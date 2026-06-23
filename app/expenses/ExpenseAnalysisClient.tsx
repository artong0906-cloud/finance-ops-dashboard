import { formatKRW } from "@/services/dashboard/calculations";
import type { Transaction } from "@/types/finance";

const categoryLabels = ["인재투자", "환불", "급여", "광고비", "세금", "운영비", "기타"] as const;
const talentLabels = ["인투1 집", "인투2 차", "인투3 밥", "인투4 돈", "인투5 성장", "인투6 환경"] as const;
const allCategoryFilter = "전체";
const allTalentFilter = "전체 인재투자";
const allCardUserFilter = "전체 카드사";
const nonCardUserFilter = "카드 외";
const unknownCardUserFilter = "카드사 미지정";

type ExpenseCategory = typeof allCategoryFilter | (typeof categoryLabels)[number];
type TalentFilter = typeof allTalentFilter | (typeof talentLabels)[number];

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
  talentType?: (typeof talentLabels)[number];
  cardUser: string;
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

function resolveTalentType(row: Transaction): (typeof talentLabels)[number] | undefined {
  const categoryText = normalizeText([
    row.talentInvestmentType,
    row.mainCategory,
    row.subCategory,
    row.detailCategory
  ].filter(Boolean).join(" "));
  const explicitText = rowText(row);

  if (includesAny(categoryText, ["인투1", "투자1", "인재투자1", "인투집", "투자집", "사택", "월세", "지급임차료"])) return "인투1 집";
  if (includesAny(categoryText, ["인투2", "투자2", "인재투자2", "인투차", "투자차", "법인차량", "차량", "리스료", "주유", "주차", "통행료"])) return "인투2 차";
  if (includesAny(categoryText, ["인투3", "투자3", "인재투자3", "인투밥", "투자밥", "식대", "간식", "커피", "카페", "편의점"])) return "인투3 밥";
  if (includesAny(categoryText, ["인투4", "투자4", "인재투자4", "인투돈", "투자돈", "인투몸", "투자몸", "복지포인트", "내일채움", "일자리공제", "4대보험", "보험료"])) return "인투4 돈";
  if (includesAny(categoryText, ["인투5", "투자5", "인재투자5", "인투성장", "투자성장", "교육", "출장", "숙박", "플랫폼", "openai", "gemini", "kling", "ai"])) return "인투5 성장";
  if (includesAny(categoryText, ["인투6", "투자6", "인재투자6", "인투환경", "투자환경", "사무용품", "소모품", "통신비", "공과금", "전력비", "인터넷", "정수기", "보안"])) return "인투6 환경";

  if (includesAny(explicitText, ["인투1", "투자1", "인재투자1"])) return "인투1 집";
  if (includesAny(explicitText, ["인투2", "투자2", "인재투자2"])) return "인투2 차";
  if (includesAny(explicitText, ["인투3", "투자3", "인재투자3"])) return "인투3 밥";
  if (includesAny(explicitText, ["인투4", "투자4", "인재투자4"])) return "인투4 돈";
  if (includesAny(explicitText, ["인투5", "투자5", "인재투자5"])) return "인투5 성장";
  if (includesAny(explicitText, ["인투6", "투자6", "인재투자6"])) return "인투6 환경";

  return undefined;
}

function resolveCategory(row: Transaction, talentType?: (typeof talentLabels)[number]) {
  const text = rowText(row);
  const isBankWithdrawal = row.source === "은행";

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
  cardUser = allCardUserFilter
}: {
  category?: ExpenseCategory;
  talent?: TalentFilter;
  cardUser?: string;
}) {
  const params = new URLSearchParams();
  if (category !== allCategoryFilter) params.set("category", category);
  if (category === "인재투자" && talent !== allTalentFilter) params.set("talent", talent);
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
  activeCardUser: activeCardUserValue,
  expenseRows
}: {
  activeCategory?: string;
  activeTalent?: string;
  activeCardUser?: string;
  expenseRows: Transaction[];
}) {
  const activeCategory = resolveActiveCategory(activeCategoryValue, activeTalentValue);
  const activeTalent = activeCategory === "인재투자" ? resolveActiveTalent(activeTalentValue) : allTalentFilter;
  const resolvedRows: ResolvedExpenseRow[] = expenseRows.map((row) => {
    const talentType = resolveTalentType(row);
    const { category, detail } = resolveCategory(row, talentType);

    return {
      row,
      category,
      categoryDetail: detail,
      talentType,
      cardUser: resolveCardUser(row)
    };
  });

  const categoryFilteredRows = activeCategory === allCategoryFilter
    ? resolvedRows
    : resolvedRows.filter((item) => item.category === activeCategory);
  const talentFilteredRows = activeCategory === "인재투자" && activeTalent !== allTalentFilter
    ? categoryFilteredRows.filter((item) => item.talentType === activeTalent)
    : categoryFilteredRows;
  const canFilterByCardUser = activeCategory === "인재투자";
  const cardUserSummaries = canFilterByCardUser ? buildCardUserSummaries(talentFilteredRows) : [];
  const activeCardUser = canFilterByCardUser ? resolveActiveCardUser(activeCardUserValue, cardUserSummaries) : allCardUserFilter;
  const isCardUserFiltered = canFilterByCardUser && activeCardUser !== allCardUserFilter;
  const filteredRows = !canFilterByCardUser || activeCardUser === allCardUserFilter
    ? talentFilteredRows
    : talentFilteredRows.filter((item) => item.cardUser === activeCardUser);
  const filteredTotal = sumResolvedAmount(filteredRows);
  const categorySummaries = buildSummaries(categoryLabels, resolvedRows, (item) => item.category);
  const talentSummaries = buildSummaries(talentLabels, resolvedRows.filter((item) => item.category === "인재투자"), (item) => item.talentType);

  return (
    <>
      <section className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        지출을 인재투자, 환불, 급여, 광고비, 세금, 운영비, 기타 대카테고리로 먼저 나누고, 인재투자 안에서만 인투1~6 하위 유형을 다시 조회합니다.
      </section>

      <section className="mb-6 grid grid-cols-[minmax(0,1fr)_270px] gap-4 max-xl:grid-cols-1">
        <div className="grid grid-cols-7 gap-3 max-2xl:grid-cols-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          {categorySummaries.map((summary) => {
            const selected = activeCategory === summary.label;

            return (
              <a
                className={[
                  "card kpi cursor-pointer p-4 text-left transition",
                  selected ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-100" : "hover:border-blue-200 hover:bg-slate-50"
                ].join(" ")}
                href={expenseHref({ category: summary.label as ExpenseCategory })}
                key={summary.label}
                aria-current={selected ? "true" : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={selected ? "badge" : "badge badge-muted"}>{summary.label}</span>
                  <span className="text-xs font-black text-slate-400">{formatPercent(summary.share)}</span>
                </div>
                <div className="mt-4 text-lg font-black text-slate-950">{formatKRW(summary.amount)}</div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{summary.count.toLocaleString("ko-KR")}건</span>
                  <span>{selected ? "선택됨" : "조회"}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, summary.share)}%` }} />
                </div>
              </a>
            );
          })}
        </div>

        <aside className="card flex flex-col justify-between gap-4">
          <div>
            <div className="eyebrow">현재 상세 필터</div>
            <div className="mt-2 text-2xl font-black text-slate-950">{activeCategory}</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {activeCategory === "인재투자" ? `하위유형: ${activeTalent}` : "대카테고리 기준으로 표시 중입니다."}
              {canFilterByCardUser ? (
                <>
                  <br />
                  카드사/사용자: {activeCardUser}
                </>
              ) : null}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-500">표시 금액</div>
              <div className="mt-2 font-black text-slate-950">{formatKRW(filteredTotal)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-500">표시 건수</div>
              <div className="mt-2 font-black text-slate-950">{filteredRows.length.toLocaleString("ko-KR")}건</div>
            </div>
          </div>
          <a className="btn w-full" href={expenseHref({})}>
            전체 지출 보기
          </a>
        </aside>
      </section>

      {activeCategory === "인재투자" ? (
        <section className="card mb-6">
          <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <h2 className="section-title">인재투자 하위 유형</h2>
              <p className="mt-1 text-sm text-slate-500">기존 인투1~6은 인재투자 대카테고리의 하위 개념으로 조회합니다.</p>
            </div>
            <a className="btn btn-sm" href={expenseHref({ category: "인재투자" })}>전체 인재투자</a>
          </div>
          <div className="grid grid-cols-6 gap-3 max-2xl:grid-cols-3 max-md:grid-cols-1">
            {talentSummaries.map((summary) => {
              const selected = activeTalent === summary.label;
              const { code, name } = splitTalentLabel(summary.label);

              return (
                <a
                  className={[
                    "rounded-lg border p-4 text-left transition",
                    selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200"
                  ].join(" ")}
                  href={expenseHref({ category: "인재투자", talent: summary.label as TalentFilter })}
                  key={summary.label}
                  aria-current={selected ? "true" : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={selected ? "badge" : "badge badge-muted"}>{code}</span>
                    <span className="text-xs font-black text-slate-400">{formatPercent(summary.share)}</span>
                  </div>
                  <div className="mt-2 text-sm font-black text-slate-950">{name}</div>
                  <div className="mt-2 text-base font-black text-slate-950">{formatKRW(summary.amount)}</div>
                  <div className="mt-1 text-xs text-slate-500">{summary.count.toLocaleString("ko-KR")}건</div>
                </a>
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
              {canFilterByCardUser ? ` 중 ${activeCardUser} 기준` : " 기준"} {filteredRows.length.toLocaleString("ko-KR")}건을 표시합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{activeCategory}</span>
            {activeCategory === "인재투자" ? <span className="badge">{activeTalent}</span> : null}
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
            <a
              className={[
                "btn btn-sm",
                activeCardUser === allCardUserFilter ? "bg-blue-50 text-blue-700" : ""
              ].join(" ")}
              href={expenseHref({ category: activeCategory, talent: activeTalent })}
            >
              전체 카드사 {talentFilteredRows.length.toLocaleString("ko-KR")}건
            </a>
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-white" open={isCardUserFiltered}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-black text-slate-800 max-md:flex-col max-md:items-start">
              <span>{isCardUserFiltered ? activeCardUser : "카드사/사용자 선택 열기"}</span>
              <span className="badge badge-muted">
                {cardUserSummaries.length.toLocaleString("ko-KR")}개 카드사
              </span>
            </summary>
            <form action="/expenses#expense-detail" className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-t border-slate-100 p-4 max-md:grid-cols-1" method="get">
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
              <a className="btn self-end" href={expenseHref({ category: activeCategory, talent: activeTalent })}>
                해제
              </a>
            </form>
          </details>
        </div> : null}

        {filteredRows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
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
                {filteredRows.map(({ row, category, categoryDetail, cardUser }) => (
                  <tr key={row.id}>
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
            <a className="btn mt-4" href={expenseHref({ category: activeCategory, talent: activeTalent })}>
              {canFilterByCardUser ? "카드사 필터 해제" : "현재 유형 다시 보기"}
            </a>
          </div>
        )}
      </section>
    </>
  );
}
