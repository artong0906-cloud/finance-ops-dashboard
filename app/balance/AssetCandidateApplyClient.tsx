"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatKRW } from "@/services/dashboard/calculations";

export type AssetCandidateRow = {
  id: string;
  date: string;
  source: string;
  vendor: string;
  description: string;
  amount: number;
  businessUnit: string;
  category: string;
};

type ApplyMode = "exclude" | "as_is" | "depreciate";

type RowState = {
  mode: ApplyMode;
  monthlyDepreciation: number;
};

function defaultMonthlyDepreciation(amount: number) {
  return Math.round(amount / 60);
}

export function AssetCandidateApplyClient({
  month,
  rows
}: {
  month: string;
  rows: AssetCandidateRow[];
}) {
  const router = useRouter();
  const [rowState, setRowState] = useState<Record<string, RowState>>(() => (
    Object.fromEntries(rows.map((row) => [row.id, {
      mode: "exclude" as ApplyMode,
      monthlyDepreciation: defaultMonthlyDepreciation(row.amount)
    }]))
  ));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedRows = useMemo(() => rows.filter((row) => rowState[row.id]?.mode !== "exclude"), [rows, rowState]);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.amount, 0);

  function updateRow(id: string, next: Partial<RowState>) {
    setRowState((current) => ({
      ...current,
      [id]: {
        mode: current[id]?.mode || "exclude",
        monthlyDepreciation: current[id]?.monthlyDepreciation || defaultMonthlyDepreciation(rows.find((row) => row.id === id)?.amount || 0),
        ...next
      }
    }));
  }

  async function applyBalance() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/balance/apply-assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          month,
          selections: Object.entries(rowState).map(([transactionId, state]) => ({
            transactionId,
            mode: state.mode,
            monthlyDepreciation: state.monthlyDepreciation
          }))
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "자산/부채 반영 중 오류가 발생했습니다.");

      setMessage(`${result.balanceMovementCount?.toLocaleString?.("ko-KR") || 0}개 자산/부채 항목을 ${month} 기준으로 업데이트했습니다.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "자산/부채 반영 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card mb-6">
      <div className="mb-4 flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <h2 className="section-title">자산 반영 후보</h2>
          <p className="mt-1 text-sm text-slate-500">
            {month} 지출 중 비용/자산 구분이 자산인 항목입니다. 반영할 항목만 선택해 자산/부채 현황을 갱신합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 max-lg:w-full max-lg:justify-between">
          <span className="badge badge-good">선택 {selectedRows.length.toLocaleString("ko-KR")}건</span>
          <span className="badge badge-muted">{formatKRW(selectedTotal)}</span>
          <button className="btn btn-primary" disabled={isSaving} onClick={applyBalance} type="button">
            {isSaving ? "반영 중..." : "6월 자산/부채 반영"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-900">
        5월 자산·부채 항목을 기초로 복사하고, 현금성 자산은 6월 말 통장잔고와 지식재산 공제부금으로 업데이트합니다.
        신한은행 신규 대출 입금은 부채 증가로 함께 반영됩니다.
      </div>

      {message ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</div>
      ) : null}

      <div className="table-wrap mt-4">
        <table>
          <thead>
            <tr>
              <th>일자</th>
              <th>거래처</th>
              <th>적요</th>
              <th>분류</th>
              <th className="text-right">금액</th>
              <th>반영 방식</th>
              <th className="text-right">당월 감가</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = rowState[row.id] || { mode: "exclude", monthlyDepreciation: defaultMonthlyDepreciation(row.amount) };
              return (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td className="font-black">{row.vendor}</td>
                  <td>
                    <div>{row.description}</div>
                    <div className="mt-1 text-xs font-bold text-slate-400">{row.source} · {row.businessUnit}</div>
                  </td>
                  <td><span className="badge badge-good">{row.category}</span></td>
                  <td className="text-right font-black">{formatKRW(row.amount)}</td>
                  <td>
                    <select
                      className="field min-w-36"
                      onChange={(event) => updateRow(row.id, { mode: event.target.value as ApplyMode })}
                      value={state.mode}
                    >
                      <option value="exclude">반영 제외</option>
                      <option value="as_is">그대로 자산 반영</option>
                      <option value="depreciate">감가상각 적용</option>
                    </select>
                  </td>
                  <td className="text-right">
                    <input
                      className="field w-32 text-right"
                      disabled={state.mode !== "depreciate"}
                      min={0}
                      onChange={(event) => updateRow(row.id, { monthlyDepreciation: Number(event.target.value || 0) })}
                      type="number"
                      value={state.monthlyDepreciation}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="py-8 text-center font-bold text-slate-500" colSpan={7}>
                  표시할 자산성 지출 후보가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
