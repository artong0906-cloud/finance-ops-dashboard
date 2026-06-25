import type { BalanceMovement, Transaction } from "@/types/finance";

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
