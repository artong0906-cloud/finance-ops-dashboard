export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, TrendingDown, TrendingUp } from "lucide-react";
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

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { transactions, bankAccounts, balanceMovements, uploadBatches, rawRows, rawRowCount } = data;

  const totalBank = sumBy(bankAccounts, (row) => row.currentBalance);
  const previousBank = sumBy(bankAccounts, (row) => row.previousBalance);
  const bankDelta = totalBank - previousBank;

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

  return (
    <AppShell
      title="경영현황 대시보드"
      description="업로드된 로우데이터를 기준으로 입금, 출금, 순현금흐름, 미배분 거래를 먼저 확인하고 화면 구조를 다듬습니다."
    >
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div>
          <div className="text-sm font-black text-blue-950">
            {data.mode === "live" ? "실데이터 모드" : "샘플데이터 모드"}
          </div>
          <div className="mt-1 text-sm leading-6 text-blue-800">
            {data.mode === "live"
              ? `Supabase 업로드 데이터 ${transactions.length.toLocaleString("ko-KR")}건을 기준으로 집계 중입니다.`
              : "아직 읽을 수 있는 업로드 거래가 없어 샘플 데이터로 화면을 보여줍니다."}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/uploads" className="btn btn-primary">로우데이터 업로드</Link>
          <Link href="/prototype-v11.html" className="btn btn-soft" target="_blank">프로토타입 보기</Link>
        </div>
      </section>

      <section className="grid grid-cols-5 gap-4 max-2xl:grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        <KpiCard label="로우데이터 행" value={`${rawRowCount.toLocaleString("ko-KR")}건`} caption={`${uploadBatches.length.toLocaleString("ko-KR")}개 업로드 배치`} tone="blue" meta="Raw" />
        <KpiCard label="거래 변환" value={`${transactions.length.toLocaleString("ko-KR")}건`} caption="대시보드 집계 대상 거래" tone="slate" meta="Rows" />
        <KpiCard label="입금 합계" value={cashIn} caption="은행/카드 변환 데이터 기준" tone="green" meta="In" />
        <KpiCard label="출금 합계" value={cashOut} caption={`자산성 지출 ${formatKRW(assetSpending)}`} tone="amber" meta="Out" />
        <KpiCard label="순현금흐름" value={netCashFlow} caption="입금 - 출금" tone={netCashFlow >= 0 ? "green" : "amber"} meta="Net" />
      </section>

      <section className="mt-5 grid grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] gap-5 max-xl:grid-cols-1">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">사업부/미배분 기준 집계</h2>
              <p className="mt-1 text-sm text-slate-500">현재 로우데이터가 어느 사업부로 귀속됐는지, 미배분이 얼마나 남았는지 먼저 봅니다.</p>
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">분류/검증 대기</h2>
            <span className="badge badge-warning">{reviewRows.length.toLocaleString("ko-KR")}건</span>
          </div>
          <div className="grid gap-3">
            {reviewRows.slice(0, 6).map((row) => (
              <div key={row.id} className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">{row.vendor}</div>
                    <div className="mt-1 text-sm text-slate-600">{row.description}</div>
                  </div>
                  <span className="badge badge-warning">{row.businessUnit}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{row.date} · {row.source}</span>
                  <b>{formatKRW(row.amount)}</b>
                </div>
              </div>
            ))}
            {reviewRows.length === 0 ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                확인이 필요한 거래가 없습니다.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] gap-5 max-xl:grid-cols-1">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">자산 · 부채 · 자본</h2>
            <span className="badge badge-muted">입력표 연동</span>
          </div>
          {balanceMovements.length > 0 ? (
            <>
              <div className="grid grid-cols-[1fr_36px_1fr_36px_1fr] items-stretch gap-2 max-md:grid-cols-1">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black text-slate-500">총자산</div>
                  <div className="mt-2 text-xl font-black text-slate-950">{formatCompactKRW(totalAssets)}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatKRW(totalAssets)}</div>
                </div>
                <div className="flex items-center justify-center text-xl font-black text-slate-400 max-md:hidden">-</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black text-slate-500">총부채</div>
                  <div className="mt-2 text-xl font-black text-slate-950">{formatCompactKRW(totalLiabilities)}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatKRW(totalLiabilities)}</div>
                </div>
                <div className="flex items-center justify-center text-xl font-black text-slate-400 max-md:hidden">=</div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="text-xs font-black text-blue-700">자본</div>
                  <div className="mt-2 text-xl font-black text-blue-950">{formatCompactKRW(equity)}</div>
                  <div className="mt-1 text-xs text-blue-700">{formatKRW(equity)}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {[...assets, ...liabilities].map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-b-0 last:pb-0">
                    <span className="font-bold text-slate-700">
                      <span className={row.statementType === "자산" ? "badge badge-good mr-2" : "badge badge-warning mr-2"}>{row.statementType}</span>
                      {row.category}
                    </span>
                    <b>{formatKRW(endingAmount(row))}</b>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              아직 자산/부채 증감 데이터가 없습니다. 은행/카드 로우데이터 분류가 안정화되면 balance 업로드 양식과 연결합니다.
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">최근 업로드</h2>
              <p className="mt-1 text-sm text-slate-500">어떤 원본 파일이 현재 결과값에 반영됐는지 확인합니다.</p>
            </div>
            <Link href="/uploads" className="btn">
              업로드 보기 <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-3">
            {uploadBatches.map((batch) => (
              <div key={batch.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-black text-slate-950">{batch.fileName}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(batch.uploadedAt)} · {batch.uploadedBy || "-"}</div>
                  </div>
                  <span className="badge badge-muted">{batch.uploadType}</span>
                </div>
              </div>
            ))}
            {uploadBatches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">업로드 이력이 없습니다.</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 card">
        <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
          <div>
            <h2 className="section-title">최근 거래</h2>
            <p className="mt-1 text-sm text-slate-500">로우데이터에서 변환된 거래를 최신순으로 보여줍니다.</p>
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
          <h2 className="section-title">원본 로우데이터 샘플</h2>
          <p className="mt-1 text-sm text-slate-500">업로드된 원본 행과 자동 정규화 결과를 같이 보면서 분류 규칙을 잡아갑니다.</p>
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

      <section className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        다음 작업은 미배분 거래를 자동 분류하는 규칙입니다. 거래처/적요 키워드를 기준으로 사업부, 비용/자산, 대분류를 채우면 이 화면의 결과값이 바로 바뀝니다.
      </section>
    </AppShell>
  );
}
