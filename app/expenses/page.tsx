export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { transactions } from "@/data/mock";
import { formatKRW } from "@/services/dashboard/calculations";

const expenseRows = transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer);
const talentLabels = ["투자1 집", "투자2 차", "투자3 밥", "투자4 몸", "투자5 성장", "투자6 환경"];

export default function ExpensesPage() {
  return (
    <AppShell title="지출 분석" description="인재투자, 급여, 광고비, 운영비를 사업부별로 분석합니다.">
      <section className="mb-6 grid grid-cols-6 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
        {talentLabels.map((label) => {
          const total = expenseRows.filter((row) => row.talentInvestmentType === label).reduce((sum, row) => sum + row.amount, 0);
          return (
            <div className="card" key={label}>
              <div className="eyebrow">{label}</div>
              <div className="mt-2 text-lg font-black">{formatKRW(total)}</div>
              <div className="mt-2 text-xs text-slate-500">상세 연결 예정</div>
            </div>
          );
        })}
      </section>
      <section className="card">
        <h2 className="section-title mb-4">지출 상세</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>일자</th>
                <th>사업부</th>
                <th>원천</th>
                <th>대분류</th>
                <th>중분류</th>
                <th>세부항목</th>
                <th>거래처</th>
                <th className="text-right">금액</th>
                <th>비용/자산</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.businessUnit}</td>
                  <td>{row.source}</td>
                  <td>{row.mainCategory}</td>
                  <td>{row.subCategory}</td>
                  <td>{row.detailCategory}</td>
                  <td>{row.vendor}</td>
                  <td className="text-right font-black">{formatKRW(row.amount)}</td>
                  <td>{row.expenseBasis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
