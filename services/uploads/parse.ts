import Papa from "papaparse";
import * as XLSX from "xlsx";

export type UploadPreview = {
  fileName: string;
  rowCount: number;
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[];
  detectedHeaderRow?: number;
  sheetName?: string;
};

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\u00a0/g, " ").trim();
}

function normalizeHeader(value: unknown): string {
  return normalizeCell(value)
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string) {
  return normalizeHeader(value).replace(/\s/g, "").toLowerCase();
}

function cleanRow(row: Record<string, unknown>, headers: string[]) {
  const result: Record<string, string> = {};
  headers.forEach((header) => {
    result[header] = normalizeCell(row[header]);
  });
  return result;
}

function isEffectivelyEmpty(row: Record<string, string>) {
  return Object.values(row).every((value) => !String(value || "").trim());
}

function parseCsv(text: string, fileName: string): Promise<UploadPreview> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error(result.errors[0]?.message || "CSV 파싱 중 오류가 발생했습니다."));
          return;
        }

        const headers = (result.meta.fields || [])
          .map((header) => normalizeHeader(header))
          .filter(Boolean);

        const rows = (result.data || [])
          .map((row) => cleanRow(row, headers))
          .filter((row) => !isEffectivelyEmpty(row));

        resolve({
          fileName,
          rowCount: rows.length,
          headers,
          rows,
          sampleRows: rows.slice(0, 10)
        });
      },
      error: (error) => reject(error)
    });
  });
}

const headerGroups = {
  date: ["거래일자", "거래일시", "거래일", "일자", "날짜", "승인일자", "이용일자", "사용일자", "전표일자", "date"],
  description: ["적요", "거래내용", "내용", "내역", "거래구분", "기재내용", "메모", "비고", "가맹점명", "거래처", "사용처", "상호", "업체명", "vendor", "description"],
  amount: ["입금", "입금액", "입금금액", "출금", "출금액", "출금금액", "거래금액", "금액", "승인금액", "이용금액", "사용금액", "amount"],
  balance: ["잔액", "거래후잔액", "거래 후 잔액", "현재잔액"]
};

function hasAnyKeyword(cell: string, keywords: string[]) {
  const normalized = compact(cell);
  if (!normalized) return false;
  return keywords.some((keyword) => normalized.includes(compact(keyword)));
}

function scoreHeaderRow(row: string[]) {
  const cells = row.map(normalizeHeader).filter(Boolean);
  if (cells.length < 2) return 0;

  const hasDate = cells.some((cell) => hasAnyKeyword(cell, headerGroups.date));
  const hasDescription = cells.some((cell) => hasAnyKeyword(cell, headerGroups.description));
  const hasAmount = cells.some((cell) => hasAnyKeyword(cell, headerGroups.amount));
  const hasBalance = cells.some((cell) => hasAnyKeyword(cell, headerGroups.balance));
  const keywordHits = cells.reduce((count, cell) => {
    const hit = Object.values(headerGroups).some((keywords) => hasAnyKeyword(cell, keywords));
    return count + (hit ? 1 : 0);
  }, 0);

  let score = keywordHits;
  if (hasDate) score += 3;
  if (hasAmount) score += 3;
  if (hasDescription) score += 2;
  if (hasBalance) score += 1;
  if (hasDate && hasAmount) score += 4;
  if (hasDate && hasAmount && hasDescription) score += 4;
  return score;
}

function findHeaderRowIndex(matrix: string[][]) {
  let bestIndex = 0;
  let bestScore = -1;
  const limit = Math.min(matrix.length, 40);

  for (let i = 0; i < limit; i += 1) {
    const score = scoreHeaderRow(matrix[i] || []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= 8 ? bestIndex : 0;
}

function makeUniqueHeaders(headerRow: string[]) {
  const seen = new Map<string, number>();
  return headerRow.map((header, index) => {
    const fallback = `열${index + 1}`;
    const base = normalizeHeader(header) || fallback;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function rowToObject(row: string[], headers: string[]) {
  const result: Record<string, string> = {};
  headers.forEach((header, index) => {
    result[header] = normalizeCell(row[index]);
  });
  return result;
}

function looksLikeNonTransactionSummary(row: Record<string, string>) {
  const joined = Object.values(row).join(" ");
  if (!joined.trim()) return true;

  const summaryMarkers = [
    "계좌번호", "조회기준일", "예금주명", "현재잔액", "조회시작일자", "조회종료일자",
    "출금가능금액", "합계", "총건수", "페이지", "단위", "거래내역조회", "입출금거래내역"
  ];
  const hasSummaryMarker = summaryMarkers.some((marker) => joined.includes(marker));
  const hasTransactionSignal = /(20\d{2}|19\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/.test(joined)
    || /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(joined);

  return hasSummaryMarker && !hasTransactionSignal;
}

function parseExcel(buffer: ArrayBuffer, fileName: string): UploadPreview {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("엑셀 파일에서 시트를 찾지 못했습니다.");

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false
  }).map((row) => row.map(normalizeCell));

  const nonEmptyMatrix = matrix.filter((row) => row.some((cell) => cell.trim()));
  if (nonEmptyMatrix.length === 0) {
    return { fileName, rowCount: 0, headers: [], rows: [], sampleRows: [], sheetName: firstSheetName };
  }

  const headerRowIndex = findHeaderRowIndex(nonEmptyMatrix);
  const headers = makeUniqueHeaders(nonEmptyMatrix[headerRowIndex] || []);
  const maxColumns = headers.length;

  const rows = nonEmptyMatrix
    .slice(headerRowIndex + 1)
    .map((row) => rowToObject(row.slice(0, maxColumns), headers))
    .filter((row) => !isEffectivelyEmpty(row))
    .filter((row) => !looksLikeNonTransactionSummary(row));

  return {
    fileName,
    rowCount: rows.length,
    headers,
    rows,
    sampleRows: rows.slice(0, 10),
    detectedHeaderRow: headerRowIndex + 1,
    sheetName: firstSheetName
  };
}

export async function parseUploadFile(file: File): Promise<UploadPreview> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const text = await file.text();
    return parseCsv(text, file.name);
  }

  if (["xlsx", "xls"].includes(extension || "")) {
    const buffer = await file.arrayBuffer();
    return parseExcel(buffer, file.name);
  }

  throw new Error("지원하지 않는 파일 형식입니다. CSV, XLSX, XLS 파일만 업로드할 수 있습니다.");
}
