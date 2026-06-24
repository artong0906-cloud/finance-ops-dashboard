export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, Landmark, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { endingAmount, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { BalanceMovement, Transaction } from "@/types/finance";

const expenseCategoryOrder = ["인재투자", "환불", "급여", "광고비", "세금", "운영비", "기타"] as const;

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.min(100, Math.max(0, (part / total) * 100)).toFixed(0)}%`;
}

function signedKRW(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatKRW(value)}`;
}

function amountTone(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-orange-700";
  return "text-slate-700";
}

function compact(value: string | undefined) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(compact(keyword)));
}

function rowText(row: Transaction) {
  return compact([
    row.source,
    row.businessUnit,
    row.accountId,
    row.cardBudgetGroup,
    row.cardIssuer,
    row.vendor,
    row.description,
    row.mainCategory,
    row.subCategory,
    row.detailCategory,
    row.talentInvestmentType,
    row.memo
  ].filter(Boolean).join(" "));
}

function balanceText(row: BalanceMovement) {
  return compact([row.category, row.memo].filter(Boolean).join(" "));
}

function balanceChange(row: BalanceMovement) {
  return row.increaseAmount - row.decreaseAmount;
}

function isCashBalance(row: BalanceMovement) {
  const text = balanceText(row);
  return row.statementType === "자산" && includesAny(text, ["현금", "예금", "통장", "증권", "현금성", "선급금", "공제부금"]);
}

function isBankLoan(row: BalanceMovement) {
  const text = balanceText(row);
  return row.statementType === "부채" && includesAny(text, ["은행", "대출", "중진공", "기.보", "기보", "증신공", "클린보증"]);
}

function hasTalentMarker(row: Transaction) {
  return includesAny(rowText(row), ["인투1", "인투2", "인투3", "인투4", "인투5", "인투6", "인재투자"]);
}

function expenseCategory(row: Transaction): (typeof expenseCategoryOrder)[number] {
  const text = rowText(row);
  const isBankWithdrawal = row.source === "은행";

  if (isBankWithdrawal && includesAny(text, ["환불", "매출취소", "결제취소", "용역수수료지급"])) return "환불";
  if (includesAny(text, ["프리급여", "급여", "학자금상환", "4대보험", "지방세", "사업소득세", "근로소득세", "원천세", "고용보험", "건강보험", "국민연금"])) return "급여";
  if (isBankWithdrawal && includesAny(text, ["메조미디어", "메조", "롯데카드", "제이와이네트워크", "위픽코퍼레이션", "바나나몽키", "광고비", "광고선전비", "매체비"])) return "광고비";
  if (hasTalentMarker(row)) return "인재투자";
  if (includesAny(text, ["부가세", "부가가치세", "과태료", "과테료", "면허세", "주민세", "법인세", "세금과공과"])) return "세금";
  if (includesAny(text, ["이자", "대출이자", "대외협력", "공통사용분", "공통운영비", "운영비", "지급수수료", "관리비", "임차료"])) return "운영비";
  return "기타";
}

function MetricCard({
  label,
  value,
  caption,
  tone = "slate"
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "slate" | "green" | "blue" | "amber" | "rose";
}) {
  const toneClass = {
    slate: "border-slate-200 bg-white",
    green: "border-emerald-200 bg-emerald-50",
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50"
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-xs font-black text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</div>
      {caption ? <div className="mt-2 text-xs leading-5 text-slate-500">{caption}</div> : null}
    </div>
  );
}

function FinancialCard({
  label,
  value,
  change,
  tone = "slate"
}: {
  label: string;
  value: number;
  change: number;
  tone?: "slate" | "blue" | "amber";
}) {
  const isPositive = change >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <div className={`rounded-lg border p-4 ${tone === "blue" ? "border-blue-200 bg-blue-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black text-slate-500">{label}</div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>
          <Icon size={12} />
          전월비 {signedKRW(change)}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{formatKRW(value)}</div>
    </div>
  );
}

function ProgressRow({
  label,
  amount,
  total,
  color
}: {
  label: string;
  amount: number;
  total: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-black text-slate-700">{label}</span>
        <span className="shrink-0 font-black text-slate-950">{formatKRW(amount)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: percent(amount, total) }} />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { transactions, balanceMovements, bankAccounts } = data;

  const currentMonth = data.currentMonth || "2026-05";
  const assets = balanceMovements.filter((row) => row.statementType === "자산");
  const liabilities = balanceMovements.filter((row) => row.statementType === "부채");
  const totalAssets = sumBy(assets, endingAmount);
  const totalLiabilities = sumBy(liabilities, endingAmount);
  const equity = totalAssets - totalLiabilities;
  const assetChange = sumBy(assets, balanceChange);
  const liabilityChange = sumBy(liabilities, balanceChange);
  const equityChange = assetChange - liabilityChange;

  const cashBalanceRows = assets.filter(isCashBalance);
  const cashRows = cashBalanceRows.length > 0
    ? cashBalanceRows.map((row) => ({ id: row.id, name: row.category, amount: endingAmount(row), caption: row.memo || "현금성자산" }))
    : bankAccounts.map((account) => ({ id: account.id, name: `${account.bankName} ${account.accountName}`, amount: account.currentBalance, caption: account.businessUnit }));
  const cashBalanceTotal = sumBy(cashRows, (row) => row.amount);

  const loanRows = liabilities.filter(isBankLoan).map((row) => ({
    id: row.id,
    name: row.category,
    amount: endingAmount(row),
    change: balanceChange(row)
  }));
  const loanTotal = sumBy(loanRows, (row) => row.amount);

  const operatingRows = transactions.filter((row) => !row.isInternalTransfer);
  const cashIn = sumBy(operatingRows.filter((row) => row.cashFlowType === "입금"), (row) => row.amount);
  const cashOut = sumBy(operatingRows.filter((row) => row.cashFlowType === "출금"), (row) => row.amount);
  const netCashFlow = cashIn - cashOut;
  const bankRows = operatingRows.filter((row) => row.source === "은행");
  const cardRows = operatingRows.filter((row) => row.source === "카드");

  const expenseRows = operatingRows.filter((row) => row.cashFlowType === "출금");
  const totalExpense = sumBy(expenseRows, (row) => row.amount);
  const expenseCategoryRows = expenseCategoryOrder
    .map((category) => {
      const rows = expenseRows.filter((row) => expenseCategory(row) === category);
      return { category, amount: sumBy(rows, (row) => row.amount), count: rows.length };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <AppShell
      title="경영현황"
      description="검증/업로드 정보는 업로드 검증에서 보고, 이 화면에서는 경영 핵심지표만 확인합니다."
      periodLabel={currentMonth}
      activePath="/dashboard"
    >
      <main className="grid gap-5">
        <section className="grid grid-cols-[minmax(0,1fr)_minmax(360px,.85fr)] gap-5 max-xl:grid-cols-1">
          <div className="card">
            <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <h2 className="section-title">통장현금 잔고</h2>
                <p className="mt-1 text-sm text-slate-500">5월말 기준 현금성 자산 잔액입니다.</p>
              </div>
              <div className="text-right max-md:text-left">
                <div className="eyebrow">총 잔고</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{formatKRW(cashBalanceTotal)}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
              {cashRows.map((row) => (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={row.id}>
                  <div className="truncate text-sm font-black text-slate-700">{row.name}</div>
                  <div className="mt-2 text-lg font-black text-slate-950">{formatKRW(row.amount)}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.caption}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">대출현황</h2>
                <p className="mt-1 text-sm text-slate-500">은행대출 부채 기준입니다.</p>
              </div>
              <Landmark size={20} className="text-slate-400" />
            </div>
            <MetricCard label="대출 잔액 합계" value={formatKRW(loanTotal)} caption={`${loanRows.length.toLocaleString("ko-KR")}개 대출 항목`} tone="amber" />
            <div className="mt-4 grid gap-2">
              {loanRows.map((row) => (
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-b-0 last:pb-0" key={row.id}>
                  <span className="truncate font-bold text-slate-700">{row.name}</span>
                  <span className="shrink-0 font-black text-slate-950">{formatKRW(row.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">월간 자금 흐름</h2>
              <p className="mt-1 text-sm text-slate-500">입금, 출금, 순현금흐름을 한 줄로 확인합니다.</p>
            </div>
            <Link href="/bank" className="btn btn-soft">통장 상세 <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            <MetricCard label="입금 합계" value={formatKRW(cashIn)} caption={`${bankRows.filter((row) => row.cashFlowType === "입금").length.toLocaleString("ko-KR")}건`} tone="green" />
            <MetricCard label="출금 합계" value={formatKRW(cashOut)} caption={`은행 ${bankRows.filter((row) => row.cashFlowType === "출금").length.toLocaleString("ko-KR")}건 / 카드 ${cardRows.length.toLocaleString("ko-KR")}건`} tone="amber" />
            <MetricCard label="순현금흐름" value={formatKRW(netCashFlow)} caption={signedKRW(netCashFlow)} tone={netCashFlow >= 0 ? "green" : "rose"} />
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">자산 · 부채 · 자본</h2>
              <p className="mt-1 text-sm text-slate-500">기말 잔액과 전월비 증감액을 함께 표시합니다.</p>
            </div>
            <WalletCards size={20} className="text-slate-400" />
          </div>
          <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
            <FinancialCard label="총자산" value={totalAssets} change={assetChange} />
            <FinancialCard label="총부채" value={totalLiabilities} change={liabilityChange} tone="amber" />
            <FinancialCard label="자본" value={equity} change={equityChange} tone="blue" />
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <h2 className="section-title">주요 지출분류</h2>
              <p className="mt-1 text-sm text-slate-500">지출 분석 기준 대카테고리별 규모입니다.</p>
            </div>
            <Link href="/expenses" className="btn btn-soft">지출 분석 <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-5 max-xl:grid-cols-1">
            <div className="grid gap-4">
              {expenseCategoryRows.map((row, index) => (
                <ProgressRow
                  amount={row.amount}
                  color={index === 0 ? "bg-blue-600" : index === 1 ? "bg-cyan-500" : index === 2 ? "bg-indigo-500" : "bg-slate-400"}
                  key={row.category}
                  label={`${row.category} · ${row.count.toLocaleString("ko-KR")}건`}
                  total={totalExpense || 1}
                />
              ))}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="eyebrow">총 지출</div>
              <div className="mt-2 text-2xl font-black text-slate-950">{formatKRW(totalExpense)}</div>
              <div className="mt-3 text-sm leading-6 text-slate-500">
                가장 큰 지출은 {expenseCategoryRows[0]?.category || "-"}이며 전체의 {percent(expenseCategoryRows[0]?.amount || 0, totalExpense)}입니다.
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
