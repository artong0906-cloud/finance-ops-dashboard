export type BusinessUnitValue = "광고사업부" | "플랫폼" | "대외협력" | "공통사용분" | "미배분";
export type ExpenseBasisValue = "비용성" | "자산성" | "해당없음";
export type ReviewStatusValue = "정상" | "확인필요";

export type FirstPassInput = {
  source?: string | null;
  businessUnit?: string | null;
  accountId?: string | null;
  cardBudgetGroup?: string | null;
  vendor?: string | null;
  description?: string | null;
  amount?: number | string | null;
  cashFlowType?: string | null;
  mainCategory?: string | null;
  subCategory?: string | null;
  detailCategory?: string | null;
  talentInvestmentType?: string | null;
  expenseBasis?: string | null;
  isInternalTransfer?: boolean | null;
  isCommonUse?: boolean | null;
  commonPolicy?: string | null;
  reviewStatus?: string | null;
  memo?: string | null;
};

export type FirstPassResult = {
  businessUnit: BusinessUnitValue;
  accountId?: string;
  mainCategory: string;
  subCategory: string;
  detailCategory: string;
  talentInvestmentType?: string;
  expenseBasis: ExpenseBasisValue;
  isInternalTransfer: boolean;
  isCommonUse: boolean;
  commonPolicy?: string;
  reviewStatus: ReviewStatusValue;
  confidence: number;
  matchedRule: string;
};

const units: BusinessUnitValue[] = ["광고사업부", "플랫폼", "대외협력", "공통사용분", "미배분"];

const accountRules: { keywords: string[]; accountId: string; businessUnit: BusinessUnitValue }[] = [
  { keywords: ["BANK_AD_001", "29812261804018"], accountId: "BANK_AD_001", businessUnit: "광고사업부" },
  { keywords: ["BANK_PLATFORM_001", "19013209204016"], accountId: "BANK_PLATFORM_001", businessUnit: "플랫폼" },
  { keywords: ["BANK_PARTNER_001", "12691002911604", "12691002745704"], accountId: "BANK_PARTNER_001", businessUnit: "대외협력" },
  { keywords: ["BANK_COMMON_001", "100037330273", "한국투자", "한투", "신한"], accountId: "BANK_COMMON_001", businessUnit: "공통사용분" }
];

function compact(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(compact(keyword)));
}

function normalizeBusinessUnit(value?: string | null): BusinessUnitValue {
  const raw = String(value || "");
  return units.find((unit) => raw.includes(unit)) || "미배분";
}

function normalizeExpenseBasis(value?: string | null): ExpenseBasisValue | undefined {
  if (value === "비용성" || value === "비용") return "비용성";
  if (value === "자산성" || value === "자산") return "자산성";
  if (value === "해당없음") return "해당없음";
  return undefined;
}

function normalizeReviewStatus(value?: string | null): ReviewStatusValue {
  return value === "정상" ? "정상" : "확인필요";
}

function inferAccount(text: string) {
  return accountRules.find((rule) => includesAny(text, rule.keywords));
}

function buildText(input: FirstPassInput) {
  return compact([
    input.source,
    input.accountId,
    input.cardBudgetGroup,
    input.vendor,
    input.description,
    input.mainCategory,
    input.subCategory,
    input.detailCategory,
    input.talentInvestmentType,
    input.memo
  ].join(" "));
}

export function classifyFirstPass(input: FirstPassInput): FirstPassResult {
  const text = buildText(input);
  const account = inferAccount(text);
  const source = String(input.source || "");
  const originalUnit = normalizeBusinessUnit(input.businessUnit);
  const originalMain = input.mainCategory?.trim() || "미분류";
  const originalSub = input.subCategory?.trim() || "미분류";
  const originalDetail = input.detailCategory?.trim() || "미분류";
  const cashFlowType = String(input.cashFlowType || "");

  let result: FirstPassResult = {
    businessUnit: account?.businessUnit || originalUnit,
    accountId: input.accountId || account?.accountId || undefined,
    mainCategory: originalMain,
    subCategory: originalSub,
    detailCategory: originalDetail,
    talentInvestmentType: input.talentInvestmentType || undefined,
    expenseBasis: normalizeExpenseBasis(input.expenseBasis) || (cashFlowType === "출금" ? "비용성" : "해당없음"),
    isInternalTransfer: Boolean(input.isInternalTransfer),
    isCommonUse: Boolean(input.isCommonUse),
    commonPolicy: input.commonPolicy || undefined,
    reviewStatus: normalizeReviewStatus(input.reviewStatus),
    confidence: account ? 0.74 : 0.35,
    matchedRule: account ? "bank-account-master" : "fallback"
  };

  const apply = (patch: Partial<FirstPassResult> & Pick<FirstPassResult, "matchedRule">) => {
    result = { ...result, ...patch };
  };

  const applyTalent = (
    talentInvestmentType: string,
    subCategory: string,
    detailCategory: string,
    matchedRule: string,
    businessUnit: BusinessUnitValue = result.businessUnit === "미배분" ? "공통사용분" : result.businessUnit,
    expenseBasis: ExpenseBasisValue = "비용성"
  ) => {
    apply({
      businessUnit,
      mainCategory: "인재투자비",
      subCategory,
      detailCategory,
      talentInvestmentType,
      expenseBasis,
      isCommonUse: businessUnit === "공통사용분",
      commonPolicy: businessUnit === "공통사용분" ? "광고사업부 제외" : result.commonPolicy,
      reviewStatus: "정상",
      confidence: 0.86,
      matchedRule
    });
  };

  if (includesAny(text, ["보통예금", "현금출금", "증권계좌입출금", "카드미지급비용", "카드대금", "타사이체출금"])) {
    apply({
      businessUnit: result.businessUnit === "미배분" ? "공통사용분" : result.businessUnit,
      mainCategory: includesAny(text, ["카드미지급비용", "카드대금"]) ? "카드대금" : "계좌이체",
      subCategory: includesAny(text, ["카드미지급비용", "카드대금"]) ? "법인카드 결제" : "계좌 간 이동",
      detailCategory: "중복 집계 제외",
      expenseBasis: "해당없음",
      isInternalTransfer: true,
      isCommonUse: result.businessUnit === "공통사용분",
      reviewStatus: "정상",
      confidence: 0.9,
      matchedRule: "cash-transfer-or-card-payment"
    });
  } else if (cashFlowType === "입금" && includesAny(text, ["외상매출금", "광고매출", "매출", "광고주"])) {
    apply({
      businessUnit: result.businessUnit === "미배분" ? "광고사업부" : result.businessUnit,
      mainCategory: "매출",
      subCategory: includesAny(text, ["플랫폼"]) ? "플랫폼 매출" : "광고 매출",
      detailCategory: originalMain === "미분류" ? "입금 매출" : originalMain,
      expenseBasis: "해당없음",
      reviewStatus: "정상",
      confidence: 0.88,
      matchedRule: "bank-sales-deposit"
    });
  } else if (cashFlowType === "입금" && includesAny(text, ["정부지원금", "영업외수익", "이자수익", "환급"])) {
    apply({
      businessUnit: result.businessUnit === "미배분" ? "공통사용분" : result.businessUnit,
      mainCategory: "영업외수익",
      subCategory: includesAny(text, ["정부지원금"]) ? "정부지원금" : "기타수익",
      detailCategory: originalMain === "미분류" ? "입금 수익" : originalMain,
      expenseBasis: "해당없음",
      reviewStatus: "정상",
      confidence: 0.82,
      matchedRule: "bank-non-operating-income"
    });
  } else if (includesAny(text, ["단기차입금", "장기차입금", "대출금", "차입", "대출상환"])) {
    apply({
      businessUnit: result.businessUnit === "미배분" ? "공통사용분" : result.businessUnit,
      mainCategory: "부채",
      subCategory: "차입금",
      detailCategory: originalMain,
      expenseBasis: "해당없음",
      reviewStatus: "정상",
      confidence: 0.86,
      matchedRule: "loan-principal"
    });
  } else if (includesAny(text, ["대출이자비용", "이자비용"])) {
    apply({
      businessUnit: result.businessUnit === "미배분" ? "공통사용분" : result.businessUnit,
      mainCategory: "금융비용",
      subCategory: "대출이자",
      detailCategory: originalMain,
      expenseBasis: "비용성",
      isCommonUse: true,
      commonPolicy: "광고사업부 제외",
      reviewStatus: "정상",
      confidence: 0.86,
      matchedRule: "loan-interest"
    });
  } else if (includesAny(text, ["광고선전비", "광고비", "메조", "매체", "리워드광고", "네이버광고", "카카오광고"])) {
    apply({
      businessUnit: "광고사업부",
      mainCategory: "광고비",
      subCategory: originalSub === "미분류" ? "매체비" : originalSub,
      detailCategory: originalMain === "미분류" ? "광고 집행" : originalMain,
      expenseBasis: "비용성",
      reviewStatus: "정상",
      confidence: 0.9,
      matchedRule: "ad-cost"
    });
  } else if (includesAny(text, ["앱개발비", "서버구축비", "비품자산", "임차보증금", "보증금", "임직원대여금", "개발중인무형자산", "지식재산공제부금", "자산취득", "유무형자산"])) {
    apply({
      businessUnit: includesAny(text, ["앱", "서버", "플랫폼"]) ? "플랫폼" : result.businessUnit === "미배분" ? "공통사용분" : result.businessUnit,
      mainCategory: "자산취득",
      subCategory: includesAny(text, ["앱", "서버", "무형", "지식재산"]) ? "유무형자산" : "보증금/비품",
      detailCategory: originalMain === "미분류" ? originalSub : originalMain,
      expenseBasis: "자산성",
      reviewStatus: "정상",
      confidence: 0.85,
      matchedRule: "asset-acquisition"
    });
  } else if (includesAny(text, ["#인투1", "인투(집)", "인투1집", "지급임차료", "사택", "월세"])) {
    applyTalent("인투1 집", "인투1 집", includesAny(text, ["보증금"]) ? "사택 보증금" : "사택/운영공간 월세", "talent-1-house", "공통사용분", includesAny(text, ["보증금"]) ? "자산성" : "비용성");
  } else if (includesAny(text, ["#인투2", "인투(차)", "인투2차", "법인차량", "리스료", "차량", "주유", "주차", "세차", "탁송", "고속도로", "도로공사", "통행료"])) {
    applyTalent("인투2 차", "인투2 차", includesAny(text, ["리스"]) ? "차량 리스료" : "차량 유지/교통", "talent-2-car");
  } else if (includesAny(text, ["#인투3", "인투(밥)", "인투3밥", "식대", "조식", "커피", "카페", "편의점", "간식", "한식", "복리후생비"])) {
    applyTalent("인투3 밥", "인투3 밥", includesAny(text, ["커피", "카페"]) ? "커피/카페" : "식대/간식", "talent-3-meal");
  } else if (includesAny(text, ["#인투4", "인투(몸)", "인투(돈)", "인투4몸", "복지포인트", "일자리공제", "내일채움공제", "4대보험", "보험료"])) {
    applyTalent("인투4 몸", "인투4 몸", includesAny(text, ["4대보험", "보험료"]) ? "보험/공제" : "복지포인트/공제", "talent-4-welfare");
  } else if (includesAny(text, ["#인투5", "인투(성장)", "인투5성장", "플랫폼", "교육훈련비", "교육", "출장", "숙박", "여비교통비", "교통비", "구글", "openai", "gemini", "재미나이", "클링ai", "kling", "ai"])) {
    const isPlatform = includesAny(text, ["플랫폼", "구글", "openai", "gemini", "재미나이", "클링ai", "kling", "ai", "앱"]);
    applyTalent("인투5 성장", "인투5 성장", includesAny(text, ["출장", "숙박", "교통비", "고속도로"]) ? "출장/교통" : "플랫폼/교육", "talent-5-growth", isPlatform ? "플랫폼" : result.businessUnit === "미배분" ? "공통사용분" : result.businessUnit);
  } else if (includesAny(text, ["#인투6", "인투(환경)", "인투6환경", "환경용품", "소모품비", "사무용품", "도서인쇄비", "통신비", "공과금", "건물관리비", "전력비", "수도광열비", "인터넷", "정수기", "복사기", "보안"])) {
    applyTalent("인투6 환경", "인투6 환경", includesAny(text, ["통신", "인터넷"]) ? "통신/인터넷" : "사무환경/소모품", "talent-6-environment");
  } else if (includesAny(text, ["직원급여", "급여", "사업소득", "인건비"])) {
    apply({
      businessUnit: "공통사용분",
      mainCategory: "인건비",
      subCategory: includesAny(text, ["사업소득"]) ? "사업소득" : "급여",
      detailCategory: originalMain,
      expenseBasis: "비용성",
      isCommonUse: true,
      commonPolicy: "광고사업부 제외",
      reviewStatus: "정상",
      confidence: 0.84,
      matchedRule: "payroll"
    });
  } else if (includesAny(text, ["외상매입금", "지급수수료", "용역수수료", "세금과공과", "접대비"])) {
    apply({
      businessUnit: result.businessUnit === "미배분" ? (includesAny(text, ["접대비", "대표님"]) ? "대외협력" : "공통사용분") : result.businessUnit,
      mainCategory: originalMain,
      subCategory: originalSub === "미분류" ? originalMain : originalSub,
      detailCategory: originalSub === "미분류" ? originalMain : originalSub,
      expenseBasis: "비용성",
      isCommonUse: result.businessUnit === "공통사용분",
      commonPolicy: result.businessUnit === "공통사용분" ? "광고사업부 제외" : result.commonPolicy,
      reviewStatus: "정상",
      confidence: 0.72,
      matchedRule: "general-expense-account"
    });
  } else if (source === "카드" && originalMain !== "미분류") {
    const businessUnit = includesAny(text, ["대표님", "접대", "출장"]) ? "대외협력" : result.businessUnit === "미배분" ? "공통사용분" : result.businessUnit;
    apply({
      businessUnit,
      mainCategory: originalMain,
      subCategory: originalSub,
      detailCategory: originalSub === "미분류" ? originalMain : originalSub,
      expenseBasis: "비용성",
      isCommonUse: businessUnit === "공통사용분",
      commonPolicy: businessUnit === "공통사용분" ? "광고사업부 제외" : result.commonPolicy,
      reviewStatus: "정상",
      confidence: 0.66,
      matchedRule: "card-account-fallback"
    });
  }

  if (result.businessUnit === "공통사용분") {
    result.isCommonUse = true;
    result.commonPolicy = result.commonPolicy || "광고사업부 제외";
  }

  if (result.businessUnit === "미배분" || result.matchedRule === "fallback") {
    result.reviewStatus = "확인필요";
    result.confidence = Math.min(result.confidence, 0.5);
  }

  return result;
}
