import Papa from "papaparse";
import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getApiUser } from "@/lib/auth/api";
import { canUpload } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyFirstPass, type FirstPassInput, type UserMappingRule } from "@/services/classification/firstPass";

type RuleImportPayload = {
  csvText?: string;
  rows?: Record<string, unknown>[];
};

type DbTransactionRow = {
  id: string;
  source: string;
  business_unit: string | null;
  account_id: string | null;
  card_budget_group: string | null;
  vendor: string | null;
  description: string | null;
  amount: number | string | null;
  cash_flow_type: string | null;
  main_category: string | null;
  sub_category: string | null;
  detail_category: string | null;
  talent_investment_type: string | null;
  expense_basis: string | null;
  is_internal_transfer: boolean | null;
  is_common_use: boolean | null;
  common_policy: string | null;
  review_status: string | null;
  memo: string | null;
};

const businessUnits = ["광고사업부", "플랫폼", "대외협력", "공통사용분", "미배분"];
const sources = ["은행", "카드", "파로스", "수기입력"];

function normalizeKey(value: string) {
  return String(value || "").replace(/^\ufeff/, "").replace(/\s+/g, "").toLowerCase();
}

function pick(row: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(row);
  const targets = keys.map(normalizeKey);

  for (const target of targets) {
    const exact = entries.find(([key]) => normalizeKey(key) === target);
    if (exact) return String(exact[1] ?? "").trim();
  }

  return "";
}

function normalizeBusinessUnit(value: string) {
  const raw = value.trim();
  return businessUnits.find((unit) => raw.includes(unit)) || "";
}

function normalizeSource(value: string) {
  const raw = value.trim();
  return sources.find((source) => raw.includes(source)) || "";
}

function normalizeExpenseBasis(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (raw === "비용" || raw === "비용성") return "비용성";
  if (raw === "자산" || raw === "자산성") return "자산성";
  if (raw === "해당없음") return "해당없음";
  return "";
}

function parseRows(payload: RuleImportPayload) {
  if (Array.isArray(payload.rows)) {
    return payload.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  }

  const csvText = String(payload.csvText || "").trim();
  if (!csvText) return [];

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message || "기준 CSV를 읽는 중 오류가 발생했습니다.");
  }

  return parsed.data || [];
}

function toRule(row: Record<string, unknown>, index: number) {
  const keyword = pick(row, ["기준키워드", "키워드", "keyword", "rule_keyword"]);
  if (!keyword) return null;

  const businessUnit = normalizeBusinessUnit(pick(row, ["사업부", "business_unit"]));
  const mainCategory = pick(row, ["대분류", "main_category"]);
  const subCategory = pick(row, ["중분류", "sub_category"]);
  const detailCategory = pick(row, ["세부항목", "세부분류", "detail_category"]);
  const expenseBasis = normalizeExpenseBasis(pick(row, ["비용구분", "비용/자산", "expense_basis"]));

  if (!businessUnit && !mainCategory && !subCategory && !detailCategory && !expenseBasis) return null;

  const source = normalizeSource(pick(row, ["원천", "source"]));
  const priority = Number(pick(row, ["우선순위", "priority"]) || 10);

  return {
    rule_name: pick(row, ["규칙명", "rule_name"]) || `검증기준 ${index + 1}`,
    source: source || null,
    keyword,
    business_unit: businessUnit || null,
    main_category: mainCategory || null,
    sub_category: subCategory || null,
    detail_category: detailCategory || null,
    expense_basis: expenseBasis || null,
    priority: Number.isFinite(priority) ? priority : 10,
    is_active: true
  };
}

async function fetchActiveMappingRules(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("mapping_rules")
    .select("rule_name,source,keyword,business_unit,main_category,sub_category,detail_category,expense_basis,priority,created_at")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as UserMappingRule[];
}

function toFirstPassInput(row: DbTransactionRow): FirstPassInput {
  return {
    source: row.source,
    businessUnit: row.business_unit,
    accountId: row.account_id,
    cardBudgetGroup: row.card_budget_group,
    vendor: row.vendor,
    description: row.description,
    amount: row.amount,
    cashFlowType: row.cash_flow_type,
    mainCategory: row.main_category,
    subCategory: row.sub_category,
    detailCategory: row.detail_category,
    talentInvestmentType: row.talent_investment_type,
    expenseBasis: row.expense_basis,
    isInternalTransfer: row.is_internal_transfer,
    isCommonUse: row.is_common_use,
    commonPolicy: row.common_policy,
    reviewStatus: row.review_status,
    memo: row.memo
  };
}

async function fetchTransactions(admin: ReturnType<typeof createAdminClient>) {
  const pageSize = 1000;
  const rows: DbTransactionRow[] = [];

  for (let from = 0; from < 10000; from += pageSize) {
    const { data, error } = await admin
      .from("transactions")
      .select("id,source,business_unit,account_id,card_budget_group,vendor,description,amount,cash_flow_type,main_category,sub_category,detail_category,talent_investment_type,expense_basis,is_internal_transfer,is_common_use,common_policy,review_status,memo")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const page = (data || []) as DbTransactionRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function reapplyRules(admin: ReturnType<typeof createAdminClient>, rules: UserMappingRule[]) {
  const transactions = await fetchTransactions(admin);
  let updatedCount = 0;

  for (const row of transactions) {
    const result = classifyFirstPass(toFirstPassInput(row), rules);
    if (!result.matchedRule.startsWith("user-mapping-rule:")) continue;

    const { error } = await admin
      .from("transactions")
      .update({
        business_unit: result.businessUnit,
        main_category: result.mainCategory,
        sub_category: result.subCategory,
        detail_category: result.detailCategory,
        expense_basis: result.expenseBasis,
        is_internal_transfer: result.isInternalTransfer,
        is_common_use: result.isCommonUse,
        common_policy: result.commonPolicy || null,
        review_status: "정상",
        memo: row.memo?.includes(result.matchedRule) ? row.memo : [row.memo, `사용자 기준 적용: ${result.matchedRule}`].filter(Boolean).join(" / "),
        updated_at: new Date().toISOString()
      })
      .eq("id", row.id);

    if (error) throw error;
    updatedCount += 1;
  }

  return updatedCount;
}

export async function POST(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  if (!canUpload(profileResult.profile.role)) {
    return NextResponse.json({ error: "기준 반영은 admin 또는 finance 권한만 가능합니다." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as RuleImportPayload;
    const rows = parseRows(body);
    const rules = rows.map(toRule).filter((rule): rule is NonNullable<ReturnType<typeof toRule>> => Boolean(rule));

    if (rules.length === 0) {
      return NextResponse.json({ error: "반영할 기준이 없습니다. 기준키워드와 최소 1개 분류값을 입력해 주세요." }, { status: 400 });
    }

    const admin = createAdminClient();

    for (let i = 0; i < rules.length; i += 500) {
      const { error } = await admin.from("mapping_rules").insert(rules.slice(i, i + 500));
      if (error) throw error;
    }

    const activeRules = await fetchActiveMappingRules(admin);
    const updatedCount = await reapplyRules(admin, activeRules);

    revalidateTag("dashboard-data", { expire: 0 });

    return NextResponse.json({
      ok: true,
      importedCount: rules.length,
      updatedCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "기준 반영 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
