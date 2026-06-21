export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";

export default async function BankPage() {
  const data = await getDashboardData();
  const { bankAccounts, transactions } = data;
  const bankRows = transactions.filter((row) => row.source === "은행");
  const accountNameById = new Map(bankAccounts.map((account) => [account.id, account.accountName]));
  const accountRows = bankAccounts.map((account) => {
    const rows = bankRows.filter((row) => row.accountId === account.id);
    const cashIn = sumBy(rows.filter((row) => row.cashFlowType === "입금" && !row.isInternalTransfer), (row) => row.amount);
    const cashOut = sumBy(rows.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer), (row) => row.amount);
    return { account, rows, cashIn, cashOut, net: cashIn - cashOut };
  });

  return (
    <AppShell title="통장 입출금" description="실제 업로드된 5월 은행 거래 기준으로 입금, 출금, 내부이체를 확인합니다." periodLabel={data.currentMonth || "2026-05"}>
      <section className="mb-6 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        {accountRows.map(({ account, rows, cashIn, cashOut, net }) => (
          <div className="card" key={account.id}>
            <div className="text-xs font-black text-slate-500">{account.businessUnit}</div>
            <div className="mt-2 font-black">{account.accountName}</div>
            <div className="metric-value mt-3">{formatKRW(net)}</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">
              {account.bankName} {account.maskedNo}<br />
              입금 {formatKRW(cashIn)} / 출금 {formatKRW(cashOut)} / {rows.length.toLocaleString("ko-KR")}건
            </div>
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
                  <td>{row.accountId ? accountNameById.get(row.accountId) || row.accountId : "-"}</td>
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
