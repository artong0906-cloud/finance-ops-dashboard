export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { balanceMovements } from "@/data/mock";
import { endingAmount, formatKRW, sumBy } from "@/services/dashboard/calculations";

export default function BalancePage() {
  const assets = balanceMovements.filter((row) => row.statementType === "자산");
  const liabilities = balanceMovements.filter((row) => row.statementType === "부채");
  const totalAssets = sumBy(assets, endingAmount);
  const totalLiabilities = sumBy(liabilities, endingAmount);
  const equity = totalAssets - totalLiabilities;
  return (
    <AppShell title="자산·자본·부채 현황" description="기초값을 입력하고 당월 증가/감소만 반영하여 기말잔액과 자본을 계산합니다.">
      <section className="grid grid-cols-3 gap-4 max-md:grid-cols-1 mb-6">
        <div className="card"><div className="eyebrow">총자산</div><div className="metric-value mt-3">{formatKRW(totalAssets)}</div></div>
        <div className="card"><div className="eyebrow">총부채</div><div className="metric-value mt-3">{formatKRW(totalLiabilities)}</div></div>
        <div className="card"><div className="eyebrow">자본</div><div className="metric-value mt-3">{formatKRW(equity)}</div><div className="text-xs text-slate-500 mt-2">총자산 - 총부채</div></div>
      </section>
      <section className="card mb-6">
        <h2 className="section-title mb-4">증감 입력표</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>구분</th><th>항목</th><th>기초</th><th>증가</th><th>감소</th><th>기말</th><th>메모</th></tr></thead>
            <tbody>
              {balanceMovements.map((row) => (
                <tr key={row.id}>
                  <td><span className={row.statementType === "자산" ? "badge badge-good" : "badge badge-warning"}>{row.statementType}</span></td>
                  <td className="font-black">{row.category}</td>
                  <td>{formatKRW(row.openingAmount)}</td>
                  <td>{formatKRW(row.increaseAmount)}</td>
                  <td>{formatKRW(row.decreaseAmount)}</td>
                  <td className="font-black">{formatKRW(endingAmount(row))}</td>
                  <td>{row.memo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
