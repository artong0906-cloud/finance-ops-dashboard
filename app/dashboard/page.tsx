export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Landmark,
  TrendingDown,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { endingAmount, formatCompactKRW, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { BalanceMovement, Transaction } from "@/types/finance";

const expenseCategoryOrder = ["인재투자", "환불", "급여", "광고비", "세금", "운영비", "기타"] as const;
const chartColors = ["#2f5f9e", "#69a2d8", "#52beb7", "#f2a65e", "#7d82df", "#8aa0b7", "#ef8371"];
const inflowColor = "#4db6ac";
const outflowColor = "#f2a65e";

type Segment = {
  label: string;
  amount: number;
  color: string;
  caption?: string;
};

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

function ratio(part: number, total: number) {
  if (!total) return 0;
  return clamp((part / total) * 100);
}

function percent(part: number, total: number) {
  return `${ratio(part, total).toFixed(0)}%`;
}

function signedKRW(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatKRW(value)}`;
}

function amountTone(value: number) {
  if (value > 0) return "text-teal-800";
  if (value < 0) return "text-amber-800";
  return "text-slate-700";
}

function compact(value: string | undefined) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(compact(keyword)));
}

function rowText(row: Transaction) {
  return compact([
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

function balanceText(row: BalanceMovement) {
  return compact([row.category, row.memo].filter(Boolean).join(" "));
}

function balanceChange(row: BalanceMovement) {
  return row.increaseAmount - row.decreaseAmount;
}

function isCashBalance(row: BalanceMovement) {
  const text = balanceText(row);
  return row.statementType === "자산" && includesAny(text, ["현금", "예금", "통장", "증권", "현금성", "선급금", "공제부금"]);
}

function isBankLoan(row: BalanceMovement) {
  const text = balanceText(row);
  return row.statementType === "부채" && includesAny(text, ["은행", "대출", "중진공", "기.보", "기보", "증신공", "클린보증"]);
}

function assetGroup(row: BalanceMovement) {
  const text = balanceText(row);
  if (isCashBalance(row)) return "현금성";
  if (includesAny(text, ["차량", "법인차"])) return "차량";
  if (includesAny(text, ["보증금"])) return "보증금";
  if (includesAny(text, ["대여금", "투자금"])) return "대여/투자";
  if (includesAny(text, ["광고비", "메조미디어"])) return "광고비";
  if (includesAny(text, ["토지", "비품", "유형자산", "무형자산", "인테리어", "사옥", "필지", "건축설계", "앱/웹"])) return "유/무형";
  return "기타";
}

function liabilityGroup(row: BalanceMovement) {
  const text = balanceText(row);
  if (isBankLoan(row)) return "은행대출";
  if (includesAny(text, ["차량", "리스"])) return "차량부채";
  if (includesAny(text, ["카드", "급여", "광고비", "예정"])) return "예정/미지급";
  return "기타";
}

function hasTalentMarker(row: Transaction) {
  return includesAny(rowText(row), ["인투1", "인투2", "인투3", "인투4", "인투5", "인투6", "인재투자"]);
}

function expenseCategory(row: Transaction): (typeof expenseCategoryOrder)[number] {
  const text = rowText(row);
  const isBankWithdrawal = row.source === "은행";

  if (isBankWithdrawal && includesAny(text, ["환불", "매출취소", "결제취소", "용역수수료지급"])) return "환불";
  if (includesAny(text, ["프리급여", "급여", "학자금상환", "4대보험", "지방세", "사업소득세", "근로소득세", "원천세", "고용보험", "건강보험", "국민연금"])) return "급여";
  if (isBankWithdrawal && includesAny(text, ["메조미디어", "메조", "롯데카드", "제이와이네트워크", "위픽코퍼레이션", "바나나몽키", "광고비", "광고선전비", "매체비"])) return "광고비";
  if (hasTalentMarker(row)) return "인재투자";
  if (includesAny(text, ["부가세", "부가가치세", "과태료", "과테료", "면허세", "주민세", "법인세", "세금과공과"])) return "세금";
  if (includesAny(text, ["이자", "대출이자", "대외협력", "공통사용분", "공통운영비", "운영비", "지급수수료", "관리비", "임차료"])) return "운영비";
  return "기타";
}

function groupSegments<T extends string>(labels: readonly T[], rows: BalanceMovement[], pick: (row: BalanceMovement) => T | string): Segment[] {
  return labels
    .map((label, index) => ({
      label,
      amount: sumBy(rows.filter((row) => pick(row) === label), endingAmount),
      color: chartColors[index % chartColors.length]
    }))
    .filter((segment) => segment.amount > 0);
}

function makeDonutGradient(segments: Segment[]) {
  const total = sumBy(segments, (segment) => Math.max(0, segment.amount));
  if (!total) return "#e2e8f0";
  let cursor = 0;
  return `conic-gradient(${segments.map((segment) => {
    const start = cursor;
    const end = cursor + (Math.max(0, segment.amount) / total) * 360;
    cursor = end;
    return `${segment.color} ${start}deg ${end}deg`;
  }).join(", ")})`;
}

function KpiCard({
  label,
  value,
  caption,
  icon,
  tone = "blue"
}: {
  label: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  const toneStyle = {
    blue: { bg: "linear-gradient(135deg, #2f5f9e 0%, #2a548f 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .18)" },
    green: { bg: "linear-gradient(135deg, #327f98 0%, #2d6185 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .16)" },
    amber: { bg: "linear-gradient(135deg, #3b6ca0 0%, #315784 100%)", shadow: "0 12px 26px rgba(47, 95, 158, .16)" },
    slate: { bg: "linear-gradient(135deg, #365173 0%, #2f3f5d 100%)", shadow: "0 12px 26px rgba(54, 81, 115, .16)" }
  }[tone];

  return (
    <div className="rounded-lg p-4 text-white" style={{ background: toneStyle.bg, boxShadow: toneStyle.shadow }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 whitespace-nowrap text-[13px] font-black text-white/90">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white">{icon}</span>
          {label}
        </div>
        <div className="whitespace-nowrap text-right text-2xl font-black tracking-tight">{value}</div>
      </div>
      <div className="mt-3 text-xs font-bold text-white/75">{caption}</div>
    </div>
  );
}

function DonutPanel({
  title,
  totalLabel,
  totalValue,
  segments
}: {
  title: string;
  totalLabel: string;
  totalValue: string;
  segments: Segment[];
}) {
  const total = sumBy(segments, (segment) => segment.amount);

  return (
    <div className="h-fit rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        <span className="badge badge-muted">{segments.length.toLocaleString("ko-KR")}개</span>
      </div>
      <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3 max-md:grid-cols-1">
        <div className="relative mx-auto h-[132px] w-[132px] rounded-full" style={{ background: makeDonutGradient(segments) }}>
          <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center shadow-inner">
            <div>
              <div className="text-[11px] font-black text-slate-500">{totalLabel}</div>
              <div className="mt-1 text-base font-black text-slate-950">{totalValue}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-1.5">
          {segments.map((segment) => (
            <div className="grid grid-cols-[8px_minmax(0,1fr)_minmax(46px,auto)_34px] items-center gap-1.5 text-xs" key={segment.label}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="truncate font-bold text-slate-700">{segment.label}</span>
              <span className="text-right text-xs font-black text-slate-700">{formatCompactKRW(segment.amount)}</span>
              <span className="text-right text-xs font-black text-slate-500">{percent(segment.amount, total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackedBar({ segments }: { segments: Segment[] }) {
  const total = sumBy(segments, (segment) => segment.amount);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div key={segment.label} style={{ width: `${ratio(segment.amount, total)}%`, backgroundColor: segment.color }} />
        ))}
      </div>
      <div className="mt-3 grid gap-1.5">
        {segments.map((segment) => (
          <div className="flex items-center justify-between gap-3 text-sm" key={segment.label}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="truncate font-bold text-slate-700">{segment.label}</span>
            </span>
            <span className="shrink-0 font-black text-slate-950">{formatKRW(segment.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankBar({
  label,
  amount,
  total,
  count,
  color
}: {
  label: string;
  amount: number;
  total: number;
  count?: number;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(96px,150px)_minmax(80px,1fr)_minmax(96px,auto)_42px] items-center gap-2 text-sm max-md:grid-cols-1">
      <span className="truncate font-black text-slate-700">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${ratio(amount, total)}%`, backgroundColor: color }} />
      </div>
      <span className="whitespace-nowrap text-right font-black text-slate-950 max-md:text-left">{formatKRW(amount)}</span>
      <span className="whitespace-nowrap text-right text-xs font-black text-slate-500 max-md:text-left">{count ? `${count.toLocaleString("ko-KR")}건` : percent(amount, total)}</span>
    </div>
  );
}

function FinancialCard({
  label,
  value,
  change,
  color
}: {
  label: string;
  value: number;
  change: number;
  color: string;
}) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const Icon = isNegative ? TrendingDown : TrendingUp;
  const changeLabel = isPositive ? "증가" : isNegative ? "감소" : "변동 없음";
  const changeStyle = isPositive
    ? "border-teal-200 bg-teal-50 text-teal-800"
    : isNegative
      ? "border-orange-200 bg-orange-50 text-orange-900"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-black text-slate-500">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{formatKRW(value)}</div>
      <div className={`mt-3 rounded-lg border px-3 py-2.5 ${changeStyle}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-black opacity-75">전월비 증감액</span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-black">{changeLabel}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-lg font-black">
          <Icon size={15} />
          {signedKRW(change)}
        </div>
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: string;
  tone?: "teal" | "stone" | "slate";
}) {
  const toneClass = {
    teal: "border-teal-100 bg-teal-50/70",
    stone: "border-stone-200 bg-stone-50",
    slate: "border-slate-200 bg-slate-50"
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function CashFlowBox({
  label,
  value,
  caption,
  tone = "slate",
  valueClassName = "text-slate-950"
}: {
  label: string;
  value: string;
  caption: string;
  tone?: "teal" | "stone" | "slate";
  valueClassName?: string;
}) {
  const toneClass = {
    teal: "border-teal-100 bg-teal-50/70",
    stone: "border-stone-200 bg-stone-50",
    slate: "border-slate-200 bg-slate-50"
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 text-xl font-black ${valueClassName}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{caption}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { transactions, balanceMovements, bankAccounts } = data;

  const currentMonth = data.currentMonth || "2026-05";
  const assets = balanceMovements.filter((row) => row.statementType === "자산");
  const liabilities = balanceMovements.filter((row) => row.statementType === "부채");
  const totalAssets = sumBy(assets, endingAmount);
  const totalLiabilities = sumBy(liabilities, endingAmount);
  const equity = totalAssets - totalLiabilities;
  const assetChange = sumBy(assets, balanceChange);
  const liabilityChange = sumBy(liabilities, balanceChange);
  const equityChange = assetChange - liabilityChange;

  const cashBalanceRows = assets.filter(isCashBalance);
  const cashRows = cashBalanceRows.length > 0
    ? cashBalanceRows.map((row) => ({ id: row.id, name: row.category, amount: endingAmount(row), caption: row.memo || "현금성자산" }))
    : bankAccounts.map((account) => ({ id: account.id, name: `${account.bankName} ${account.accountName}`, amount: account.currentBalance, caption: account.businessUnit }));
  const cashBalanceTotal = sumBy(cashRows, (row) => row.amount);
  const cashSegments = cashRows
    .sort((a, b) => b.amount - a.amount)
    .map((row, index) => ({ label: row.name, amount: row.amount, color: chartColors[index % chartColors.length], caption: row.caption }));

  const loanRows = liabilities.filter(isBankLoan).map((row) => ({
    id: row.id,
    name: row.category,
    amount: endingAmount(row),
    change: balanceChange(row)
  })).sort((a, b) => b.amount - a.amount);
  const loanTotal = sumBy(loanRows, (row) => row.amount);
  const loanSegments = loanRows.map((row, index) => ({ label: row.name, amount: row.amount, color: chartColors[index % chartColors.length] }));

  const assetSegments = groupSegments(["현금성", "차량", "보증금", "대여/투자", "광고비", "유/무형", "기타"], assets, assetGroup);
  const liabilitySegments = groupSegments(["은행대출", "차량부채", "예정/미지급", "기타"], liabilities, liabilityGroup);
  const capitalSegments = [
    { label: "부채", amount: totalLiabilities, color: outflowColor },
    { label: "자본", amount: equity, color: "#2f3a4a" }
  ].filter((segment) => segment.amount > 0);

  const operatingRows = transactions.filter((row) => !row.isInternalTransfer);
  const cashIn = sumBy(operatingRows.filter((row) => row.cashFlowType === "입금"), (row) => row.amount);
  const cashOut = sumBy(operatingRows.filter((row) => row.cashFlowType === "출금"), (row) => row.amount);
  const netCashFlow = cashIn - cashOut;
  const closingCashBalanceTotal = cashBalanceTotal;
  const openingCashBalanceTotal = closingCashBalanceTotal - netCashFlow;
  const bankRows = operatingRows.filter((row) => row.source === "은행");
  const cardRows = operatingRows.filter((row) => row.source === "카드");

  const expenseRows = operatingRows.filter((row) => row.cashFlowType === "출금");
  const totalExpense = sumBy(expenseRows, (row) => row.amount);
  const expenseCategoryRows = expenseCategoryOrder
    .map((category, index) => {
      const rows = expenseRows.filter((row) => expenseCategory(row) === category);
      return { category, amount: sumBy(rows, (row) => row.amount), count: rows.length, color: chartColors[index % chartColors.length] };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const expenseSegments = expenseCategoryRows.map((row) => ({ label: row.category, amount: row.amount, color: row.color }));

  return (
    <AppShell
      title="경영현황"
      description="현금, 대출, 자금 흐름, 재무상태, 지출 비중을 시각화해서 한 화면에서 봅니다."
      periodLabel={currentMonth}
      activePath="/dashboard"
    >
      <main className="grid gap-4">
        <section className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
          <KpiCard caption={`${cashRows.length.toLocaleString("ko-KR")}개 현금성 항목`} icon={<Banknote size={19} />} label="통장현금 잔고" value={formatCompactKRW(cashBalanceTotal)} />
          <KpiCard caption={`${loanRows.length.toLocaleString("ko-KR")}개 대출 항목`} icon={<Landmark size={19} />} label="대출현황" tone="amber" value={formatCompactKRW(loanTotal)} />
          <KpiCard caption={`입금 ${formatCompactKRW(cashIn)} / 출금 ${formatCompactKRW(cashOut)}`} icon={<BarChart3 size={19} />} label="월간 순현금흐름" tone={netCashFlow >= 0 ? "green" : "amber"} value={formatCompactKRW(netCashFlow)} />
          <KpiCard caption={`자산 대비 자본 ${percent(equity, totalAssets)}`} icon={<WalletCards size={19} />} label="자본" tone="slate" value={formatCompactKRW(equity)} />
        </section>

        <section className="grid grid-cols-2 items-stretch gap-4 max-xl:grid-cols-1">
          <div className="card h-full">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="section-title">통장현금 잔고</h2>
                <p className="mt-1 text-sm text-slate-500">은행·증권·선급금 등 현금성 항목별 보유 비중입니다.</p>
              </div>
              <span className="badge badge-good">자산 중 {percent(cashBalanceTotal, totalAssets)}</span>
            </div>
            <SummaryBox label="현금성 잔액 합계" tone="teal" value={formatKRW(cashBalanceTotal)} />
            <div className="mt-3">
              <StackedBar segments={cashSegments.slice(0, 6)} />
            </div>
          </div>

          <div className="card h-full">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="section-title">대출현황</h2>
                <p className="mt-1 text-sm text-slate-500">은행대출 구성과 부채 내 비중입니다.</p>
              </div>
              <span className="badge badge-warning">부채 중 {percent(loanTotal, totalLiabilities)}</span>
            </div>
            <SummaryBox label="대출 잔액 합계" tone="stone" value={formatKRW(loanTotal)} />
            <div className="mt-3">
              <StackedBar segments={loanSegments.slice(0, 6)} />
            </div>
          </div>
        </section>

        <section>
          <div className="card">
            <div className="mb-3 flex items-start justify-between gap-3 max-md:flex-col">
              <div>
                <h2 className="section-title">월간 자금 흐름</h2>
                <p className="mt-1 text-sm text-slate-500">최근 거래일 기준 입금/출금 흐름입니다.</p>
              </div>
              <Link href="/bank" className="btn btn-soft">통장 상세 <ArrowRight size={14} /></Link>
            </div>
            <div className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1">
              <CashFlowBox
                caption="월말 - 순현금흐름"
                label="월초잔액"
                tone="stone"
                value={formatKRW(openingCashBalanceTotal)}
              />
              <CashFlowBox
                caption={`${bankRows.filter((row) => row.cashFlowType === "입금").length.toLocaleString("ko-KR")}건`}
                label="입금"
                tone="teal"
                value={formatKRW(cashIn)}
              />
              <CashFlowBox
                caption={`은행 ${bankRows.filter((row) => row.cashFlowType === "출금").length.toLocaleString("ko-KR")}건 / 카드 ${cardRows.length.toLocaleString("ko-KR")}건`}
                label="출금"
                tone="stone"
                value={formatKRW(cashOut)}
              />
              <CashFlowBox
                caption={signedKRW(netCashFlow)}
                label="순현금흐름"
                value={formatKRW(netCashFlow)}
                valueClassName={amountTone(netCashFlow)}
              />
              <CashFlowBox
                caption={`월초 대비 ${signedKRW(netCashFlow)}`}
                label="월말잔액"
                tone="teal"
                value={formatKRW(closingCashBalanceTotal)}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <h2 className="section-title">자산 · 부채 · 자본</h2>
                <p className="mt-1 text-sm text-slate-500">기말 잔액, 전월비 증감액, 구성 비중을 한 섹션에서 봅니다.</p>
              </div>
              <WalletCards size={20} className="text-slate-400" />
            </div>
            <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
              <FinancialCard color="#2f3a4a" label="총자산" value={totalAssets} change={assetChange} />
              <FinancialCard color={outflowColor} label="총부채" value={totalLiabilities} change={liabilityChange} />
              <FinancialCard color={inflowColor} label="자본" value={equity} change={equityChange} />
            </div>
            <div className="mt-4">
              <StackedBar segments={[
                { label: "부채", amount: totalLiabilities, color: outflowColor },
                { label: "자본", amount: equity, color: inflowColor }
              ]} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 max-xl:grid-cols-1">
              <DonutPanel segments={capitalSegments} title="자산 대비 부채/자본" totalLabel="총자산" totalValue={formatCompactKRW(totalAssets)} />
              <DonutPanel segments={assetSegments} title="자산 구성" totalLabel="총자산" totalValue={formatCompactKRW(totalAssets)} />
              <DonutPanel segments={liabilitySegments} title="부채 구성" totalLabel="총부채" totalValue={formatCompactKRW(totalLiabilities)} />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">주요 지출분류</h2>
              <p className="mt-1 text-sm text-slate-500">지출 분석 기준 대카테고리별 규모와 비중입니다.</p>
            </div>
            <Link href="/expenses" className="btn btn-soft">지출 분석 <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_330px] items-start gap-4 max-xl:grid-cols-1">
            <div className="grid gap-3">
              {expenseCategoryRows.map((row) => (
                <RankBar amount={row.amount} color={row.color} count={row.count} key={row.category} label={`${row.category} · ${percent(row.amount, totalExpense)}`} total={totalExpense || 1} />
              ))}
            </div>
            <DonutPanel segments={expenseSegments} title="지출 비중" totalLabel="총 지출" totalValue={formatCompactKRW(totalExpense)} />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
