"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatKRW } from "@/services/dashboard/calculations";

const revenueCategories = ["광고사업부 매출", "대외협력부 매출", "플랫폼 매출", "정부지원금", "기타매출"] as const;

type RevenueCategory = (typeof revenueCategories)[number];

export type RevenueEditorRow = {
  id: string;
  date: string;
  category: RevenueCategory;
  accountLabel: string;
  vendor: string;
  description: string;
  rule: string;
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
  const [category, setCategory] = useState<RevenueCategory>("광고사업부 매출");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(row.id));

  function toggleRow(id: string) {
    setMessage(null);
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  }

  function toggleAllVisible() {
    setMessage(null);
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
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
            <select className="field" value={category} onChange={(event) => setCategory(event.target.value as RevenueCategory)}>
              {revenueCategories.map((item) => (
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
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    aria-label={`${row.date} ${row.vendor} 매출 선택`}
                    checked={selectedSet.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    type="checkbox"
                  />
                </td>
                <td>{row.date}</td>
                <td><span className={categoryBadgeClass(row.category)}>{row.category}</span></td>
                <td>{row.accountLabel}</td>
                <td>{row.vendor}</td>
                <td>{row.description}</td>
                <td>{row.rule}</td>
                <td className="text-right font-black">{formatKRW(row.amount)}</td>
              </tr>
            )) : (
              <tr>
                <td className="py-10 text-center text-sm font-bold text-slate-500" colSpan={8}>
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
