import { TrendingDown, TrendingUp } from "lucide-react";
import { formatCompactKRW, formatKRW, sumBy } from "@/services/dashboard/calculations";

export const chartColors = ["#2f5f9e", "#69a2d8", "#52beb7", "#f2a65e", "#7d82df", "#8aa0b7", "#ef8371"];
export const inflowColor = "#4db6ac";
export const outflowColor = "#f2a65e";
export const equityColor = "#2f3a4a";

export type Segment = {
  label: string;
  amount: number;
  color: string;
  caption?: string;
};

export function clampRatio(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function ratio(part: number, total: number) {
  if (!total) return 0;
  return clampRatio((part / total) * 100);
}

export function percent(part: number, total: number) {
  return `${ratio(part, total).toFixed(0)}%`;
}

export function signedKRW(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatKRW(value)}`;
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

export function DonutPanel({
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
    <div className="h-fit w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-3" style={{ maxWidth: "100%" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        <span className="badge badge-muted">{segments.length.toLocaleString("ko-KR")}개</span>
      </div>
      <div className="grid min-w-0 grid-cols-[132px_minmax(0,1fr)] items-center gap-3 max-2xl:grid-cols-1">
        <div className="relative mx-auto h-[132px] w-[132px] rounded-full" style={{ background: makeDonutGradient(segments) }}>
          <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center shadow-inner">
            <div>
              <div className="text-[11px] font-black text-slate-500">{totalLabel}</div>
              <div className="mt-1 text-base font-black text-slate-950">{totalValue}</div>
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-1.5">
          {segments.map((segment) => (
            <div className="grid min-w-0 grid-cols-[8px_minmax(0,1fr)_minmax(46px,auto)_34px] items-center gap-1.5 text-xs" key={segment.label}>
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

export function StackedBar({ segments }: { segments: Segment[] }) {
  const total = sumBy(segments, (segment) => Math.max(0, segment.amount));

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div key={segment.label} style={{ width: `${ratio(Math.max(0, segment.amount), total)}%`, backgroundColor: segment.color }} />
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

export function RankBar({
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
    <div className="grid min-w-0 grid-cols-[minmax(72px,130px)_minmax(48px,1fr)_minmax(78px,auto)_42px] items-center gap-2 text-sm max-md:grid-cols-1">
      <span className="truncate font-black text-slate-700">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${ratio(amount, total)}%`, backgroundColor: color }} />
      </div>
      <span className="whitespace-nowrap text-right font-black text-slate-950 max-md:text-left">{formatKRW(amount)}</span>
      <span className="whitespace-nowrap text-right text-xs font-black text-slate-500 max-md:text-left">
        {typeof count === "number" ? `${count.toLocaleString("ko-KR")}건` : percent(amount, total)}
      </span>
    </div>
  );
}

export function FinancialCard({
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

export function SummaryBox({
  label,
  value,
  caption,
  tone = "slate"
}: {
  label: string;
  value: string;
  caption?: string;
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
      <div className="mt-2 text-xl font-black text-slate-950">{value}</div>
      {caption ? <div className="mt-1 text-xs text-slate-500">{caption}</div> : null}
    </div>
  );
}
