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

  return (
    <AppShell title="메인 경영현황판" description="통장잔고, 자산, 부채, 자본과 사업부별 매출/지출을 한 화면에서 봅니다.">
      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1 mb-6">
        <KpiCard label="통장잔고" value={totalBank} caption="클릭 시 통장별 잔액 드릴다운 예정" />
        <KpiCard label="자산" value={totalAssets} caption="기초 + 증가 - 감소" />
        <KpiCard label="부채" value={totalLiabilities} caption="차량부채, 은행대출, 기타부채" />
        <KpiCard label="자본" value={equity} caption="총자산 - 총부채" />
      </section>

      <section className="card mb-6">
        <h2 className="text-xl font-black tracking-[-0.04em] mb-4">사업부별 매출·지출</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>사업부</th><th>매출</th><th>비용성 지출</th><th>순기여액</th><th>처리 기준</th></tr></thead>
            <tbody>
              {units.map((unit) => {
                const revenue = revenueByBusinessUnit(transactions, unit);
                const expense = expenseByBusinessUnit(transactions, unit);
                return (
                  <tr key={unit}>
                    <td className="font-black">{unit}</td>
                    <td>{formatKRW(revenue)}</td>
                    <td>{formatKRW(expense)}</td>
                    <td className="font-black">{formatKRW(revenue - expense)}</td>
                    <td>{unit === "공통사용분" ? "광고사업부 제외, 전체 지출에는 포함" : "직접귀속 기준"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <div className="card">
          <h3 className="font-black mb-3">통장별 잔액</h3>
          <div className="grid gap-2">
            {bankAccounts.map((row) => <div key={row.id} className="flex justify-between gap-3 text-sm"><span>{row.accountName}</span><b>{formatKRW(row.currentBalance)}</b></div>)}
          </div>
        </div>
        <div className="card">
          <h3 className="font-black mb-3">자산 요약</h3>
          <div className="grid gap-2">
            {assets.map((row) => <div key={row.id} className="flex justify-between gap-3 text-sm"><span>{row.category}</span><b>{formatKRW(endingAmount(row))}</b></div>)}
          </div>
        </div>
        <div className="card">
          <h3 className="font-black mb-3">부채 요약</h3>
          <div className="grid gap-2">
            {liabilities.map((row) => <div key={row.id} className="flex justify-between gap-3 text-sm"><span>{row.category}</span><b>{formatKRW(endingAmount(row))}</b></div>)}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
