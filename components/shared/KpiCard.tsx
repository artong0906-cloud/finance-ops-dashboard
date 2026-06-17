import { formatKRW } from "@/services/dashboard/calculations";

export function KpiCard({ label, value, caption }: { label: string; value: number | string; caption?: string }) {
  return (
    <div className="card kpi">
      <div className="text-xs font-black text-slate-500 mb-3">{label}</div>
      <div className="text-3xl font-black tracking-[-0.05em]">{typeof value === "number" ? formatKRW(value) : value}</div>
      {caption ? <div className="mt-3 text-xs text-slate-500 leading-5">{caption}</div> : null}
    </div>
  );
}
