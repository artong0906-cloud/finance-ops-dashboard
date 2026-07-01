import { NextResponse, type NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth/api";
import { canUpload } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DbTransactionRow = {
  id: string;
  upload_batch_id: string | null;
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
  journal_status: string | null;
  review_status: string | null;
  memo: string | null;
};

type DbRawUploadRow = {
  id: string;
  upload_batch_id: string | null;
  row_index: number | string | null;
  raw_data: Record<string, unknown> | null;
  normalized_data: Record<string, unknown> | null;
  parse_status: string | null;
  memo: string | null;
};

type DbUploadBatch = {
  id: string;
  file_name: string | null;
  upload_type: string | null;
};

type ReviewCsvRow = {
  kind: string;
  transactionId: string;
  rawRowId: string;
  uploadFile: string;
  uploadType: string;
  rowIndex: string | number;
  date: string;
  source: string;
  vendor: string;
  description: string;
  amount: string | number;
  cashFlowType: string;
  keyword: string;
  businessUnit: string;
  mainCategory: string;
  subCategory: string;
  detailCategory: string;
  expenseBasis: string;
  priority: number;
  reviewStatus: string;
  memo: string;
  rawSummary: string;
};

const csvHeaders = [
  "구분",
  "거래ID",
  "원본행ID",
  "업로드파일",
  "업로드유형",
  "원본행번호",
  "일자",
  "원천",
  "거래처",
  "적요",
  "금액",
  "현금흐름",
  "기준키워드",
  "사업부",
  "대분류",
  "중분류",
  "세부항목",
  "비용구분",
  "우선순위",
  "검증상태",
  "메모",
  "원본요약"
];

function monthDateRange(month: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;

  const [year, monthIndex] = month.split("-").map(Number);
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  const nextYear = monthIndex === 12 ? year + 1 : year;

  return {
    start: `${month}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function readRecordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeText(record[key]);
    if (value) return value;
  }

  return "";
}

function isReviewNeeded(row: DbTransactionRow) {
  const reviewStatus = normalizeText(row.review_status);
  const journalStatus = normalizeText(row.journal_status);
  const businessUnit = normalizeText(row.business_unit);

  return (
    reviewStatus !== "정상" ||
    journalStatus === "미분개" ||
    businessUnit.includes("미배")
  );
}

function rawRowMonth(row: DbRawUploadRow) {
  const normalized = row.normalized_data || {};
  const raw = row.raw_data || {};
  const values = [
    normalized.month,
    normalized.detected_month,
    normalized.transaction_date,
    normalized.date,
    raw.__detectedMonth,
    raw.month,
    raw["월"],
    raw["기준월"],
    raw["집계월"],
    raw["거래일자"],
    raw["일자"],
    raw["날짜"]
  ];

  for (const value of values) {
    const text = normalizeText(value);
    if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7);

    const match = text.match(/(20\d{2}|19\d{2})[.\-/\s년]*(\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}`;
  }

  return "";
}

function rawRowNeedsCsv(row: DbRawUploadRow, month: string | null) {
  if (month && rawRowMonth(row) !== month) return false;
  if (normalizeText(row.parse_status) === "정상") return false;

  const normalized = row.normalized_data || {};
  const hasTransactionShape = Boolean(normalized.transaction_date && normalized.amount);

  return !hasTransactionShape;
}

function rawSummary(rawData: Record<string, unknown> | null) {
  return Object.entries(rawData || {})
    .filter(([, value]) => normalizeText(value))
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${normalizeText(value)}`)
    .join(" / ");
}

function buildRuleKeyword(values: Array<unknown>) {
  const parts = values
    .map(normalizeText)
    .filter((value) => value && value !== "-")
    .slice(0, 2);

  return parts.join("+");
}

async function fetchTransactions(admin: ReturnType<typeof createAdminClient>, month: string | null) {
  const rows: DbTransactionRow[] = [];
  const pageSize = 1000;
  const range = monthDateRange(month);

  for (let from = 0; from < 20000; from += pageSize) {
    let query = admin
      .from("transactions")
      .select("id,upload_batch_id,transaction_date,source,business_unit,account_id,card_budget_group,vendor,description,amount,cash_flow_type,main_category,sub_category,detail_category,expense_basis,journal_status,review_status,memo")
      .order("transaction_date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (range) {
      query = query.gte("transaction_date", range.start).lt("transaction_date", range.end);
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data || []) as DbTransactionRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.filter(isReviewNeeded);
}

async function fetchRawRows(admin: ReturnType<typeof createAdminClient>, month: string | null) {
  const rows: DbRawUploadRow[] = [];
  const pageSize = 1000;

  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await admin
      .from("upload_raw_rows")
      .select("id,upload_batch_id,row_index,raw_data,normalized_data,parse_status,memo")
      .neq("parse_status", "정상")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const page = (data || []) as DbRawUploadRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.filter((row) => rawRowNeedsCsv(row, month));
}

async function fetchBatchMap(admin: ReturnType<typeof createAdminClient>, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, DbUploadBatch>();

  const { data, error } = await admin
    .from("upload_batches")
    .select("id,file_name,upload_type")
    .in("id", uniqueIds);

  if (error) throw error;

  return new Map((data || []).map((row) => [String(row.id), row as DbUploadBatch]));
}

function transactionToCsvRow(row: DbTransactionRow, batchMap: Map<string, DbUploadBatch>): ReviewCsvRow {
  const batch = row.upload_batch_id ? batchMap.get(row.upload_batch_id) : null;

  return {
    kind: "거래",
    transactionId: row.id,
    rawRowId: "",
    uploadFile: batch?.file_name || "",
    uploadType: batch?.upload_type || "",
    rowIndex: "",
    date: normalizeText(row.transaction_date),
    source: normalizeText(row.source),
    vendor: normalizeText(row.vendor),
    description: normalizeText(row.description),
    amount: row.amount ?? "",
    cashFlowType: normalizeText(row.cash_flow_type),
    keyword: buildRuleKeyword([row.vendor, row.description, row.account_id, row.card_budget_group]),
    businessUnit: normalizeText(row.business_unit) === "미배분" ? "" : normalizeText(row.business_unit),
    mainCategory: normalizeText(row.main_category) === "미분류" ? "" : normalizeText(row.main_category),
    subCategory: normalizeText(row.sub_category) === "미분류" ? "" : normalizeText(row.sub_category),
    detailCategory: normalizeText(row.detail_category) === "미분류" ? "" : normalizeText(row.detail_category),
    expenseBasis: normalizeText(row.expense_basis) === "해당없음" ? "" : normalizeText(row.expense_basis),
    priority: 10,
    reviewStatus: normalizeText(row.review_status) || "확인필요",
    memo: normalizeText(row.memo),
    rawSummary: ""
  };
}

function rawToCsvRow(row: DbRawUploadRow, batchMap: Map<string, DbUploadBatch>): ReviewCsvRow {
  const batch = row.upload_batch_id ? batchMap.get(row.upload_batch_id) : null;
  const normalized = row.normalized_data || {};
  const raw = row.raw_data || {};
  const vendor = readRecordValue(normalized, ["vendor", "거래처"]) || readRecordValue(raw, ["거래처", "가맹점", "사용처", "적요"]);
  const description = readRecordValue(normalized, ["description", "적요"]) || readRecordValue(raw, ["적요", "내용", "비고", "거래내용"]);

  return {
    kind: "원본행",
    transactionId: "",
    rawRowId: row.id,
    uploadFile: batch?.file_name || "",
    uploadType: batch?.upload_type || "",
    rowIndex: row.row_index || "",
    date: readRecordValue(normalized, ["transaction_date", "date"]) || readRecordValue(raw, ["거래일자", "일자", "날짜"]),
    source: readRecordValue(normalized, ["source"]) || batch?.upload_type || "",
    vendor,
    description,
    amount: readRecordValue(normalized, ["amount"]) || readRecordValue(raw, ["금액", "입금", "출금", "사용금액"]),
    cashFlowType: readRecordValue(normalized, ["cash_flow_type"]) || "",
    keyword: buildRuleKeyword([vendor, description, rawSummary(raw)]),
    businessUnit: "",
    mainCategory: "",
    subCategory: "",
    detailCategory: "",
    expenseBasis: "",
    priority: 10,
    reviewStatus: normalizeText(row.parse_status) || "확인필요",
    memo: normalizeText(row.memo),
    rawSummary: rawSummary(raw)
  };
}

function buildCsv(rows: ReviewCsvRow[]) {
  const body = rows.map((row) => [
    row.kind,
    row.transactionId,
    row.rawRowId,
    row.uploadFile,
    row.uploadType,
    row.rowIndex,
    row.date,
    row.source,
    row.vendor,
    row.description,
    row.amount,
    row.cashFlowType,
    row.keyword,
    row.businessUnit,
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.expenseBasis,
    row.priority,
    row.reviewStatus,
    row.memo,
    row.rawSummary
  ]);

  return `\ufeff${[csvHeaders, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
}

export async function GET(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  if (!canUpload(profileResult.profile.role)) {
    return NextResponse.json({ error: "확인필요 CSV 다운로드는 관리자 권한이 필요합니다." }, { status: 403 });
  }

  const month = request.nextUrl.searchParams.get("month");
  const safeMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : null;

  try {
    const admin = createAdminClient();
    const [transactions, rawRows] = await Promise.all([
      fetchTransactions(admin, safeMonth),
      fetchRawRows(admin, safeMonth)
    ]);
    const batchIds = [
      ...transactions.map((row) => row.upload_batch_id || ""),
      ...rawRows.map((row) => row.upload_batch_id || "")
    ];
    const batchMap = await fetchBatchMap(admin, batchIds);
    const csvRows = [
      ...transactions.map((row) => transactionToCsvRow(row, batchMap)),
      ...rawRows.map((row) => rawToCsvRow(row, batchMap))
    ];

    if (csvRows.length === 0) {
      return NextResponse.json({ error: "다운로드할 확인필요 거래가 없습니다." }, { status: 404 });
    }

    const filename = `financeops-review-rules-${safeMonth || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(buildCsv(csvRows), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Review-Count": String(csvRows.length)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "확인필요 CSV 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
