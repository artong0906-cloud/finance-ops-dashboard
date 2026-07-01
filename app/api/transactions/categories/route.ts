import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth/api";
import { canUpload } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

type CategoryMode = "revenue" | "expense";

type CategoryPayload = {
  transactionIds?: unknown;
  mode?: unknown;
  category?: unknown;
  detail?: unknown;
  expenseBasis?: unknown;
};

type DbCategoryRow = {
  id: string;
  transaction_date: string | null;
  source: string | null;
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
  expense_basis: string | null;
  memo: string | null;
  upload_batch_id: string | null;
};

type RawLookupRow = {
  upload_batch_id: string | null;
  row_index: number | null;
  raw_data: Record<string, unknown> | null;
  normalized_data: Record<string, unknown> | null;
};

const revenueCategories = ["광고사업부 매출", "대외협력팀 매출", "플랫폼 매출", "정부지원금", "기타매출"] as const;
const expenseCategories = ["인재투자", "환불", "급여", "광고비", "세금", "운영비", "기타"] as const;
const talentDetails = ["인투1 집", "인투2 차", "인투3 밥", "인투4 돈", "인투5 성장", "인투6 환경"] as const;
const operatingDetails = ["일반운영비", "이자"] as const;
const transferCategory = "통장간 이동";
const genericKeywordParts = new Set([
  "-",
  "b00000",
  "b00001",
  "b00002",
  "b00003",
  "b00004",
  "b00011",
  "b00012",
  "타행이체",
  "인터넷",
  "전자망",
  "자동이체",
  "펌이체",
  "대체",
  "cc",
  "bz뱅크",
  "은행",
  "카드",
  "매출",
  "계좌이체",
  "광고사업부매출",
  "대외협력팀매출",
  "플랫폼매출",
  "영업외수익",
  "수동분류",
  "입금매출",
  "통장입금매출",
  "중복집계제외"
]);

const rawAccountKeys = ["계좌번호", "계좌", "입금계좌", "출금계좌", "통장", "account_id"];
const rawSpecificKeys = [
  "거래적요",
  "상대계정",
  "계정과목",
  "차변계정",
  "대변계정",
  "입금의뢰인",
  "출금계좌인자내용",
  "상대계좌예금주명",
  "상대예금주명",
  "거래내용",
  "내용",
  "적요",
  "비고"
];

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value);
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean))).slice(0, 500);
}

function normalizeExpenseBasis(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw === "유지") return null;
  if (raw === "비용" || raw === "비용성") return "비용성";
  if (raw === "자산" || raw === "자산성") return "자산성";
  throw new Error("비용/자산 구분이 올바르지 않습니다.");
}

function compact(value: unknown) {
  return String(value ?? "").normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

function readRecordValue(record: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(record);
  const targets = keys.map(compact);

  for (const target of targets) {
    const exact = entries.find(([key]) => compact(key) === target);
    if (exact && exact[1]) return String(exact[1]).trim();
  }

  for (const target of targets) {
    const partial = entries.find(([key, value]) => {
      const normalizedKey = compact(key);
      return value && (normalizedKey.includes(target) || target.includes(normalizedKey));
    });
    if (partial) return String(partial[1]).trim();
  }

  return "";
}

function toLookupRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function transactionLookupKey(input: {
  transaction_date?: unknown;
  amount?: unknown;
  cash_flow_type?: unknown;
  vendor?: unknown;
  description?: unknown;
}) {
  const date = String(input.transaction_date || "").slice(0, 10);
  const amount = Math.round(Math.abs(toNumber(input.amount)));
  if (!date || !amount) return "";

  return [
    date,
    amount,
    compact(input.cash_flow_type),
    compact(input.vendor),
    compact(input.description)
  ].join("|");
}

function rawLookupKey(row: RawLookupRow) {
  const rawData = toLookupRecord(row.raw_data);
  const normalizedData = toLookupRecord(row.normalized_data);

  return transactionLookupKey({
    transaction_date: normalizedData.transaction_date,
    amount: normalizedData.amount,
    cash_flow_type: normalizedData.cash_flow_type,
    vendor: normalizedData.vendor || readRecordValue(rawData, ["거래처", "가맹점명", "사용처", "받는분", "보내는분", "예금주"]),
    description: normalizedData.description || readRecordValue(rawData, ["거래적요", "적요", "내용", "거래내용"])
  });
}

function buildRawLookup(rows: RawLookupRow[]) {
  const lookup = new Map<string, RawLookupRow[]>();

  rows.forEach((row) => {
    const key = rawLookupKey(row);
    if (!key) return;
    const current = lookup.get(key) || [];
    current.push(row);
    lookup.set(key, current);
  });

  return lookup;
}

function rawRowForTransaction(row: DbCategoryRow, lookup: Map<string, RawLookupRow[]>) {
  const key = transactionLookupKey(row);
  const values = key ? lookup.get(key) : undefined;
  return values?.shift();
}

function normalizeKeywordPart(value: unknown) {
  return String(value || "").normalize("NFC").replace(/\u00a0/g, " ").trim();
}

function isGenericKeywordPart(value: string) {
  const normalized = compact(value).replace(/[()[\]{}#._-]/g, "");
  if (!normalized) return true;
  if (/^b\d{3,}$/i.test(normalized)) return true;
  return genericKeywordParts.has(normalized);
}

function uniqueUsefulParts(values: unknown[]) {
  const seen = new Set<string>();
  const parts: string[] = [];

  values.forEach((value) => {
    const part = normalizeKeywordPart(value);
    const key = compact(part);
    if (!part || seen.has(key) || isGenericKeywordPart(part)) return;
    seen.add(key);
    parts.push(part);
  });

  return parts;
}

function buildRuleKeyword(row: DbCategoryRow, rawRow?: RawLookupRow) {
  const rawData = toLookupRecord(rawRow?.raw_data);
  const normalizedData = toLookupRecord(rawRow?.normalized_data);
  const accountParts = uniqueUsefulParts([
    row.account_id,
    row.card_budget_group,
    normalizedData.account_id,
    readRecordValue(rawData, rawAccountKeys)
  ]);
  const rawSpecificParts = uniqueUsefulParts([
    readRecordValue(rawData, rawSpecificKeys),
    normalizedData.bank_classification_context
  ]);
  const rowSpecificParts = uniqueUsefulParts([
    row.vendor,
    row.description,
    row.main_category,
    row.sub_category,
    row.detail_category
  ]);

  if (accountParts.length > 0 && rawSpecificParts.length > 0) {
    return [accountParts[0], rawSpecificParts[0]].join("+");
  }
  if (rawSpecificParts.length >= 2) return rawSpecificParts.slice(0, 2).join("+");
  if (accountParts.length > 0 && rowSpecificParts.length > 0) {
    return [accountParts[0], rowSpecificParts[0]].join("+");
  }
  if (rowSpecificParts.length >= 2) return rowSpecificParts.slice(0, 2).join("+");
  if (rawSpecificParts.length === 1) return rawSpecificParts[0];
  if (rowSpecificParts.length === 1) return rowSpecificParts[0];

  return "";
}

function normalizeRevenueCategory(value: string) {
  if (value === "대외협력부 매출" || value === "대외협력팀 매출") return "대외협력팀 매출";
  return value;
}

function businessUnitForRevenue(category: string) {
  if (category === "대외협력팀 매출") return "대외협력";
  if (category === "플랫폼 매출") return "플랫폼";
  return "광고사업부";
}

function revenuePatch(category: string) {
  return {
    business_unit: businessUnitForRevenue(category),
    main_category: category === "정부지원금" || category === "기타매출" ? "영업외수익" : "매출",
    sub_category: category,
    detail_category: "수동분류",
    talent_investment_type: null,
    expense_basis: "해당없음",
    is_internal_transfer: false,
    is_common_use: false,
    common_policy: null,
    review_status: "정상"
  };
}

function transferPatch() {
  return {
    business_unit: "공통사용분",
    main_category: "계좌이체",
    sub_category: "계좌 간 이동",
    detail_category: "중복 집계 제외",
    talent_investment_type: null,
    expense_basis: "해당없음",
    is_internal_transfer: true,
    is_common_use: true,
    common_policy: null,
    review_status: "정상"
  };
}

function expensePatch(category: string, detail: string) {
  if (category === "인재투자") {
    const talentType = isOneOf(detail, talentDetails) ? detail : "인투1 집";
    return {
      main_category: "인재투자비",
      sub_category: talentType,
      detail_category: talentType,
      talent_investment_type: talentType,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "환불") {
    return {
      main_category: "매출환불",
      sub_category: "환불",
      detail_category: "환불/취소",
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "급여") {
    return {
      main_category: "인건비",
      sub_category: "급여",
      detail_category: detail || "급여",
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "광고비") {
    return {
      main_category: "광고비",
      sub_category: "매체비",
      detail_category: detail || "광고비",
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "세금") {
    return {
      main_category: "세금과공과",
      sub_category: "세금",
      detail_category: detail || "세금",
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "운영비") {
    const operatingType = isOneOf(detail, operatingDetails) ? detail : "일반운영비";
    return {
      main_category: "운영비",
      sub_category: operatingType,
      detail_category: operatingType,
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  return {
    main_category: "기타",
    sub_category: "기타",
    detail_category: detail || "기타",
    talent_investment_type: null,
    expense_basis: "비용성",
    is_internal_transfer: false,
    review_status: "정상"
  };
}

function buildPatch(mode: CategoryMode, category: string, detail: string) {
  if (category === transferCategory) {
    return transferPatch();
  }

  if (mode === "revenue") {
    const revenueCategory = normalizeRevenueCategory(category);
    if (!isOneOf(revenueCategory, revenueCategories)) {
      throw new Error("지원하지 않는 매출 카테고리입니다.");
    }
    return revenuePatch(revenueCategory);
  }

  if (!isOneOf(category, expenseCategories)) {
    throw new Error("지원하지 않는 지출 카테고리입니다.");
  }
  return expensePatch(category, detail);
}

function replaceManualMemo(currentMemo: string, manualMemo: string) {
  const preserved = currentMemo
    .split(" / ")
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("수동분류:"));

  return [...preserved, manualMemo].join(" / ");
}

async function fetchRawRowsForTransactions(admin: ReturnType<typeof createAdminClient>, rows: DbCategoryRow[]) {
  const batchIds = Array.from(new Set(rows.map((row) => row.upload_batch_id).filter((id): id is string => Boolean(id))));
  if (batchIds.length === 0) return [];

  const { data, error } = await admin
    .from("upload_raw_rows")
    .select("upload_batch_id,row_index,raw_data,normalized_data")
    .in("upload_batch_id", batchIds);

  if (error) return [];
  return (data || []) as RawLookupRow[];
}

function mappingRuleForRow(
  row: DbCategoryRow,
  keyword: string,
  patch: Record<string, string | boolean | null | undefined>,
  category: string,
  detail: string,
  expenseBasis: string | null
) {
  const businessUnit = String(patch.business_unit || row.business_unit || "").trim() || null;
  const mainCategory = String(patch.main_category || row.main_category || "").trim() || null;
  const subCategory = String(patch.sub_category || row.sub_category || "").trim() || null;
  const detailCategory = String(patch.detail_category || row.detail_category || detail || "").trim() || null;
  const nextExpenseBasis = String(patch.expense_basis || expenseBasis || row.expense_basis || "").trim() || null;

  return {
    rule_name: `수동분류 ${category} - ${keyword.slice(0, 36)}`,
    source: row.source || null,
    keyword,
    business_unit: businessUnit,
    main_category: mainCategory,
    sub_category: subCategory,
    detail_category: detailCategory,
    expense_basis: nextExpenseBasis,
    priority: 5,
    is_active: true
  };
}

function mappingRuleKey(rule: {
  source: string | null;
  keyword: string;
  business_unit: string | null;
  main_category: string | null;
  sub_category: string | null;
  detail_category: string | null;
  expense_basis: string | null;
}) {
  return [
    rule.source || "",
    rule.keyword,
    rule.business_unit || "",
    rule.main_category || "",
    rule.sub_category || "",
    rule.detail_category || "",
    rule.expense_basis || ""
  ].map(compact).join("|");
}

async function saveAccumulatedRules(
  admin: ReturnType<typeof createAdminClient>,
  rows: DbCategoryRow[],
  patch: Record<string, string | boolean | null | undefined>,
  category: string,
  detail: string,
  expenseBasis: string | null
) {
  const rawRows = await fetchRawRowsForTransactions(admin, rows);
  const rawLookup = buildRawLookup(rawRows);
  const rules = rows
    .map((row) => {
      const rawRow = rawRowForTransaction(row, rawLookup);
      const keyword = buildRuleKeyword(row, rawRow);
      return keyword ? mappingRuleForRow(row, keyword, patch, category, detail, expenseBasis) : null;
    })
    .filter((rule): rule is NonNullable<ReturnType<typeof mappingRuleForRow>> => Boolean(rule));

  if (rules.length === 0) return 0;

  const deduped = Array.from(new Map(rules.map((rule) => [mappingRuleKey(rule), rule])).values());
  const keywords = Array.from(new Set(deduped.map((rule) => rule.keyword)));
  const { data: existingRows } = await admin
    .from("mapping_rules")
    .select("source,keyword,business_unit,main_category,sub_category,detail_category,expense_basis")
    .eq("is_active", true)
    .in("keyword", keywords);
  const existingKeys = new Set(((existingRows || []) as Array<{
    source: string | null;
    keyword: string;
    business_unit: string | null;
    main_category: string | null;
    sub_category: string | null;
    detail_category: string | null;
    expense_basis: string | null;
  }>).map(mappingRuleKey));
  const newRules = deduped.filter((rule) => !existingKeys.has(mappingRuleKey(rule)));

  if (newRules.length === 0) return 0;

  const { error } = await admin.from("mapping_rules").insert(newRules);
  if (error) throw error;
  return newRules.length;
}

export async function PATCH(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  if (!canUpload(profileResult.profile.role)) {
    return NextResponse.json({ error: "카테고리 변경은 admin 또는 finance 권한만 가능합니다." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CategoryPayload;
    const transactionIds = normalizeIds(body.transactionIds);
    const mode = String(body.mode || "") as CategoryMode;
    const rawCategory = String(body.category || "").trim();
    const category = mode === "revenue" ? normalizeRevenueCategory(rawCategory) : rawCategory;
    const detail = String(body.detail || "").trim();
    const expenseBasis = normalizeExpenseBasis(body.expenseBasis);

    if (transactionIds.length === 0) {
      return NextResponse.json({ error: "선택된 거래가 없습니다." }, { status: 400 });
    }
    if (mode !== "revenue" && mode !== "expense") {
      return NextResponse.json({ error: "카테고리 변경 모드가 올바르지 않습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const patch: Record<string, string | boolean | null | undefined> = { ...buildPatch(mode, category, detail) };
    if (mode === "expense" && category !== transferCategory) {
      if (expenseBasis) {
        patch.expense_basis = expenseBasis;
      } else {
        delete patch.expense_basis;
      }
    }
    const manualMemo = `수동분류:${category}${detail ? `:${detail}` : ""}${expenseBasis ? `:${expenseBasis}` : ""}`;

    const { data: existingRows, error: fetchError } = await admin
      .from("transactions")
      .select("id,transaction_date,source,business_unit,account_id,card_budget_group,vendor,description,amount,cash_flow_type,main_category,sub_category,detail_category,expense_basis,memo,upload_batch_id")
      .in("id", transactionIds);

    if (fetchError) throw fetchError;

    let updatedCount = 0;
    const categoryRows = (existingRows || []) as DbCategoryRow[];
    const savedRuleCount = await saveAccumulatedRules(admin, categoryRows, patch, category, detail, expenseBasis);

    for (const row of categoryRows) {
      const currentMemo = String(row.memo || "");
      const memo = replaceManualMemo(currentMemo, manualMemo);

      const { error } = await admin
        .from("transactions")
        .update({
          ...patch,
          memo,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);

      if (error) throw error;
      updatedCount += 1;
    }

    revalidateTag("dashboard-data", { expire: 0 });
    ["/dashboard", "/revenue", "/expenses", "/bank", "/cards", "/balance", "/uploads"].forEach((path) => {
      revalidatePath(path);
    });

    return NextResponse.json({ ok: true, updatedCount, savedRuleCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "카테고리 변경 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
