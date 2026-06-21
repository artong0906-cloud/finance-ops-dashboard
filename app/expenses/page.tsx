export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { transactions } from "@/data/mock";
import { formatKRW } from "@/services/dashboard/calculations";

const expenseRows = transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer);

export default function ExpensesPage() {
  return (
    <AppShell title="지출 분석" description="인투1~6, 급여, 광고비, 세금, 운영비, 플랫폼 비용을 사업부별로 분석합니다.">
      <section className="grid grid-cols-6 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1 mb-6">
        {["인투1 집", "인투2 차", "인투3 밥", "인투4 돈", "인투5 성장", "인투6 환경"].map((label) => {
          const total = expenseRows.filter((row) => row.talentInvestmentType === label).reduce((sum, row) => sum + row.amount, 0);
          return <div className="card" key={label}><div className="eyebrow">{label}</div><div className="mt-2 text-lg font-black">{formatKRW(total)}</div><div className="text-xs text-slate-500 mt-2">상세 예정</div></div>;
        })}
      </section>
      <section className="card">
        <h2 className="section-title mb-4">지출 상세</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>일자</th><th>사업부</th><th>원천</th><th>대분류</th><th>중분류</th><th>세부항목</th><th>거래처</th><th>금액</th><th>비용/자산</th></tr></thead>
            <tbody>
              {expenseRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td><td>{row.businessUnit}</td><td>{row.source}</td><td>{row.mainCategory}</td><td>{row.subCategory}</td><td>{row.detailCategory}</td><td>{row.vendor}</td><td>{formatKRW(row.amount)}</td><td>{row.expenseBasis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
