export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { chartColors, DonutPanel, RankBar } from "@/components/shared/FinanceViz";
import { resolveMonthParam, withMonthParam, type MonthSearchParams } from "@/lib/month-filter";
import { formatCompactKRW, formatKRW } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { Transaction } from "@/types/finance";

const revenueCategories = ["광고사업부 매출", "대외협력부 매출", "플랫폼 매출", "정부지원금", "기타매출"] as const;
const allFilter = "전체";
const highlightCardStyles = [
  { bg: "linear-gradient(135deg, #2f5f9e 0%, #2a548f 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .18)" },
  { bg: "linear-gradient(135deg, #3b6ca0 0%, #315784 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .16)" },
  { bg: "linear-gradient(135deg, #327f98 0%, #2d6185 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .16)" },
  { bg: "linear-gradient(135deg, #365173 0%, #2f3f5d 100%)", shadow: "0 12px 26px rgba(54, 81, 115, .16)" }
];
const governmentSupportKeywords = [
  "고용노동부",
  "고용부",
  "지원금",
  "훈련비",
  "식대",
  "보조금",
  "장려금",
  "고용센터",
  "산업인력공단",
  "한국산업인력공단",
  "hrd"
];
const miscKeywords = [
  "환급",
  "매출취소",
  "대여금상환",
  "급여착오지급반환",
  "착오지급반환",
  "캐시백",
  "조수인",
  "영업외수익",
  "이자수익"
];
const loanExecutionKeywords = ["대출실행", "대출금입금", "대출금 입금", "신규대출", "차입금입금", "차입금 입금", "단기차입금", "장기차입금", "차입"];
const excludedRevenueDepositKeywords = [
  "계좌이체",
  "계좌간이동",
  "중복집계제외",
  "보통예금",
  "타사이체",
  "광고인하나은행",
  "광고인신한은행",
  "광고인기업은행",
  "광고인cma",
  "주식회사광고인",
  "(주)광고인",
  "카드대금",
  "카드미지급비용",
  "법인카드결제",
  "롯데카드",
  "현대카드",
  "비씨카드",
  "하나카드",
  "국민카드",
  "신한카드"
];
const nonRevenueMainCategories = [
  "부채",
  "계좌이체",
  "카드대금",
  "광고비",
  "인건비",
  "자산취득",
  "인재투자비",
  "금융비용",
  "외상매입금",
  "대납금",
  "세금"
];

type RevenueCategory = (typeof revenueCategories)[number];
type RevenueFilter = typeof allFilter | RevenueCategory;

type RevenueRow = {
  row: Transaction;
  category: RevenueCategory;
  rule: string;
};

type RevenuePageProps = {
  searchParams?: Promise<MonthSearchParams & {
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
    row.source,
    row.businessUnit,
    row.accountId,
    row.accountName,
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

function isExcludedRevenueDeposit(row: Transaction) {
  if (matchedGovernmentSupportKeyword(row) || matchedMiscKeyword(row)) return false;
  if (row.isInternalTransfer || isLoanExecutionDeposit(row)) return true;

  const text = rowText(row);
  if (excludedRevenueDepositKeywords.some((keyword) => text.includes(normalizeText(keyword)))) return true;
  if (normalizeText(row.subCategory).includes(normalizeText("차입금"))) return true;
  if (nonRevenueMainCategories.some((category) => normalizeText(row.mainCategory).includes(normalizeText(category)))) return true;

  return false;
}

function classifyRevenue(row: Transaction): Pick<RevenueRow, "category" | "rule"> {
  const governmentSupportKeyword = matchedGovernmentSupportKeyword(row);
  const miscKeyword = matchedMiscKeyword(row);
  const mainCategory = normalizeText(row.mainCategory);

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

  if (mainCategory.includes(normalizeText("영업외수익"))) {
    return {
      category: "기타매출",
      rule: "영업외수익 기준: 기타매출"
    };
  }

  return {
    category: "광고사업부 매출",
    rule: "통장 입금 기본값: 광고사업부 매출"
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

function filterHref(category: RevenueFilter, month?: string | null) {
  const params = new URLSearchParams();
  if (category !== allFilter) params.set("category", category);
  const query = params.toString();
  return withMonthParam(`/revenue${query ? `?${query}` : ""}#revenue-detail`, month);
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.min(100, Math.max(0, (part / total) * 100)).toFixed(0)}%`;
}

function ruleCaption(category: RevenueCategory) {
  if (category === "광고사업부 매출") return "통장 입금 기본 산정";
  if (category === "정부지원금") return "고용노동부·지원금·훈련비·식대";
  if (category === "기타매출") return "환급·매출취소·상환·영업외수익";
  return "6월부터 분리 기준 적용 예정";
}

export default async function RevenuePage({ searchParams }: RevenuePageProps) {
  const params = searchParams ? await searchParams : {};
  const activeFilter = resolveFilter(Array.isArray(params.category) ? params.category[0] : params.category);
  const selectedMonth = resolveMonthParam(params);
  const data = await getDashboardData(selectedMonth);
  const currentMonth = data.currentMonth || "2026-05";
  const bankDepositRows = data.transactions.filter((row) => (
    row.source === "은행"
    && row.cashFlowType === "입금"
    && !row.isInternalTransfer
  ));
  const depositRows = bankDepositRows.filter((row) => !isExcludedRevenueDeposit(row));
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
  const revenueSegments = summaries
    .filter((summary) => summary.amount > 0)
    .map((summary, index) => ({
      label: summary.category,
      amount: summary.amount,
      color: chartColors[index % chartColors.length]
    }));

  return (
    <AppShell
      title="매출 분석"
      description="선택 월 통장 입금내역을 기준으로 매출을 광고사업부, 대외협력부, 플랫폼, 정부지원금, 기타매출로 시뮬레이션합니다."
      periodLabel={currentMonth}
      availableMonths={data.availableMonths}
      activePath="/revenue"
    >
      <section className="mb-6 grid items-start grid-cols-[minmax(0,1fr)_320px] gap-4 max-xl:grid-cols-1">
        <div className="card self-start">
          <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <h2 className="section-title">매출 카테고리</h2>
              <p className="mt-1 text-sm text-slate-500">카드를 클릭하면 하단 상세가 해당 매출구분으로 필터링됩니다.</p>
            </div>
            <a className="btn btn-sm" href={filterHref(allFilter, currentMonth)}>전체 보기</a>
          </div>
          <div className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1">
            {summaries.map((summary, index) => {
              const selected = activeFilter === summary.category;
              const cardStyle = highlightCardStyles[index % highlightCardStyles.length];

              return (
                <a
                  aria-current={selected ? "true" : undefined}
                  className={[
                    "rounded-lg border border-white/10 p-4 text-left text-white transition",
                    selected ? "ring-2 ring-blue-100" : "hover:-translate-y-0.5 hover:ring-1 hover:ring-white/25"
                  ].join(" ")}
                  href={filterHref(summary.category, currentMonth)}
                  key={summary.category}
                  style={{ background: cardStyle.bg, boxShadow: selected ? cardStyle.shadow : undefined }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex min-h-[22px] items-center justify-center rounded-full bg-white/15 px-2 py-1 text-[11px] font-black text-white">{summary.category}</span>
                    <span className="text-xs font-black text-white/70">{summary.share}</span>
                  </div>
                  <div className="mt-4 text-xl font-black text-white">{formatKRW(summary.amount)}</div>
                  <div className="mt-2 text-xs font-bold leading-5 text-white/70">
                    {summary.rows.length.toLocaleString("ko-KR")}건 · {ruleCaption(summary.category)}
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-white/75" style={{ width: summary.share }} />
                  </div>
                </a>
              );
            })}
          </div>
          <div className="mt-5 grid gap-2">
            {summaries.filter((summary) => summary.amount > 0).map((summary, index) => (
              <RankBar
                amount={summary.amount}
                color={chartColors[index % chartColors.length]}
                count={summary.rows.length}
                key={summary.category}
                label={summary.category}
                total={totalRevenue}
              />
            ))}
          </div>
        </div>

        <aside className="grid min-w-0 gap-4 overflow-hidden">
          <DonutPanel
            segments={revenueSegments}
            title="매출 비중"
            totalLabel="총 매출"
            totalValue={formatCompactKRW(totalRevenue)}
          />
          <div className="card flex flex-col justify-between gap-4">
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
            <a className="btn w-full" href={filterHref(allFilter, currentMonth)}>
              전체 매출 보기
            </a>
          </div>
        </aside>
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
