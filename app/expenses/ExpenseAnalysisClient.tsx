"use client";

import { useMemo, useState } from "react";
import { formatKRW } from "@/services/dashboard/calculations";
import type { Transaction } from "@/types/finance";

const talentLabels = ["인투1 집", "인투2 차", "인투3 밥", "인투4 몸", "인투5 성장", "인투6 환경"];
const allFilter = "전체";

type TalentFilter = typeof allFilter | (typeof talentLabels)[number];

type TalentSummary = {
  label: string;
  amount: number;
  count: number;
  share: number;
};

type ResolvedExpenseRow = {
  row: Transaction;
  talentType?: string;
};

function sumAmount(rows: Transaction[]) {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

function sumResolvedAmount(rows: ResolvedExpenseRow[]) {
  return rows.reduce((sum, { row }) => sum + row.amount, 0);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function normalizeTalentText(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}#·._-]/g, "");
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeTalentText(keyword)));
}

function resolveTalentType(row: Transaction) {
  const categoryText = normalizeTalentText([
    row.talentInvestmentType,
    row.mainCategory,
    row.subCategory,
    row.detailCategory
  ].filter(Boolean).join(" "));
  const fullText = normalizeTalentText([
    row.talentInvestmentType,
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.vendor,
    row.description,
    row.memo
  ].filter(Boolean).join(" "));

  if (includesAny(categoryText, ["인투1", "투자1", "인재투자1", "인투집", "투자집", "사택", "월세", "지급임차료"])) return "인투1 집";
  if (includesAny(categoryText, ["인투2", "투자2", "인재투자2", "인투차", "투자차", "법인차량", "차량", "리스료", "주유", "주차", "통행료"])) return "인투2 차";
  if (includesAny(categoryText, ["인투3", "투자3", "인재투자3", "인투밥", "투자밥", "식대", "간식", "커피", "카페", "편의점"])) return "인투3 밥";
  if (includesAny(categoryText, ["인투4", "투자4", "인재투자4", "인투몸", "투자몸", "복지포인트", "내일채움", "일자리공제", "4대보험", "보험료"])) return "인투4 몸";
  if (includesAny(categoryText, ["인투5", "투자5", "인재투자5", "인투성장", "투자성장", "교육", "출장", "숙박", "플랫폼", "openai", "gemini", "kling", "ai"])) return "인투5 성장";
  if (includesAny(categoryText, ["인투6", "투자6", "인재투자6", "인투환경", "투자환경", "사무용품", "소모품", "통신비", "공과금", "전력비", "인터넷", "정수기", "보안"])) return "인투6 환경";

  if (includesAny(fullText, ["인투1", "투자1", "인재투자1", "사택", "월세", "지급임차료"])) return "인투1 집";
  if (includesAny(fullText, ["인투2", "투자2", "인재투자2", "법인차량", "차량리스", "리스료", "주유", "주차", "통행료", "고속도로"])) return "인투2 차";
  if (includesAny(fullText, ["인투3", "투자3", "인재투자3", "식대", "간식", "커피", "카페", "편의점", "한식"])) return "인투3 밥";
  if (includesAny(fullText, ["인투4", "투자4", "인재투자4", "복지포인트", "내일채움", "일자리공제", "4대보험", "보험료"])) return "인투4 몸";
  if (includesAny(fullText, ["인투5", "투자5", "인재투자5", "교육훈련", "교육", "출장", "숙박", "플랫폼", "openai", "gemini", "kling", "클링", "재미나이"])) return "인투5 성장";
  if (includesAny(fullText, ["인투6", "투자6", "인재투자6", "환경용품", "사무용품", "소모품", "통신비", "공과금", "전력비", "인터넷", "정수기", "보안"])) return "인투6 환경";

  return undefined;
}

function splitTalentLabel(label: string) {
  const [code, ...rest] = label.split(" ");
  return {
    code,
    name: rest.join(" ") || label
  };
}

export function ExpenseAnalysisClient({ expenseRows }: { expenseRows: Transaction[] }) {
  const [activeFilter, setActiveFilter] = useState<TalentFilter>(allFilter);

  const totalAmount = useMemo(() => sumAmount(expenseRows), [expenseRows]);
  const resolvedRows = useMemo<ResolvedExpenseRow[]>(
    () => expenseRows.map((row) => ({ row, talentType: resolveTalentType(row) })),
    [expenseRows]
  );
  const talentRows = useMemo(
    () => resolvedRows.filter((item) => talentLabels.includes(item.talentType || "")),
    [resolvedRows]
  );
  const talentTotal = useMemo(() => sumResolvedAmount(talentRows), [talentRows]);
  const filteredRows = useMemo(() => {
    if (activeFilter === allFilter) return resolvedRows;
    return resolvedRows.filter((item) => item.talentType === activeFilter);
  }, [activeFilter, resolvedRows]);
  const filteredTotal = useMemo(() => sumResolvedAmount(filteredRows), [filteredRows]);
  const summaries = useMemo<TalentSummary[]>(
    () => talentLabels.map((label) => {
      const rows = resolvedRows.filter((item) => item.talentType === label);
      const amount = sumResolvedAmount(rows);

      return {
        label,
        amount,
        count: rows.length,
        share: talentTotal > 0 ? (amount / talentTotal) * 100 : 0
      };
    }),
    [resolvedRows, talentTotal]
  );

  return (
    <>
      <section className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        상단 인투 카드를 클릭하면 하단 지출 상세가 해당 유형으로 필터링됩니다. 2026년 5월은 사업부 세부 귀속 기준 확정 전까지 광고사업부 입금/출금으로 산정합니다.
      </section>

      <section className="mb-6 grid grid-cols-[minmax(0,1fr)_260px] gap-4 max-xl:grid-cols-1">
        <div className="grid grid-cols-6 gap-3 max-2xl:grid-cols-3 max-md:grid-cols-1">
          {summaries.map((summary) => {
            const selected = activeFilter === summary.label;
            const { code, name } = splitTalentLabel(summary.label);

            return (
              <button
                type="button"
                className={[
                  "card kpi cursor-pointer p-4 text-left transition",
                  selected ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-100" : "hover:border-blue-200 hover:bg-slate-50"
                ].join(" ")}
                key={summary.label}
                onClick={() => setActiveFilter(summary.label)}
                aria-pressed={selected}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={selected ? "badge" : "badge badge-muted"}>{code}</span>
                  <span className="text-xs font-black text-slate-400">{formatPercent(summary.share)}</span>
                </div>
                <div className="mt-3 text-sm font-black text-slate-950">{name}</div>
                <div className="mt-2 text-lg font-black text-slate-950">{formatKRW(summary.amount)}</div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{summary.count.toLocaleString("ko-KR")}건</span>
                  <span>{selected ? "선택됨" : "클릭해 상세보기"}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, summary.share)}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        <aside className="card flex flex-col justify-between gap-4">
          <div>
            <div className="eyebrow">현재 상세 필터</div>
            <div className="mt-2 text-2xl font-black text-slate-950">{activeFilter}</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {activeFilter === allFilter
                ? "전체 지출 거래를 표시 중입니다."
                : `${activeFilter}로 분류된 거래만 하단 상세에 표시 중입니다.`}
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
          <button type="button" className="btn w-full" onClick={() => setActiveFilter(allFilter)}>
            전체 지출 보기
          </button>
        </aside>
      </section>

      <section className="mb-6 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <div className="card">
          <div className="eyebrow">전체 지출</div>
          <div className="metric-value mt-3">{formatKRW(totalAmount)}</div>
          <div className="mt-2 text-xs text-slate-500">{expenseRows.length.toLocaleString("ko-KR")}건</div>
        </div>
        <div className="card">
          <div className="eyebrow">인재투자 합계</div>
          <div className="metric-value mt-3">{formatKRW(talentTotal)}</div>
          <div className="mt-2 text-xs text-slate-500">{talentRows.length.toLocaleString("ko-KR")}건</div>
        </div>
        <div className="card">
          <div className="eyebrow">현재 선택 상세</div>
          <div className="metric-value mt-3">{formatKRW(filteredTotal)}</div>
          <div className="mt-2 text-xs text-slate-500">{filteredRows.length.toLocaleString("ko-KR")}건 표시</div>
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <h2 className="section-title">지출 상세</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeFilter === allFilter ? "전체 지출 거래" : `${activeFilter} 거래`} {filteredRows.length.toLocaleString("ko-KR")}건을 표시합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{activeFilter}</span>
            <span className="badge badge-muted">{formatKRW(filteredTotal)}</span>
          </div>
        </div>

        {filteredRows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>일자</th>
                  <th>인투유형</th>
                  <th>사업부</th>
                  <th>원천</th>
                  <th>대분류</th>
                  <th>중분류</th>
                  <th>세부항목</th>
                  <th>거래처</th>
                  <th>적요</th>
                  <th className="text-right">금액</th>
                  <th>비용/자산</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ row, talentType }) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{talentType ? <span className="badge">{talentType}</span> : <span className="badge badge-muted">미지정</span>}</td>
                    <td>{row.businessUnit}</td>
                    <td>{row.source}</td>
                    <td>{row.mainCategory}</td>
                    <td>{row.subCategory}</td>
                    <td>{row.detailCategory}</td>
                    <td>{row.vendor}</td>
                    <td>{row.description}</td>
                    <td className="text-right font-black">{formatKRW(row.amount)}</td>
                    <td>{row.expenseBasis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="font-black text-slate-950">표시할 지출 상세가 없습니다.</div>
            <p className="mt-2 text-sm text-slate-500">다른 인투 카드를 선택하거나 전체 지출 보기로 돌아가세요.</p>
            <button type="button" className="btn mt-4" onClick={() => setActiveFilter(allFilter)}>
              전체 지출 보기
            </button>
          </div>
        )}
      </section>
    </>
  );
}
