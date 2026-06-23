export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { getDashboardData } from "@/services/dashboard/liveData";
import { ExpenseAnalysisClient } from "./ExpenseAnalysisClient";

type ExpensesPageProps = {
  searchParams?: Promise<{
    talent?: string | string[];
    cardUser?: string | string[];
  }>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = searchParams ? await searchParams : {};
  const activeTalent = Array.isArray(params.talent) ? params.talent[0] : params.talent;
  const activeCardUser = Array.isArray(params.cardUser) ? params.cardUser[0] : params.cardUser;
  const data = await getDashboardData();
  const expenseRows = data.transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer);

  return (
    <AppShell title="지출 분석" description="업로드된 5월 거래 기준으로 인재투자, 급여, 광고비, 운영비를 분석합니다." periodLabel={data.currentMonth || "2026-05"}>
      <ExpenseAnalysisClient activeCardUser={activeCardUser} activeFilter={activeTalent} expenseRows={expenseRows} />
    </AppShell>
  );
}
