export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { bankAccounts, transactions } from "@/data/mock";
import { formatKRW } from "@/services/dashboard/calculations";

export default function BankPage() {
  const bankRows = transactions.filter((row) => row.source === "은행");
  return (
    <AppShell title="통장 입출금" description="사업부별 운영통장을 기준으로 입금, 출금, 내부이체를 확인합니다.">
      <section className="mb-6 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        {bankAccounts.map((account) => (
          <div className="card" key={account.id}>
            <div className="text-xs font-black text-slate-500">{account.businessUnit}</div>
            <div className="mt-2 font-black">{account.accountName}</div>
            <div className="metric-value mt-3">{formatKRW(account.currentBalance)}</div>
            <div className="mt-2 text-xs text-slate-500">{account.bankName} {account.maskedNo}</div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="section-title mb-4">은행 거래 상세</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>일자</th>
                <th>통장</th>
                <th>사업부</th>
                <th>구분</th>
                <th>거래처</th>
                <th>적요</th>
                <th className="text-right">금액</th>
                <th>반영</th>
              </tr>
            </thead>
            <tbody>
              {bankRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.accountName}</td>
                  <td>{row.businessUnit}</td>
                  <td><span className={row.isInternalTransfer ? "badge badge-warning" : "badge"}>{row.cashFlowType}</span></td>
                  <td>{row.vendor}</td>
                  <td>{row.description}</td>
                  <td className="text-right font-black">{formatKRW(row.amount)}</td>
                  <td>{row.isInternalTransfer ? "현금 흐름만 반영, 매출/지출 제외" : "매출/지출 반영"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
