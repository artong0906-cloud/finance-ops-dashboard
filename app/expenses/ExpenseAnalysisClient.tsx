"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { chartColors, RankBar } from "@/components/shared/FinanceViz";
import { formatKRW } from "@/services/dashboard/calculations";
import type { Transaction } from "@/types/finance";

const categoryLabels = ["인재투자", "환불", "급여", "광고비", "세금", "운영비", "기타"] as const;
const talentLabels = ["인투1 집", "인투2 차", "인투3 밥", "인투4 돈", "인투5 성장", "인투6 환경"] as const;
const allCategoryFilter = "전체";
const allTalentFilter = "전체 인재투자";
const operatingLabels = ["일반운영비", "이자"] as const;
const allOperatingFilter = "전체 운영비";
const allCardUserFilter = "전체 카드사";
const nonCardUserFilter = "카드 외";
const unknownCardUserFilter = "카드사 미지정";
const highlightCardStyles = [
  { bg: "linear-gradient(135deg, #2f5f9e 0%, #2a548f 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .18)" },
  { bg: "linear-gradient(135deg, #3b6ca0 0%, #315784 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .16)" },
  { bg: "linear-gradient(135deg, #327f98 0%, #2d6185 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .16)" },
  { bg: "linear-gradient(135deg, #365173 0%, #2f3f5d 100%)", shadow: "0 12px 26px rgba(54, 81, 115, .16)" }
];

type ExpenseCategory = typeof allCategoryFilter | (typeof categoryLabels)[number];
type TalentFilter = typeof allTalentFilter | (typeof talentLabels)[number];
type OperatingFilter = typeof allOperatingFilter | (typeof operatingLabels)[number];
type TalentCode = "1" | "2" | "3" | "4" | "5" | "6";

type Summary = {
  label: string;
  amount: number;
  count: number;
  share: number;
};

type CardUserSummary = {
  label: string;
  amount: number;
  count: number;
};

type ResolvedExpenseRow = {
  row: Transaction;
  category: (typeof categoryLabels)[number];
  categoryDetail: string;
  talentCode?: TalentCode;
  talentType?: (typeof talentLabels)[number];
  operatingType?: (typeof operatingLabels)[number];
  cardUser: string;
};

const talentLabelByCode: Record<TalentCode, (typeof talentLabels)[number]> = {
  "1": "인투1 집",
  "2": "인투2 차",
  "3": "인투3 밥",
  "4": "인투4 돈",
  "5": "인투5 성장",
  "6": "인투6 환경"
};

function sumResolvedAmount(rows: ResolvedExpenseRow[]) {
  return rows.reduce((sum, { row }) => sum + row.amount, 0);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function normalizeText(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}#·._-]/g, "");
}

function normalizeFilterText(value: string | undefined) {
  return (value || "")
    .trim()
    .replace(/[()[\]{}·._-]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function rowText(row: Transaction) {
  return normalizeText([
    row.source,
    row.businessUnit,
    row.accountId,
    row.cardBudgetGroup,
    row.cardIssuer,
    row.vendor,
    row.description,
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.talentInvestmentType,
    row.memo
  ].filter(Boolean).join(" "));
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function talentCodeFromText(value: string | undefined): TalentCode | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;

  if (includesAny(text, ["인투1", "투자1", "인재투자1", "인투집", "투자집"])) return "1";
  if (includesAny(text, ["인투2", "투자2", "인재투자2", "인투차", "투자차"])) return "2";
  if (includesAny(text, ["인투3", "투자3", "인재투자3", "인투밥", "투자밥"])) return "3";
  if (includesAny(text, ["인투4", "투자4", "인재투자4", "인투돈", "투자돈", "인투몸", "투자몸"])) return "4";
  if (includesAny(text, ["인투5", "투자5", "인재투자5", "인투성장", "투자성장"])) return "5";
  if (includesAny(text, ["인투6", "투자6", "인재투자6", "인투환경", "투자환경"])) return "6";

  return undefined;
}

function fallbackTalentCodeFromText(value: string | undefined): TalentCode | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;

  if (includesAny(text, ["사택", "월세", "지급임차료"])) return "1";
  if (includesAny(text, ["법인차량", "차량", "리스료", "주유", "주차", "통행료"])) return "2";
  if (includesAny(text, ["식대", "간식", "커피", "카페", "편의점"])) return "3";
  if (includesAny(text, ["복지포인트", "내일채움", "일자리공제", "4대보험", "보험료"])) return "4";
  if (includesAny(text, ["교육", "출장", "숙박", "플랫폼", "openai", "gemini", "kling", "ai"])) return "5";
  if (includesAny(text, ["사무용품", "소모품", "통신비", "공과금", "전력비", "인터넷", "정수기", "보안"])) return "6";

  return undefined;
}

function resolveTalentCode(row: Transaction): TalentCode | undefined {
  const structuredText = [
    row.talentInvestmentType,
    row.subCategory,
    row.detailCategory,
    row.mainCategory
  ].filter(Boolean).join(" ");
  const explicitText = [
    row.talentInvestmentType,
    row.subCategory,
    row.detailCategory,
    row.mainCategory,
    row.description,
    row.memo
  ].filter(Boolean).join(" ");

  return talentCodeFromText(structuredText)
    || talentCodeFromText(explicitText)
    || fallbackTalentCodeFromText(structuredText)
    || fallbackTalentCodeFromText(explicitText);
}

function hasExplicitTalentMarker(row: Transaction) {
  const text = normalizeText([
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.description,
    row.memo
  ].filter(Boolean).join(" "));

  return includesAny(text, [
    "인투1",
    "인투2",
    "인투3",
    "인투4",
    "인투5",
    "인투6",
    "인투집",
    "인투차",
    "인투밥",
    "인투돈",
    "인투몸",
    "인투성장",
    "인투환경",
    "인재투자1",
    "인재투자2",
    "인재투자3",
    "인재투자4",
    "인재투자5",
    "인재투자6"
  ]);
}

function resolveTalentType(row: Transaction): (typeof talentLabels)[number] | undefined {
  const code = resolveTalentCode(row);
  return code ? talentLabelByCode[code] : undefined;
}

function editableDetailOptions(category: (typeof categoryLabels)[number]) {
  if (category === "인재투자") return [...talentLabels];
  if (category === "운영비") return [...operatingLabels];
  return [];
}

function resolveCategory(row: Transaction, talentType?: (typeof talentLabels)[number]) {
  const text = rowText(row);
  const isBankWithdrawal = row.source === "은행";
  const isExplicitTalent = Boolean(talentType && hasExplicitTalentMarker(row));
  const persistedText = normalizeText([
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.talentInvestmentType,
    row.memo
  ].filter(Boolean).join(" "));
  const persistedTalentCode = resolveTalentCode(row);
  const persistedTalentType = persistedTalentCode ? talentLabelByCode[persistedTalentCode] : talentType;

  if (persistedTalentCode && hasExplicitTalentMarker(row) && persistedTalentType) {
    return {
      category: "인재투자" as const,
      detail: persistedTalentType
    };
  }

  if (persistedText.includes(normalizeText("매출환불")) || persistedText.includes(normalizeText("수동분류: 환불"))) {
    return {
      category: "환불" as const,
      detail: row.detailCategory && row.detailCategory !== "미분류" ? row.detailCategory : "환불/취소"
    };
  }

  if (persistedText.includes(normalizeText("인건비")) || persistedText.includes(normalizeText("수동분류: 급여"))) {
    return {
      category: "급여" as const,
      detail: row.detailCategory && row.detailCategory !== "미분류" ? row.detailCategory : "급여"
    };
  }

  if (persistedText.includes(normalizeText("광고비")) || persistedText.includes(normalizeText("수동분류: 광고비"))) {
    return {
      category: "광고비" as const,
      detail: row.detailCategory && row.detailCategory !== "미분류" ? row.detailCategory : "광고비"
    };
  }

  if (persistedText.includes(normalizeText("세금과공과")) || persistedText.includes(normalizeText("수동분류: 세금"))) {
    return {
      category: "세금" as const,
      detail: row.detailCategory && row.detailCategory !== "미분류" ? row.detailCategory : "세금"
    };
  }

  if (persistedText.includes(normalizeText("운영비")) || persistedText.includes(normalizeText("수동분류: 운영비"))) {
    const operatingType = row.detailCategory === "이자" || row.subCategory === "이자" ? "이자" : "일반운영비";
    return {
      category: "운영비" as const,
      detail: operatingType
    };
  }

  if (persistedText.includes(normalizeText("수동분류: 기타")) || persistedText === normalizeText("기타")) {
    return {
      category: "기타" as const,
      detail: row.detailCategory && row.detailCategory !== "미분류" ? row.detailCategory : "기타"
    };
  }

  if (isBankWithdrawal && includesAny(text, ["환불", "매출취소", "결제취소", "용역수수료지급"])) {
    return {
      category: "환불" as const,
      detail: includesAny(text, ["용역수수료지급"]) ? "용역수수료 지급" : "환불/취소"
    };
  }

  if (includesAny(text, ["프리급여", "급여", "학자금상환", "4대보험", "지방세", "사업소득세", "근로소득세", "원천세", "고용보험", "건강보험", "국민연금"])) {
    return {
      category: "급여" as const,
      detail: includesAny(text, ["4대보험", "고용보험", "건강보험", "국민연금"])
        ? "4대보험"
        : includesAny(text, ["지방세", "사업소득세", "근로소득세", "원천세"])
          ? "급여 원천세"
          : includesAny(text, ["학자금상환"])
            ? "학자금상환"
            : includesAny(text, ["프리급여"])
              ? "프리급여"
              : "급여"
    };
  }

  if (isBankWithdrawal && includesAny(text, ["메조미디어", "메조", "롯데카드", "제이와이네트워크", "위픽코퍼레이션", "바나나몽키", "광고비", "광고선전비", "매체비"])) {
    return {
      category: "광고비" as const,
      detail: includesAny(text, ["롯데카드"]) ? "롯데카드"
        : includesAny(text, ["메조"]) ? "메조미디어"
          : includesAny(text, ["제이와이네트워크"]) ? "제이와이네트워크"
            : includesAny(text, ["위픽코퍼레이션"]) ? "위픽코퍼레이션"
              : includesAny(text, ["바나나몽키"]) ? "바나나몽키"
                : "광고비"
    };
  }

  if (isExplicitTalent && talentType) {
    return {
      category: "인재투자" as const,
      detail: talentType
    };
  }

  if (includesAny(text, ["부가세", "부가가치세", "과태료", "과테료", "면허세", "주민세", "법인세", "세금과공과"])) {
    return {
      category: "세금" as const,
      detail: includesAny(text, ["부가세", "부가가치세"]) ? "부가세"
        : includesAny(text, ["과태료", "과테료"]) ? "과태료"
          : includesAny(text, ["면허세"]) ? "면허세"
            : "세금"
    };
  }

  if (talentType) {
    return {
      category: "인재투자" as const,
      detail: talentType
    };
  }

  if (includesAny(text, ["이자", "대출이자", "대외협력", "공통사용분", "공통운영비", "운영비", "지급수수료", "수수료", "관리비", "임차료"])) {
    return {
      category: "운영비" as const,
      detail: includesAny(text, ["이자", "대출이자"]) ? "이자"
        : includesAny(text, ["대외협력"]) || row.businessUnit === "대외협력" ? "대외협력부 운영비"
          : includesAny(text, ["공통사용분", "공통운영비"]) || row.businessUnit === "공통사용분" ? "공통운영비"
            : "일반 운영비"
    };
  }

  return {
    category: "기타" as const,
    detail: row.mainCategory && row.mainCategory !== "미분류" ? row.mainCategory : "기타"
  };
}

function resolveActiveCategory(value: string | undefined, talentValue: string | undefined): ExpenseCategory {
  if (!value && talentValue) return "인재투자";
  if (!value) return allCategoryFilter;
  if (categoryLabels.includes(value as (typeof categoryLabels)[number])) return value as ExpenseCategory;

  const normalized = normalizeText(value);
  const matched = categoryLabels.find((label) => includesAny(normalized, [label]));
  return matched || allCategoryFilter;
}

function resolveActiveTalent(value: string | undefined): TalentFilter {
  if (!value) return allTalentFilter;
  if (talentLabels.includes(value as (typeof talentLabels)[number])) return value as TalentFilter;

  const normalized = normalizeText(value);
  if (includesAny(normalized, ["인투1", "투자1", "집"])) return "인투1 집";
  if (includesAny(normalized, ["인투2", "투자2", "차"])) return "인투2 차";
  if (includesAny(normalized, ["인투3", "투자3", "밥"])) return "인투3 밥";
  if (includesAny(normalized, ["인투4", "투자4", "돈", "몸"])) return "인투4 돈";
  if (includesAny(normalized, ["인투5", "투자5", "성장"])) return "인투5 성장";
  if (includesAny(normalized, ["인투6", "투자6", "환경"])) return "인투6 환경";

  return allTalentFilter;
}

function resolveActiveOperating(value: string | undefined): OperatingFilter {
  if (!value) return allOperatingFilter;
  if (operatingLabels.includes(value as (typeof operatingLabels)[number])) return value as OperatingFilter;

  const normalized = normalizeText(value);
  if (includesAny(normalized, ["이자", "대출이자"])) return "이자";
  if (includesAny(normalized, ["일반운영비", "운영비", "일반"])) return "일반운영비";

  return allOperatingFilter;
}

function resolveCardUser(row: Transaction) {
  if (row.source !== "카드") return nonCardUserFilter;
  return row.cardIssuer || row.cardBudgetGroup || unknownCardUserFilter;
}

function resolveActiveCardUser(value: string | undefined, summaries: CardUserSummary[]) {
  if (!value) return allCardUserFilter;

  const normalized = normalizeFilterText(value);
  if (normalizeFilterText(allCardUserFilter) === normalized) return allCardUserFilter;

  const matched = summaries.find((summary) => normalizeFilterText(summary.label) === normalized);
  return matched?.label || allCardUserFilter;
}

function resolveTalentFilterCode(value: TalentFilter): TalentCode | undefined {
  return value === allTalentFilter ? undefined : talentCodeFromText(value);
}

function getResolvedTalentCode(item: ResolvedExpenseRow) {
  return talentCodeFromText(item.categoryDetail)
    || talentCodeFromText(item.talentType)
    || item.talentCode;
}

function splitTalentLabel(label: string) {
  const [code, ...rest] = label.split(" ");
  return {
    code,
    name: rest.join(" ") || label
  };
}

function expenseHref({
  category = allCategoryFilter,
  talent = allTalentFilter,
  operating = allOperatingFilter,
  cardUser = allCardUserFilter,
  month
}: {
  category?: ExpenseCategory;
  talent?: TalentFilter;
  operating?: OperatingFilter;
  cardUser?: string;
  month?: string;
}) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (category !== allCategoryFilter) params.set("category", category);
  if (category === "인재투자" && talent !== allTalentFilter) params.set("talent", talent);
  if (category === "운영비" && operating !== allOperatingFilter) params.set("operating", operating);
  if (category === "인재투자" && cardUser !== allCardUserFilter) params.set("cardUser", cardUser);
  const query = params.toString();

  return `/expenses${query ? `?${query}` : ""}#expense-detail`;
}

function buildSummaries<T extends string>(labels: readonly T[], rows: ResolvedExpenseRow[], pick: (row: ResolvedExpenseRow) => string | undefined): Summary[] {
  const total = sumResolvedAmount(rows);

  return labels.map((label) => {
    const filtered = rows.filter((item) => pick(item) === label);
    const amount = sumResolvedAmount(filtered);

    return {
      label,
      amount,
      count: filtered.length,
      share: total > 0 ? (amount / total) * 100 : 0
    };
  });
}

function buildCardUserSummaries(rows: ResolvedExpenseRow[]) {
  const grouped = rows.reduce((acc, item) => {
    const current = acc.get(item.cardUser) || { label: item.cardUser, amount: 0, count: 0 };
    current.amount += item.row.amount;
    current.count += 1;
    acc.set(item.cardUser, current);
    return acc;
  }, new Map<string, CardUserSummary>());

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.label === nonCardUserFilter) return 1;
    if (b.label === nonCardUserFilter) return -1;
    if (a.label === unknownCardUserFilter) return 1;
    if (b.label === unknownCardUserFilter) return -1;
    return b.amount - a.amount;
  });
}

export function ExpenseAnalysisClient({
  activeCategory: activeCategoryValue,
  activeTalent: activeTalentValue,
  activeOperating: activeOperatingValue,
  activeCardUser: activeCardUserValue,
  activeMonth,
  expenseRows
}: {
  activeCategory?: string;
  activeTalent?: string;
  activeOperating?: string;
  activeCardUser?: string;
  activeMonth?: string;
  expenseRows: Transaction[];
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>(() => resolveActiveCategory(activeCategoryValue, activeTalentValue));
  const [selectedTalent, setSelectedTalent] = useState<TalentFilter>(() => resolveActiveTalent(activeTalentValue));
  const [selectedOperating, setSelectedOperating] = useState<OperatingFilter>(() => resolveActiveOperating(activeOperatingValue));
  const [selectedCardUser, setSelectedCardUser] = useState(() => activeCardUserValue || allCardUserFilter);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editCategory, setEditCategory] = useState<(typeof categoryLabels)[number]>("인재투자");
  const [editDetail, setEditDetail] = useState<string>("인투1 집");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCategory(resolveActiveCategory(activeCategoryValue, activeTalentValue));
    setSelectedTalent(resolveActiveTalent(activeTalentValue));
    setSelectedOperating(resolveActiveOperating(activeOperatingValue));
    setSelectedCardUser(activeCardUserValue || allCardUserFilter);
  }, [activeCardUserValue, activeCategoryValue, activeOperatingValue, activeTalentValue]);

  useEffect(() => {
    const options = editableDetailOptions(editCategory);
    if (options.length === 0) {
      if (editDetail) setEditDetail("");
      return;
    }

    if (!options.some((option) => option === editDetail)) {
      setEditDetail(options[0]);
    }
  }, [editCategory, editDetail]);

  const activeCategory = selectedCategory;
  const activeTalent = activeCategory === "인재투자" ? selectedTalent : allTalentFilter;
  const activeTalentCode = activeCategory === "인재투자" ? resolveTalentFilterCode(activeTalent) : undefined;
  const activeOperating = activeCategory === "운영비" ? selectedOperating : allOperatingFilter;
  const resolvedRows: ResolvedExpenseRow[] = useMemo(() => expenseRows.map((row) => {
    const talentCode = resolveTalentCode(row);
    const talentType = resolveTalentType(row);
    const { category, detail } = resolveCategory(row, talentType);
    const operatingType = category === "운영비"
      ? detail === "이자" ? "이자" as const : "일반운영비" as const
      : undefined;

    return {
      row,
      category,
      categoryDetail: detail,
      talentCode,
      talentType,
      operatingType,
      cardUser: resolveCardUser(row)
    };
  }), [expenseRows]);

  const categoryFilteredRows = useMemo(() => activeCategory === allCategoryFilter
    ? resolvedRows
    : resolvedRows.filter((item) => item.category === activeCategory), [activeCategory, resolvedRows]);
  const talentFilteredRows = useMemo(() => activeCategory === "인재투자" && activeTalent !== allTalentFilter
    ? categoryFilteredRows.filter((item) => getResolvedTalentCode(item) === activeTalentCode)
    : categoryFilteredRows, [activeCategory, activeTalent, activeTalentCode, categoryFilteredRows]);
  const detailFilteredRows = useMemo(() => activeCategory === "운영비" && activeOperating !== allOperatingFilter
    ? categoryFilteredRows.filter((item) => item.operatingType === activeOperating)
    : talentFilteredRows, [activeCategory, activeOperating, categoryFilteredRows, talentFilteredRows]);
  const activeTalentLabel = activeTalentCode ? talentLabelByCode[activeTalentCode] : undefined;
  const strictTalentRows = useMemo(() => activeCategory === "인재투자" && activeTalentCode
    ? detailFilteredRows.filter((item) => getResolvedTalentCode(item) === activeTalentCode && item.categoryDetail === activeTalentLabel)
    : detailFilteredRows, [activeCategory, activeTalentCode, activeTalentLabel, detailFilteredRows]);
  const canFilterByCardUser = activeCategory === "인재투자";
  const cardUserSummaries = useMemo(() => canFilterByCardUser ? buildCardUserSummaries(strictTalentRows) : [], [canFilterByCardUser, strictTalentRows]);
  const activeCardUser = canFilterByCardUser ? resolveActiveCardUser(selectedCardUser, cardUserSummaries) : allCardUserFilter;
  const isCardUserFiltered = canFilterByCardUser && activeCardUser !== allCardUserFilter;
  const filteredRows = useMemo(() => !canFilterByCardUser || activeCardUser === allCardUserFilter
    ? strictTalentRows
    : strictTalentRows.filter((item) => item.cardUser === activeCardUser), [activeCardUser, canFilterByCardUser, strictTalentRows]);
  const finalDetailRows = useMemo(() => activeCategory === "인재투자" && activeTalentCode
    ? filteredRows.filter((item) => getResolvedTalentCode(item) === activeTalentCode && item.categoryDetail === activeTalentLabel)
    : filteredRows, [activeCategory, activeTalentCode, activeTalentLabel, filteredRows]);
  const filteredTotal = useMemo(() => sumResolvedAmount(finalDetailRows), [finalDetailRows]);
  const visibleDetailIds = useMemo(() => finalDetailRows.map(({ row }) => row.id), [finalDetailRows]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = finalDetailRows.length > 0 && finalDetailRows.every(({ row }) => selectedIdSet.has(row.id));
  const editDetailOptions = useMemo(() => editableDetailOptions(editCategory), [editCategory]);
  const categorySummaries = useMemo(() => buildSummaries(categoryLabels, resolvedRows, (item) => item.category), [resolvedRows]);
  const talentSummaries = useMemo(() => buildSummaries(talentLabels, resolvedRows.filter((item) => item.category === "인재투자"), (item) => item.talentType), [resolvedRows]);
  const operatingSummaries = useMemo(() => buildSummaries(operatingLabels, resolvedRows.filter((item) => item.category === "운영비"), (item) => item.operatingType), [resolvedRows]);
  const totalExpense = useMemo(() => sumResolvedAmount(resolvedRows), [resolvedRows]);

  useEffect(() => {
    const allowed = new Set(visibleDetailIds);
    setSelectedIds((current) => current.filter((id) => allowed.has(id)));
  }, [visibleDetailIds]);

  function applyFilters({
    category = activeCategory,
    talent = activeTalent,
    operating = activeOperating,
    cardUser = activeCardUser,
    scrollToDetail = true
  }: {
    category?: ExpenseCategory;
    talent?: TalentFilter;
    operating?: OperatingFilter;
    cardUser?: string;
    scrollToDetail?: boolean;
  }) {
    const nextTalent = category === "인재투자" ? talent : allTalentFilter;
    const nextOperating = category === "운영비" ? operating : allOperatingFilter;
    const nextCardUser = category === "인재투자" ? cardUser : allCardUserFilter;

    setSelectedCategory(category);
    setSelectedTalent(nextTalent);
    setSelectedOperating(nextOperating);
    setSelectedCardUser(nextCardUser);

    if (typeof window !== "undefined") {
      window.history.pushState(null, "", expenseHref({
        category,
        talent: nextTalent,
        operating: nextOperating,
        cardUser: nextCardUser,
        month: activeMonth
      }));
      if (scrollToDetail) {
        window.requestAnimationFrame(() => {
          document.getElementById("expense-detail")?.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      }
    }
  }

  function handleCardUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextCardUser = String(formData.get("cardUser") || allCardUserFilter);
    applyFilters({ category: "인재투자", talent: activeTalent, cardUser: nextCardUser });
  }

  function toggleDetailRow(id: string) {
    setCategoryMessage(null);
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  }

  function toggleVisibleRows() {
    setCategoryMessage(null);
    setSelectedIds(allVisibleSelected ? [] : visibleDetailIds);
  }

  async function saveSelectedCategory() {
    if (selectedIds.length === 0) {
      setCategoryMessage("변경할 지출 거래를 먼저 선택해 주세요.");
      return;
    }

    setIsSavingCategory(true);
    setCategoryMessage(null);

    try {
      const response = await fetch("/api/transactions/categories", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "expense",
          transactionIds: selectedIds,
          category: editCategory,
          detail: editDetail
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "지출 구분 변경 중 오류가 발생했습니다.");
      }

      setSelectedIds([]);
      setCategoryMessage(`${(result.updatedCount ?? selectedIds.length).toLocaleString("ko-KR")}건을 ${editCategory}${editDetail ? ` · ${editDetail}` : ""}로 변경했습니다.`);
      router.refresh();
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "지출 구분 변경 중 오류가 발생했습니다.");
    } finally {
      setIsSavingCategory(false);
    }
  }

  return (
    <>
      <section className="mb-6 grid gap-4">
        <div className="grid auto-rows-max grid-cols-[repeat(7,minmax(0,1fr))] gap-2.5 max-2xl:grid-cols-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          {categorySummaries.map((summary, index) => {
            const selected = activeCategory === summary.label;
            const cardStyle = highlightCardStyles[index % highlightCardStyles.length];

            return (
              <button
                className={[
                  "min-h-[118px] self-start rounded-lg border border-white/10 p-3 text-left text-white transition",
                  selected ? "ring-2 ring-blue-100" : "hover:-translate-y-0.5 hover:ring-1 hover:ring-white/25"
                ].join(" ")}
                key={summary.label}
                onClick={() => applyFilters({ category: summary.label as ExpenseCategory })}
                type="button"
                aria-current={selected ? "true" : undefined}
                style={{ background: cardStyle.bg, boxShadow: selected ? cardStyle.shadow : undefined }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-h-[22px] items-center justify-center rounded-full bg-white/15 px-2 py-1 text-[11px] font-black text-white">{summary.label}</span>
                  <span className="text-xs font-black text-white/70">{formatPercent(summary.share)}</span>
                </div>
                <div className="mt-3 text-base font-black text-white">{formatKRW(summary.amount)}</div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs font-bold text-white/70">
                  <span>{summary.count.toLocaleString("ko-KR")}건</span>
                  <span>{selected ? "선택됨" : "조회"}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-white/75" style={{ width: `${Math.min(100, summary.share)}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="card">
          <div className="mb-4 flex items-start justify-between gap-4 max-lg:flex-col">
            <div>
              <h2 className="section-title">지출 비중</h2>
              <p className="mt-1 text-sm text-slate-500">유형별 지출 규모와 건수를 가로 막대 기준으로 비교합니다.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 max-lg:justify-start">
              <span className="badge">{activeCategory}</span>
              <span className="badge badge-muted">{formatKRW(filteredTotal)}</span>
              <span className="badge badge-muted">{finalDetailRows.length.toLocaleString("ko-KR")}건</span>
              <button className="btn btn-sm" onClick={() => applyFilters({ category: allCategoryFilter })} type="button">
                전체 지출 보기
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4 max-xl:grid-cols-1">
            <div className="grid gap-2.5">
              {categorySummaries.map((summary, index) => (
                <RankBar
                  amount={summary.amount}
                  color={chartColors[index % chartColors.length]}
                  count={summary.count}
                  key={summary.label}
                  label={summary.label}
                  total={totalExpense}
                />
              ))}
            </div>
            <div className="grid gap-3 self-start">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="eyebrow">총 지출</div>
                <div className="mt-2 text-xl font-black text-slate-950">{formatKRW(totalExpense)}</div>
                <div className="mt-1 text-xs text-slate-500">{resolvedRows.length.toLocaleString("ko-KR")}건 기준</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="eyebrow">현재 상세 필터</div>
                <div className="mt-2 text-base font-black text-slate-950">{activeCategory}</div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {activeCategory === "인재투자"
                    ? `하위유형: ${activeTalent}`
                    : activeCategory === "운영비"
                      ? `보조유형: ${activeOperating}`
                      : "대카테고리 기준"}
                  {canFilterByCardUser ? ` · 카드사/사용자: ${activeCardUser}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {activeCategory === "인재투자" ? (
        <section className="card mb-6">
          <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <h2 className="section-title">인재투자 하위 유형</h2>
              <p className="mt-1 text-sm text-slate-500">기존 인투1~6은 인재투자 대카테고리의 하위 개념으로 조회합니다.</p>
            </div>
            <button className="btn btn-sm" onClick={() => applyFilters({ category: "인재투자", talent: allTalentFilter, cardUser: allCardUserFilter })} type="button">전체 인재투자</button>
          </div>
          <div className="grid grid-cols-6 gap-3 max-2xl:grid-cols-3 max-md:grid-cols-1">
            {talentSummaries.map((summary) => {
              const selected = activeTalent === summary.label;
              const { code, name } = splitTalentLabel(summary.label);

              return (
                <button
                  className={[
                    "rounded-lg border p-4 text-left transition",
                    selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200"
                  ].join(" ")}
                  key={summary.label}
                  onClick={() => applyFilters({ category: "인재투자", talent: summary.label as TalentFilter, cardUser: allCardUserFilter })}
                  type="button"
                  aria-current={selected ? "true" : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={selected ? "badge" : "badge badge-muted"}>{code}</span>
                    <span className="text-xs font-black text-slate-400">{formatPercent(summary.share)}</span>
                  </div>
                  <div className="mt-2 text-sm font-black text-slate-950">{name}</div>
                  <div className="mt-2 text-base font-black text-slate-950">{formatKRW(summary.amount)}</div>
                  <div className="mt-1 text-xs text-slate-500">{summary.count.toLocaleString("ko-KR")}건</div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeCategory === "운영비" ? (
        <section className="card mb-6">
          <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <h2 className="section-title">운영비 보조 구분</h2>
              <p className="mt-1 text-sm text-slate-500">운영비는 일반운영비와 이자로 나누어 조회합니다.</p>
            </div>
            <button className="btn btn-sm" onClick={() => applyFilters({ category: "운영비", operating: allOperatingFilter })} type="button">전체 운영비</button>
          </div>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            {operatingSummaries.map((summary) => {
              const selected = activeOperating === summary.label;

              return (
                <button
                  className={[
                    "rounded-lg border p-4 text-left transition",
                    selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200"
                  ].join(" ")}
                  key={summary.label}
                  onClick={() => applyFilters({ category: "운영비", operating: summary.label as OperatingFilter })}
                  type="button"
                  aria-current={selected ? "true" : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={selected ? "badge" : "badge badge-muted"}>{summary.label}</span>
                    <span className="text-xs font-black text-slate-400">{formatPercent(summary.share)}</span>
                  </div>
                  <div className="mt-2 text-base font-black text-slate-950">{formatKRW(summary.amount)}</div>
                  <div className="mt-1 text-xs text-slate-500">{summary.count.toLocaleString("ko-KR")}건</div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="card" id="expense-detail">
        <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <h2 className="section-title">지출 상세</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeCategory === allCategoryFilter ? "전체 지출" : activeCategory}
              {activeCategory === "인재투자" && activeTalent !== allTalentFilter ? ` · ${activeTalent}` : ""}
              {activeCategory === "운영비" && activeOperating !== allOperatingFilter ? ` · ${activeOperating}` : ""}
              {canFilterByCardUser ? ` 중 ${activeCardUser} 기준` : " 기준"} {finalDetailRows.length.toLocaleString("ko-KR")}건을 표시합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{activeCategory}</span>
            {activeCategory === "인재투자" ? <span className="badge">{activeTalent}</span> : null}
            {activeCategory === "운영비" ? <span className="badge">{activeOperating}</span> : null}
            {canFilterByCardUser ? <span className="badge">{activeCardUser}</span> : null}
            <span className="badge badge-muted">{formatKRW(filteredTotal)}</span>
          </div>
        </div>

        {canFilterByCardUser ? <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <div className="eyebrow">카드사/사용자별 조회</div>
              <p className="mt-1 text-sm text-slate-600">
                현재 선택된 지출유형 안에서 매입신용카드 원본의 카드사 컬럼 기준으로 지출 상세를 다시 필터링합니다.
              </p>
            </div>
            <button
              className={[
                "btn btn-sm",
                activeCardUser === allCardUserFilter ? "bg-blue-50 text-blue-700" : ""
              ].join(" ")}
              onClick={() => applyFilters({ category: "인재투자", talent: activeTalent, cardUser: allCardUserFilter })}
              type="button"
            >
              전체 카드사 {strictTalentRows.length.toLocaleString("ko-KR")}건
            </button>
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-white" open={isCardUserFiltered}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-black text-slate-800 max-md:flex-col max-md:items-start">
              <span>{isCardUserFiltered ? activeCardUser : "카드사/사용자 선택 열기"}</span>
              <span className="badge badge-muted">
                {cardUserSummaries.length.toLocaleString("ko-KR")}개 카드사
              </span>
            </summary>
            <form className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-t border-slate-100 p-4 max-md:grid-cols-1" onSubmit={handleCardUserSubmit}>
              <input name="category" type="hidden" value="인재투자" />
              {activeTalent !== allTalentFilter ? <input name="talent" type="hidden" value={activeTalent} /> : null}
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                카드사/사용자
                <select className="field" defaultValue={isCardUserFiltered ? activeCardUser : ""} name="cardUser">
                  <option value="">전체 카드사</option>
                  {cardUserSummaries.map((summary) => (
                    <option key={summary.label} value={summary.label}>
                      {summary.label} · {summary.count.toLocaleString("ko-KR")}건 · {formatKRW(summary.amount)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary self-end" type="submit">
                조회
              </button>
              <button className="btn self-end" onClick={() => applyFilters({ category: "인재투자", talent: activeTalent, cardUser: allCardUserFilter })} type="button">
                해제
              </button>
            </form>
          </details>
        </div> : null}

        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_180px_180px_auto_auto] items-end gap-3 max-2xl:grid-cols-[minmax(0,1fr)_180px_180px] max-lg:grid-cols-1">
            <div>
              <div className="eyebrow">선택 구분 변경</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                상세 행을 체크한 뒤 지출유형을 변경하면 이후 집계와 월별 필터에도 같은 기준으로 반영됩니다.
              </p>
              {categoryMessage ? <p className="mt-2 text-sm font-bold text-blue-700">{categoryMessage}</p> : null}
            </div>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              지출유형
              <select className="field" value={editCategory} onChange={(event) => setEditCategory(event.target.value as (typeof categoryLabels)[number])}>
                {categoryLabels.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              하위유형
              <select
                className="field"
                disabled={editDetailOptions.length === 0}
                value={editDetail}
                onChange={(event) => setEditDetail(event.target.value)}
              >
                {editDetailOptions.length > 0 ? editDetailOptions.map((label) => (
                  <option key={label} value={label}>{label}</option>
                )) : <option value="">자동</option>}
              </select>
            </label>
            <button className="btn btn-primary" disabled={isSavingCategory || selectedIds.length === 0} onClick={saveSelectedCategory} type="button">
              {isSavingCategory ? "저장 중" : `선택 ${selectedIds.length.toLocaleString("ko-KR")}건 변경`}
            </button>
            <button className="btn" disabled={isSavingCategory || selectedIds.length === 0} onClick={() => setSelectedIds([])} type="button">
              선택 해제
            </button>
          </div>
        </div>

        {finalDetailRows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-10">
                    <input aria-label="표시된 지출 전체 선택" checked={allVisibleSelected} onChange={toggleVisibleRows} type="checkbox" />
                  </th>
                  <th>일자</th>
                  <th>지출유형</th>
                  <th>세부유형</th>
                  {canFilterByCardUser ? <th>카드사/사용자</th> : null}
                  <th>사업부</th>
                  <th>원천</th>
                  <th>대분류</th>
                  <th>중분류</th>
                  <th>세부항목</th>
                  <th>거래처</th>
                  <th>적요</th>
                  <th className="text-right">금액</th>
                  <th>비용/자산</th>
                </tr>
              </thead>
              <tbody>
                {finalDetailRows.map(({ row, category, categoryDetail, cardUser }, index) => (
                  <tr key={`${activeCategory}-${activeTalent}-${activeCardUser}-${row.id}-${index}`}>
                    <td>
                      <input
                        aria-label={`${row.date} ${row.vendor} 지출 선택`}
                        checked={selectedIdSet.has(row.id)}
                        onChange={() => toggleDetailRow(row.id)}
                        type="checkbox"
                      />
                    </td>
                    <td>{row.date}</td>
                    <td><span className="badge">{category}</span></td>
                    <td><span className="badge badge-muted">{categoryDetail}</span></td>
                    {canFilterByCardUser ? <td>
                      <span className={cardUser === nonCardUserFilter || cardUser === unknownCardUserFilter ? "badge badge-muted" : "badge"}>
                        {cardUser}
                      </span>
                    </td> : null}
                    <td>{row.businessUnit}</td>
                    <td>{row.source}</td>
                    <td>{row.mainCategory}</td>
                    <td>{row.subCategory}</td>
                    <td>{row.detailCategory}</td>
                    <td>{row.vendor}</td>
                    <td>{row.description}</td>
                    <td className="text-right font-black">{formatKRW(row.amount)}</td>
                    <td>{row.expenseBasis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="font-black text-slate-950">표시할 지출 상세가 없습니다.</div>
            <p className="mt-2 text-sm text-slate-500">다른 지출유형{canFilterByCardUser ? "이나 카드사/사용자 필터" : ""}을 선택해 주세요.</p>
            <button
              className="btn mt-4"
              onClick={() => applyFilters({ category: activeCategory, talent: activeTalent, operating: activeOperating, cardUser: allCardUserFilter })}
              type="button"
            >
              {canFilterByCardUser ? "카드사 필터 해제" : "현재 유형 다시 보기"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
