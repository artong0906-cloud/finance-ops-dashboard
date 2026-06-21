export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileSpreadsheet,
  Landmark,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { endingAmount, formatCompactKRW, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { Transaction } from "@/types/finance";

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.min(100, Math.max(0, (part / total) * 100)).toFixed(0)}%`;
}

function signedKRW(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatKRW(value)}`;
}

function isReviewNeeded(row: Transaction) {
  return row.reviewStatus === "확인필요" || row.journalStatus === "미분개" || row.businessUnit.includes("미배");
}

function isNormal(row: Transaction) {
  return row.reviewStatus === "정상" || row.reviewStatus === "확정";
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

function previewRawData(rawData: Record<string, unknown>) {
  return Object.entries(rawData)
    .filter(([, value]) => String(value ?? "").trim())
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" / ");
}

function amountTone(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-orange-700";
  return "text-slate-700";
}

function MiniStat({
  label,
  value,
  caption,
  tone = "slate"
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "slate" | "blue" | "green" | "amber" | "rose";
}) {
  const toneClass = {
    slate: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50"
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-xs font-black text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-black tracking-tight text-slate-950">{value}</div>
      {caption ? <div className="mt-1 text-xs leading-5 text-slate-500">{caption}</div> : null}
    </div>
  );
}

function StatusLine({
  icon,
  label,
  value,
  caption,
  tone = "slate"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption?: string;
  tone?: "slate" | "green" | "amber" | "rose" | "blue";
}) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-blue-50 text-blue-700"
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-950">{label}</div>
          {caption ? <div className="mt-0.5 truncate text-xs text-slate-500">{caption}</div> : null}
        </div>
      </div>
      <b className="shrink-0 text-sm text-slate-950">{value}</b>
    </div>
  );
}

function ProgressRow({
  label,
  amount,
  total,
  color = "bg-blue-600"
}: {
  label: string;
  amount: number;
  total: number;
  color?: string;
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
  const { transactions, balanceMovements, uploadBatches, rawRows, rawRowCount } = data;

  const currentMonth = data.currentMonth || "2026-05";
  const monthLabel = currentMonth.replace("-", ".");
  const assets = balanceMovements.filter((row) => row.statementType === "자산");
  const liabilities = balanceMovements.filter((row) => row.statementType === "부채");
  const totalAssets = sumBy(assets, endingAmount);
  const totalLiabilities = sumBy(liabilities, endingAmount);
  const equity = totalAssets - totalLiabilities;

  const cashIn = sumBy(transactions.filter((row) => row.cashFlowType === "입금" && !row.isInternalTransfer), (row) => row.amount);
  const cashOut = sumBy(transactions.filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer), (row) => row.amount);
  const netCashFlow = cashIn - cashOut;
  const assetSpending = sumBy(transactions.filter((row) => row.cashFlowType === "출금" && row.expenseBasis === "자산" && !row.isInternalTransfer), (row) => row.amount);
  const reviewRows = transactions.filter(isReviewNeeded);
  const normalRows = transactions.filter(isNormal);
  const recentRows = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const latestUpload = uploadBatches[0];

  const sourceRows = ["은행", "카드"].map((source) => {
    const rows = transactions.filter((row) => row.source === source && !row.isInternalTransfer);
    return {
      source,
      count: rows.length,
      cashIn: sumBy(rows.filter((row) => row.cashFlowType === "입금"), (row) => row.amount),
      cashOut: sumBy(rows.filter((row) => row.cashFlowType === "출금"), (row) => row.amount)
    };
  });

  const expenseCategoryRows = Array.from(
    transactions
      .filter((row) => row.cashFlowType === "출금" && !row.isInternalTransfer)
      .reduce((acc, row) => {
        const key = row.mainCategory || "미분류";
        acc.set(key, (acc.get(key) || 0) + row.amount);
        return acc;
      }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const pipelineSteps = [
    {
      label: "원본 데이터",
      value: `${rawRowCount.toLocaleString("ko-KR")}행`,
      caption: `${uploadBatches.length.toLocaleString("ko-KR")}개 업로드 배치`,
      tone: "blue" as const
    },
    {
      label: "거래 변환",
      value: `${transactions.length.toLocaleString("ko-KR")}건`,
      caption: `정상 ${normalRows.length.toLocaleString("ko-KR")}건`,
      tone: "green" as const
    },
    {
      label: "검증 대기",
      value: `${reviewRows.length.toLocaleString("ko-KR")}건`,
      caption: reviewRows.length === 0 ? "확인 필요 없음" : "분류 규칙 확인",
      tone: reviewRows.length === 0 ? "green" as const : "amber" as const
    },
    {
      label: "5월 집계 기준",
      value: "광고사업부",
      caption: "6월 결산 시 기준 재분리",
      tone: "amber" as const
    }
  ];

  return (
    <AppShell
      title="대시보드"
      description="고객DB가 아니라 5월 경영지원 로우데이터 기준으로 자금 흐름, 비용, 자산·부채를 한 화면에서 봅니다."
      periodLabel={currentMonth}
      activePath="/dashboard"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-2xl:grid-cols-1">
        <main className="grid min-w-0 gap-5">
          <section className="card overflow-hidden border-blue-100 bg-gradient-to-b from-white to-blue-50/30 p-0">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 max-md:flex-col">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <Landmark size={19} />
                </span>
                <div>
                  <h2 className="text-base font-black text-slate-950">당월 경영지원 패널</h2>
                  <p className="mt-1 text-sm text-slate-500">업로드 → 거래 변환 → 검증 → 5월 임시 집계 기준</p>
                </div>
              </div>
              <span className="badge badge-good">이상 없음 · {reviewRows.length.toLocaleString("ko-KR")}건</span>
            </div>
            <div className="grid grid-cols-4 gap-4 p-5 max-xl:grid-cols-2 max-md:grid-cols-1">
              {pipelineSteps.map((step, index) => (
                <div key={step.label} className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  {index < pipelineSteps.length - 1 ? (
                    <span className="absolute -right-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-xs font-black text-blue-700 max-xl:hidden">
                      →
                    </span>
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-500">{step.label}</span>
                    <span className={`badge ${step.tone === "green" ? "badge-good" : step.tone === "amber" ? "badge-warning" : "badge-muted"}`}>
                      {index + 1}
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{step.value}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">{step.caption}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            <MiniStat label="입금 합계" value={formatCompactKRW(cashIn)} caption={formatKRW(cashIn)} tone="green" />
            <MiniStat label="출금 합계" value={formatCompactKRW(cashOut)} caption={formatKRW(cashOut)} tone="amber" />
            <MiniStat label="순현금흐름" value={formatCompactKRW(netCashFlow)} caption={signedKRW(netCashFlow)} tone={netCashFlow >= 0 ? "green" : "amber"} />
            <MiniStat label="자산성 지출" value={formatCompactKRW(assetSpending)} caption="출금 중 자산 취득 반영액" tone="blue" />
          </section>

          <section className="grid grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)] gap-5 max-xl:grid-cols-1">
            <div className="card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">월간 자금 흐름</h2>
                  <p className="mt-1 text-sm text-slate-500">5월은 전체 입금·출금을 광고사업부 기준으로 산정합니다.</p>
                </div>
                <Link href="/bank" className="btn btn-soft">통장 상세 <ArrowRight size={14} /></Link>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>구분</th>
                      <th className="text-right">입금</th>
                      <th className="text-right">출금</th>
                      <th className="text-right">순현금흐름</th>
                      <th className="text-right">거래</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-black text-slate-950">광고사업부</td>
                      <td className="text-right font-black text-emerald-700">{formatKRW(cashIn)}</td>
                      <td className="text-right font-black text-orange-700">{formatKRW(cashOut)}</td>
                      <td className={`text-right font-black ${amountTone(netCashFlow)}`}>{formatKRW(netCashFlow)}</td>
                      <td className="text-right">{transactions.filter((row) => !row.isInternalTransfer).length.toLocaleString("ko-KR")}건</td>
                    </tr>
                    {sourceRows.map((row) => (
                      <tr key={row.source}>
                        <td>
                          <span className="badge badge-muted mr-2">{row.source}</span>
                          원천 합계
                        </td>
                        <td className="text-right">{formatKRW(row.cashIn)}</td>
                        <td className="text-right">{formatKRW(row.cashOut)}</td>
                        <td className={`text-right font-bold ${amountTone(row.cashIn - row.cashOut)}`}>{formatKRW(row.cashIn - row.cashOut)}</td>
                        <td className="text-right">{row.count.toLocaleString("ko-KR")}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">자산 · 부채 · 자본</h2>
                  <p className="mt-1 text-sm text-slate-500">5월말 기준 재무상태 요약입니다.</p>
                </div>
                <WalletCards size={20} className="text-slate-400" />
              </div>
              <div className="grid grid-cols-[1fr_28px_1fr_28px_1fr] items-stretch gap-2 max-md:grid-cols-1">
                <MiniStat label="총자산" value={formatCompactKRW(totalAssets)} caption={formatKRW(totalAssets)} />
                <div className="flex items-center justify-center text-xl font-black text-slate-400 max-md:hidden">-</div>
                <MiniStat label="총부채" value={formatCompactKRW(totalLiabilities)} caption={formatKRW(totalLiabilities)} />
                <div className="flex items-center justify-center text-xl font-black text-slate-400 max-md:hidden">=</div>
                <MiniStat label="자본" value={formatCompactKRW(equity)} caption={formatKRW(equity)} tone="blue" />
              </div>
              <div className="mt-4 grid gap-2">
                {[...assets, ...liabilities].slice(0, 6).map((row) => (
                  <div key={`${row.statementType}-${row.id}-${row.category}`} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-b-0 last:pb-0">
                    <span className="min-w-0 truncate font-bold text-slate-700">
                      <span className={row.statementType === "자산" ? "badge badge-good mr-2" : "badge badge-warning mr-2"}>{row.statementType}</span>
                      {row.category}
                    </span>
                    <b className="shrink-0">{formatKRW(endingAmount(row))}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-[minmax(0,1fr)_minmax(360px,.85fr)] gap-5 max-xl:grid-cols-1">
            <div className="card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">주요 지출 분류</h2>
                  <p className="mt-1 text-sm text-slate-500">출금 거래 중 금액이 큰 대분류입니다.</p>
                </div>
                <Link href="/expenses" className="btn btn-soft">지출 분석</Link>
              </div>
              <div className="grid gap-4">
                {expenseCategoryRows.map(([category, amount], index) => (
                  <ProgressRow key={category} label={category} amount={amount} total={cashOut || 1} color={index === 0 ? "bg-blue-600" : index === 1 ? "bg-cyan-500" : "bg-indigo-400"} />
                ))}
              </div>
            </div>

            <div className="card">
              <div className="mb-4">
                <h2 className="section-title">최근 업로드</h2>
                <p className="mt-1 text-sm text-slate-500">현재 결과값에 반영된 파일입니다.</p>
              </div>
              <div className="grid gap-3">
                {uploadBatches.slice(0, 4).map((batch) => (
                  <div key={batch.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="truncate font-black text-slate-950">{batch.fileName}</div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{formatDateTime(batch.uploadedAt)}</span>
                      <span className="badge badge-muted">{batch.uploadType}</span>
                    </div>
                  </div>
                ))}
                <Link href="/uploads" className="btn">업로드 보기 <ArrowRight size={14} /></Link>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <h2 className="section-title">최근 거래</h2>
                <p className="mt-1 text-sm text-slate-500">최신순 8건을 빠르게 확인합니다.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/bank" className="btn">은행</Link>
                <Link href="/cards" className="btn">카드</Link>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>출처</th>
                    <th>사업부</th>
                    <th>거래처</th>
                    <th>내용</th>
                    <th>상태</th>
                    <th className="text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td><span className="badge badge-muted">{row.source}</span></td>
                      <td className="font-bold text-slate-700">{row.businessUnit}</td>
                      <td>{row.vendor}</td>
                      <td>{row.description}</td>
                      <td>
                        {isNormal(row) ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700"><CheckCircle2 size={13} /> {row.reviewStatus}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700"><CircleAlert size={13} /> {row.reviewStatus}</span>
                        )}
                      </td>
                      <td className="text-right font-black">{formatKRW(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="mb-4">
              <h2 className="section-title">원본 로우데이터 확인</h2>
              <p className="mt-1 text-sm text-slate-500">필요할 때만 원본 샘플을 확인합니다.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>행</th>
                    <th>원본값 일부</th>
                    <th>정규화 결과</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rawRows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-black">{row.rowIndex}</td>
                      <td>{previewRawData(row.rawData)}</td>
                      <td>{row.normalizedData ? previewRawData(row.normalizedData) : "-"}</td>
                      <td><span className={row.parseStatus === "정상" ? "badge badge-good" : "badge badge-warning"}>{row.parseStatus}</span></td>
                    </tr>
                  ))}
                  {rawRows.length === 0 ? (
                    <tr><td colSpan={4} className="text-slate-500">표시할 원본 행이 없습니다.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        <aside className="grid h-fit gap-5 2xl:sticky 2xl:top-5">
          <section className="card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="section-title">당월 점검</h2>
                <p className="mt-1 text-sm text-slate-500">결산 전 확인할 항목입니다.</p>
              </div>
              <span className="badge badge-good">정상</span>
            </div>
            <div className="grid gap-3">
              <StatusLine icon={<Database size={15} />} label="실데이터 연결" value="ON" caption="Supabase 기준" tone="blue" />
              <StatusLine icon={<CheckCircle2 size={15} />} label="분류 검증" value={`${reviewRows.length}건`} caption="확인필요 없음" tone="green" />
              <StatusLine icon={<Landmark size={15} />} label="5월 집계 기준" value="광고사업부" caption="6월 결산 시 재분리" tone="amber" />
            </div>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">결산 메모</h2>
              <Clock3 size={18} className="text-slate-400" />
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              5월은 사업부 세부 귀속 기준 확정 전까지 입금과 출금을 광고사업부 기준으로 산정합니다.
            </div>
            <Link href="/expenses" className="btn mt-3 w-full">지출 상세 보기</Link>
          </section>

          <section className="card">
            <div className="mb-4">
              <h2 className="section-title">데이터 요약</h2>
              <p className="mt-1 text-sm text-slate-500">원천별 반영 상태입니다.</p>
            </div>
            <div className="grid gap-2">
              <StatusLine icon={<FileSpreadsheet size={15} />} label="로우데이터" value={`${rawRowCount.toLocaleString("ko-KR")}행`} tone="slate" />
              <StatusLine icon={<Landmark size={15} />} label="은행 거래" value={`${sourceRows.find((row) => row.source === "은행")?.count.toLocaleString("ko-KR") || 0}건`} tone="blue" />
              <StatusLine icon={<WalletCards size={15} />} label="카드 거래" value={`${sourceRows.find((row) => row.source === "카드")?.count.toLocaleString("ko-KR") || 0}건`} tone="blue" />
            </div>
          </section>

          <section className="card">
            <div className="mb-4">
              <h2 className="section-title">확인 필요 거래</h2>
              <p className="mt-1 text-sm text-slate-500">자동분류 후 남은 항목입니다.</p>
            </div>
            {reviewRows.length === 0 ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                확인이 필요한 거래가 없습니다.
              </div>
            ) : (
              <div className="grid gap-3">
                {reviewRows.slice(0, 5).map((row) => (
                  <div key={row.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="font-black text-slate-950">{row.vendor}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">{row.description}</div>
                    <div className="mt-2 text-right text-sm font-black">{formatKRW(row.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
