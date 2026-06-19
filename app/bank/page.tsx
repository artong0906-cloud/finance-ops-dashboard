export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { bankAccounts, transactions } from "@/data/mock";
import { formatKRW } from "@/services/dashboard/calculations";

export default function BankPage() {
  const bankRows = transactions.filter((row) => row.source === "은행");
  return (
    <AppShell title="은행 입출금" description="사업부별 통장 기준으로 입금, 출금, 내부이체를 모두 확인합니다.">
      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1 mb-6">
        {bankAccounts.map((account) => (
          <div className="card" key={account.id}>
            <div className="text-xs font-black text-slate-500">{account.businessUnit}</div>
            <div className="font-black mt-2">{account.accountName}</div>
            <div className="metric-value mt-3">{formatKRW(account.currentBalance)}</div>
            <div className="text-xs text-slate-500 mt-2">{account.bankName} {account.maskedNo}</div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="section-title mb-4">은행 거래 상세</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>일자</th><th>통장</th><th>사업부</th><th>구분</th><th>거래처</th><th>적요</th><th>금액</th><th>반영</th></tr></thead>
            <tbody>
              {bankRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.accountName}</td>
                  <td>{row.businessUnit}</td>
                  <td><span className={row.isInternalTransfer ? "badge badge-warning" : "badge"}>{row.cashFlowType}</span></td>
                  <td>{row.vendor}</td>
                  <td>{row.description}</td>
                  <td>{formatKRW(row.amount)}</td>
                  <td>{row.isInternalTransfer ? "현금흐름만 반영, 매출/지출 제외" : "매출/지출 반영"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
