export type UploadPreview = {
  fileName: string;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, string>[];
};

export async function parseUploadFile(file: File): Promise<UploadPreview> {
  // Implementation target for step 2.
  // CSV parsing will use papaparse, Excel parsing will use xlsx.
  return {
    fileName: file.name,
    rowCount: 0,
    headers: [],
    sampleRows: []
  };
}
