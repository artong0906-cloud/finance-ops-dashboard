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

async function fetchAllRawRowsForBatches(admin: ReturnType<typeof createAdminClient>, batchIds: string[]) {
  if (batchIds.length === 0) return [] as DbRawUploadRow[];

  const pageSize = 1000;
  const rows: DbRawUploadRow[] = [];

  for (let from = 0; from < 10000; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("upload_raw_rows")
      .select("upload_batch_id,row_index,raw_data,normalized_data")
      .in("upload_batch_id", batchIds)
      .order("row_index", { ascending: true })
      .range(from, to);

    if (error) return rows;

    const page = (data || []) as DbRawUploadRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
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

function toLookupRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const rawCardIssuerKeys = ["카드사", "카드회사", "카드사/사용자", "card_budget_group"];
const rawVendorKeys = ["거래처", "가맹점명", "사용처", "상호", "업체명", "vendor"];
const rawDescriptionKeys = ["거래적요", "적요", "거래내용", "내용", "메모", "description"];
const rawBalanceKeys = ["거래후 잔액", "거래 후 잔액", "거래 잔액", "잔액", "현재잔액", "balance"];
const rawBankAccountKeys = ["계좌", "계좌번호", "입금계좌", "출금계좌", "통장", "은행", "account_id"];

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

function inferBankAccountIdFromRawRow(rawRow: DbRawUploadRow) {
  const rawData = toLookupRecord(rawRow.raw_data);
  const normalizedData = toLookupRecord(rawRow.normalized_data);
  const sheetName = readRecordValue(rawData, ["__sheetName"]);
  const accountHint = [
    normalizedData.account_id,
    readRecordValue(rawData, rawBankAccountKeys),
    sheetName
  ].filter(Boolean).join(" ");
  const firstPass = classifyFirstPass({
    source: "은행",
    accountId: accountHint,
    memo: sheetName
  });

  return firstPass.accountId;
}

function applyMonthlyBankBalances(accounts: BankAccount[], rawRows: DbRawUploadRow[]) {
  const latestByAccount = new Map<string, { balance: number; date: string; rowIndex: number }>();

  rawRows.forEach((rawRow) => {
    const rawData = toLookupRecord(rawRow.raw_data);
    const normalizedData = toLookupRecord(rawRow.normalized_data);
    const sourceType = String(normalizedData.detected_upload_type || "").toLowerCase();
    if (sourceType && sourceType !== "bank") return;

    const accountId = inferBankAccountIdFromRawRow(rawRow);
    if (!accountId) return;

    const balance = parseAmountText(readRecordValue(rawData, rawBalanceKeys));
    if (!balance) return;

    const date = String(normalizedData.transaction_date || "");
    const current = latestByAccount.get(accountId);
    if (!current || date > current.date || (date === current.date && rawRow.row_index > current.rowIndex)) {
      latestByAccount.set(accountId, { balance, date, rowIndex: rawRow.row_index });
    }
  });

  if (latestByAccount.size === 0) return accounts;

  return accounts.map((account) => ({
    ...account,
    currentBalance: latestByAccount.get(account.id)?.balance || 0
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

function toTransaction(row: DbTransaction, cardIssuerLookup?: Map<string, string[]>, mappingRules: UserMappingRule[] = []): Transaction {
  const cardBudgetGroup = row.card_budget_group || consumeCardIssuer(row, cardIssuerLookup) || undefined;
  const firstPass = classifyFirstPass({
    source: row.source,
    businessUnit: row.business_unit,
    accountId: row.account_id,
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
    memo: row.memo
  }, mappingRules);
  const shouldReclassifyBankDeposit = row.source === "은행" && row.cash_flow_type === "입금";
  const shouldApplyUserRule = firstPass.matchedRule.startsWith("user-mapping-rule:");
  const useFirstPass = shouldReclassifyBankDeposit
    || shouldApplyUserRule
    || row.business_unit === "미배분"
    || row.review_status === "확인필요"
    || !row.detail_category
    || !row.expense_basis;

  const transaction: Transaction = {
    id: row.id,
    date: row.transaction_date,
    source: row.source || "업로드",
    businessUnit: useFirstPass ? firstPass.businessUnit : row.business_unit || "미배분",
    accountId: row.account_id || firstPass.accountId || undefined,
    cardBudgetGroup,
    cardIssuer: cardBudgetGroup,
    vendor: row.vendor || "-",
    description: row.description || row.vendor || "-",
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
    rawData.transaction_date,
    rawData.date,
    rawData.month,
    readRecordValue(rawData, ["거래일자", "일자", "날짜", "기준월", "월", "month", "date"])
  ].filter(Boolean).map(String);

  return values.some((value) => value.startsWith(month) || value.slice(0, 7) === month);
}

async function fetchRawRowsForMonth(admin: ReturnType<typeof createAdminClient>, month: string | null) {
  const pageSize = 1000;
  const matched: (DbRawUploadRow & { id?: string; parse_status?: string | null; memo?: string | null; created_at?: string | null })[] = [];

  for (let from = 0; from < 10000; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("upload_raw_rows")
      .select("id,upload_batch_id,row_index,raw_data,normalized_data,parse_status,memo,created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

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
      transactionResult,
      bankResult,
      balanceResult,
      batchResult,
      mappingRuleResult,
    ] = await Promise.all([
      fetchAllTransactions(admin),
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

    const dbTransactions = (transactionResult.data || []) as DbTransaction[];
    const dbBalanceMovements = (balanceResult.data || []) as DbBalanceMovement[];
    if (transactionResult.error || dbTransactions.length === 0) {
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

    const availableMonths = getAvailableMonths(dbTransactions, dbBalanceMovements);
    const currentMonth = pickCurrentMonth(requestedMonth, availableMonths);
    const currentTransactions = currentMonth
      ? dbTransactions.filter((row) => row.transaction_date?.startsWith(currentMonth))
      : dbTransactions;
    const mappingRules = ((mappingRuleResult as { data?: DbMappingRule[]; error?: unknown }).data || []) as UserMappingRule[];
    const transactionBatchIds = Array.from(new Set(
      currentTransactions
        .map((row) => row.upload_batch_id)
        .filter((id): id is string => Boolean(id))
    ));
    const currentRawRows = await fetchAllRawRowsForBatches(admin, transactionBatchIds);
    const cardIssuerLookup = buildCardIssuerLookup(currentRawRows);
    const rawRowsForMonth = includeRawRows
      ? await fetchRawRowsForMonth(admin, currentMonth)
      : { rows: [], count: 0 };
    const bankAccounts = applyMonthlyBankBalances(((bankResult.data || []) as DbBankAccount[]).map(toBankAccount), currentRawRows);

    return {
      mode: "live",
      currentMonth,
      availableMonths,
      transactions: currentTransactions.map((row) => toTransaction(row, cardIssuerLookup, mappingRules)),
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

export const getDashboardData = unstable_cache(loadDashboardData, ["finance-dashboard-data-v2"], {
  revalidate: 15,
  tags: ["dashboard-data"]
});
