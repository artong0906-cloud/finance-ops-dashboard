export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";

export default async function CardsPage() {
  const data = await getDashboardData();
  const { transactions } = data;
  const cardRows = transactions.filter((row) => row.source === "카드");
  const total = sumBy(cardRows, (row) => row.amount);
  const grouped = Array.from(
    cardRows.reduce((acc, row) => {
      const key = row.mainCategory || "미분류";
      acc.set(key, (acc.get(key) || 0) + row.amount);
      return acc;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <AppShell title="카드 사용내역" description="업로드된 5월 카드 로우데이터를 기준으로 사용액과 분류 결과를 확인합니다." periodLabel={data.currentMonth || "2026-05"}>
      <section className="mb-6 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        <div className="card">
          <div className="eyebrow">카드 거래</div>
          <div className="metric-value mt-3">{cardRows.length.toLocaleString("ko-KR")}건</div>
        </div>
        <div className="card">
          <div className="eyebrow">카드 사용액</div>
          <div className="metric-value mt-3">{formatKRW(total)}</div>
        </div>
        <div className="card">
          <div className="eyebrow">확인필요</div>
          <div className="metric-value mt-3">{cardRows.filter((row) => row.reviewStatus === "확인필요").length.toLocaleString("ko-KR")}건</div>
        </div>
        <div className="card">
          <div className="eyebrow">5월 집계 기준</div>
          <div className="metric-value mt-3">광고사업부</div>
        </div>
      </section>
      <section className="card mb-6">
        <h2 className="section-title mb-4">주요 분류별 사용액</h2>
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          {grouped.map(([category, amount]) => (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={category}>
              <div className="text-xs font-black text-slate-500">{category}</div>
              <div className="mt-2 text-lg font-black">{formatKRW(amount)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="card mb-6">
        <h2 className="section-title mb-4">카드 거래 상세</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>일자</th>
                <th>예산그룹</th>
                <th>최종 사업부</th>
                <th>공통</th>
                <th>거래처</th>
                <th>적요</th>
                <th className="text-right">금액</th>
                <th>분개상태</th>
              </tr>
            </thead>
            <tbody>
              {cardRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.cardBudgetGroup || "-"}</td>
                  <td>{row.journalBusinessUnit || row.businessUnit}</td>
                  <td>{row.isCommonUse ? <span className="badge badge-warning">공통사용분</span> : <span className="badge badge-good">직접귀속</span>}</td>
                  <td>{row.vendor}</td>
                  <td>{row.description}</td>
                  <td className="text-right font-black">{formatKRW(row.amount)}</td>
                  <td>{row.journalStatus || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2 className="section-title mb-3">운영 기준</h2>
        <p className="text-sm leading-7 text-slate-600">
          2026년 5월은 세부 사업부 기준 확정 전까지 입금과 출금을 광고사업부 기준으로 산정합니다.
          6월 결산 기준을 받으면 사업부별 귀속 규칙을 다시 반영합니다.
        </p>
      </section>
    </AppShell>
  );
}
