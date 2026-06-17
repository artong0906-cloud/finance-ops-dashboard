import { AppShell } from "@/components/layout/AppShell";
import { transactions } from "@/data/mock";
import { formatKRW } from "@/services/dashboard/calculations";

export default function CardsPage() {
  const cardRows = transactions.filter((row) => row.source === "카드");
  return (
    <AppShell title="카드 사용내역" description="법인카드는 파로스 분개 사업부를 최종 귀속 기준으로 관리합니다.">
      <section className="card mb-6">
        <h2 className="text-xl font-black tracking-[-0.04em] mb-4">카드 거래 상세</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>일자</th><th>예산그룹</th><th>기본/최종 사업부</th><th>공통</th><th>거래처</th><th>적요</th><th>금액</th><th>분개상태</th></tr></thead>
            <tbody>
              {cardRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.cardBudgetGroup}</td>
                  <td>{row.businessUnit}</td>
                  <td>{row.isCommonUse ? <span className="badge badge-warning">공통사용분</span> : <span className="badge badge-good">직접귀속</span>}</td>
                  <td>{row.vendor}</td>
                  <td>{row.description}</td>
                  <td>{formatKRW(row.amount)}</td>
                  <td>{row.journalStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2 className="text-xl font-black tracking-[-0.04em] mb-3">운영 기준</h2>
        <p className="text-sm leading-7 text-slate-600">공통사용분은 광고사업부 비용에서 제외하고 별도 표기합니다. 전체 회사 지출에는 포함하되, 사업부별 순기여액 계산에서는 공통사용분 라인으로 분리합니다.</p>
      </section>
    </AppShell>
  );
}
