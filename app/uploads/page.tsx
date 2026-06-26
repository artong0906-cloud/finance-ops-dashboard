export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { formatKRW } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import { resolveMonthParam, type MonthSearchParams } from "@/lib/month-filter";
import type { Transaction } from "@/types/finance";
import { UploadWorkspace } from "@/app/uploads/UploadWorkspace";

function isReviewNeeded(row: Transaction) {
  return row.reviewStatus === "확인필요" || row.journalStatus === "미분개" || row.businessUnit.includes("미배");
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

function SummaryCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="card">
      <div className="eyebrow">{label}</div>
      <div className="metric-value mt-2">{value}</div>
      {caption ? <div className="mt-2 text-xs leading-5 text-slate-500">{caption}</div> : null}
    </div>
  );
}

export default async function UploadsPage({
  searchParams
}: {
  searchParams?: Promise<MonthSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const selectedMonth = resolveMonthParam(params);
  const data = await getDashboardData(selectedMonth, true);
  const reviewRows = data.transactions.filter(isReviewNeeded);
  const recentRows = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const latestUpload = data.uploadBatches[0];

  return (
    <AppShell
      title="업로드 검증"
      description="은행, 카드, 파로스, 자산·부채 파일을 업로드하고 원본/거래/검증 상태를 확인합니다."
      periodLabel={data.currentMonth || "2026-05"}
      availableMonths={data.availableMonths}
      activePath="/uploads"
    >
      <div className="grid gap-6">
        <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          <SummaryCard label="원본 로우데이터" value={`${data.rawRowCount.toLocaleString("ko-KR")}행`} caption="Supabase upload_raw_rows 기준" />
          <SummaryCard label="거래 변환" value={`${data.transactions.length.toLocaleString("ko-KR")}건`} caption="은행/카드/분개 거래" />
          <SummaryCard label="검증 대기" value={`${reviewRows.length.toLocaleString("ko-KR")}건`} caption={reviewRows.length === 0 ? "현재 확인 필요 없음" : "분류 또는 분개 확인 필요"} />
          <SummaryCard label="최근 업로드" value={latestUpload ? latestUpload.fileName : "-"} caption={latestUpload ? formatDateTime(latestUpload.uploadedAt) : "업로드 이력 없음"} />
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(360px,.85fr)] gap-5 max-xl:grid-cols-1">
          <div className="card">
            <div className="mb-4">
              <h2 className="section-title">최근 거래내역</h2>
              <p className="mt-1 text-sm text-slate-500">업로드 후 변환된 거래 최신순 8건입니다.</p>
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
                      <td><span className={isReviewNeeded(row) ? "badge badge-warning" : "badge badge-good"}>{row.reviewStatus}</span></td>
                      <td className="text-right font-black">{formatKRW(row.amount)}</td>
                    </tr>
                  ))}
                  {recentRows.length === 0 ? <tr><td className="text-slate-500" colSpan={7}>표시할 거래가 없습니다.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="mb-4">
              <h2 className="section-title">확인 필요 거래</h2>
              <p className="mt-1 text-sm text-slate-500">자동분류 후 사람이 확인할 항목입니다.</p>
            </div>
            {reviewRows.length === 0 ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                확인이 필요한 거래가 없습니다.
              </div>
            ) : (
              <div className="grid gap-3">
                {reviewRows.slice(0, 6).map((row) => (
                  <div key={row.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-black text-slate-950">{row.vendor}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">{row.description}</div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-black">{formatKRW(row.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="mb-4">
            <h2 className="section-title">원본 로우데이터 확인</h2>
            <p className="mt-1 text-sm text-slate-500">최근 저장된 원본 행과 정규화 결과 샘플입니다.</p>
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
                {data.rawRows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-black">{row.rowIndex}</td>
                    <td>{previewRawData(row.rawData)}</td>
                    <td>{row.normalizedData ? previewRawData(row.normalizedData) : "-"}</td>
                    <td><span className={row.parseStatus === "정상" ? "badge badge-good" : "badge badge-warning"}>{row.parseStatus}</span></td>
                  </tr>
                ))}
                {data.rawRows.length === 0 ? <tr><td className="text-slate-500" colSpan={4}>표시할 원본 행이 없습니다.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <UploadWorkspace reviewRows={reviewRows} />
      </div>
    </AppShell>
  );
}
