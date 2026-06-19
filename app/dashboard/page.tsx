export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/shared/KpiCard";
import { balanceMovements, bankAccounts, transactions } from "@/data/mock";
import { endingAmount, expenseByBusinessUnit, formatKRW, revenueByBusinessUnit, sumBy } from "@/services/dashboard/calculations";

const units = ["광고사업부", "플랫폼", "대외협력", "공통사용분"] as const;

export default function DashboardPage() {
  const totalBank = sumBy(bankAccounts, (row) => row.currentBalance);
  const assets = balanceMovements.filter((row) => row.statementType === "자산");
  const liabilities = balanceMovements.filter((row) => row.statementType === "부채");
  const totalAssets = sumBy(assets, endingAmount);
  const totalLiabilities = sumBy(liabilities, endingAmount);
  const equity = totalAssets - totalLiabilities;
  const cashIn = sumBy(transactions.filter((row) => row.cashFlowType === "입금"), (row) => row.amount);
  const cashOut = sumBy(transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer), (row) => row.amount);
  const reviewRows = transactions.filter((row) => row.reviewStatus !== "정상" && row.reviewStatus !== "확정");

  return (
    <AppShell title="메인 경영현황판" description="통장잔고, 자산, 부채, 자본과 사업부별 매출/지출을 한 화면에서 봅니다.">
      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        <KpiCard label="통장잔고" value={totalBank} caption="4개 운영 통장 현재 잔액" tone="blue" meta="Cash" />
        <KpiCard label="당월 입금" value={cashIn} caption="내부이체 제외 매출성 입금" tone="green" meta="In" />
        <KpiCard label="당월 출금" value={cashOut} caption="비용성 지출 기준" tone="amber" meta="Out" />
        <KpiCard label="검증 필요" value={`${reviewRows.length}건`} caption="카드/업로드 확인 대기 항목" tone="amber" meta="Review" />
      </section>

      <section className="mt-5 grid grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] gap-5 max-xl:grid-cols-1">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">사업부별 매출·지출</h2>
              <p className="mt-1 text-sm text-slate-500">매출, 비용성 지출, 순기여액을 같은 기준으로 비교합니다.</p>
            </div>
            <span className="badge badge-muted">월간 집계</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>사업부</th><th>매출</th><th>비용성 지출</th><th>순기여액</th><th>처리 기준</th></tr></thead>
              <tbody>
                {units.map((unit) => {
                  const revenue = revenueByBusinessUnit(transactions, unit);
                  const expense = expenseByBusinessUnit(transactions, unit);
                  return (
                    <tr key={unit}>
                      <td className="font-black text-slate-950">{unit}</td>
                      <td className="font-bold">{formatKRW(revenue)}</td>
                      <td>{formatKRW(expense)}</td>
                      <td className="font-black text-slate-950">{formatKRW(revenue - expense)}</td>
                      <td className="text-slate-500">{unit === "공통사용분" ? "광고사업부 제외, 전체 지출 포함" : "직접귀속 기준"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">검증대기</h2>
            <span className="badge badge-warning">{reviewRows.length}건</span>
          </div>
          <div className="grid gap-3">
            {reviewRows.map((row) => (
              <div key={row.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black text-slate-900">{row.vendor}</div>
                  <span className="badge badge-warning">{row.reviewStatus}</span>
                </div>
                <div className="mt-1 text-sm text-slate-500">{row.description}</div>
                <div className="mt-2 text-sm font-black">{formatKRW(row.amount)}</div>
              </div>
            ))}
            {reviewRows.length === 0 ? <div className="text-sm text-slate-500">대기 중인 항목이 없습니다.</div> : null}
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">통장별 잔액</h3>
            <span className="badge">4개</span>
          </div>
          <div className="grid gap-3">
            {bankAccounts.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
                <div>
                  <div className="font-black text-slate-900">{row.accountName}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.bankName} {row.maskedNo}</div>
                </div>
                <b className="text-right">{formatKRW(row.currentBalance)}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">자산 요약</h3>
            <span className="badge badge-good">{formatKRW(totalAssets)}</span>
          </div>
          <div className="grid gap-3">
            {assets.map((row) => (
              <div key={row.id} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
                <span className="font-bold text-slate-700">{row.category}</span>
                <b>{formatKRW(endingAmount(row))}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">부채·자본</h3>
            <span className="badge badge-muted">{formatKRW(equity)}</span>
          </div>
          <div className="grid gap-3">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm">
              <span className="font-bold text-slate-700">총부채</span>
              <b>{formatKRW(totalLiabilities)}</b>
            </div>
            {liabilities.map((row) => (
              <div key={row.id} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
                <span className="text-slate-600">{row.category}</span>
                <b>{formatKRW(endingAmount(row))}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
