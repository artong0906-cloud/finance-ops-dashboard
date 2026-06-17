import type { Transaction } from "@/types/finance";

export type ValidationIssue = {
  transactionId: string;
  level: "warning" | "error";
  message: string;
};

export function validateTransactions(rows: Transaction[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const row of rows) {
    if (row.source === "은행" && !row.accountId) {
      issues.push({ transactionId: row.id, level: "error", message: "은행 거래인데 accountId가 없습니다." });
    }
    if (row.source === "카드" && row.journalStatus !== "분개완료" && !row.cardBudgetGroup) {
      issues.push({ transactionId: row.id, level: "warning", message: "카드 거래인데 예산그룹이 없습니다." });
    }
    if (row.isInternalTransfer && row.mainCategory !== "내부이체") {
      issues.push({ transactionId: row.id, level: "warning", message: "내부이체는 매출/지출에서 제외되어야 합니다." });
    }
    if (row.isCommonUse && row.businessUnit !== "공통사용분") {
      issues.push({ transactionId: row.id, level: "warning", message: "공통사용분은 사업부를 공통사용분으로 분리하세요." });
    }
  }

  return issues;
}
