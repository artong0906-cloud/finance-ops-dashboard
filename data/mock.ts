import type { BankAccount, BalanceMovement, Transaction } from "@/types/finance";

export const bankAccounts: BankAccount[] = [
  { id: "BANK_AD_001", bankName: "기업은행", accountName: "광고사업 운영통장", maskedNo: "***1234", businessUnit: "광고사업부", purpose: "광고사업 매출/지출", previousBalance: 182000000, currentBalance: 196500000 },
  { id: "BANK_PLATFORM_001", bankName: "기업은행", accountName: "플랫폼 운영통장", maskedNo: "***5678", businessUnit: "플랫폼", purpose: "플랫폼 매출/지출", previousBalance: 48000000, currentBalance: 75200000 },
  { id: "BANK_PARTNER_001", bankName: "하나은행", accountName: "대외협력 운영통장", maskedNo: "***9012", businessUnit: "대외협력", purpose: "대외협력 매출/지출", previousBalance: 29000000, currentBalance: 24800000 },
  { id: "BANK_COMMON_001", bankName: "신한은행", accountName: "공통 운영통장", maskedNo: "***0000", businessUnit: "공통사용분", purpose: "공통비/내부이체", previousBalance: 31000000, currentBalance: 45500000 }
];

export const transactions: Transaction[] = [
  { id: "T001", date: "2026-06-03", source: "은행", businessUnit: "광고사업부", accountId: "BANK_AD_001", accountName: "광고사업 운영통장", vendor: "광고주A", description: "광고대행 매출 입금", amount: 52000000, cashFlowType: "입금", mainCategory: "매출", subCategory: "광고사업부매출", detailCategory: "광고대행매출", expenseBasis: "해당없음", isInternalTransfer: false, isCommonUse: false, reviewStatus: "정상" },
  { id: "T002", date: "2026-06-04", source: "은행", businessUnit: "플랫폼", accountId: "BANK_PLATFORM_001", accountName: "플랫폼 운영통장", vendor: "플랫폼 고객", description: "플랫폼 충전금 입금", amount: 31000000, cashFlowType: "입금", mainCategory: "매출", subCategory: "플랫폼매출", detailCategory: "서비스 이용 매출", expenseBasis: "해당없음", isInternalTransfer: false, isCommonUse: false, reviewStatus: "정상" },
  { id: "T003", date: "2026-06-05", source: "카드", businessUnit: "공통사용분", cardBudgetGroup: "메인 법인카드 예산", vendor: "Adobe", description: "디자인툴 공통 사용분", amount: 800800, cashFlowType: "출금", mainCategory: "운영비", subCategory: "플랫폼/툴", detailCategory: "디자인툴", expenseBasis: "비용성", isInternalTransfer: false, isCommonUse: true, commonPolicy: "광고사업부 제외", journalStatus: "미분개", reviewStatus: "확인필요" },
  { id: "T004", date: "2026-06-07", source: "카드", businessUnit: "플랫폼", cardBudgetGroup: "PO 법인카드 예산", vendor: "OpenAI", description: "플랫폼 개발 AI 사용료", amount: 450000, cashFlowType: "출금", mainCategory: "플랫폼", subCategory: "AI/API", detailCategory: "개발툴", expenseBasis: "비용성", isInternalTransfer: false, isCommonUse: false, journalStatus: "분개완료", journalBusinessUnit: "플랫폼", reviewStatus: "확정" },
  { id: "T005", date: "2026-06-10", source: "은행", businessUnit: "공통사용분", accountId: "BANK_COMMON_001", accountName: "공통 운영통장", vendor: "내부이체", description: "광고사업 통장에서 공통통장으로 자금 이동", amount: 10000000, cashFlowType: "내부이체", mainCategory: "내부이체", subCategory: "사업부간 자금이동", detailCategory: "매출지출제외", expenseBasis: "해당없음", isInternalTransfer: true, isCommonUse: false, reviewStatus: "정상" },
  { id: "T006", date: "2026-06-12", source: "은행", businessUnit: "광고사업부", accountId: "BANK_AD_001", accountName: "광고사업 운영통장", vendor: "급여", description: "6월 급여 지급", amount: 158000000, cashFlowType: "출금", mainCategory: "급여", subCategory: "인건비", detailCategory: "급여", expenseBasis: "비용성", isInternalTransfer: false, isCommonUse: false, reviewStatus: "정상" },
  { id: "T007", date: "2026-06-14", source: "은행", businessUnit: "광고사업부", accountId: "BANK_AD_001", accountName: "광고사업 운영통장", vendor: "사택 임대인", description: "사택 월세", amount: 4200000, cashFlowType: "출금", mainCategory: "인재투자비", subCategory: "인투1 집", detailCategory: "사택 월세", talentInvestmentType: "인투1 집", expenseBasis: "비용성", isInternalTransfer: false, isCommonUse: false, reviewStatus: "정상" }
];

export const balanceMovements: BalanceMovement[] = [
  { id: "A001", month: "2026-06", statementType: "자산", category: "현금성자산", openingAmount: 290000000, increaseAmount: 143000000, decreaseAmount: 91500000, memo: "통장 잔액 기준" },
  { id: "A002", month: "2026-06", statementType: "자산", category: "법인차량", openingAmount: 162000000, increaseAmount: 0, decreaseAmount: 2600000, memo: "감가/처분 반영" },
  { id: "A003", month: "2026-06", statementType: "자산", category: "보증금", openingAmount: 88000000, increaseAmount: 12000000, decreaseAmount: 0, memo: "사택 보증금 증가" },
  { id: "A004", month: "2026-06", statementType: "자산", category: "광고비", openingAmount: 36000000, increaseAmount: 18000000, decreaseAmount: 9000000, memo: "광고비 선급/사용" },
  { id: "L001", month: "2026-06", statementType: "부채", category: "차량부채", openingAmount: 103000000, increaseAmount: 0, decreaseAmount: 5800000, memo: "리스 상환" },
  { id: "L002", month: "2026-06", statementType: "부채", category: "은행대출부채", openingAmount: 300000000, increaseAmount: 300000000, decreaseAmount: 0, memo: "신규 대출 실행" },
  { id: "L003", month: "2026-06", statementType: "부채", category: "기타부채", openingAmount: 86000000, increaseAmount: 42000000, decreaseAmount: 51000000, memo: "예정급여/카드결제/광고비" }
];
