export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { formatKRW } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { Transaction } from "@/types/finance";

const revenueCategories = ["광고사업부 매출", "대외협력부 매출", "플랫폼 매출", "정부지원금", "기타매출"] as const;
const allFilter = "전체";
const governmentSupportKeywords = [
  "고용노동부",
  "고용부",
  "지원금",
  "훈련비",
  "식대"
];
const miscKeywords = [
  "환급",
  "매출취소",
  "대여금상환",
  "급여착오지급반환",
  "착오지급반환",
  "캐시백",
  "조수인",
  "영업외수익"
];
const loanExecutionKeywords = ["대출실행", "대출금입금", "대출금 입금", "신규대출", "차입금입금", "차입금 입금"];

type RevenueCategory = (typeof revenueCategories)[number];
type RevenueFilter = typeof allFilter | RevenueCategory;

type RevenueRow = {
  row: Transaction;
  category: RevenueCategory;
  rule: string;
};

type RevenuePageProps = {
  searchParams?: Promise<{
    category?: string | string[];
  }>;
};

function normalizeText(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}#·._-]/g, "");
}

function rowText(row: Transaction) {
  return normalizeText([
    row.vendor,
    row.description,
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.memo
  ].filter(Boolean).join(" "));
}

function matchedMiscKeyword(row: Transaction) {
  const text = rowText(row);
  return miscKeywords.find((keyword) => text.includes(normalizeText(keyword)));
}

function matchedGovernmentSupportKeyword(row: Transaction) {
  const text = rowText(row);
  return governmentSupportKeywords.find((keyword) => text.includes(normalizeText(keyword)));
}

function isLoanExecutionDeposit(row: Transaction) {
  const text = rowText(row);
  return loanExecutionKeywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function classifyRevenue(row: Transaction): Pick<RevenueRow, "category" | "rule"> {
  const governmentSupportKeyword = matchedGovernmentSupportKeyword(row);
  const miscKeyword = matchedMiscKeyword(row);

  if (governmentSupportKeyword) {
    return {
      category: "정부지원금",
      rule: `정부지원금 키워드: ${governmentSupportKeyword}`
    };
  }

  if (miscKeyword) {
    return {
      category: "기타매출",
      rule: `기타매출 키워드: ${miscKeyword}`
    };
  }

  return {
    category: "광고사업부 매출",
    rule: "5월 임시 기준: 통장 입금 기본값"
  };
}

function sumRevenue(rows: RevenueRow[]) {
  return rows.reduce((sum, item) => sum + item.row.amount, 0);
}

function resolveFilter(value: string | undefined): RevenueFilter {
  if (!value) return allFilter;
  if (revenueCategories.includes(value as RevenueCategory)) return value as RevenueCategory;

  const text = normalizeText(value);
  if (text.includes("광고")) return "광고사업부 매출";
  if (text.includes("대외")) return "대외협력부 매출";
  if (text.includes("플랫폼")) return "플랫폼 매출";
  if (text.includes("정부") || text.includes("지원금")) return "정부지원금";
  if (text.includes("기타")) return "기타매출";

  return allFilter;
}

function filterHref(category: RevenueFilter) {
  if (category === allFilter) return "/revenue";
  return `/revenue?category=${encodeURIComponent(category)}#revenue-detail`;
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.min(100, Math.max(0, (part / total) * 100)).toFixed(0)}%`;
}

function ruleCaption(category: RevenueCategory) {
  if (category === "광고사업부 매출") return "5월 통장 입금 기본 산정";
  if (category === "정부지원금") return "고용노동부·지원금·훈련비·식대";
  if (category === "기타매출") return "환급·매출취소·상환·영업외수익";
  return "6월부터 분리 기준 적용 예정";
}

export default async function RevenuePage({ searchParams }: RevenuePageProps) {
  const params = searchParams ? await searchParams : {};
  const activeFilter = resolveFilter(Array.isArray(params.category) ? params.category[0] : params.category);
  const data = await getDashboardData();
  const bankDepositRows = data.transactions.filter((row) => (
    row.source === "은행"
    && row.cashFlowType === "입금"
    && !row.isInternalTransfer
  ));
  const excludedLoanRows = bankDepositRows.filter(isLoanExecutionDeposit);
  const depositRows = bankDepositRows.filter((row) => !isLoanExecutionDeposit(row));
  const revenueRows: RevenueRow[] = depositRows.map((row) => ({
    row,
    ...classifyRevenue(row)
  }));
  const totalRevenue = sumRevenue(revenueRows);
  const filteredRows = activeFilter === allFilter
    ? revenueRows
    : revenueRows.filter((item) => item.category === activeFilter);
  const filteredTotal = sumRevenue(filteredRows);
  const summaries = revenueCategories.map((category) => {
    const rows = revenueRows.filter((item) => item.category === category);
    const amount = sumRevenue(rows);

    return {
      category,
      rows,
      amount,
      share: percent(amount, totalRevenue)
    };
  });

  return (
    <AppShell
      title="매출 분석"
      description="5월 통장 입금내역을 기준으로 매출을 광고사업부, 대외협력부, 플랫폼, 정부지원금, 기타매출로 시뮬레이션합니다."
      periodLabel={data.currentMonth || "2026-05"}
      activePath="/revenue"
    >
      <section className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        5월은 모든 입금이 한 통장으로 들어왔기 때문에 기본적으로 광고사업부 매출로 산정합니다.
        고용노동부, 고용부, 지원금, 훈련비, 식대는 정부지원금으로 분리합니다.
        환급, 매출취소, 대여금상환, 급여착오지급반환, 캐시백, 조수인 입금, 영업외수익은 기타매출로 분리합니다.
        대출실행 입금은 매출 후보에서 제외합니다.
      </section>

      <section className="mb-6 grid grid-cols-[minmax(0,1fr)_280px] gap-4 max-xl:grid-cols-1">
        <div className="grid grid-cols-5 gap-4 max-2xl:grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1">
          {summaries.map((summary) => {
            const selected = activeFilter === summary.category;

            return (
              <a
                aria-current={selected ? "true" : undefined}
                className={[
                  "card kpi cursor-pointer p-5 transition",
                  selected ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-100" : "hover:border-blue-200 hover:bg-slate-50"
                ].join(" ")}
                href={filterHref(summary.category)}
                key={summary.category}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={selected ? "badge" : "badge badge-muted"}>{summary.category}</span>
                  <span className="text-xs font-black text-slate-400">{summary.share}</span>
                </div>
                <div className="metric-value mt-4">{formatKRW(summary.amount)}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  {summary.rows.length.toLocaleString("ko-KR")}건 · {ruleCaption(summary.category)}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: summary.share }} />
                </div>
              </a>
            );
          })}
        </div>

        <aside className="card flex flex-col justify-between gap-4">
          <div>
            <div className="eyebrow">현재 매출 필터</div>
            <div className="mt-2 text-2xl font-black text-slate-950">{activeFilter}</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {activeFilter === allFilter
                ? "전체 통장 입금 매출 후보를 표시 중입니다."
                : `${activeFilter}로 분류된 입금만 하단 상세에 표시합니다.`}
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
          <a className="btn w-full" href={filterHref(allFilter)}>
            전체 매출 보기
          </a>
        </aside>
      </section>

      <section className="mb-6 grid grid-cols-5 gap-4 max-2xl:grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        <div className="card">
          <div className="eyebrow">통장 입금 매출 후보</div>
          <div className="metric-value mt-3">{formatKRW(totalRevenue)}</div>
          <div className="mt-2 text-xs text-slate-500">{revenueRows.length.toLocaleString("ko-KR")}건</div>
        </div>
        <div className="card">
          <div className="eyebrow">대출실행 제외</div>
          <div className="metric-value mt-3">{formatKRW(excludedLoanRows.reduce((sum, row) => sum + row.amount, 0))}</div>
          <div className="mt-2 text-xs text-slate-500">{excludedLoanRows.length.toLocaleString("ko-KR")}건 · 매출 후보 제외</div>
        </div>
        <div className="card">
          <div className="eyebrow">정부지원금 분리</div>
          <div className="metric-value mt-3">{formatKRW(summaries.find((item) => item.category === "정부지원금")?.amount || 0)}</div>
          <div className="mt-2 text-xs text-slate-500">고용노동부/지원금/훈련비 등</div>
        </div>
        <div className="card">
          <div className="eyebrow">기타매출 분리</div>
          <div className="metric-value mt-3">{formatKRW(summaries.find((item) => item.category === "기타매출")?.amount || 0)}</div>
          <div className="mt-2 text-xs text-slate-500">환급/대여금상환/캐시백 등</div>
        </div>
        <div className="card">
          <div className="eyebrow">현재 선택 상세</div>
          <div className="metric-value mt-3">{formatKRW(filteredTotal)}</div>
          <div className="mt-2 text-xs text-slate-500">{filteredRows.length.toLocaleString("ko-KR")}건 표시</div>
        </div>
      </section>

      <section className="card" id="revenue-detail">
        <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <h2 className="section-title">매출 상세</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeFilter === allFilter ? "전체 매출 후보" : `${activeFilter} 거래`} {filteredRows.length.toLocaleString("ko-KR")}건을 표시합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{activeFilter}</span>
            <span className="badge badge-muted">{formatKRW(filteredTotal)}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>일자</th>
                <th>매출구분</th>
                <th>통장/원천</th>
                <th>거래처</th>
                <th>적요</th>
                <th>분류근거</th>
                <th className="text-right">입금액</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ row, category, rule }) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td><span className={category === "기타매출" ? "badge badge-warning" : category === "정부지원금" ? "badge badge-good" : "badge"}>{category}</span></td>
                  <td>{row.accountName || row.accountId || row.source}</td>
                  <td>{row.vendor}</td>
                  <td>{row.description}</td>
                  <td>{rule}</td>
                  <td className="text-right font-black">{formatKRW(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
