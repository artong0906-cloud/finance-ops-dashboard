import { formatKRW } from "@/services/dashboard/calculations";
import type { Transaction } from "@/types/finance";

const talentLabels = ["인투1 집", "인투2 차", "인투3 밥", "인투4 돈", "인투5 성장", "인투6 환경"] as const;
const allFilter = "전체";
const allCardUserFilter = "전체 카드사";
const nonCardUserFilter = "카드 외";
const unknownCardUserFilter = "카드사 미지정";

type TalentFilter = typeof allFilter | (typeof talentLabels)[number];

type TalentSummary = {
  label: (typeof talentLabels)[number];
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
  talentType?: (typeof talentLabels)[number];
  cardUser: string;
};

function sumResolvedAmount(rows: ResolvedExpenseRow[]) {
  return rows.reduce((sum, { row }) => sum + row.amount, 0);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function normalizeTalentText(value: string | undefined) {
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

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeTalentText(keyword)));
}

function resolveTalentType(row: Transaction): (typeof talentLabels)[number] | undefined {
  const categoryText = normalizeTalentText([
    row.talentInvestmentType,
    row.mainCategory,
    row.subCategory,
    row.detailCategory
  ].filter(Boolean).join(" "));
  const explicitText = normalizeTalentText([
    row.talentInvestmentType,
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.description,
    row.memo
  ].filter(Boolean).join(" "));

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

function resolveActiveFilter(value: string | undefined): TalentFilter {
  if (!value) return allFilter;
  if (talentLabels.includes(value as (typeof talentLabels)[number])) return value as TalentFilter;

  const normalized = normalizeTalentText(value);
  if (includesAny(normalized, ["인투1", "투자1", "집"])) return "인투1 집";
  if (includesAny(normalized, ["인투2", "투자2", "차"])) return "인투2 차";
  if (includesAny(normalized, ["인투3", "투자3", "밥"])) return "인투3 밥";
  if (includesAny(normalized, ["인투4", "투자4", "돈", "몸"])) return "인투4 돈";
  if (includesAny(normalized, ["인투5", "투자5", "성장"])) return "인투5 성장";
  if (includesAny(normalized, ["인투6", "투자6", "환경"])) return "인투6 환경";

  return allFilter;
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

function expenseHref(talent: TalentFilter, cardUser = allCardUserFilter) {
  const params = new URLSearchParams();
  if (talent !== allFilter) params.set("talent", talent);
  if (cardUser !== allCardUserFilter) params.set("cardUser", cardUser);
  const query = params.toString();

  return `/expenses${query ? `?${query}` : ""}#expense-detail`;
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
  activeFilter: activeFilterValue,
  activeCardUser: activeCardUserValue,
  expenseRows
}: {
  activeFilter?: string;
  activeCardUser?: string;
  expenseRows: Transaction[];
}) {
  const activeFilter = resolveActiveFilter(activeFilterValue);
  const resolvedRows = expenseRows.map((row) => ({
    row,
    talentType: resolveTalentType(row),
    cardUser: resolveCardUser(row)
  }));
  const talentRows = resolvedRows.filter((item) => item.talentType ? talentLabels.includes(item.talentType) : false);
  const talentTotal = sumResolvedAmount(talentRows);
  const talentFilteredRows = activeFilter === allFilter
    ? resolvedRows
    : resolvedRows.filter((item) => item.talentType === activeFilter);
  const cardUserSummaries = buildCardUserSummaries(talentFilteredRows);
  const activeCardUser = resolveActiveCardUser(activeCardUserValue, cardUserSummaries);
  const isCardUserFiltered = activeCardUser !== allCardUserFilter;
  const filteredRows = activeCardUser === allCardUserFilter
    ? talentFilteredRows
    : talentFilteredRows.filter((item) => item.cardUser === activeCardUser);
  const filteredTotal = sumResolvedAmount(filteredRows);
  const summaries: TalentSummary[] = talentLabels.map((label) => {
    const rows = resolvedRows.filter((item) => item.talentType === label);
    const amount = sumResolvedAmount(rows);

    return {
      label,
      amount,
      count: rows.length,
      share: talentTotal > 0 ? (amount / talentTotal) * 100 : 0
    };
  });

  return (
    <>
      <section className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        상단 인투 카드로 유형을 선택한 뒤, 하단의 카드사/사용자별 조회에서 법인카드 사용 주체를 좁혀 볼 수 있습니다. 기준값은 업로드한 매입신용카드 시트의 카드사 컬럼입니다.
      </section>

      <section className="mb-6 grid grid-cols-[minmax(0,1fr)_260px] gap-4 max-xl:grid-cols-1">
        <div className="grid grid-cols-6 gap-3 max-2xl:grid-cols-3 max-md:grid-cols-1">
          {summaries.map((summary) => {
            const selected = activeFilter === summary.label;
            const { code, name } = splitTalentLabel(summary.label);

            return (
              <a
                className={[
                  "card kpi cursor-pointer p-4 text-left transition",
                  selected ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-100" : "hover:border-blue-200 hover:bg-slate-50"
                ].join(" ")}
                href={expenseHref(summary.label)}
                key={summary.label}
                aria-current={selected ? "true" : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={selected ? "badge" : "badge badge-muted"}>{code}</span>
                  <span className="text-xs font-black text-slate-400">{formatPercent(summary.share)}</span>
                </div>
                <div className="mt-3 text-sm font-black text-slate-950">{name}</div>
                <div className="mt-2 text-lg font-black text-slate-950">{formatKRW(summary.amount)}</div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{summary.count.toLocaleString("ko-KR")}건</span>
                  <span>{selected ? "선택됨" : "클릭해 상세보기"}</span>
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
            <div className="mt-2 text-2xl font-black text-slate-950">{activeFilter}</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {activeFilter === allFilter
                ? "전체 지출 거래를 표시 중입니다."
                : `${activeFilter}로 분류된 거래를 기준으로 표시 중입니다.`}
              <br />
              카드사/사용자: {activeCardUser}
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
          <a className="btn w-full" href={expenseHref(allFilter)}>
            전체 지출 보기
          </a>
        </aside>
      </section>

      <section className="card" id="expense-detail">
        <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <h2 className="section-title">지출 상세</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeFilter === allFilter ? "전체 지출 거래" : `${activeFilter} 거래`} 중 {activeCardUser} 기준 {filteredRows.length.toLocaleString("ko-KR")}건을 표시합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{activeFilter}</span>
            <span className="badge">{activeCardUser}</span>
            <span className="badge badge-muted">{formatKRW(filteredTotal)}</span>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <div className="eyebrow">카드사/사용자별 조회</div>
              <p className="mt-1 text-sm text-slate-600">
                선택된 인투 유형 안에서 매입신용카드 원본의 카드사 컬럼 기준으로 지출 상세를 다시 필터링합니다.
              </p>
            </div>
            <a
              className={[
                "btn btn-sm",
                activeCardUser === allCardUserFilter ? "bg-blue-50 text-blue-700" : ""
              ].join(" ")}
              href={expenseHref(activeFilter)}
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
              {activeFilter !== allFilter ? <input name="talent" type="hidden" value={activeFilter} /> : null}
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
              <a className="btn self-end" href={expenseHref(activeFilter)}>
                해제
              </a>
            </form>
          </details>
        </div>

        {filteredRows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>일자</th>
                  <th>인투유형</th>
                  <th>카드사/사용자</th>
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
                {filteredRows.map(({ row, talentType, cardUser }) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{talentType ? <span className="badge">{talentType}</span> : <span className="badge badge-muted">미지정</span>}</td>
                    <td>
                      <span className={cardUser === nonCardUserFilter || cardUser === unknownCardUserFilter ? "badge badge-muted" : "badge"}>
                        {cardUser}
                      </span>
                    </td>
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
            <p className="mt-2 text-sm text-slate-500">다른 인투 카드나 카드사/사용자 필터를 선택해 주세요.</p>
            <a className="btn mt-4" href={expenseHref(activeFilter)}>
              카드사 필터 해제
            </a>
          </div>
        )}
      </section>
    </>
  );
}
