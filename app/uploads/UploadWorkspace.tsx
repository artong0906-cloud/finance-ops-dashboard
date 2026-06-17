"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseUploadFile, type UploadPreview } from "@/services/uploads/parse";
import { normalizeUploadRows, type UploadType } from "@/services/uploads/normalize";

type UploadBatch = {
  id: string;
  upload_type: UploadType;
  file_name: string;
  status: string;
  uploaded_by: string | null;
  uploaded_at: string;
  rawRowCount: number;
  transactionCount: number;
};

const uploadTypeOptions: { value: UploadType; label: string; desc: string }[] = [
  { value: "bank", label: "은행 입출금", desc: "기업은행, 플랫폼 통장, 하나/신한/한투 입출금" },
  { value: "card", label: "카드 사용내역", desc: "매입신용카드, 법인카드 승인내역" },
  { value: "pharos", label: "파로스 분개", desc: "파로스 일일분개, 사업부 확정 기준" },
  { value: "balance", label: "자산·부채 증감", desc: "기초/증가/감소 잔액 템플릿" }
];

function typeLabel(type: UploadType) {
  return uploadTypeOptions.find((item) => item.value === type)?.label || type;
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

async function getAuthHeaders(includeJson = false) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다. 로그아웃 후 다시 로그인해주세요.");
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`
  };
}

export function UploadWorkspace() {
  const [uploadType, setUploadType] = useState<UploadType>("bank");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const normalizedPreview = useMemo(() => {
    if (!preview) return [];
    return normalizeUploadRows(uploadType, preview.rows).slice(0, 10);
  }, [preview, uploadType]);

  const stats = useMemo(() => {
    if (!preview) return null;
    const normalized = normalizeUploadRows(uploadType, preview.rows);
    return {
      rawRows: preview.rowCount,
      okRows: normalized.filter((row) => row.parseStatus === "정상").length,
      reviewRows: normalized.filter((row) => row.parseStatus !== "정상").length,
      transactionRows: uploadType === "balance" ? 0 : normalized.filter((row) => row.transaction).length
    };
  }, [preview, uploadType]);

  async function loadBatches() {
    setIsLoadingBatches(true);
    try {
      const headers = await getAuthHeaders(false);
      const response = await fetch("/api/uploads", { headers, credentials: "same-origin", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "업로드 이력을 불러오지 못했습니다.");
      setBatches(result.batches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 이력을 불러오지 못했습니다.");
    } finally {
      setIsLoadingBatches(false);
    }
  }

  useEffect(() => {
    loadBatches().catch(() => undefined);
  }, []);

  async function handlePreview() {
    setMessage("");
    setError("");
    setPreview(null);

    if (!file) {
      setError("업로드할 파일을 선택하세요.");
      return;
    }

    setIsParsing(true);
    try {
      const parsed = await parseUploadFile(file);
      if (parsed.rowCount === 0) throw new Error("파일에서 읽을 수 있는 행이 없습니다.");
      setPreview(parsed);
      setMessage(`미리보기 생성 완료: ${parsed.rowCount.toLocaleString("ko-KR")}행을 읽었습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 미리보기 생성 중 오류가 발생했습니다.");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSave() {
    setMessage("");
    setError("");

    if (!preview) {
      setError("먼저 미리보기를 생성하세요.");
      return;
    }

    setIsSaving(true);
    try {
      const headers = await getAuthHeaders(true);
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({
          uploadType,
          fileName: preview.fileName,
          headers: preview.headers,
          rows: preview.rows
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "업로드 저장에 실패했습니다.");
      setMessage(`저장 완료: 원본 ${result.rawRowCount.toLocaleString("ko-KR")}행 / 거래 ${result.transactionCount.toLocaleString("ko-KR")}건 생성 / 확인필요 ${result.needReviewCount.toLocaleString("ko-KR")}건`);
      setPreview(null);
      setFile(null);
      const input = document.getElementById("upload-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-4 max-xl:grid-cols-1">
        <div className="card">
          <div className="flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <h2 className="text-xl font-black tracking-[-0.04em]">파일 업로드</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">CSV, XLSX, XLS 파일을 읽어 원본 행을 저장하고 1차 거래 데이터로 변환합니다. 확정 전까지는 모두 검토대기 상태로 둡니다.</p>
            </div>
            <span className="badge badge-warning">v4 MVP</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              자료 유형
              <select className="rounded-2xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500" value={uploadType} onChange={(event) => setUploadType(event.target.value as UploadType)}>
                {uploadTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <span className="text-xs font-medium text-slate-500">{uploadTypeOptions.find((option) => option.value === uploadType)?.desc}</span>
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              파일 선택
              <input id="upload-file-input" className="rounded-2xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <span className="text-xs font-medium text-slate-500">1회 업로드 최대 5,000행 기준으로 먼저 운영합니다.</span>
            </label>
          </div>

          <div className="mt-5 flex gap-2 max-md:grid">
            <button className="btn" onClick={handlePreview} disabled={isParsing || isSaving}>{isParsing ? "미리보기 생성 중..." : "미리보기 생성"}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!preview || isSaving}>{isSaving ? "저장 중..." : "검증대기 저장"}</button>
          </div>

          {message ? <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">{message}</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
        </div>

        <div className="card">
          <h2 className="text-xl font-black tracking-[-0.04em]">업로드 기준</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
            <p><b>은행</b>은 거래일자, 입금액/출금액, 적요를 우선 인식합니다.</p>
            <p><b>카드</b>는 승인일자, 가맹점명, 승인금액을 우선 인식합니다.</p>
            <p><b>파로스</b>는 전표일자, 거래처, 금액, 사업부를 우선 인식합니다.</p>
            <p><b>자산·부채</b>는 원본 저장부터 하고, 증감 계산 연결은 다음 단계에서 확장합니다.</p>
          </div>
        </div>
      </section>

      {stats && preview ? (
        <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          <div className="card"><div className="text-xs font-bold text-slate-500">원본 행</div><div className="mt-2 text-2xl font-black">{stats.rawRows.toLocaleString("ko-KR")}</div></div>
          <div className="card"><div className="text-xs font-bold text-slate-500">자동 인식 정상</div><div className="mt-2 text-2xl font-black">{stats.okRows.toLocaleString("ko-KR")}</div></div>
          <div className="card"><div className="text-xs font-bold text-slate-500">확인 필요</div><div className="mt-2 text-2xl font-black text-amber-700">{stats.reviewRows.toLocaleString("ko-KR")}</div></div>
          <div className="card"><div className="text-xs font-bold text-slate-500">거래 생성 예정</div><div className="mt-2 text-2xl font-black text-blue-700">{stats.transactionRows.toLocaleString("ko-KR")}</div></div>
        </section>
      ) : null}

      {preview ? (
        <section className="card">
          <div className="flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <h2 className="text-xl font-black tracking-[-0.04em]">미리보기</h2>
              <p className="mt-2 text-sm text-slate-500">{preview.fileName} · {preview.rowCount.toLocaleString("ko-KR")}행 · {preview.headers.length}개 컬럼</p>
            </div>
            <span className="badge">{typeLabel(uploadType)}</span>
          </div>

          <div className="mt-4 table-wrap">
            <table>
              <thead>
                <tr>
                  <th>상태</th><th>일자</th><th>거래처/적요</th><th>금액</th><th>현금흐름</th><th>사업부</th><th>메모</th>
                </tr>
              </thead>
              <tbody>
                {normalizedPreview.map((row) => (
                  <tr key={row.rowIndex}>
                    <td><span className={row.parseStatus === "정상" ? "badge badge-good" : "badge badge-warning"}>{row.parseStatus}</span></td>
                    <td>{String(row.normalizedData.transaction_date || "-")}</td>
                    <td>{String(row.normalizedData.vendor || row.normalizedData.description || "-")}</td>
                    <td className="font-black">{Number(row.normalizedData.amount || 0).toLocaleString("ko-KR")}</td>
                    <td>{String(row.normalizedData.cash_flow_type || "-")}</td>
                    <td>{String(row.normalizedData.business_unit || "-")}</td>
                    <td className="text-amber-700">{row.memo || "검토대기"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-black">원본 컬럼/샘플 보기</summary>
            <div className="mt-4 table-wrap">
              <table>
                <thead>
                  <tr>{preview.headers.slice(0, 12).map((header) => <th key={header}>{header}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, index) => (
                    <tr key={index}>{preview.headers.slice(0, 12).map((header) => <td key={header}>{row[header]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      ) : null}

      <section className="card">
        <div className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
          <div>
            <h2 className="text-xl font-black tracking-[-0.04em]">최근 업로드 이력</h2>
            <p className="mt-2 text-sm text-slate-500">저장된 원본 행과 거래 생성 건수를 확인합니다.</p>
          </div>
          <button className="btn" onClick={() => loadBatches()} disabled={isLoadingBatches}>{isLoadingBatches ? "새로고침 중..." : "새로고침"}</button>
        </div>
        <div className="mt-4 table-wrap">
          <table>
            <thead><tr><th>업로드일</th><th>유형</th><th>파일명</th><th>상태</th><th>업로드자</th><th>원본행</th><th>거래건</th></tr></thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDateTime(batch.uploaded_at)}</td>
                  <td><span className="badge">{typeLabel(batch.upload_type)}</span></td>
                  <td className="font-bold">{batch.file_name}</td>
                  <td><span className="badge badge-warning">{batch.status}</span></td>
                  <td>{batch.uploaded_by || "-"}</td>
                  <td>{batch.rawRowCount.toLocaleString("ko-KR")}</td>
                  <td>{batch.transactionCount.toLocaleString("ko-KR")}</td>
                </tr>
              ))}
              {batches.length === 0 ? <tr><td colSpan={7} className="text-slate-500">아직 업로드 이력이 없습니다.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
