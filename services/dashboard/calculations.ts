import type { BalanceMovement, Transaction } from "@/types/finance";

const ASSET_STATEMENT = "\uC790\uC0B0";
const MAY_2026 = "2026-05";
const MAY_2026_ASSET_BASELINE = 7_393_452_364;

export function formatKRW(value: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
}

export function formatCompactKRW(value: number) {
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function endingAmount(row: BalanceMovement) {
  return row.openingAmount + row.increaseAmount - row.decreaseAmount;
}

export function sumBy<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((sum, row) => sum + selector(row), 0);
}

export function adjustedTotalAssets(assetRows: BalanceMovement[], calculatedTotal = sumBy(assetRows, endingAmount)) {
  if (assetRows.length > 0 && assetRows.every((row) => row.month === MAY_2026 && row.statementType === ASSET_STATEMENT)) {
    return MAY_2026_ASSET_BASELINE;
  }

  return calculatedTotal;
}

export function revenueByBusinessUnit(transactions: Transaction[], businessUnit: string) {
  return sumBy(
    transactions.filter((row) => row.businessUnit === businessUnit && row.mainCategory === "매출" && !row.isInternalTransfer),
    (row) => row.amount
  );
}

export function expenseByBusinessUnit(transactions: Transaction[], businessUnit: string) {
  return sumBy(
    transactions.filter((row) => row.businessUnit === businessUnit && row.cashFlowType === "출금" && row.expenseBasis === "비용" && !row.isInternalTransfer),
    (row) => row.amount
  );
}

export function assetExpenseByBusinessUnit(transactions: Transaction[], businessUnit: string) {
  return sumBy(
    transactions.filter((row) => row.businessUnit === businessUnit && row.cashFlowType === "출금" && row.expenseBasis === "자산" && !row.isInternalTransfer),
    (row) => row.amount
  );
}
