import { unstable_cache } from "next/cache";
import { bankAccounts as mockBankAccounts, transactions as mockTransactions } from "@/data/mock";
import { mayBalanceMovements } from "@/data/mayBalanceSnapshot";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyFirstPass, type UserMappingRule } from "@/services/classification/firstPass";
import type { BalanceMovement, BankAccount, Transaction } from "@/types/finance";

type DbTransaction = {
  id: string;
  upload_batch_id: string | null;
  transaction_date: string;
  source: string;
  business_unit: string;
  account_id: string | null;
  card_budget_group: string | null;
  vendor: string | null;
  description: string | null;
  amount: number | string;
  cash_flow_type: string;
  main_category: string | null;
  sub_category: string | null;
  detail_category: string | null;
  talent_investment_type: string | null;
  expense_basis: string | null;
  is_internal_transfer: boolean | null;
  is_common_use: boolean | null;
  common_policy: string | null;
  journal_status: string | null;
  journal_business_unit: string | null;
  review_status: string | null;
  memo: string | null;
};

type DbBankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_no_masked: string;
  business_unit: string;
  purpose: string | null;
};

type DbBalanceMovement = {
  id: string;
  month: string;
  statement_type: string;
  category: string;
  opening_amount: number | string;
  increase_amount: number | string;
  decrease_amount: number | string;
  memo: string | null;
};

type DbRawUploadRow = {
  upload_batch_id: string;
  row_index: number;
  raw_data: Record<string, unknown> | null;
  normalized_data: Record<string, unknown> | null;
};

type DbMappingRule = UserMappingRule;
type BankRawContext = {
  context: string;
  displayDescription?: string;
};

async function fetchAllTransactions(admin: ReturnType<typeof createAdminClient>) {
  const pageSize = 1000;
  const rows: DbTransaction[] = [];

  for (let from = 0; from < 10000; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .range(from, to);

    if (error) return { data: rows, error };

    const page = (data || []) as DbTransaction[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return { data: rows, error: null };
}

function monthDateRange(month: string | null | undefined) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;

  const [year, monthIndex] = month.split("-").map(Number);
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  const nextYear = monthIndex === 12 ? year + 1 : year;

  return {
    start: `${month}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  };
}

async function fetchTransactionMonths(admin: ReturnType<typeof createAdminClient>) {
  const pageSize = 1000;
  const rows: Pick<DbTransaction, "transaction_date">[] = [];

  for (let from = 0; from < 10000; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("transactions")
      .select("transaction_date")
      .order("transaction_date", { ascending: false })
      .range(from, to);

    if (error) return { data: rows, error };

    const page = (data || []) as Pick<DbTransaction, "transaction_date">[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return { data: rows, error: null };
}

async function fetchTransactionsForMonth(admin: ReturnType<typeof createAdminClient>, month: string | null) {
  const pageSize = 1000;
  const rows: DbTransaction[] = [];
  const range = monthDateRange(month);

  for (let from = 0; from < 10000; from += pageSize) {
    const to = from + pageSize - 1;
    let query = admin
      .from("transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .range(from, to);

    if (range) {
      query = query.gte("transaction_date", range.start).lt("transaction_date", range.end);
    }

    const { data, error } = await query;

    if (error) return { data: rows, error };

    const page = (data || []) as DbTransaction[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return { data: rows, error: null };
}

async function fetchAllRawRowsForBatches(admin: ReturnType<typeof createAdminClient>, batchIds: string[], month?: string | null, allowFallback = true) {
  if (batchIds.length === 0) return [] as DbRawUploadRow[];

  const pageSize = 1000;
  const rows: DbRawUploadRow[] = [];
  const range = monthDateRange(month);

  for (let from = 0; from < 10000; from += pageSize) {
    const to = from + pageSize - 1;
    let query = admin
      .from("upload_raw_rows")
      .select("upload_batch_id,row_index,raw_data,normalized_data")
      .in("upload_batch_id", batchIds)
      .order("row_index", { ascending: true })
      .range(from, to);

    if (range) {
      query = query.gte("normalized_data->>transaction_date", range.start).lt("normalized_data->>transaction_date", range.end);
    }

    const { data, error } = await query;

    if (error) return rows;

    const page = (data || []) as DbRawUploadRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  if (range && rows.length === 0 && allowFallback) {
    return fetchAllRawRowsForBatches(admin, batchIds, null, false);
  }

  return rows;
}

export type UploadBatchSummary = {
  id: string;
  uploadType: string;
  fileName: string;
  status: string;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type RawRowSample = {
  id: string;
  rowIndex: number;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown> | null;
  parseStatus: string;
  memo: string | null;
};

export type DashboardData = {
  mode: "live" | "mock";
  currentMonth: string | null;
  availableMonths: string[];
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  balanceMovements: BalanceMovement[];
  uploadBatches: UploadBatchSummary[];
  rawRows: RawRowSample[];
  rawRowCount: number;
};

function toNumber(value: number | string | null | undefined) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function parseAmountText(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return 0;

  const isNegative = /^\(.*\)$/.test(raw);
  const normalized = raw
    .replace(/₩/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[()]/g, "")
    .replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) return 0;
  return isNegative ? -Math.abs(amount) : amount;
}

function compactLookup(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function readRecordValue(record: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(record);
  const targets = keys.map(compactLookup);

  for (const target of targets) {
    const exact = entries.find(([key]) => compactLookup(key) === target);
    if (exact && exact[1]) return String(exact[1]).trim();
  }

  for (const target of targets) {
    const partial = entries.find(([key, value]) => {
      const normalizedKey = compactLookup(key);
      return value && (normalizedKey.includes(target) || target.includes(normalizedKey));
    });
    if (partial) return String(partial[1]).trim();
  }

  return "";
}

function readExactRecordValue(record: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(record);
  const targets = keys.map(compactLookup);

  for (const target of targets) {
    const exact = entries.find(([key]) => compactLookup(key) === target);
    if (exact && exact[1]) return String(exact[1]).trim();
  }

  return "";
}

function toLookupRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const rawCardIssuerKeys = ["카드사", "카드회사", "카드사/사용자", "card_budget_group"];
const rawVendorKeys = ["거래처", "가맹점명", "사용처", "상호", "업체명", "vendor"];
const rawDescriptionKeys = ["거래적요", "적요", "거래내용", "내용", "메모", "description"];
const rawBalanceKeys = ["거래후 잔액", "거래후잔액", "거래 후 잔액", "거래 잔액", "잔액", "현재잔액", "balance"];
const rawBankAccountKeys = ["계좌", "계좌번호", "입금계좌", "출금계좌", "통장", "account_id", "sheet_name"];
const rawBankContextKeys = [
  "__sheetName",
  "거래적요",
  "상대계정",
  "계정과목",
  "차변계정",
  "대변계정",
  "거래내용",
  "내용",
  "적요",
  "메모",
  "메모_2",
  "비고",
  "의뢰인/수취인",
  "입금의뢰인",
  "출금계좌인자내용",
  "상대계좌예금주명",
  "상대예금주명",
  "상대계좌번호",
  "입금인코드",
  "거래점명",
  "거래점"
];
const rawBankDisplayDescriptionKeys = [
  "거래적요",
  "입금의뢰인",
  "출금계좌인자내용",
  "상대계좌예금주명",
  "상대예금주명",
  "거래내용",
  "적요"
];
const knownBankAccountIds = new Set([
  "BANK_AD_001",
  "BANK_PLATFORM_001",
  "BANK_PLATFORM_REVENUE_001",
  "BANK_PARTNER_001",
  "BANK_PARTNER_IBK_001",
  "BANK_COMMON_001",
  "BANK_CMA_001"
]);

function transactionLookupKey(input: {
  date?: unknown;
  amount?: unknown;
  cashFlowType?: unknown;
  vendor?: unknown;
  description?: unknown;
}) {
  const date = String(input.date || "").slice(0, 10);
  const amount = Math.round(Math.abs(toNumber(input.amount as number | string | null | undefined)));
  if (!date || !amount) return "";

  return [
    date,
    amount,
    compactLookup(input.cashFlowType),
    compactLookup(input.vendor),
    compactLookup(input.description)
  ].join("|");
}

function buildCardIssuerLookup(rawRows: DbRawUploadRow[]) {
  const lookup = new Map<string, string[]>();

  rawRows.forEach((rawRow) => {
    const rawData = toLookupRecord(rawRow.raw_data);
    const normalizedData = toLookupRecord(rawRow.normalized_data);
    const cardIssuer = readRecordValue(rawData, rawCardIssuerKeys);
    if (!cardIssuer) return;

    const key = transactionLookupKey({
      date: normalizedData.transaction_date,
      amount: normalizedData.amount,
      cashFlowType: normalizedData.cash_flow_type || "출금",
      vendor: normalizedData.vendor || readRecordValue(rawData, rawVendorKeys),
      description: normalizedData.description || readRecordValue(rawData, rawDescriptionKeys)
    });
    if (!key) return;

    const current = lookup.get(key) || [];
    current.push(cardIssuer);
    lookup.set(key, current);
  });

  return lookup;
}

function readContextValues(record: Record<string, unknown>, keys: string[]) {
  return Array.from(new Set(
    keys
      .map((key) => readRecordValue(record, [key]))
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )).join(" ");
}

function buildBankRawContextLookup(rawRows: DbRawUploadRow[]) {
  const lookup = new Map<string, BankRawContext[]>();

  rawRows.forEach((rawRow) => {
    const rawData = toLookupRecord(rawRow.raw_data);
    const normalizedData = toLookupRecord(rawRow.normalized_data);
    const sourceType = String(normalizedData.detected_upload_type || "").toLowerCase();
    if (sourceType && sourceType !== "bank") return;

    const key = transactionLookupKey({
      date: normalizedData.transaction_date,
      amount: normalizedData.amount,
      cashFlowType: normalizedData.cash_flow_type || "입금",
      vendor: normalizedData.vendor || readRecordValue(rawData, rawVendorKeys),
      description: normalizedData.description || readRecordValue(rawData, rawDescriptionKeys)
    });
    if (!key) return;

    const context = readContextValues(rawData, rawBankContextKeys);
    const displayDescription = readRecordValue(rawData, rawBankDisplayDescriptionKeys);
    if (!context && !displayDescription) return;

    const current = lookup.get(key) || [];
    current.push({ context, displayDescription: displayDescription || undefined });
    lookup.set(key, current);
  });

  return lookup;
}

function consumeCardIssuer(row: DbTransaction, lookup?: Map<string, string[]>) {
  if (!lookup || row.source !== "카드") return undefined;

  const key = transactionLookupKey({
    date: row.transaction_date,
    amount: row.amount,
    cashFlowType: row.cash_flow_type,
    vendor: row.vendor,
    description: row.description
  });
  const values = key ? lookup.get(key) : undefined;
  return values?.shift();
}

function consumeBankRawContext(row: DbTransaction, lookup?: Map<string, BankRawContext[]>) {
  if (!lookup || row.source !== "은행") return undefined;

  const key = transactionLookupKey({
    date: row.transaction_date,
    amount: row.amount,
    cashFlowType: row.cash_flow_type,
    vendor: row.vendor,
    description: row.description
  });
  const values = key ? lookup.get(key) : undefined;
  return values?.shift();
}

function inferBankAccountIdFromRawRow(rawRow: DbRawUploadRow) {
  const rawData = toLookupRecord(rawRow.raw_data);
  const normalizedData = toLookupRecord(rawRow.normalized_data);
  const sheetName = readRecordValue(rawData, ["__sheetName"]);
  const accountHint = [
    normalizedData.account_id,
    normalizedData.sheet_name,
    readExactRecordValue(rawData, rawBankAccountKeys),
    sheetName
  ].filter(Boolean).join(" ");
  const firstPass = classifyFirstPass({
    source: "은행",
    memo: accountHint
  });

  return firstPass.accountId && knownBankAccountIds.has(firstPass.accountId)
    ? firstPass.accountId
    : undefined;
}

function derivedBankAccounts(): BankAccount[] {
  return [
    {
      id: "BANK_PARTNER_IBK_001",
      bankName: "기업은행",
      accountName: "대협팀 계좌",
      maskedNo: "***4023",
      businessUnit: "대외협력",
      purpose: "대외협력팀 매출/운영",
      previousBalance: 0,
      currentBalance: 0
    },
    {
      id: "BANK_PLATFORM_REVENUE_001",
      bankName: "광주은행",
      accountName: "플랫폼 매출 계좌",
      maskedNo: "***6235",
      businessUnit: "플랫폼",
      purpose: "플랫폼 매출",
      previousBalance: 0,
      currentBalance: 0
    },
    {
      id: "BANK_CMA_001",
      bankName: "한국투자증권",
      accountName: "한투CMA",
      maskedNo: "***CMA",
      businessUnit: "공통사용분",
      purpose: "CMA 현금성자산",
      previousBalance: 0,
      currentBalance: 0
    }
  ];
}

function ensureDerivedBankAccounts(accounts: BankAccount[]) {
  const ids = new Set(accounts.map((account) => account.id));
  return [
    ...accounts,
    ...derivedBankAccounts().filter((account) => !ids.has(account.id))
  ];
}

function buildBankAccountLookup(rawRows: DbRawUploadRow[]) {
  const lookup = new Map<string, string[]>();

  rawRows.forEach((rawRow) => {
    const rawData = toLookupRecord(rawRow.raw_data);
    const normalizedData = toLookupRecord(rawRow.normalized_data);
    const sourceType = String(normalizedData.detected_upload_type || "").toLowerCase();
    if (sourceType && sourceType !== "bank") return;

    const accountId = inferBankAccountIdFromRawRow(rawRow);
    if (!accountId) return;

    const key = transactionLookupKey({
      date: normalizedData.transaction_date,
      amount: normalizedData.amount,
      cashFlowType: normalizedData.cash_flow_type || "출금",
      vendor: normalizedData.vendor || readRecordValue(rawData, rawVendorKeys),
      description: normalizedData.description || readRecordValue(rawData, rawDescriptionKeys)
    });
    if (!key) return;

    const current = lookup.get(key) || [];
    current.push(accountId);
    lookup.set(key, current);
  });

  return lookup;
}

function consumeBankAccount(row: DbTransaction, lookup?: Map<string, string[]>) {
  if (row.account_id) return row.account_id;
  if (!lookup || row.source !== "은행") return undefined;

  const key = transactionLookupKey({
    date: row.transaction_date,
    amount: row.amount,
    cashFlowType: row.cash_flow_type,
    vendor: row.vendor,
    description: row.description
  });
  const values = key ? lookup.get(key) : undefined;
  return values?.shift();
}

function bankBalanceBucketKey(rawRow: DbRawUploadRow, accountId: string) {
  const rawData = toLookupRecord(rawRow.raw_data);
  const normalizedData = toLookupRecord(rawRow.normalized_data);
  const sheetName = readRecordValue(rawData, ["__sheetName"]) || String(normalizedData.sheet_name || "");
  const accountHint = String(normalizedData.account_id || "").trim();

  return [accountId, accountHint || sheetName || rawRow.upload_batch_id].filter(Boolean).join("::");
}

function rawRowMonth(rawRow: DbRawUploadRow) {
  const normalizedData = toLookupRecord(rawRow.normalized_data);
  const transactionDate = String(normalizedData.transaction_date || "");
  if (transactionDate.length >= 7) return transactionDate.slice(0, 7);

  return String(normalizedData.detected_month || "").slice(0, 7);
}

function openingBalanceFromRawRow(rawRow: DbRawUploadRow, endingBalance: number) {
  const normalizedData = toLookupRecord(rawRow.normalized_data);
  const amount = toNumber(normalizedData.amount as number | string | null | undefined);
  const cashFlowType = String(normalizedData.cash_flow_type || "");

  if (cashFlowType === "입금") return endingBalance - amount;
  if (cashFlowType === "출금") return endingBalance + amount;
  return endingBalance;
}

function isEarlierBalancePoint(
  next: { date: string; rowIndex: number },
  current?: { date: string; rowIndex: number }
) {
  if (!current) return true;
  if (next.date && current.date && next.date !== current.date) return next.date < current.date;
  return next.rowIndex < current.rowIndex;
}

function isLaterBalancePoint(
  next: { date: string; rowIndex: number },
  current?: { date: string; rowIndex: number }
) {
  if (!current) return true;
  if (next.date && current.date && next.date !== current.date) return next.date > current.date;
  return next.rowIndex > current.rowIndex;
}

function applyMonthlyBankBalances(accounts: BankAccount[], rawRows: DbRawUploadRow[], month: string | null) {
  const earliestByBalanceBucket = new Map<string, { accountId: string; balance: number; date: string; rowIndex: number }>();
  const latestByBalanceBucket = new Map<string, { accountId: string; balance: number; date: string; rowIndex: number }>();

  rawRows.forEach((rawRow) => {
    const rawData = toLookupRecord(rawRow.raw_data);
    const normalizedData = toLookupRecord(rawRow.normalized_data);
    const sourceType = String(normalizedData.detected_upload_type || "").toLowerCase();
    if (sourceType && sourceType !== "bank") return;
    if (month && rawRowMonth(rawRow) !== month) return;

    const accountId = inferBankAccountIdFromRawRow(rawRow);
    if (!accountId) return;

    const balance = parseAmountText(readRecordValue(rawData, rawBalanceKeys));
    if (!balance) return;

    const date = String(normalizedData.transaction_date || "");
    const bucketKey = bankBalanceBucketKey(rawRow, accountId);
    const nextEarliest = {
      accountId,
      balance: openingBalanceFromRawRow(rawRow, balance),
      date,
      rowIndex: rawRow.row_index
    };
    const earliest = earliestByBalanceBucket.get(bucketKey);
    if (isEarlierBalancePoint(nextEarliest, earliest)) {
      earliestByBalanceBucket.set(bucketKey, nextEarliest);
    }

    const nextLatest = { accountId, balance, date, rowIndex: rawRow.row_index };
    const current = latestByBalanceBucket.get(bucketKey);
    if (isLaterBalancePoint(nextLatest, current)) {
      latestByBalanceBucket.set(bucketKey, nextLatest);
    }
  });

  if (latestByBalanceBucket.size === 0) return accounts;

  const openingTotalsByAccount = new Map<string, number>();
  const totalsByAccount = new Map<string, number>();
  earliestByBalanceBucket.forEach((item) => {
    openingTotalsByAccount.set(item.accountId, (openingTotalsByAccount.get(item.accountId) || 0) + item.balance);
  });
  latestByBalanceBucket.forEach((item) => {
    totalsByAccount.set(item.accountId, (totalsByAccount.get(item.accountId) || 0) + item.balance);
  });

  return accounts.map((account) => ({
    ...account,
    previousBalance: openingTotalsByAccount.has(account.id) ? openingTotalsByAccount.get(account.id) || 0 : 0,
    currentBalance: totalsByAccount.has(account.id) ? totalsByAccount.get(account.id) || 0 : 0
  }));
}

function getLatestMonth(rows: DbTransaction[]) {
  return getAvailableMonths(rows)[0] || null;
}

function getAvailableMonths(rows: DbTransaction[], balanceRows: DbBalanceMovement[] = []) {
  return Array.from(new Set([
    ...rows
    .map((row) => row.transaction_date?.slice(0, 7))
      .filter((month): month is string => Boolean(month)),
    ...balanceRows
      .map((row) => row.month)
      .filter((month): month is string => Boolean(month))
  ])).sort((a, b) => b.localeCompare(a));
}

function pickCurrentMonth(requestedMonth: string | undefined, availableMonths: string[]) {
  if (requestedMonth && availableMonths.includes(requestedMonth)) return requestedMonth;
  return availableMonths[0] || requestedMonth || null;
}

function toUiExpenseBasis(value: string | null | undefined, cashFlowType: string) {
  if (value === "자산성" || value === "자산") return "자산";
  if (value === "비용성" || value === "비용") return "비용";
  if (value === "해당없음") return "해당없음";
  return cashFlowType === "출금" ? "비용" : "해당없음";
}

function normalizeTalentLabel(value: string | null | undefined) {
  if (!value) return value;
  return value
    .replaceAll("인투4 몸", "인투4 돈")
    .replaceAll("인투4몸", "인투4 돈")
    .replaceAll("투자4 몸", "인투4 돈")
    .replaceAll("투자4몸", "인투4 돈");
}

function applyTemporaryMayUnit(row: DbTransaction, transaction: Transaction): Transaction {
  if (!row.transaction_date?.startsWith("2026-05")) return transaction;
  if (transaction.cashFlowType !== "입금" && transaction.cashFlowType !== "출금") return transaction;
  if (String(row.memo || "").includes("수동분류:")) return transaction;
  if (String(row.memo || "").includes("매출분리:")) return transaction;

  return {
    ...transaction,
    businessUnit: "광고사업부",
    journalBusinessUnit: transaction.journalBusinessUnit === "미배분" ? undefined : transaction.journalBusinessUnit,
    isCommonUse: false,
    commonPolicy: undefined,
    memo: transaction.memo
      ? `${transaction.memo} / 2026-05 임시 집계: 광고사업부`
      : "2026-05 임시 집계: 광고사업부"
  };
}

function classificationMemo(row: DbTransaction, bankRawContext?: BankRawContext) {
  const context = bankRawContext?.context;

  if (row.source !== "은행") {
    return [row.memo, context].filter(Boolean).join(" ");
  }

  return String(row.memo || "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => !/^(원본시트|계좌번호|잔액|first-pass)\s*:/i.test(part))
    .concat(context ? [context] : [])
    .join(" ");
}

function toTransaction(
  row: DbTransaction,
  cardIssuerLookup?: Map<string, string[]>,
  mappingRules: UserMappingRule[] = [],
  bankAccountLookup?: Map<string, string[]>,
  bankRawContextLookup?: Map<string, BankRawContext[]>
): Transaction {
  const cardBudgetGroup = row.card_budget_group || consumeCardIssuer(row, cardIssuerLookup) || undefined;
  const accountId = consumeBankAccount(row, bankAccountLookup);
  const bankRawContext = consumeBankRawContext(row, bankRawContextLookup);
  const firstPass = classifyFirstPass({
    source: row.source,
    businessUnit: row.business_unit,
    accountId,
    cardBudgetGroup,
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
    memo: classificationMemo(row, bankRawContext)
  }, mappingRules);
  const isManualCategory = String(row.memo || "").includes("수동분류:");
  const shouldUseCurrentUploadRules = Boolean(row.upload_batch_id);
  const shouldReclassifyBankDeposit = row.source === "은행" && row.cash_flow_type === "입금";
  const shouldApplyUserRule = firstPass.matchedRule.startsWith("user-mapping-rule:");
  const useFirstPass = !isManualCategory && (
    shouldUseCurrentUploadRules
    || shouldReclassifyBankDeposit
    || shouldApplyUserRule
    || row.business_unit === "미배분"
    || row.review_status === "확인필요"
    || !row.detail_category
    || !row.expense_basis
  );

  const transaction: Transaction = {
    id: row.id,
    date: row.transaction_date,
    source: row.source || "업로드",
    businessUnit: useFirstPass ? firstPass.businessUnit : row.business_unit || "미배분",
    accountId: accountId || firstPass.accountId || undefined,
    cardBudgetGroup,
    cardIssuer: cardBudgetGroup,
    vendor: row.vendor || "-",
    description: row.description || row.vendor || "-",
    rawDescription: bankRawContext?.displayDescription || undefined,
    amount: toNumber(row.amount),
    cashFlowType: row.cash_flow_type || "제외",
    mainCategory: normalizeTalentLabel(useFirstPass ? firstPass.mainCategory : row.main_category) || "미분류",
    subCategory: normalizeTalentLabel(useFirstPass ? firstPass.subCategory : row.sub_category) || "미분류",
    detailCategory: normalizeTalentLabel(useFirstPass ? firstPass.detailCategory : row.detail_category) || "미분류",
    talentInvestmentType: normalizeTalentLabel(useFirstPass ? firstPass.talentInvestmentType : row.talent_investment_type) || undefined,
    expenseBasis: toUiExpenseBasis(useFirstPass ? firstPass.expenseBasis : row.expense_basis, row.cash_flow_type),
    isInternalTransfer: useFirstPass ? firstPass.isInternalTransfer : Boolean(row.is_internal_transfer),
    isCommonUse: useFirstPass ? firstPass.isCommonUse : Boolean(row.is_common_use),
    commonPolicy: (useFirstPass ? firstPass.commonPolicy : row.common_policy) || undefined,
    journalStatus: row.journal_status || undefined,
    journalBusinessUnit: row.journal_business_unit || undefined,
    memo: row.memo || (useFirstPass ? `1차분류: ${firstPass.matchedRule}` : undefined),
    reviewStatus: useFirstPass ? firstPass.reviewStatus : row.review_status || "확인필요"
  };

  return applyTemporaryMayUnit(row, transaction);
}

function toBankAccount(row: DbBankAccount): BankAccount {
  const fallback = mockBankAccounts.find((item) => item.id === row.id);
  return {
    id: row.id,
    bankName: row.bank_name,
    accountName: row.account_name,
    maskedNo: row.account_no_masked,
    businessUnit: row.business_unit,
    purpose: row.purpose || "",
    previousBalance: fallback?.previousBalance || 0,
    currentBalance: fallback?.currentBalance || 0
  };
}

function toBalanceMovement(row: DbBalanceMovement): BalanceMovement {
  return {
    id: row.id,
    month: row.month,
    statementType: row.statement_type === "부채" ? "부채" : "자산",
    category: row.category,
    openingAmount: toNumber(row.opening_amount),
    increaseAmount: toNumber(row.increase_amount),
    decreaseAmount: toNumber(row.decrease_amount),
    memo: row.memo || undefined
  };
}

function balanceRowsForMonth(month: string | null, dbRows: DbBalanceMovement[]) {
  if (month === "2026-05") return mayBalanceMovements;
  if (month) return [];

  const currentRows = month
    ? dbRows.filter((row) => row.month === month)
    : dbRows;

  return currentRows.map(toBalanceMovement);
}

function rawRowMatchesMonth(row: DbRawUploadRow, month: string | null) {
  if (!month) return true;

  const normalizedData = toLookupRecord(row.normalized_data);
  const rawData = toLookupRecord(row.raw_data);
  const values = [
    normalizedData.transaction_date,
    normalizedData.date,
    normalizedData.month,
    normalizedData.detected_month,
    rawData.transaction_date,
    rawData.date,
    rawData.month,
    rawData.__detectedMonth,
    readRecordValue(rawData, ["거래일자", "일자", "날짜", "기준월", "월", "month", "date"])
  ].filter(Boolean).map(String);

  return values.some((value) => value.startsWith(month) || value.slice(0, 7) === month);
}

function rawRowIsBankUpload(row: DbRawUploadRow) {
  const normalizedData = toLookupRecord(row.normalized_data);
  const rawData = toLookupRecord(row.raw_data);
  const sourceType = String(normalizedData.detected_upload_type || "").toLowerCase();
  if (sourceType) return sourceType === "bank";

  const sheetName = [
    normalizedData.sheet_name,
    readRecordValue(rawData, ["__sheetName"])
  ].filter(Boolean).join(" ");
  const sheetKey = compactLookup(sheetName);

  return sheetKey.includes("입출금") || sheetKey.includes("은행") || sheetKey.includes("cma");
}

async function fetchBankRawRowsForMonth(admin: ReturnType<typeof createAdminClient>, month: string | null, allowFallback = true) {
  const pageSize = 1000;
  const matched: (DbRawUploadRow & { created_at?: string | null })[] = [];
  const range = monthDateRange(month);

  for (let from = 0; from < 10000; from += pageSize) {
    const to = from + pageSize - 1;
    let query = admin
      .from("upload_raw_rows")
      .select("upload_batch_id,row_index,raw_data,normalized_data,created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (range) {
      query = query.gte("normalized_data->>transaction_date", range.start).lt("normalized_data->>transaction_date", range.end);
    }

    const { data, error } = await query;

    if (error) break;

    const page = (data || []) as (DbRawUploadRow & { created_at?: string | null })[];
    matched.push(...page.filter((row) => rawRowIsBankUpload(row) && rawRowMatchesMonth(row, month)));
    if (page.length < pageSize) break;
  }

  if (range && matched.length === 0 && allowFallback) {
    return fetchBankRawRowsForMonth(admin, month, false);
  }

  if (!month || matched.length === 0) return matched;

  const latestBatchId = [...matched]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0]?.upload_batch_id;

  return latestBatchId
    ? matched.filter((row) => row.upload_batch_id === latestBatchId)
    : matched;
}

async function fetchRawRowsForMonth(admin: ReturnType<typeof createAdminClient>, month: string | null) {
  const pageSize = 1000;
  const matched: (DbRawUploadRow & { id?: string; parse_status?: string | null; memo?: string | null; created_at?: string | null })[] = [];
  const range = monthDateRange(month);

  for (let from = 0; from < 10000; from += pageSize) {
    const to = from + pageSize - 1;
    let query = admin
      .from("upload_raw_rows")
      .select("id,upload_batch_id,row_index,raw_data,normalized_data,parse_status,memo,created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (range) {
      query = query.gte("normalized_data->>transaction_date", range.start).lt("normalized_data->>transaction_date", range.end);
    }

    const { data, error } = await query;

    if (error) break;

    const page = (data || []) as (DbRawUploadRow & { id?: string; parse_status?: string | null; memo?: string | null; created_at?: string | null })[];
    matched.push(...page.filter((row) => rawRowMatchesMonth(row, month)));
    if (page.length < pageSize) break;
  }

  return {
    rows: matched.slice(0, 12),
    count: matched.length
  };
}

async function loadDashboardData(requestedMonth?: string, includeRawRows = false): Promise<DashboardData> {
  try {
    const admin = createAdminClient();
    const [
      transactionMonthResult,
      bankResult,
      balanceResult,
      batchResult,
      mappingRuleResult,
    ] = await Promise.all([
      fetchTransactionMonths(admin),
      admin
        .from("bank_account_master")
        .select("id,bank_name,account_name,account_no_masked,business_unit,purpose")
        .order("id", { ascending: true }),
      admin
        .from("balance_movements")
        .select("*")
        .order("month", { ascending: false })
        .limit(200),
      admin
        .from("upload_batches")
        .select("id,upload_type,file_name,status,uploaded_by,uploaded_at")
        .order("uploaded_at", { ascending: false })
        .limit(10),
      admin
        .from("mapping_rules")
        .select("rule_name,source,keyword,business_unit,main_category,sub_category,detail_category,expense_basis,priority,created_at")
        .eq("is_active", true)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
    ]);

    const transactionMonthRows = (transactionMonthResult.data || []) as Pick<DbTransaction, "transaction_date">[];
    const dbBalanceMovements = (balanceResult.data || []) as DbBalanceMovement[];
    if (transactionMonthResult.error || transactionMonthRows.length === 0) {
      const mockMonths = getAvailableMonths(mockTransactions.map((row) => ({
        transaction_date: row.date
      } as DbTransaction)), []);
      const currentMonth = pickCurrentMonth(requestedMonth, mockMonths);

      return {
        mode: "mock",
        currentMonth,
        availableMonths: mockMonths,
        transactions: currentMonth ? mockTransactions.filter((row) => row.date.startsWith(currentMonth)) : mockTransactions,
        bankAccounts: mockBankAccounts,
        balanceMovements: currentMonth === "2026-05" ? mayBalanceMovements : mayBalanceMovements,
        uploadBatches: [],
        rawRows: [],
        rawRowCount: 0
      };
    }

    const availableMonths = getAvailableMonths(transactionMonthRows as DbTransaction[], dbBalanceMovements);
    const currentMonth = pickCurrentMonth(requestedMonth, availableMonths);
    const transactionResult = await fetchTransactionsForMonth(admin, currentMonth);
    if (transactionResult.error) {
      throw transactionResult.error;
    }
    const currentTransactions = (transactionResult.data || []) as DbTransaction[];
    const mappingRules = ((mappingRuleResult as { data?: DbMappingRule[]; error?: unknown }).data || []) as UserMappingRule[];
    const transactionBatchIds = Array.from(new Set(
      currentTransactions
        .map((row) => row.upload_batch_id)
        .filter((id): id is string => Boolean(id))
    ));
    const currentRawRows = await fetchAllRawRowsForBatches(admin, transactionBatchIds, currentMonth);
    const cardIssuerLookup = buildCardIssuerLookup(currentRawRows);
    const bankAccountLookup = buildBankAccountLookup(currentRawRows);
    const bankRawContextLookup = buildBankRawContextLookup(currentRawRows);
    const bankBalanceRawRows = await fetchBankRawRowsForMonth(admin, currentMonth);
    const rawRowsForMonth = includeRawRows
      ? await fetchRawRowsForMonth(admin, currentMonth)
      : { rows: [], count: 0 };
    const bankAccounts = applyMonthlyBankBalances(
      ensureDerivedBankAccounts(((bankResult.data || []) as DbBankAccount[]).map(toBankAccount)),
      bankBalanceRawRows.length > 0 ? bankBalanceRawRows : currentRawRows,
      currentMonth
    );

    return {
      mode: "live",
      currentMonth,
      availableMonths,
      transactions: currentTransactions.map((row) => toTransaction(row, cardIssuerLookup, mappingRules, bankAccountLookup, bankRawContextLookup)),
      bankAccounts,
      balanceMovements: balanceRowsForMonth(currentMonth, dbBalanceMovements),
      uploadBatches: ((batchResult.data || []) as Record<string, string | null>[]).map((row) => ({
        id: String(row.id),
        uploadType: String(row.upload_type || ""),
        fileName: String(row.file_name || ""),
        status: String(row.status || ""),
        uploadedBy: row.uploaded_by || null,
        uploadedAt: String(row.uploaded_at || "")
      })),
      rawRows: rawRowsForMonth.rows.map((row) => ({
        id: String(row.id),
        rowIndex: Number(row.row_index || 0),
        rawData: (row.raw_data || {}) as Record<string, unknown>,
        normalizedData: (row.normalized_data || null) as Record<string, unknown> | null,
        parseStatus: String(row.parse_status || ""),
        memo: row.memo ? String(row.memo) : null
      })),
      rawRowCount: rawRowsForMonth.count
    };
  } catch {
    const mockMonths = getAvailableMonths(mockTransactions.map((row) => ({
      transaction_date: row.date
    } as DbTransaction)), []);
    const currentMonth = pickCurrentMonth(requestedMonth, mockMonths);

    return {
      mode: "mock",
      currentMonth,
      availableMonths: mockMonths,
      transactions: currentMonth ? mockTransactions.filter((row) => row.date.startsWith(currentMonth)) : mockTransactions,
      bankAccounts: mockBankAccounts,
      balanceMovements: mayBalanceMovements,
      uploadBatches: [],
      rawRows: [],
      rawRowCount: 0
    };
  }
}

export const getDashboardData = unstable_cache(loadDashboardData, ["finance-dashboard-data-v12"], {
  revalidate: 300,
  tags: ["dashboard-data"]
});
