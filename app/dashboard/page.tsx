export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Database, FileSpreadsheet, Landmark, WalletCards } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/shared/KpiCard";
import { endingAmount, formatCompactKRW, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { Transaction } from "@/types/finance";

function percent(part: number, total: number) {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function signedKRW(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatKRW(value)}`;
}

function isReviewNeeded(row: Transaction) {
  return row.reviewStatus === "확인필요"
    || row.journalStatus === "미분개"
    || row.businessUnit.includes("미배");
}

function isNormal(row: Transaction) {
  return row.reviewStatus === "정상" || row.reviewStatus === "확정";
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

function previewRawData(rawData: Record<string, unknown>) {
  return Object.entries(rawData)
    .filter(([, value]) => String(value ?? "").trim())
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" / ");
}

function amountClass(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-orange-700";
  return "text-slate-700";
}

function ShortMetric({
  label,
  value,
  caption,
  tone = "slate"
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "slate" | "blue" | "green" | "amber";
}) {
  const toneClass = {
    slate: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50"
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-xs font-black text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-black tracking-tight text-slate-950">{value}</div>
      {caption ? <div className="mt-1 text-xs leading-5 text-slate-500">{caption}</div> : null}
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { transactions, bankAccounts, balanceMovements, uploadBatches, rawRows, rawRowCount } = data;

  const assets = balanceMovements.filter((row) => row.statementType === "자산");
  const liabilities = balanceMovements.filter((row) => row.statementType === "부채");
  const totalAssets = sumBy(assets, endingAmount);
  const totalLiabilities = sumBy(liabilities, endingAmount);
  const equity = totalAssets - totalLiabilities;

  const cashIn = sumBy(transactions.filter((row) => row.cashFlowType === "입금" && !row.isInternalTransfer), (row) => row.amount);
  const cashOut = sumBy(transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer), (row) => row.amount);
  const netCashFlow = cashIn - cashOut;
  const assetSpending = sumBy(transactions.filter((row) => row.cashFlowType === "출금" && row.expenseBasis === "자산" && !row.isInternalTransfer), (row) => row.amount);
  const reviewRows = transactions.filter(isReviewNeeded);
  const recentRows = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const latestUpload = uploadBatches[0];

  const businessUnits = Array.from(new Set(transactions.map((row) => row.businessUnit || "미배분")))
    .sort((a, b) => {
      if (a.includes("미배")) return 1;
      if (b.includes("미배")) return -1;
      return a.localeCompare(b, "ko-KR");
    });

  const unitRows = businessUnits.map((unit) => {
    const rows = transactions.filter((row) => (row.businessUnit || "미배분") === unit && !row.isInternalTransfer);
    const unitIn = sumBy(rows.filter((row) => row.cashFlowType === "입금"), (row) => row.amount);
    const unitOut = sumBy(rows.filter((row) => row.cashFlowType === "출금"), (row) => row.amount);
    const unitReviewCount = rows.filter(isReviewNeeded).length;
    return {
      unit,
      cashIn: unitIn,
      cashOut: unitOut,
      net: unitIn - unitOut,
      count: rows.length,
      reviewCount: unitReviewCount
    };
  });
  const maxUnitIn = Math.max(...unitRows.map((row) => row.cashIn), 1);
  const sourceRows = ["은행", "카드"].map((source) => {
    const rows = transactions.filter((row) => row.source === source && !row.isInternalTransfer);
    return {
      source,
      count: rows.length,
      inAmount: sumBy(rows.filter((row) => row.cashFlowType === "입금"), (row) => row.amount),
      outAmount: sumBy(rows.filter((row) => row.cashFlowType === "출금"), (row) => row.amount)
    };
  });
  const expenseCategoryRows = Array.from(
    transactions
      .filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer)
      .reduce((acc, row) => {
        const key = row.mainCategory || "미분류";
        acc.set(key, (acc.get(key) || 0) + row.amount);
        return acc;
      }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <AppShell
      title="경영현황 대시보드"
      description="5월 로우데이터를 기준으로 현금흐름, 자산·부채, 분류 상태를 한 화면에서 확인합니다."
      periodLabel={data.currentMonth || "2026-05"}
    >
      <section className="mb-5 overflow-hidden rounded-lg border border-slate-900 bg-slate-950 text-white">
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] gap-0 max-xl:grid-cols-1">
          <div className="p-6 max-md:p-5">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black text-blue-100">{data.currentMonth || "2026-05"} 실데이터</span>
              <span className="inline-flex rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">5월 임시 기준: 광고사업부</span>
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight max-md:text-2xl">5월 경영현황 요약</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              6월 결산 전까지 입금과 출금은 광고사업부 기준으로 산정합니다. 세부 사업부 분류는 유지하되, 화면 집계는 같은 기준으로 맞췄습니다.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 max-md:grid-cols-1">
              <div className="rounded-lg bg-white/[.08] p-4 ring-1 ring-white/10">
                <div className="text-xs font-black text-slate-300">입금</div>
                <div className="mt-2 text-2xl font-black">{formatCompactKRW(cashIn)}</div>
                <div className="mt-1 text-xs text-slate-400">{formatKRW(cashIn)}</div>
              </div>
              <div className="rounded-lg bg-white/[.08] p-4 ring-1 ring-white/10">
                <div className="text-xs font-black text-slate-300">출금</div>
                <div className="mt-2 text-2xl font-black">{formatCompactKRW(cashOut)}</div>
                <div className="mt-1 text-xs text-slate-400">{formatKRW(cashOut)}</div>
              </div>
              <div className="rounded-lg bg-white p-4 text-slate-950">
                <div className="text-xs font-black text-slate-500">순현금흐름</div>
                <div className={`mt-2 text-2xl font-black ${amountClass(netCashFlow)}`}>{formatCompactKRW(netCashFlow)}</div>
                <div className="mt-1 text-xs text-slate-500">{signedKRW(netCashFlow)}</div>
              </div>
            </div>
          </div>
          <div className="border-l border-white/10 bg-white/[.04] p-6 max-xl:border-l-0 max-xl:border-t max-md:p-5">
            <div className="grid gap-3">
              <ShortMetric label="총자산" value={formatCompactKRW(totalAssets)} caption={formatKRW(totalAssets)} tone="blue" />
              <ShortMetric label="총부채" value={formatCompactKRW(totalLiabilities)} caption={formatKRW(totalLiabilities)} tone="amber" />
              <ShortMetric label="자본" value={formatCompactKRW(equity)} caption="총자산 - 총부채" tone="green" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        <KpiCard label="거래 변환" value={`${transactions.length.toLocaleString("ko-KR")}건`} caption={`원본 ${rawRowCount.toLocaleString("ko-KR")}행 / 배치 ${uploadBatches.length.toLocaleString("ko-KR")}개`} tone="blue" meta="Rows" />
        <KpiCard label="확인필요" value={`${reviewRows.length.toLocaleString("ko-KR")}건`} caption={reviewRows.length === 0 ? "현재 검증 대기 없음" : "검토 후 규칙 보정 필요"} tone={reviewRows.length === 0 ? "green" : "amber"} meta="Review" />
        <KpiCard label="자산성 지출" value={assetSpending} caption="출금 중 자산 취득 반영액" tone="slate" meta="Asset" />
        <KpiCard label="최근 업로드" value={latestUpload ? "반영 완료" : "-"} caption={latestUpload ? `${latestUpload.fileName} · ${formatDateTime(latestUpload.uploadedAt)}` : "업로드 이력 없음"} tone="slate" meta="File" />
      </section>

      <section className="mt-5 grid grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)] gap-5 max-xl:grid-cols-1">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">5월 집계 기준</h2>
              <p className="mt-1 text-sm text-slate-500">현재 월은 모든 입금·출금을 광고사업부로 산정합니다. 6월부터 세부 기준을 다시 적용합니다.</p>
            </div>
            <Link href="/expenses" className="btn btn-soft">
              지출 분석 <ArrowRight size={14} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>사업부</th>
                  <th className="text-right">입금</th>
                  <th className="text-right">출금</th>
                  <th className="text-right">순현금흐름</th>
                  <th className="text-right">거래</th>
                  <th>입금 비중</th>
                </tr>
              </thead>
              <tbody>
                {unitRows.map((row) => (
                  <tr key={row.unit}>
                    <td className="font-black text-slate-950">
                      {row.unit}
                      {row.reviewCount > 0 ? <span className="badge badge-warning ml-2">{row.reviewCount}건 확인</span> : null}
                    </td>
                    <td className="text-right font-bold">{formatKRW(row.cashIn)}</td>
                    <td className="text-right">{formatKRW(row.cashOut)}</td>
                    <td className={`text-right font-black ${row.net >= 0 ? "text-emerald-700" : "text-orange-700"}`}>{formatKRW(row.net)}</td>
                    <td className="text-right">{row.count.toLocaleString("ko-KR")}건</td>
                    <td>
                      <div className="flex min-w-[180px] items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: percent(row.cashIn, maxUnitIn) }} />
                        </div>
                        <span className="w-12 text-right text-xs font-black text-slate-500">{percent(row.cashIn, cashIn)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">처리 상태</h2>
              <p className="mt-1 text-sm text-slate-500">데이터 반영과 검증 상태를 요약합니다.</p>
            </div>
            <span className={reviewRows.length === 0 ? "badge badge-good" : "badge badge-warning"}>
              {reviewRows.length === 0 ? "정상" : `${reviewRows.length}건 확인`}
            </span>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Database className="text-blue-600" size={20} />
              <div className="min-w-0">
                <div className="font-black text-slate-950">Supabase 실데이터</div>
                <div className="mt-1 text-xs text-slate-500">{transactions.length.toLocaleString("ko-KR")}건 집계 중</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <CheckCircle2 className="text-emerald-600" size={20} />
              <div className="min-w-0">
                <div className="font-black text-slate-950">분류 검증 완료</div>
                <div className="mt-1 text-xs text-slate-500">확인필요 {reviewRows.length.toLocaleString("ko-KR")}건</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <FileSpreadsheet className="text-slate-600" size={20} />
              <div className="min-w-0">
                <div className="truncate font-black text-slate-950">{latestUpload?.fileName || "업로드 없음"}</div>
                <div className="mt-1 text-xs text-slate-500">최근 반영 파일</div>
              </div>
            </div>
            {reviewRows.length === 0 ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                확인이 필요한 거래가 없습니다.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-5 max-xl:grid-cols-1">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">현금흐름 원천</h2>
              <p className="mt-1 text-sm text-slate-500">은행과 카드 원천별 입출금 규모입니다.</p>
            </div>
            <Landmark size={20} className="text-slate-400" />
          </div>
          <div className="grid gap-3">
            {sourceRows.map((row) => (
              <div key={row.source} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black text-slate-950">{row.source}</div>
                  <span className="badge badge-muted">{row.count.toLocaleString("ko-KR")}건</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs font-black text-slate-500">입금</div>
                    <div className="mt-1 font-black text-emerald-700">{formatKRW(row.inAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-500">출금</div>
                    <div className="mt-1 font-black text-orange-700">{formatKRW(row.outAmount)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">자산 · 부채 · 자본</h2>
              <p className="mt-1 text-sm text-slate-500">5월말 기준 재무상태 요약입니다.</p>
            </div>
            <WalletCards size={20} className="text-slate-400" />
          </div>
          <div className="grid grid-cols-[1fr_28px_1fr_28px_1fr] items-stretch gap-2 max-md:grid-cols-1">
            <ShortMetric label="총자산" value={formatCompactKRW(totalAssets)} caption={formatKRW(totalAssets)} />
            <div className="flex items-center justify-center text-xl font-black text-slate-400 max-md:hidden">-</div>
            <ShortMetric label="총부채" value={formatCompactKRW(totalLiabilities)} caption={formatKRW(totalLiabilities)} />
            <div className="flex items-center justify-center text-xl font-black text-slate-400 max-md:hidden">=</div>
            <ShortMetric label="자본" value={formatCompactKRW(equity)} caption={formatKRW(equity)} tone="blue" />
          </div>
          <div className="mt-4 grid gap-2">
            {[...assets, ...liabilities].slice(0, 6).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-b-0 last:pb-0">
                <span className="min-w-0 font-bold text-slate-700">
                  <span className={row.statementType === "자산" ? "badge badge-good mr-2" : "badge badge-warning mr-2"}>{row.statementType}</span>
                  {row.category}
                </span>
                <b className="shrink-0">{formatKRW(endingAmount(row))}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(340px,.75fr)] gap-5 max-xl:grid-cols-1">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">주요 지출 분류</h2>
              <p className="mt-1 text-sm text-slate-500">출금 거래 중 금액이 큰 대분류입니다.</p>
            </div>
            <Link href="/expenses" className="btn btn-soft">전체 지출</Link>
          </div>
          <div className="grid gap-3">
            {expenseCategoryRows.map(([category, amount]) => (
              <div key={category}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-black text-slate-700">{category}</span>
                  <span className="font-black text-slate-950">{formatKRW(amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: percent(amount, Math.max(cashOut, 1)) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-4">
            <h2 className="section-title">최근 업로드</h2>
            <p className="mt-1 text-sm text-slate-500">현재 결과값에 반영된 파일입니다.</p>
          </div>
          <div className="grid gap-3">
            {uploadBatches.slice(0, 4).map((batch) => (
              <div key={batch.id} className="rounded-lg border border-slate-200 p-4">
                <div className="truncate font-black text-slate-950">{batch.fileName}</div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{formatDateTime(batch.uploadedAt)}</span>
                  <span className="badge badge-muted">{batch.uploadType}</span>
                </div>
              </div>
            ))}
            <Link href="/uploads" className="btn">업로드 보기 <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      <section className="mt-5 card">
        <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
          <div>
            <h2 className="section-title">최근 거래</h2>
            <p className="mt-1 text-sm text-slate-500">최신순 8건을 빠르게 확인합니다.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/bank" className="btn">은행</Link>
            <Link href="/cards" className="btn">카드</Link>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>일자</th>
                <th>출처</th>
                <th>사업부</th>
                <th>거래처</th>
                <th>내용</th>
                <th>상태</th>
                <th className="text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td><span className="badge badge-muted">{row.source}</span></td>
                  <td className="font-bold text-slate-700">{row.businessUnit}</td>
                  <td>{row.vendor}</td>
                  <td>{row.description}</td>
                  <td>
                    {isNormal(row) ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700"><CheckCircle2 size={13} /> {row.reviewStatus}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700"><CircleAlert size={13} /> {row.reviewStatus}</span>
                    )}
                  </td>
                  <td className="text-right font-black">{formatKRW(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 card">
        <div className="mb-4">
          <h2 className="section-title">원본 로우데이터 확인</h2>
          <p className="mt-1 text-sm text-slate-500">필요할 때만 원본 샘플을 확인합니다. 첫 화면에서는 핵심 지표를 우선 보여줍니다.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>행</th>
                <th>원본값 일부</th>
                <th>정규화 결과</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rawRows.map((row) => (
                <tr key={row.id}>
                  <td className="font-black">{row.rowIndex}</td>
                  <td>{previewRawData(row.rawData)}</td>
                  <td>{row.normalizedData ? previewRawData(row.normalizedData) : "-"}</td>
                  <td><span className={row.parseStatus === "정상" ? "badge badge-good" : "badge badge-warning"}>{row.parseStatus}</span></td>
                </tr>
              ))}
              {rawRows.length === 0 ? (
                <tr><td colSpan={4} className="text-slate-500">표시할 원본 행이 없습니다.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        5월은 사업부 세부 귀속 기준 확정 전까지 광고사업부 기준으로 산정했습니다. 6월 결산 기준을 받으면 이 영역의 집계 기준을 다시 분리합니다.
      </section>
    </AppShell>
  );
}
