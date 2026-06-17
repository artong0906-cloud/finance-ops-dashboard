export type BusinessUnit = "광고사업부" | "플랫폼" | "대외협력" | "공통사용분" | "미배분";
export type TransactionSource = "은행" | "카드" | "파로스" | "수기입력";
export type CashFlowType = "입금" | "출금" | "내부이체" | "제외";
export type ExpenseBasis = "비용성" | "자산성" | "해당없음";
export type JournalStatus = "미분개" | "분개완료" | "확인필요";

export type Transaction = {
  id: string;
  date: string;
  source: TransactionSource;
  businessUnit: BusinessUnit;
  accountName?: string;
  accountId?: string;
  cardBudgetGroup?: string;
  vendor: string;
  description: string;
  amount: number;
  cashFlowType: CashFlowType;
  mainCategory: string;
  subCategory: string;
  detailCategory: string;
  talentInvestmentType?: string;
  expenseBasis: ExpenseBasis;
  isInternalTransfer: boolean;
  isCommonUse: boolean;
  commonPolicy?: string;
  journalStatus?: JournalStatus;
  journalBusinessUnit?: BusinessUnit;
  memo?: string;
  reviewStatus: "정상" | "확인필요" | "보류" | "확정";
};

export type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  maskedNo: string;
  businessUnit: BusinessUnit;
  purpose: string;
  previousBalance: number;
  currentBalance: number;
};

export type BalanceMovement = {
  id: string;
  month: string;
  statementType: "자산" | "부채";
  category: string;
  openingAmount: number;
  increaseAmount: number;
  decreaseAmount: number;
  memo?: string;
};
