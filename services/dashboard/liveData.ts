import { bankAccounts as mockBankAccounts, balanceMovements as mockBalanceMovements, transactions as mockTransactions } from "@/data/mock";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyFirstPass } from "@/services/classification/firstPass";
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

function getLatestMonth(rows: DbTransaction[]) {
  return rows
    .map((row) => row.transaction_date?.slice(0, 7))
    .filter((month): month is string => Boolean(month))
    .sort((a, b) => b.localeCompare(a))[0] || null;
}

function toUiExpenseBasis(value: string | null | undefined, cashFlowType: string) {
  if (value === "자산성" || value === "자산") return "자산";
  if (value === "비용성" || value === "비용") return "비용";
  if (value === "해당없음") return "해당없음";
  return cashFlowType === "출금" ? "비용" : "해당없음";
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

function toTransaction(row: DbTransaction): Transaction {
  const firstPass = classifyFirstPass({
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
  });
  const useFirstPass = row.business_unit === "미배분"
    || row.review_status === "확인필요"
    || !row.detail_category
    || !row.expense_basis;

  const transaction: Transaction = {
    id: row.id,
    date: row.transaction_date,
    source: row.source || "업로드",
    businessUnit: useFirstPass ? firstPass.businessUnit : row.business_unit || "미배분",
    accountId: row.account_id || firstPass.accountId || undefined,
    cardBudgetGroup: row.card_budget_group || undefined,
    vendor: row.vendor || "-",
    description: row.description || row.vendor || "-",
    amount: toNumber(row.amount),
    cashFlowType: row.cash_flow_type || "제외",
    mainCategory: useFirstPass ? firstPass.mainCategory : row.main_category || "미분류",
    subCategory: useFirstPass ? firstPass.subCategory : row.sub_category || "미분류",
    detailCategory: useFirstPass ? firstPass.detailCategory : row.detail_category || "미분류",
    talentInvestmentType: useFirstPass ? firstPass.talentInvestmentType : row.talent_investment_type || undefined,
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

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const admin = createAdminClient();
    const [
      transactionResult,
      bankResult,
      balanceResult,
      batchResult,
      rawRowResult
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
        .from("upload_raw_rows")
        .select("id,row_index,raw_data,normalized_data,parse_status,memo,created_at")
        .order("created_at", { ascending: false })
        .limit(12)
    ]);

    const dbTransactions = (transactionResult.data || []) as DbTransaction[];
    if (transactionResult.error || dbTransactions.length === 0) {
      return {
        mode: "mock",
        currentMonth: null,
        transactions: mockTransactions,
        bankAccounts: mockBankAccounts,
        balanceMovements: mockBalanceMovements,
        uploadBatches: [],
        rawRows: [],
        rawRowCount: 0
      };
    }

    const currentMonth = getLatestMonth(dbTransactions);
    const currentTransactions = currentMonth
      ? dbTransactions.filter((row) => row.transaction_date?.startsWith(currentMonth))
      : dbTransactions;
    const dbBalanceMovements = (balanceResult.data || []) as DbBalanceMovement[];
    const currentBalanceMovements = currentMonth
      ? dbBalanceMovements.filter((row) => row.month === currentMonth)
      : dbBalanceMovements;

    const countResult = await admin
      .from("upload_raw_rows")
      .select("id", { count: "exact", head: true });

    return {
      mode: "live",
      currentMonth,
      transactions: currentTransactions.map(toTransaction),
      bankAccounts: ((bankResult.data || []) as DbBankAccount[]).map(toBankAccount),
      balanceMovements: (currentBalanceMovements.length > 0 ? currentBalanceMovements : dbBalanceMovements).map(toBalanceMovement),
      uploadBatches: ((batchResult.data || []) as Record<string, string | null>[]).map((row) => ({
        id: String(row.id),
        uploadType: String(row.upload_type || ""),
        fileName: String(row.file_name || ""),
        status: String(row.status || ""),
        uploadedBy: row.uploaded_by || null,
        uploadedAt: String(row.uploaded_at || "")
      })),
      rawRows: ((rawRowResult.data || []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        rowIndex: Number(row.row_index || 0),
        rawData: (row.raw_data || {}) as Record<string, unknown>,
        normalizedData: (row.normalized_data || null) as Record<string, unknown> | null,
        parseStatus: String(row.parse_status || ""),
        memo: row.memo ? String(row.memo) : null
      })),
      rawRowCount: countResult.count || 0
    };
  } catch {
    return {
      mode: "mock",
      currentMonth: null,
      transactions: mockTransactions,
      bankAccounts: mockBankAccounts,
      balanceMovements: mockBalanceMovements,
      uploadBatches: [],
      rawRows: [],
      rawRowCount: 0
    };
  }
}
