export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { resolveMonthParam, type MonthSearchParams } from "@/lib/month-filter";
import { getDashboardData } from "@/services/dashboard/liveData";
import { ExpenseAnalysisClient } from "./ExpenseAnalysisClient";

type ExpensesPageProps = {
  searchParams?: Promise<MonthSearchParams & {
    category?: string | string[];
    talent?: string | string[];
    operating?: string | string[];
    cardUser?: string | string[];
  }>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = searchParams ? await searchParams : {};
  const activeCategory = Array.isArray(params.category) ? params.category[0] : params.category;
  const activeTalent = Array.isArray(params.talent) ? params.talent[0] : params.talent;
  const activeOperating = Array.isArray(params.operating) ? params.operating[0] : params.operating;
  const activeCardUser = Array.isArray(params.cardUser) ? params.cardUser[0] : params.cardUser;
  const selectedMonth = resolveMonthParam(params);
  const data = await getDashboardData(selectedMonth);
  const currentMonth = data.currentMonth || "2026-05";
  const expenseRows = data.transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer);

  return (
    <AppShell title="지출 분석" description="선택한 월의 거래 기준으로 인재투자, 환불, 급여, 광고비, 세금, 운영비, 기타 지출을 분석합니다." periodLabel={currentMonth} availableMonths={data.availableMonths} activePath="/expenses">
      <ExpenseAnalysisClient activeCardUser={activeCardUser} activeCategory={activeCategory} activeMonth={currentMonth} activeOperating={activeOperating} activeTalent={activeTalent} expenseRows={expenseRows} />
    </AppShell>
  );
}
