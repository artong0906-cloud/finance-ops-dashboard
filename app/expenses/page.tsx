export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { formatKRW } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";

const talentLabels = ["인투1 집", "인투2 차", "인투3 밥", "인투4 몸", "인투5 성장", "인투6 환경"];

export default async function ExpensesPage() {
  const data = await getDashboardData();
  const expenseRows = data.transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer);

  return (
    <AppShell title="지출 분석" description="업로드된 5월 거래 기준으로 인재투자, 급여, 광고비, 운영비를 분석합니다." periodLabel={data.currentMonth || "2026-05"}>
      <section className="mb-6 grid grid-cols-6 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
        {talentLabels.map((label) => {
          const total = expenseRows.filter((row) => row.talentInvestmentType === label).reduce((sum, row) => sum + row.amount, 0);
          return (
            <div className="card" key={label}>
              <div className="eyebrow">{label}</div>
              <div className="mt-2 text-lg font-black">{formatKRW(total)}</div>
              <div className="mt-2 text-xs text-slate-500">{expenseRows.filter((row) => row.talentInvestmentType === label).length.toLocaleString("ko-KR")}건</div>
            </div>
          );
        })}
      </section>
      <section className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        2026년 5월은 사업부 세부 귀속 기준 확정 전까지 광고사업부 입금/출금으로 산정합니다. 분류 항목과 인재투자 유형은 유지합니다.
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
