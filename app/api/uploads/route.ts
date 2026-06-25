import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getApiUser } from "@/lib/auth/api";
import { canUpload } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUploadRows, type UploadType } from "@/services/uploads/normalize";

const uploadTypes = ["bank", "card", "pharos", "balance"] as const;

type UploadPayload = {
  uploadType?: UploadType;
  fileName?: string;
  headers?: string[];
  rows?: Record<string, string>[];
};

function safeRows(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    .slice(0, 5000)
    .map((row) => {
      const cleaned: Record<string, string> = {};
      Object.entries(row).forEach(([key, value]) => {
        cleaned[String(key)] = value === null || value === undefined ? "" : String(value);
      });
      return cleaned;
    });
}

async function tableExists(admin: any, tableName: string) {
  const { error } = await admin.from(tableName).select("id").limit(1);
  return !error;
}

export async function GET(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  const admin = createAdminClient();
  const { data: batches, error } = await admin
    .from("upload_batches")
    .select("id,upload_type,file_name,status,uploaded_by,uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const batchIds = (batches || []).map((batch) => batch.id);
  let rawCounts: Record<string, number> = {};
  let transactionCounts: Record<string, number> = {};

  if (batchIds.length > 0) {
    const hasRawRows = await tableExists(admin, "upload_raw_rows");
    if (hasRawRows) {
      const { data: rawRows } = await admin
        .from("upload_raw_rows")
        .select("upload_batch_id")
        .in("upload_batch_id", batchIds);
      rawCounts = (rawRows || []).reduce<Record<string, number>>((acc, row: { upload_batch_id: string }) => {
        acc[row.upload_batch_id] = (acc[row.upload_batch_id] || 0) + 1;
        return acc;
      }, {});
    }

    const { data: transactions } = await admin
      .from("transactions")
      .select("upload_batch_id")
      .in("upload_batch_id", batchIds);
    transactionCounts = (transactions || []).reduce<Record<string, number>>((acc, row: { upload_batch_id: string }) => {
      if (!row.upload_batch_id) return acc;
      acc[row.upload_batch_id] = (acc[row.upload_batch_id] || 0) + 1;
      return acc;
    }, {});
  }

  return NextResponse.json({
    batches: (batches || []).map((batch) => ({
      ...batch,
      rawRowCount: rawCounts[batch.id] || 0,
      transactionCount: transactionCounts[batch.id] || 0
    }))
  });
}

export async function POST(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  if (!canUpload(profileResult.profile.role)) {
    return NextResponse.json({ error: "업로드는 admin 또는 finance 권한만 가능합니다." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as UploadPayload;
    const uploadType = body.uploadType;
    const fileName = String(body.fileName || "").trim();
    const rows = safeRows(body.rows);

    if (!uploadType || !uploadTypes.includes(uploadType)) {
      return NextResponse.json({ error: "업로드 유형을 선택하세요." }, { status: 400 });
    }
    if (!fileName) return NextResponse.json({ error: "파일명이 없습니다." }, { status: 400 });
    if (rows.length === 0) return NextResponse.json({ error: "저장할 행이 없습니다." }, { status: 400 });
    if (Array.isArray(body.rows) && body.rows.length > 5000) {
      return NextResponse.json({ error: "1회 업로드는 최대 5,000행까지 가능합니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: batch, error: batchError } = await admin
      .from("upload_batches")
      .insert({
        upload_type: uploadType,
        file_name: fileName,
        status: "previewed",
        uploaded_by: profileResult.profile.login_id || profileResult.profile.email
      })
      .select("id,upload_type,file_name,status,uploaded_at")
      .single();

    if (batchError) throw batchError;

    const normalizedRows = normalizeUploadRows(uploadType, rows);
    const hasRawRows = await tableExists(admin, "upload_raw_rows");

    if (hasRawRows) {
      const rawPayload = normalizedRows.map((row) => ({
        upload_batch_id: batch.id,
        row_index: row.rowIndex,
        raw_data: row.rawData,
        normalized_data: row.normalizedData,
        parse_status: row.parseStatus,
        memo: row.memo
      }));

      for (let i = 0; i < rawPayload.length; i += 500) {
        const { error } = await admin.from("upload_raw_rows").insert(rawPayload.slice(i, i + 500));
        if (error) throw error;
      }
    }

    const transactionRows = uploadType === "balance" ? [] : normalizedRows
      .map((row) => row.transaction)
      .filter((transaction): transaction is NonNullable<typeof transaction> => Boolean(transaction))
      .map((transaction) => ({
        upload_batch_id: batch.id,
        transaction_date: transaction.transaction_date,
        source: transaction.source,
        business_unit: transaction.business_unit,
        account_id: transaction.account_id,
        card_budget_group: transaction.card_budget_group,
        vendor: transaction.vendor,
        description: transaction.description,
        amount: transaction.amount,
        cash_flow_type: transaction.cash_flow_type,
        main_category: transaction.main_category,
        sub_category: transaction.sub_category,
        detail_category: transaction.detail_category,
        talent_investment_type: transaction.talent_investment_type,
        expense_basis: transaction.expense_basis,
        is_internal_transfer: transaction.is_internal_transfer,
        is_common_use: transaction.is_common_use,
        common_policy: transaction.common_policy,
        review_status: transaction.review_status,
        memo: transaction.memo
      }));
    const balanceMovementRows = uploadType === "balance" ? normalizedRows
      .map((row) => row.balanceMovement)
      .filter((movement): movement is NonNullable<typeof movement> => Boolean(movement))
      .map((movement) => ({
        month: movement.month,
        statement_type: movement.statement_type,
        category: movement.category,
        opening_amount: movement.opening_amount,
        increase_amount: movement.increase_amount,
        decrease_amount: movement.decrease_amount,
        memo: movement.memo
      })) : [];

    for (let i = 0; i < transactionRows.length; i += 500) {
      const { error } = await admin.from("transactions").insert(transactionRows.slice(i, i + 500));
      if (error) throw error;
    }

    if (balanceMovementRows.length > 0) {
      const months = Array.from(new Set(balanceMovementRows.map((row) => row.month)));
      const { error: deleteError } = await admin
        .from("balance_movements")
        .delete()
        .in("month", months);
      if (deleteError) throw deleteError;

      for (let i = 0; i < balanceMovementRows.length; i += 500) {
        const { error } = await admin.from("balance_movements").insert(balanceMovementRows.slice(i, i + 500));
        if (error) throw error;
      }
    }

    revalidateTag("dashboard-data", { expire: 0 });

    return NextResponse.json({
      ok: true,
      batch,
      rawRowCount: rows.length,
      transactionCount: transactionRows.length,
      balanceMovementCount: balanceMovementRows.length,
      needReviewCount: normalizedRows.filter((row) => row.parseStatus !== "정상" || row.transaction?.review_status === "확인필요").length,
      rawRowsTableReady: hasRawRows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
