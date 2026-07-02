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
  applied: boolean;
  appliedMode?: ApplyMode;
  appliedAssetCategory?: string;
  appliedMonthlyDepreciation?: number;
};

type ApplyMode = "exclude" | "as_is" | "depreciate";
type StatusFilter = "all" | "applied" | "pending";

type RowState = {
  mode: ApplyMode;
  assetCategory: string;
  monthlyDepreciation: number;
};

const assetCategoryOptions = ["현금성자산", "차량가액", "보증금", "대여금", "광고비", "유형자산", "무형자산", "기타자산"] as const;

function defaultMonthlyDepreciation(amount: number) {
  return Math.round(amount * 0.4);
}

function defaultAssetCategory(row: AssetCandidateRow) {
  if (assetCategoryOptions.includes(row.category as (typeof assetCategoryOptions)[number])) return row.category;

  const text = [row.category, row.vendor, row.description].filter(Boolean).join(" ");
  if (/현금|예금|통장|증권|공제부금/.test(text)) return "현금성자산";
  if (/차량|자동차|리스/.test(text)) return "차량가액";
  if (/보증금|임차/.test(text)) return "보증금";
  if (/대여금|투자금/.test(text)) return "대여금";
  if (/광고|메조|역량/.test(text)) return "광고비";
  if (/무형|앱|웹|소프트웨어|지식재산|특허|상표/.test(text)) return "무형자산";
  if (/토지|비품|시설|장비|집기|인테리어|사옥|건물/.test(text)) return "유형자산";
  return "유형자산";
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
      mode: row.appliedMode || "exclude" as ApplyMode,
      assetCategory: row.appliedAssetCategory || defaultAssetCategory(row),
      monthlyDepreciation: row.appliedMonthlyDepreciation ?? 0
    }]))
  ));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedRows = useMemo(() => rows.filter((row) => rowState[row.id]?.mode !== "exclude"), [rows, rowState]);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.amount, 0);
  const appliedRows = rows.filter((row) => row.applied);
  const pendingRows = rows.filter((row) => !row.applied);
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (statusFilter === "applied") return row.applied;
    if (statusFilter === "pending") return !row.applied;
    return true;
  }), [rows, statusFilter]);

  function updateRow(id: string, next: Partial<RowState>) {
    const row = rows.find((item) => item.id === id);
    setRowState((current) => ({
      ...current,
      [id]: {
        mode: current[id]?.mode || "exclude",
        assetCategory: current[id]?.assetCategory || (row ? defaultAssetCategory(row) : "유형자산"),
        monthlyDepreciation: current[id]?.monthlyDepreciation ?? 0,
        ...next
      }
    }));
  }

  function updateMode(row: AssetCandidateRow, mode: ApplyMode) {
    updateRow(row.id, {
      mode,
      monthlyDepreciation: mode === "depreciate" ? defaultMonthlyDepreciation(row.amount) : 0
    });
  }

  function statusLabel(row: AssetCandidateRow, state: RowState) {
    if (row.applied && state.mode === "exclude") return "반영 해제 예정";
    if (!row.applied && state.mode !== "exclude") return "반영 예정";
    return row.applied ? "반영완료" : "반영미완료";
  }

  function statusClass(row: AssetCandidateRow, state: RowState) {
    if (row.applied && state.mode === "exclude") return "badge badge-warning";
    if (!row.applied && state.mode !== "exclude") return "badge badge-good";
    return row.applied ? "badge badge-good" : "badge badge-muted";
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
            assetCategory: state.assetCategory,
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[
          { key: "all" as const, label: "전체", count: rows.length },
          { key: "applied" as const, label: "반영완료", count: appliedRows.length },
          { key: "pending" as const, label: "반영미완료", count: pendingRows.length }
        ].map((item) => (
          <button
            className={`btn btn-sm ${statusFilter === item.key ? "btn-primary" : ""}`}
            key={item.key}
            onClick={() => setStatusFilter(item.key)}
            type="button"
          >
            {item.label} {item.count.toLocaleString("ko-KR")}건
          </button>
        ))}
      </div>

      <div className="table-wrap mt-4">
        <table>
          <thead>
            <tr>
              <th>반영상태</th>
              <th>일자</th>
              <th>거래처</th>
              <th>적요</th>
              <th>분류</th>
              <th className="text-right">금액</th>
              <th>자산 카테고리</th>
              <th>반영 방식</th>
              <th className="text-right">당월 감가</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const state = rowState[row.id] || { mode: "exclude", assetCategory: defaultAssetCategory(row), monthlyDepreciation: 0 };
              return (
                <tr key={row.id}>
                  <td><span className={statusClass(row, state)}>{statusLabel(row, state)}</span></td>
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
                      className="field min-w-32"
                      onChange={(event) => updateRow(row.id, { assetCategory: event.target.value })}
                      value={state.assetCategory}
                    >
                      {assetCategoryOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="field min-w-36"
                      onChange={(event) => updateMode(row, event.target.value as ApplyMode)}
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
            {visibleRows.length === 0 ? (
              <tr>
                <td className="py-8 text-center font-bold text-slate-500" colSpan={9}>
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
