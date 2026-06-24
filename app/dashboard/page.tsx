export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Landmark,
  PieChart,
  TrendingDown,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { endingAmount, formatCompactKRW, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { BalanceMovement, Transaction } from "@/types/finance";

const expenseCategoryOrder = ["인재투자", "환불", "급여", "광고비", "세금", "운영비", "기타"] as const;
const chartColors = ["#2563eb", "#14b8a6", "#f59e0b", "#8b5cf6", "#64748b", "#ef4444", "#22c55e"];

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
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-orange-700";
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
  const toneClass = {
    blue: "bg-blue-600 text-white shadow-blue-100",
    green: "bg-emerald-600 text-white shadow-emerald-100",
    amber: "bg-amber-500 text-white shadow-amber-100",
    slate: "bg-slate-900 text-white shadow-slate-100"
  }[tone];

  return (
    <div className={`rounded-lg p-5 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm font-black opacity-90">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">{icon}</span>
          {label}
        </div>
        <div className="text-right text-2xl font-black tracking-tight">{value}</div>
      </div>
      <div className="mt-4 text-xs font-bold opacity-80">{caption}</div>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        <span className="badge badge-muted">{segments.length.toLocaleString("ko-KR")}개</span>
      </div>
      <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-4 max-md:grid-cols-1">
        <div className="relative mx-auto h-[150px] w-[150px] rounded-full" style={{ background: makeDonutGradient(segments) }}>
          <div className="absolute inset-8 grid place-items-center rounded-full bg-white text-center shadow-inner">
            <div>
              <div className="text-[11px] font-black text-slate-500">{totalLabel}</div>
              <div className="mt-1 text-base font-black text-slate-950">{totalValue}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          {segments.map((segment) => (
            <div className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 text-sm" key={segment.label}>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="truncate font-bold text-slate-700">{segment.label}</span>
              <span className="text-xs font-black text-slate-500">{percent(segment.amount, total)}</span>
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
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div key={segment.label} style={{ width: `${ratio(segment.amount, total)}%`, backgroundColor: segment.color }} />
        ))}
      </div>
      <div className="mt-3 grid gap-2">
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
  count: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-black text-slate-700">{label}</span>
        <span className="shrink-0 font-black text-slate-950">{formatKRW(amount)}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_52px] items-center gap-3">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${ratio(amount, total)}%`, backgroundColor: color }} />
        </div>
        <span className="text-right text-xs font-black text-slate-500">{count.toLocaleString("ko-KR")}건</span>
      </div>
    </div>
  );
}

function FlowBars({
  rows,
  maxAmount
}: {
  rows: { label: string; cashIn: number; cashOut: number }[];
  maxAmount: number;
}) {
  return (
    <div className="grid h-56 grid-cols-12 items-end gap-2 border-b border-slate-200 pt-4 max-lg:grid-cols-6">
      {rows.map((row) => (
        <div className="grid h-full grid-rows-[1fr_auto] gap-2" key={row.label}>
          <div className="flex items-end justify-center gap-1">
            <div className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(5, ratio(row.cashIn, maxAmount))}%` }} title={`입금 ${formatKRW(row.cashIn)}`} />
            <div className="w-3 rounded-t bg-orange-400" style={{ height: `${Math.max(5, ratio(row.cashOut, maxAmount))}%` }} title={`출금 ${formatKRW(row.cashOut)}`} />
          </div>
          <div className="truncate text-center text-[11px] font-bold text-slate-400">{row.label}</div>
        </div>
      ))}
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
  const isPositive = change >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-black text-slate-500">{label}</span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>
          <Icon size={12} />
          {signedKRW(change)}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{formatKRW(value)}</div>
      <div className="mt-1 text-xs text-slate-500">전월비 증감액 포함</div>
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
    { label: "부채", amount: totalLiabilities, color: "#f59e0b" },
    { label: "자본", amount: equity, color: "#2563eb" }
  ].filter((segment) => segment.amount > 0);

  const operatingRows = transactions.filter((row) => !row.isInternalTransfer);
  const cashIn = sumBy(operatingRows.filter((row) => row.cashFlowType === "입금"), (row) => row.amount);
  const cashOut = sumBy(operatingRows.filter((row) => row.cashFlowType === "출금"), (row) => row.amount);
  const netCashFlow = cashIn - cashOut;
  const bankRows = operatingRows.filter((row) => row.source === "은행");
  const cardRows = operatingRows.filter((row) => row.source === "카드");
  const flowRows = Array.from(
    operatingRows.reduce((acc, row) => {
      const date = row.date.slice(5).replace("-", ".");
      const current = acc.get(date) || { label: date, cashIn: 0, cashOut: 0 };
      if (row.cashFlowType === "입금") current.cashIn += row.amount;
      if (row.cashFlowType === "출금") current.cashOut += row.amount;
      acc.set(date, current);
      return acc;
    }, new Map<string, { label: string; cashIn: number; cashOut: number }>())
  ).map(([, value]) => value).sort((a, b) => a.label.localeCompare(b.label)).slice(-12);
  const maxFlowAmount = Math.max(1, ...flowRows.flatMap((row) => [row.cashIn, row.cashOut]));

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
      <main className="grid gap-5">
        <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          <KpiCard caption={`${cashRows.length.toLocaleString("ko-KR")}개 현금성 항목`} icon={<Banknote size={19} />} label="통장현금 잔고" value={formatCompactKRW(cashBalanceTotal)} />
          <KpiCard caption={`${loanRows.length.toLocaleString("ko-KR")}개 대출 항목`} icon={<Landmark size={19} />} label="대출현황" tone="amber" value={formatCompactKRW(loanTotal)} />
          <KpiCard caption={`입금 ${formatCompactKRW(cashIn)} / 출금 ${formatCompactKRW(cashOut)}`} icon={<BarChart3 size={19} />} label="월간 순현금흐름" tone={netCashFlow >= 0 ? "green" : "amber"} value={formatCompactKRW(netCashFlow)} />
          <KpiCard caption={`자산 대비 자본 ${percent(equity, totalAssets)}`} icon={<WalletCards size={19} />} label="자본" tone="slate" value={formatCompactKRW(equity)} />
        </section>

        <section className="grid grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] gap-5 max-xl:grid-cols-1">
          <div className="card">
            <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
              <div>
                <h2 className="section-title">통장현금 잔고</h2>
                <p className="mt-1 text-sm text-slate-500">은행·증권·선급금 등 현금성 항목별 보유 비중입니다.</p>
              </div>
              <div className="text-right max-md:text-left">
                <div className="eyebrow">총 잔고</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{formatKRW(cashBalanceTotal)}</div>
              </div>
            </div>
            <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1">
              <DonutPanel segments={cashSegments.slice(0, 6)} title="현금성 자산 구성" totalLabel="현금 잔고" totalValue={formatCompactKRW(cashBalanceTotal)} />
              <div className="grid gap-3">
                {cashRows.sort((a, b) => b.amount - a.amount).map((row, index) => (
                  <RankBar amount={row.amount} color={chartColors[index % chartColors.length]} count={1} key={row.id} label={row.name} total={cashBalanceTotal || 1} />
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="section-title">대출현황</h2>
                <p className="mt-1 text-sm text-slate-500">은행대출 구성과 부채 내 비중입니다.</p>
              </div>
              <span className="badge badge-warning">부채 중 {percent(loanTotal, totalLiabilities)}</span>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="eyebrow">대출 잔액 합계</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{formatKRW(loanTotal)}</div>
            </div>
            <div className="mt-4">
              <StackedBar segments={loanSegments.slice(0, 6)} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-xl:grid-cols-1">
          <div className="card">
            <div className="mb-4 flex items-start justify-between gap-3 max-md:flex-col">
              <div>
                <h2 className="section-title">월간 자금 흐름</h2>
                <p className="mt-1 text-sm text-slate-500">최근 거래일 기준 입금/출금 흐름입니다.</p>
              </div>
              <Link href="/bank" className="btn btn-soft">통장 상세 <ArrowRight size={14} /></Link>
            </div>
            <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="eyebrow">입금</div>
                <div className="mt-2 text-xl font-black text-slate-950">{formatKRW(cashIn)}</div>
                <div className="mt-1 text-xs text-slate-500">{bankRows.filter((row) => row.cashFlowType === "입금").length.toLocaleString("ko-KR")}건</div>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="eyebrow">출금</div>
                <div className="mt-2 text-xl font-black text-slate-950">{formatKRW(cashOut)}</div>
                <div className="mt-1 text-xs text-slate-500">은행 {bankRows.filter((row) => row.cashFlowType === "출금").length.toLocaleString("ko-KR")}건 / 카드 {cardRows.length.toLocaleString("ko-KR")}건</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="eyebrow">순현금흐름</div>
                <div className={`mt-2 text-xl font-black ${amountTone(netCashFlow)}`}>{formatKRW(netCashFlow)}</div>
                <div className="mt-1 text-xs text-slate-500">{signedKRW(netCashFlow)}</div>
              </div>
            </div>
            <FlowBars maxAmount={maxFlowAmount} rows={flowRows} />
            <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />입금</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />출금</span>
            </div>
          </div>

          <DonutPanel segments={capitalSegments} title="자산 대비 부채/자본" totalLabel="총자산" totalValue={formatCompactKRW(totalAssets)} />
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(360px,.92fr)] gap-5 max-xl:grid-cols-1">
          <div className="card">
            <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <h2 className="section-title">자산 · 부채 · 자본</h2>
                <p className="mt-1 text-sm text-slate-500">기말 잔액과 전월비 증감액을 함께 표시합니다.</p>
              </div>
              <WalletCards size={20} className="text-slate-400" />
            </div>
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
              <FinancialCard color="#2563eb" label="총자산" value={totalAssets} change={assetChange} />
              <FinancialCard color="#f59e0b" label="총부채" value={totalLiabilities} change={liabilityChange} />
              <FinancialCard color="#14b8a6" label="자본" value={equity} change={equityChange} />
            </div>
            <div className="mt-5">
              <StackedBar segments={[
                { label: "부채", amount: totalLiabilities, color: "#f59e0b" },
                { label: "자본", amount: equity, color: "#14b8a6" }
              ]} />
            </div>
          </div>

          <div className="grid gap-5">
            <DonutPanel segments={assetSegments} title="자산 구성" totalLabel="총자산" totalValue={formatCompactKRW(totalAssets)} />
            <DonutPanel segments={liabilitySegments} title="부채 구성" totalLabel="총부채" totalValue={formatCompactKRW(totalLiabilities)} />
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">주요 지출분류</h2>
              <p className="mt-1 text-sm text-slate-500">지출 분석 기준 대카테고리별 규모와 비중입니다.</p>
            </div>
            <Link href="/expenses" className="btn btn-soft">지출 분석 <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_330px] gap-5 max-xl:grid-cols-1">
            <div className="grid gap-4">
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
