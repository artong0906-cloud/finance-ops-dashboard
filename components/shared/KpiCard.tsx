import { formatKRW } from "@/services/dashboard/calculations";

type KpiTone = "blue" | "green" | "amber" | "slate";

const toneClass: Record<KpiTone, string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-700"
};

export function KpiCard({
  label,
  value,
  caption,
  tone = "slate",
  meta
}: {
  label: string;
  value: number | string;
  caption?: string;
  tone?: KpiTone;
  meta?: string;
}) {
  return (
    <div className="card kpi min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="eyebrow">{label}</div>
        {meta ? <span className={`badge ${toneClass[tone]}`}>{meta}</span> : null}
      </div>
      <div className="metric-value mt-3 break-words text-slate-950">{typeof value === "number" ? formatKRW(value) : value}</div>
      {caption ? <div className="mt-3 text-xs leading-5 text-slate-500">{caption}</div> : null}
    </div>
  );
}
