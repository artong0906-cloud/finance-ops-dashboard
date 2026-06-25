export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { chartColors, RankBar, SummaryBox } from "@/components/shared/FinanceViz";
import { formatCompactKRW, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";

export default async function CardsPage() {
  const data = await getDashboardData();
  const { transactions } = data;
  const cardRows = transactions.filter((row) => row.source === "카드");
  const total = sumBy(cardRows, (row) => row.amount);
  const grouped = Array.from(
    cardRows.reduce((acc, row) => {
      const key = row.mainCategory || "미분류";
      const current = acc.get(key) || { label: key, amount: 0, count: 0 };
      current.amount += row.amount;
      current.count += 1;
      acc.set(key, current);
      return acc;
    }, new Map<string, { label: string; amount: number; count: number }>())
  ).map(([, value]) => value).sort((a, b) => b.amount - a.amount).slice(0, 6);
  const userGrouped = Array.from(
    cardRows.reduce((acc, row) => {
      const key = row.cardIssuer || row.cardBudgetGroup || "카드사 미지정";
      const current = acc.get(key) || { label: key, amount: 0, count: 0 };
      current.amount += row.amount;
      current.count += 1;
      acc.set(key, current);
      return acc;
    }, new Map<string, { label: string; amount: number; count: number }>())
  ).map(([, value]) => value).sort((a, b) => b.amount - a.amount).slice(0, 6);
  const reviewCount = cardRows.filter((row) => row.reviewStatus === "확인필요").length;

  return (
    <AppShell title="카드 사용내역" description="업로드된 5월 카드 로우데이터를 기준으로 사용액과 분류 결과를 확인합니다." periodLabel={data.currentMonth || "2026-05"} activePath="/cards">
      <section className="mb-5 grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        <SummaryBox caption="매입신용카드 원본 기준" label="카드 거래" value={`${cardRows.length.toLocaleString("ko-KR")}건`} />
        <SummaryBox caption="카드 사용 총액" label="카드 사용액" tone="stone" value={formatKRW(total)} />
        <SummaryBox caption="업로드 검증에서 확인" label="확인필요" value={`${reviewCount.toLocaleString("ko-KR")}건`} />
        <SummaryBox caption="5월 임시 귀속" label="집계 기준" tone="teal" value="광고사업부" />
      </section>

      <section className="mb-6 grid items-start grid-cols-2 gap-4 max-xl:grid-cols-1">
        <div className="card self-start">
          <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <h2 className="section-title">주요 분류별 사용액</h2>
              <p className="mt-1 text-sm text-slate-500">카드 거래의 대분류별 사용 규모와 건수를 표시합니다.</p>
            </div>
            <span className="badge badge-muted">총 {formatCompactKRW(total)}</span>
          </div>
          <div className="grid gap-2.5">
            {grouped.map((item, index) => (
              <RankBar
                amount={item.amount}
                color={chartColors[index % chartColors.length]}
                count={item.count}
                key={item.label}
                label={item.label}
                total={total}
              />
            ))}
          </div>
        </div>

        <div className="card min-w-0 overflow-hidden">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-950">카드사/사용자 상위</h3>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">카드사 또는 사용자 기준 상위 사용액입니다.</p>
            </div>
            <span className="badge badge-muted">{userGrouped.length.toLocaleString("ko-KR")}개</span>
          </div>
          <div className="grid gap-2">
            {userGrouped.map((item, index) => (
              <RankBar
                amount={item.amount}
                color={chartColors[index % chartColors.length]}
                count={item.count}
                key={item.label}
                label={item.label}
                total={total}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="card mb-6">
        <div className="flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <h2 className="section-title">운영 기준</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              2026년 5월은 세부 사업부 기준 확정 전까지 카드 사용분을 광고사업부 기준으로 산정합니다.
              6월 결산 기준을 받으면 사업부별 귀속 규칙을 다시 반영합니다.
            </p>
          </div>
          <span className="badge badge-muted">5월 임시 기준</span>
        </div>
      </section>
      <section className="card mb-6">
        <h2 className="section-title mb-4">카드 거래 상세</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>일자</th>
                <th>카드사/사용자</th>
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
    </AppShell>
  );
}
