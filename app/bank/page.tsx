export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { resolveMonthParam, type MonthSearchParams } from "@/lib/month-filter";
import { chartColors, inflowColor, outflowColor, RankBar, signedKRW, StackedBar, SummaryBox } from "@/components/shared/FinanceViz";
import { formatCompactKRW, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";

export default async function BankPage({
  searchParams
}: {
  searchParams?: Promise<MonthSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const selectedMonth = resolveMonthParam(params);
  const data = await getDashboardData(selectedMonth);
  const { bankAccounts, transactions } = data;
  const bankRows = transactions.filter((row) => row.source === "은행");
  const accountNameById = new Map(bankAccounts.map((account) => [account.id, account.accountName]));
  const accountRows = bankAccounts.map((account) => {
    const rows = bankRows.filter((row) => row.accountId === account.id);
    const cashIn = sumBy(rows.filter((row) => row.cashFlowType === "입금" && !row.isInternalTransfer), (row) => row.amount);
    const cashOut = sumBy(rows.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer), (row) => row.amount);
    return { account, rows, cashIn, cashOut, net: cashIn - cashOut, balance: account.currentBalance };
  });
  const totalBalance = sumBy(accountRows, (row) => row.balance);
  const cashInTotal = sumBy(accountRows, (row) => row.cashIn);
  const cashOutTotal = sumBy(accountRows, (row) => row.cashOut);
  const netCashFlow = cashInTotal - cashOutTotal;
  const openingBalanceTotal = totalBalance - netCashFlow;
  const accountSegments = accountRows
    .filter(({ balance }) => balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map(({ account, balance }, index) => ({
      label: `${account.bankName} ${account.accountName}`,
      amount: balance,
      color: chartColors[index % chartColors.length],
      caption: account.businessUnit
    }));
  const flowSegments = [
    { label: "입금", amount: cashInTotal, color: inflowColor },
    { label: "출금", amount: cashOutTotal, color: outflowColor }
  ].filter((segment) => segment.amount > 0);

  return (
    <AppShell title="통장 입출금" description="선택한 월의 은행 거래 기준으로 입금, 출금, 내부이체를 확인합니다." periodLabel={data.currentMonth || "2026-05"} availableMonths={data.availableMonths} activePath="/bank">
      <section className="mb-5 grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        <SummaryBox caption="월말 - 순현금흐름" label="월초잔액" tone="stone" value={formatKRW(openingBalanceTotal)} />
        <SummaryBox caption={`${bankRows.filter((row) => row.cashFlowType === "입금").length.toLocaleString("ko-KR")}건`} label="월 입금" value={formatKRW(cashInTotal)} />
        <SummaryBox caption={`${bankRows.filter((row) => row.cashFlowType === "출금").length.toLocaleString("ko-KR")}건`} label="월 출금" tone="stone" value={formatKRW(cashOutTotal)} />
        <SummaryBox caption="입금 - 출금" label="순현금흐름" value={formatKRW(netCashFlow)} />
        <SummaryBox caption={`월초 대비 ${signedKRW(netCashFlow)}`} label="월말잔액" tone="teal" value={formatKRW(totalBalance)} />
      </section>

      <section className="mb-6 grid items-start grid-cols-2 gap-4 max-xl:grid-cols-1">
        <div className="card self-start">
          <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <h2 className="section-title">계좌별 현금 잔고</h2>
              <p className="mt-1 text-sm text-slate-500">현금성자산과 동일한 계좌 잔액 기준으로 보유 비중을 표시합니다.</p>
            </div>
            <span className="badge badge-muted">총 잔고 {formatCompactKRW(totalBalance)}</span>
          </div>
          <div className="grid gap-2.5">
            {accountSegments.map((segment) => (
              <RankBar
                amount={segment.amount}
                color={segment.color}
                count={accountRows.find(({ account }) => `${account.bankName} ${account.accountName}` === segment.label)?.rows.length}
                key={segment.label}
                label={segment.label}
                total={totalBalance}
              />
            ))}
          </div>
        </div>

        <div className="card min-w-0 overflow-hidden">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-950">입출금 흐름</h3>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">은행 거래 기준 월 입금과 출금 규모입니다.</p>
            </div>
            <span className="badge badge-muted">{bankRows.length.toLocaleString("ko-KR")}건</span>
          </div>
          <StackedBar segments={flowSegments} />
        </div>
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
