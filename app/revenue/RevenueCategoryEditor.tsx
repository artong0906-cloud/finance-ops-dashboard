"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatKRW } from "@/services/dashboard/calculations";

const revenueCategories = ["광고사업부 매출", "대외협력팀 매출", "플랫폼 매출", "정부지원금", "기타매출"] as const;
const editableRevenueCategories = [...revenueCategories, "통장간 이동"] as const;

type RevenueCategory = (typeof revenueCategories)[number];
type EditableRevenueCategory = (typeof editableRevenueCategories)[number];

export type RevenueEditorRow = {
  id: string;
  transactionId: string;
  date: string;
  category: RevenueCategory;
  accountLabel: string;
  vendor: string;
  description: string;
  rule: string;
  amount: number;
  originalAmount: number;
  isSplit: boolean;
  splitEntries: RevenueSplitEntry[];
  canSplit: boolean;
};

export type RevenueSplitEntry = {
  category: RevenueCategory;
  amount: number;
};

function categoryBadgeClass(category: RevenueCategory) {
  if (category === "기타매출") return "badge badge-warning";
  if (category === "정부지원금") return "badge badge-good";
  return "badge";
}

export function RevenueCategoryEditor({
  rows
}: {
  rows: RevenueEditorRow[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [category, setCategory] = useState<EditableRevenueCategory>("광고사업부 매출");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSplit, setIsSavingSplit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [splitTarget, setSplitTarget] = useState<RevenueEditorRow | null>(null);
  const [splitAmounts, setSplitAmounts] = useState<Record<RevenueCategory, string>>(() => initialSplitAmounts());
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const categoryEditableRows = useMemo(() => rows.filter((row) => !row.isSplit), [rows]);
  const allSelected = categoryEditableRows.length > 0 && categoryEditableRows.every((row) => selectedSet.has(row.transactionId));
  const allocatedSplitAmount = useMemo(() => (
    revenueCategories.reduce((sum, item) => sum + parseAmount(splitAmounts[item]), 0)
  ), [splitAmounts]);
  const splitDiff = splitTarget ? splitTarget.originalAmount - allocatedSplitAmount : 0;

  function toggleRow(row: RevenueEditorRow) {
    if (row.isSplit) return;
    setMessage(null);
    setSelectedIds((current) => (
      current.includes(row.transactionId)
        ? current.filter((item) => item !== row.transactionId)
        : [...current, row.transactionId]
    ));
  }

  function toggleAllVisible() {
    setMessage(null);
    setSelectedIds(allSelected ? [] : categoryEditableRows.map((row) => row.transactionId));
  }

  function openSplitEditor(row: RevenueEditorRow) {
    const next = initialSplitAmounts();
    const entries = row.splitEntries.length > 0
      ? row.splitEntries
      : [{ category: row.category, amount: row.originalAmount }];

    entries.forEach((entry) => {
      next[entry.category] = String(entry.amount);
    });
    setSplitTarget(row);
    setSplitAmounts(next);
    setMessage(null);
  }

  async function saveCategory() {
    if (selectedIds.length === 0) {
      setMessage("변경할 매출 거래를 먼저 선택해 주세요.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/transactions/categories", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "revenue",
          transactionIds: selectedIds,
          category
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "매출 구분 변경 중 오류가 발생했습니다.");
      }

      setSelectedIds([]);
      setMessage(`${(result.updatedCount ?? selectedIds.length).toLocaleString("ko-KR")}건을 ${category}로 변경했습니다.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "매출 구분 변경 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSplit() {
    if (!splitTarget) return;
    if (allocatedSplitAmount !== splitTarget.originalAmount) {
      setMessage(`분리 금액 합계가 원 입금액과 일치해야 합니다. 차이: ${formatKRW(splitDiff)}`);
      return;
    }

    setIsSavingSplit(true);
    setMessage(null);

    try {
      const splits = revenueCategories
        .map((item) => ({ category: item, amount: parseAmount(splitAmounts[item]) }))
        .filter((item) => item.amount > 0);
      const response = await fetch("/api/transactions/revenue-splits", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transactionId: splitTarget.transactionId,
          splits
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "매출 금액분리 저장 중 오류가 발생했습니다.");
      }

      setSplitTarget(null);
      setMessage("ciderpay 입금 금액분리를 저장했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "매출 금액분리 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingSplit(false);
    }
  }

  async function clearSplit() {
    if (!splitTarget) return;

    setIsSavingSplit(true);
    setMessage(null);

    try {
      const response = await fetch("/api/transactions/revenue-splits", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transactionId: splitTarget.transactionId,
          splits: []
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "매출 금액분리 해제 중 오류가 발생했습니다.");
      }

      setSplitTarget(null);
      setMessage("매출 금액분리를 해제했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "매출 금액분리 해제 중 오류가 발생했습니다.");
    } finally {
      setIsSavingSplit(false);
    }
  }

  return (
    <>
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_220px_auto_auto] items-end gap-3 max-xl:grid-cols-1">
          <div>
            <div className="eyebrow">선택 구분 변경</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              상세 행을 선택한 뒤 매출구분을 변경하면 이후 집계와 월별 필터에 같은 기준으로 반영됩니다.
            </p>
            {message ? <p className="mt-2 text-sm font-bold text-blue-700">{message}</p> : null}
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            변경할 매출구분
            <select className="field" value={category} onChange={(event) => setCategory(event.target.value as EditableRevenueCategory)}>
              {editableRevenueCategories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" disabled={isSaving || selectedIds.length === 0} onClick={saveCategory} type="button">
            {isSaving ? "저장 중" : `선택 ${selectedIds.length.toLocaleString("ko-KR")}건 변경`}
          </button>
          <button className="btn" disabled={selectedIds.length === 0 || isSaving} onClick={() => setSelectedIds([])} type="button">
            선택 해제
          </button>
        </div>
      </div>

      {splitTarget ? (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/70 p-4">
          <div className="mb-3 flex items-start justify-between gap-4 max-lg:flex-col">
            <div>
              <div className="eyebrow">ciderpay 금액 분리</div>
              <h3 className="mt-1 text-lg font-black text-slate-950">{splitTarget.vendor}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                수수료 제외 후 입금된 순입금액을 사업부별 매출로 나눕니다. 입력 합계는 원 입금액과 정확히 같아야 저장됩니다.
              </p>
            </div>
            <div className="grid min-w-[260px] gap-1 rounded-lg border border-blue-100 bg-white p-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-slate-500">원 입금액</span><strong>{formatKRW(splitTarget.originalAmount)}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">분리 합계</span><strong>{formatKRW(allocatedSplitAmount)}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">차이</span><strong className={splitDiff === 0 ? "text-emerald-700" : "text-amber-700"}>{formatKRW(splitDiff)}</strong></div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {revenueCategories.map((item) => (
              <label className="grid gap-2 text-sm font-bold text-slate-700" key={item}>
                {item}
                <input
                  className="field"
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => setSplitAmounts((current) => ({ ...current, [item]: event.target.value }))}
                  type="number"
                  value={splitAmounts[item]}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" disabled={isSavingSplit || splitDiff !== 0} onClick={saveSplit} type="button">
              {isSavingSplit ? "저장 중" : "금액분리 저장"}
            </button>
            <button className="btn" disabled={isSavingSplit} onClick={() => setSplitTarget(null)} type="button">
              닫기
            </button>
            {splitTarget.isSplit ? (
              <button className="btn border-red-200 bg-red-50 text-red-700 hover:bg-red-100" disabled={isSavingSplit} onClick={clearSplit} type="button">
                분리 해제
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="w-10">
                <input aria-label="표시된 매출 전체 선택" checked={allSelected} onChange={toggleAllVisible} type="checkbox" />
              </th>
              <th>일자</th>
              <th>매출구분</th>
              <th>통장/원천</th>
              <th>거래처</th>
              <th>적요</th>
              <th>분류근거</th>
              <th className="text-right">입금액</th>
              <th className="text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    aria-label={`${row.date} ${row.vendor} 매출 선택`}
                    checked={!row.isSplit && selectedSet.has(row.transactionId)}
                    disabled={row.isSplit}
                    onChange={() => toggleRow(row)}
                    type="checkbox"
                  />
                </td>
                <td>{row.date}</td>
                <td><span className={categoryBadgeClass(row.category)}>{row.category}</span></td>
                <td>{row.accountLabel}</td>
                <td>{row.vendor}</td>
                <td>{row.description}</td>
                <td>{row.rule}</td>
                <td className="text-right font-black">
                  {formatKRW(row.amount)}
                  {row.isSplit ? <div className="mt-1 text-[11px] font-bold text-slate-400">원입금 {formatKRW(row.originalAmount)}</div> : null}
                </td>
                <td className="text-right">
                  {row.canSplit ? (
                    <button className="btn btn-sm" onClick={() => openSplitEditor(row)} type="button">
                      금액 분리
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">-</span>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td className="py-10 text-center text-sm font-bold text-slate-500" colSpan={9}>
                  표시할 매출 상세가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function initialSplitAmounts(): Record<RevenueCategory, string> {
  return revenueCategories.reduce((acc, item) => {
    acc[item] = "0";
    return acc;
  }, {} as Record<RevenueCategory, string>);
}

function parseAmount(value: string) {
  const amount = Number(String(value || "0").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount);
}
