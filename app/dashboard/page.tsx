export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/shared/KpiCard";
import { balanceMovements, bankAccounts, transactions } from "@/data/mock";
import {
  endingAmount,
  expenseByBusinessUnit,
  formatCompactKRW,
  formatKRW,
  revenueByBusinessUnit,
  sumBy
} from "@/services/dashboard/calculations";

const units = ["광고사업부", "플랫폼", "파트너십", "공통사용분"] as const;

function percent(part: number, total: number) {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function signedKRW(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatKRW(value)}`;
}

export default function DashboardPage() {
  const totalBank = sumBy(bankAccounts, (row) => row.currentBalance);
  const previousBank = sumBy(bankAccounts, (row) => row.previousBalance);
  const bankDelta = totalBank - previousBank;

  const assets = balanceMovements.filter((row) => row.statementType === "자산");
  const liabilities = balanceMovements.filter((row) => row.statementType === "부채");
  const totalAssets = sumBy(assets, endingAmount);
  const totalLiabilities = sumBy(liabilities, endingAmount);
  const equity = totalAssets - totalLiabilities;

  const revenue = sumBy(transactions.filter((row) => row.mainCategory === "매출" && !row.isInternalTransfer), (row) => row.amount);
  const cashIn = sumBy(transactions.filter((row) => row.cashFlowType === "입금" && !row.isInternalTransfer), (row) => row.amount);
  const cashOut = sumBy(transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer), (row) => row.amount);
  const operatingExpense = sumBy(transactions.filter((row) => row.cashFlowType === "출금" && row.expenseBasis === "비용" && !row.isInternalTransfer), (row) => row.amount);
  const assetSpending = sumBy(transactions.filter((row) => row.cashFlowType === "출금" && row.expenseBasis === "자산" && !row.isInternalTransfer), (row) => row.amount);
  const estimatedProfit = revenue - operatingExpense;
  const reviewRows = transactions.filter((row) => row.reviewStatus === "확인필요" || row.journalStatus === "미분개");
  const maxUnitRevenue = Math.max(...units.map((unit) => revenueByBusinessUnit(transactions, unit)), 1);
  const recentRows = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  return (
    <AppShell
      title="경영현황 대시보드"
      description="통장 잔액, 사업부 손익, 현금 흐름, 자산/부채 상태를 한 화면에서 확인하는 운영용 첫 화면입니다."
    >
      <section className="grid grid-cols-5 gap-4 max-2xl:grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        <KpiCard label="통장 잔액" value={totalBank} caption={`전월 대비 ${signedKRW(bankDelta)}`} tone="blue" meta="Cash" />
        <KpiCard label="당월 매출" value={revenue} caption={`입금 기준 ${formatKRW(cashIn)}`} tone="green" meta="Revenue" />
        <KpiCard label="비용성 지출" value={operatingExpense} caption={`자산성 지출 ${formatKRW(assetSpending)}`} tone="amber" meta="Expense" />
        <KpiCard label="추정 영업손익" value={estimatedProfit} caption="매출 - 비용성 지출" tone={estimatedProfit >= 0 ? "green" : "amber"} meta="P/L" />
        <KpiCard label="검증 필요" value={`${reviewRows.length}건`} caption="미분개 또는 확인 필요 거래" tone="amber" meta="Review" />
      </section>

      <section className="mt-5 grid grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] gap-5 max-xl:grid-cols-1">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">사업부별 매출/지출</h2>
              <p className="mt-1 text-sm text-slate-500">공통사용분은 광고사업부 손익에서 제외하고 별도 라인으로 관리합니다.</p>
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
                  <th className="text-right">매출</th>
                  <th className="text-right">비용성 지출</th>
                  <th className="text-right">추정 손익</th>
                  <th>매출 비중</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => {
                  const unitRevenue = revenueByBusinessUnit(transactions, unit);
                  const unitExpense = expenseByBusinessUnit(transactions, unit);
                  const unitProfit = unitRevenue - unitExpense;
                  return (
                    <tr key={unit}>
                      <td className="font-black text-slate-950">{unit}</td>
                      <td className="text-right font-bold">{formatKRW(unitRevenue)}</td>
                      <td className="text-right">{formatKRW(unitExpense)}</td>
                      <td className={`text-right font-black ${unitProfit >= 0 ? "text-emerald-700" : "text-orange-700"}`}>
                        {formatKRW(unitProfit)}
                      </td>
                      <td>
                        <div className="flex min-w-[180px] items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: percent(unitRevenue, maxUnitRevenue) }} />
                          </div>
                          <span className="w-12 text-right text-xs font-black text-slate-500">{percent(unitRevenue, revenue)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">검증 대기</h2>
            <span className="badge badge-warning">{reviewRows.length}건</span>
          </div>
          <div className="grid gap-3">
            {reviewRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">{row.vendor}</div>
                    <div className="mt-1 text-sm text-slate-600">{row.description}</div>
                  </div>
                  <span className="badge badge-warning">{row.reviewStatus}</span>
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
            <span className="badge badge-muted">자동 계산</span>
          </div>
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
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">통장별 잔액</h2>
              <p className="mt-1 text-sm text-slate-500">전월 대비 증감과 현재 잔액을 통장 기준으로 확인합니다.</p>
            </div>
            <Link href="/bank" className="btn">
              입출금 보기 <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            {bankAccounts.map((row) => {
              const delta = row.currentBalance - row.previousBalance;
              return (
                <div key={row.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-950">{row.accountName}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.bankName} {row.maskedNo}</div>
                    </div>
                    <span className="badge badge-muted">{row.businessUnit}</span>
                  </div>
                  <div className="mt-4 text-xl font-black text-slate-950">{formatKRW(row.currentBalance)}</div>
                  <div className={`mt-2 flex items-center gap-1 text-xs font-black ${delta >= 0 ? "text-emerald-700" : "text-orange-700"}`}>
                    {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {signedKRW(delta)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-5 card">
        <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
          <div>
            <h2 className="section-title">최근 거래</h2>
            <p className="mt-1 text-sm text-slate-500">은행, 카드, 내부이체를 합쳐 최근 처리 순서로 보여줍니다.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/cards" className="btn">카드</Link>
            <Link href="/uploads" className="btn btn-soft">업로드</Link>
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
                    {row.reviewStatus === "정상" || row.reviewStatus === "확정" ? (
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

      <section className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        다음 고도화 순서: 업로드 데이터 저장 → 자동 분류 → KPI 실데이터 연결 → Vercel 운영 환경변수 등록 → Production 배포.
      </section>
    </AppShell>
  );
}
