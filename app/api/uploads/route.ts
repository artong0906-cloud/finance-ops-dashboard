import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getApiUser } from "@/lib/auth/api";
import { canUpload } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserMappingRule } from "@/services/classification/firstPass";
import { inferMixedUploadType, normalizeUploadRows, type NormalizedUploadRow, type PersistedUploadType, type UploadType } from "@/services/uploads/normalize";

const uploadTypes = ["bank", "card", "pharos", "balance", "mixed"] as const;
const persistedUploadTypeLabels: Record<PersistedUploadType, string> = {
  bank: "은행",
  card: "카드",
  pharos: "파로스",
  balance: "자산부채"
};

type UploadPayload = {
  uploadType?: UploadType;
  fileName?: string;
  headers?: string[];
  rows?: Record<string, string>[];
};

function isPersistedUploadType(value: string): value is PersistedUploadType {
  return value === "bank" || value === "card" || value === "pharos" || value === "balance";
}

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

async function countRows(admin: any, tableName: string, columnName: string, value: string) {
  const { count, error } = await admin
    .from(tableName)
    .select("id", { count: "exact", head: true })
    .eq(columnName, value);

  if (error) return 0;
  return count || 0;
}

async function fetchActiveMappingRules(admin: any) {
  const { data, error } = await admin
    .from("mapping_rules")
    .select("rule_name,source,keyword,business_unit,main_category,sub_category,detail_category,expense_basis,priority,created_at")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  return error ? [] : (data || []) as UserMappingRule[];
}

function normalizeMonthValue(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = raw.match(/(20\d{2}|19\d{2})[.\-/년\s]*(\d{1,2})/);
  if (!match) return null;

  return `${match[1]}-${match[2].padStart(2, "0")}`;
}

function inferRawRowMonth(row: { raw_data?: Record<string, unknown> | null; normalized_data?: Record<string, unknown> | null }) {
  const normalized = row.normalized_data || {};
  const raw = row.raw_data || {};
  const values = [
    normalized.month,
    normalized.transaction_date,
    normalized.date,
    raw.month,
    raw.date,
    raw["월"],
    raw["기준월"],
    raw["집계월"],
    raw["마감월"],
    raw["일자"],
    raw["날짜"],
    raw["거래일자"]
  ];

  for (const value of values) {
    const month = normalizeMonthValue(value);
    if (month) return month;
  }

  return null;
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
      const pairs = await Promise.all(batchIds.map(async (batchId) => [
        batchId,
        await countRows(admin, "upload_raw_rows", "upload_batch_id", batchId)
      ] as const));
      rawCounts = Object.fromEntries(pairs);
    }

    const transactionPairs = await Promise.all(batchIds.map(async (batchId) => [
      batchId,
      await countRows(admin, "transactions", "upload_batch_id", batchId)
    ] as const));
    transactionCounts = Object.fromEntries(transactionPairs);
  }

  return NextResponse.json({
    batches: (batches || []).map((batch) => ({
      ...batch,
      rawRowCount: rawCounts[batch.id] || 0,
      transactionCount: transactionCounts[batch.id] || 0
    }))
  });
}

export async function DELETE(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  if (!canUpload(profileResult.profile.role)) {
    return NextResponse.json({ error: "업로드 삭제는 admin 또는 finance 권한만 가능합니다." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || request.nextUrl.searchParams.get("id") || "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "삭제할 업로드 ID가 올바르지 않습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: batch, error: batchError } = await admin
      .from("upload_batches")
      .select("id,upload_type,file_name")
      .eq("id", id)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) return NextResponse.json({ error: "삭제할 업로드 기록을 찾을 수 없습니다." }, { status: 404 });

    const hasRawRows = await tableExists(admin, "upload_raw_rows");
    const rawRows = hasRawRows
      ? ((await admin
          .from("upload_raw_rows")
          .select("id,raw_data,normalized_data")
          .eq("upload_batch_id", id)).data || []) as { id: string; raw_data: Record<string, unknown> | null; normalized_data: Record<string, unknown> | null }[]
      : [];

    const balanceMonths = batch.upload_type === "balance"
      ? Array.from(new Set(rawRows.map(inferRawRowMonth).filter((month): month is string => Boolean(month))))
      : [];

    const { data: deletedTransactions, error: transactionDeleteError } = await admin
      .from("transactions")
      .delete()
      .eq("upload_batch_id", id)
      .select("id");
    if (transactionDeleteError) throw transactionDeleteError;

    let balanceMovementCount = 0;
    if (balanceMonths.length > 0) {
      const { data: deletedBalanceRows, error: balanceDeleteError } = await admin
        .from("balance_movements")
        .delete()
        .in("month", balanceMonths)
        .select("id");
      if (balanceDeleteError) throw balanceDeleteError;
      balanceMovementCount = deletedBalanceRows?.length || 0;
    }

    const rawRowCount = rawRows.length;
    const { error: batchDeleteError } = await admin
      .from("upload_batches")
      .delete()
      .eq("id", id);
    if (batchDeleteError) throw batchDeleteError;

    revalidateTag("dashboard-data", { expire: 0 });

    return NextResponse.json({
      ok: true,
      deleted: {
        id,
        fileName: batch.file_name,
        uploadType: batch.upload_type,
        rawRowCount,
        transactionCount: deletedTransactions?.length || 0,
        balanceMovementCount,
        balanceMonths
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  if (!canUpload(profileResult.profile.role)) {
    return NextResponse.json({ error: "업로드는 admin 또는 finance 권한만 가능합니다." }, { status: 403 });
  }
  const profile = profileResult.profile;

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
    const mappingRules = await fetchActiveMappingRules(admin);
    const normalizedRows = normalizeUploadRows(uploadType, rows, mappingRules);
    const hasRawRows = await tableExists(admin, "upload_raw_rows");

    async function persistRows(batchUploadType: PersistedUploadType, batchFileName: string, groupRows: NormalizedUploadRow[]) {
      const { data: batch, error: batchError } = await admin
        .from("upload_batches")
        .insert({
          upload_type: batchUploadType,
          file_name: batchFileName,
          status: "previewed",
          uploaded_by: profile.login_id || profile.email
        })
        .select("id,upload_type,file_name,status,uploaded_at")
        .single();

      if (batchError) throw batchError;

      if (hasRawRows) {
        const rawPayload = groupRows.map((row) => ({
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

      const transactionRows = batchUploadType === "balance" ? [] : groupRows
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
      const balanceMovementRows = batchUploadType === "balance" ? groupRows
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

      return {
        batch,
        rawRowCount: groupRows.length,
        transactionCount: transactionRows.length,
        balanceMovementCount: balanceMovementRows.length
      };
    }

    const persistResults = [];
    if (uploadType === "mixed") {
      const groupedRows = normalizedRows.reduce((groups, row) => {
        const detectedType = String(row.normalizedData.detected_upload_type || inferMixedUploadType(row.rawData));
        const groupType = isPersistedUploadType(detectedType) ? detectedType : "bank";
        const current = groups.get(groupType) || [];
        current.push(row);
        groups.set(groupType, current);
        return groups;
      }, new Map<PersistedUploadType, NormalizedUploadRow[]>());

      for (const [groupType, groupRows] of groupedRows.entries()) {
        persistResults.push(await persistRows(groupType, `${fileName} :: ${persistedUploadTypeLabels[groupType]}`, groupRows));
      }
    } else {
      persistResults.push(await persistRows(uploadType, fileName, normalizedRows));
    }

    const transactionCount = persistResults.reduce((sum, result) => sum + result.transactionCount, 0);
    const balanceMovementCount = persistResults.reduce((sum, result) => sum + result.balanceMovementCount, 0);

    revalidateTag("dashboard-data", { expire: 0 });

    return NextResponse.json({
      ok: true,
      batch: persistResults[0]?.batch,
      batches: persistResults.map((result) => result.batch),
      rawRowCount: rows.length,
      transactionCount,
      balanceMovementCount,
      needReviewCount: normalizedRows.filter((row) => row.parseStatus !== "정상" || row.transaction?.review_status === "확인필요").length,
      rawRowsTableReady: hasRawRows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
