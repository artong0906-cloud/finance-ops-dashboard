import { mayBalanceMovements } from "@/data/mayBalanceSnapshot";
import { endingAmount } from "@/services/dashboard/calculations";
import type { BalanceMovement, BankAccount, Transaction } from "@/types/finance";

export type AssetApplyMode = "exclude" | "as_is" | "depreciate";

export type AssetApplySelection = {
  transactionId: string;
  mode: AssetApplyMode;
  assetCategory?: string;
  monthlyDepreciation?: number;
};

export type BalanceMovementInsert = {
  month: string;
  statement_type: "자산" | "부채";
  category: string;
  opening_amount: number;
  increase_amount: number;
  decrease_amount: number;
  memo: string | null;
};

function compact(value: unknown) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(compact(keyword)));
}

function previousMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const prevMonth = monthIndex === 1 ? 12 : monthIndex - 1;
  const prevYear = monthIndex === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

function balanceText(row: BalanceMovement) {
  return compact([row.category, row.memo].filter(Boolean).join(" "));
}

function isCashAsset(row: BalanceMovement) {
  const text = balanceText(row);
  return row.statementType === "자산" && includesAny(text, ["현금", "예금", "통장", "증권", "현금성", "선급금", "공제부금"]);
}

function isIntellectualFund(row: BalanceMovement) {
  return row.statementType === "자산" && includesAny(balanceText(row), ["지식재산", "공제부금"]);
}

function toOpeningRow(month: string, row: BalanceMovement): BalanceMovementInsert {
  return {
    month,
    statement_type: row.statementType,
    category: row.category,
    opening_amount: endingAmount(row),
    increase_amount: 0,
    decrease_amount: 0,
    memo: row.memo || null
  };
}

function cashRows(month: string, bankAccounts: BankAccount[], baseRows: BalanceMovement[]): BalanceMovementInsert[] {
  const accountRows = bankAccounts
    .filter((account) => Math.abs(account.currentBalance) > 0 || Math.abs(account.previousBalance) > 0)
    .map((account) => {
      const delta = account.currentBalance - account.previousBalance;
      return {
        month,
        statement_type: "자산" as const,
        category: `${account.bankName} ${account.accountName}`,
        opening_amount: account.previousBalance,
        increase_amount: delta > 0 ? delta : 0,
        decrease_amount: delta < 0 ? Math.abs(delta) : 0,
        memo: `현금성자산 · ${[account.businessUnit, account.maskedNo, account.purpose].filter(Boolean).join(" · ")}`
      };
    });

  const intellectualFund = baseRows.find(isIntellectualFund);
  if (intellectualFund) {
    accountRows.push({
      month,
      statement_type: "자산",
      category: "지식재산 공제부금",
      opening_amount: endingAmount(intellectualFund),
      increase_amount: 0,
      decrease_amount: 0,
      memo: "현금성자산 · 5월 기준 유지"
    });
  }

  return accountRows;
}

function transactionText(row: Transaction) {
  return compact([
    row.accountId,
    row.vendor,
    row.rawDescription,
    row.description,
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.memo
  ].filter(Boolean).join(" "));
}

function normalizeAssetCategory(value: unknown) {
  const category = String(value || "").trim();
  if (["현금성자산", "차량가액", "보증금", "대여금", "광고비", "유형자산", "무형자산", "기타자산"].includes(category)) {
    return category;
  }
  return "유형자산";
}

function isExcludedLoanPassThrough(row: Transaction) {
  const text = transactionText(row);
  return includesAny(text, [
    "b00003",
    "12698016728842",
    "급여",
    "프리급여"
  ]);
}

export function assetExpenseCandidates(transactions: Transaction[], month: string) {
  return transactions.filter((row) => (
    row.date.startsWith(month)
    && row.cashFlowType === "출금"
    && row.expenseBasis === "자산"
    && !row.isInternalTransfer
  ));
}

function appliedAssetRows(month: string, transactions: Transaction[], selections: AssetApplySelection[]): BalanceMovementInsert[] {
  const selectionById = new Map(selections.map((selection) => [selection.transactionId, selection]));
  const rows: BalanceMovementInsert[] = [];

  assetExpenseCandidates(transactions, month).forEach((row) => {
    const selection = selectionById.get(row.id);
    if (!selection || selection.mode === "exclude") return;

    const monthlyDepreciation = selection.mode === "depreciate"
      ? Math.max(0, Math.round(Number(selection.monthlyDepreciation || row.amount * 0.4)))
      : 0;

    rows.push({
      month,
      statement_type: "자산",
      category: normalizeAssetCategory(selection.assetCategory),
      opening_amount: 0,
      increase_amount: row.amount,
      decrease_amount: monthlyDepreciation,
      memo: [
        "6월 자산성 지출 반영",
        row.detailCategory && row.detailCategory !== "미분류" ? row.detailCategory : row.mainCategory,
        selection.mode === "depreciate" ? `감가상각 적용 · 당월 ${monthlyDepreciation.toLocaleString("ko-KR")}원` : "그대로 반영",
        row.vendor,
        row.rawDescription || row.description
      ].filter(Boolean).join(" · ")
    });
  });

  return rows;
}

function loanRows(month: string, transactions: Transaction[]): BalanceMovementInsert[] {
  return transactions
    .filter((row) => {
      const text = transactionText(row);
      return row.date.startsWith(month)
        && row.source === "은행"
        && row.cashFlowType === "입금"
        && !row.isInternalTransfer
        && !isExcludedLoanPassThrough(row)
        && (row.mainCategory === "부채"
          || includesAny(text, ["대출", "차입", "신규대출", "대출실행", "대출금입금", "차입금입금"]));
    })
    .map((row) => ({
      month,
      statement_type: "부채" as const,
      category: includesAny(transactionText(row), ["신한"]) ? "신한은행 신규대출" : `${row.vendor || row.accountId || "신규"} 대출`,
      opening_amount: 0,
      increase_amount: row.amount,
      decrease_amount: 0,
      memo: ["은행대출 부채", row.vendor, row.rawDescription || row.description].filter(Boolean).join(" · ")
    }));
}

export function buildMonthlyBalanceRows({
  month,
  bankAccounts,
  transactions,
  currentRows,
  selections = []
}: {
  month: string;
  bankAccounts: BankAccount[];
  transactions: Transaction[];
  currentRows?: BalanceMovement[];
  selections?: AssetApplySelection[];
}) {
  const baseMonth = previousMonth(month);
  const baseRows = baseMonth === "2026-05" || !currentRows?.length ? mayBalanceMovements : currentRows;
  const carryForwardRows = baseRows
    .filter((row) => !isCashAsset(row))
    .map((row) => toOpeningRow(month, row));

  return [
    ...carryForwardRows,
    ...cashRows(month, bankAccounts, baseRows),
    ...loanRows(month, transactions),
    ...appliedAssetRows(month, transactions, selections)
  ];
}
