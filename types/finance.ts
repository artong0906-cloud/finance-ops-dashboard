export type BusinessUnit = string;
export type TransactionSource = string;
export type CashFlowType = string;
export type ExpenseBasis = string;
export type JournalStatus = string;
export type ReviewStatus = string;

export type Transaction = {
  id: string;
  date: string;
  source: TransactionSource;
  businessUnit: BusinessUnit;
  accountName?: string;
  accountId?: string;
  cardBudgetGroup?: string;
  cardIssuer?: string;
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
  reviewStatus: ReviewStatus;
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
  acquiredAt?: string;
  monthlyDepreciation?: number;
  memo?: string;
};
