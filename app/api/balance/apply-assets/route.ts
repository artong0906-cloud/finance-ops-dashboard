import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMonthlyBalanceRows, type AssetApplyMode, type AssetApplySelection } from "@/services/balance/monthlyClose";
import { getDashboardData } from "@/services/dashboard/liveData";

export const dynamic = "force-dynamic";

function normalizeMonth(value: unknown) {
  const month = typeof value === "string" ? value.trim() : "";
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ? month : "2026-06";
}

function normalizeMode(value: unknown): AssetApplyMode {
  return value === "as_is" || value === "depreciate" ? value : "exclude";
}

function normalizeSelections(value: unknown): AssetApplySelection[] {
  if (!Array.isArray(value)) return [];

  const selections: AssetApplySelection[] = [];
  value
    .map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const transactionId = typeof record.transactionId === "string" ? record.transactionId : "";
      if (!transactionId) return null;

      return {
        transactionId,
        mode: normalizeMode(record.mode),
        assetCategory: typeof record.assetCategory === "string" ? record.assetCategory : undefined,
        monthlyDepreciation: Number(record.monthlyDepreciation || 0)
      };
    })
    .forEach((item) => {
      if (item) selections.push(item);
    });

  return selections;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const month = normalizeMonth(body.month);
    const selections = normalizeSelections(body.selections);
    const data = await getDashboardData(month);
    const rows = buildMonthlyBalanceRows({
      month,
      bankAccounts: data.bankAccounts,
      transactions: data.transactions,
      selections
    });

    const admin = createAdminClient();
    const { error: deleteError } = await admin
      .from("balance_movements")
      .delete()
      .eq("month", month);

    if (deleteError) throw deleteError;

    if (rows.length > 0) {
      const { error: insertError } = await admin
        .from("balance_movements")
        .insert(rows);

      if (insertError) throw insertError;
    }

    revalidateTag("dashboard-data", { expire: 0 });
    ["/dashboard", "/balance", "/expenses", "/bank"].forEach((path) => revalidatePath(path));

    return NextResponse.json({
      ok: true,
      month,
      balanceMovementCount: rows.length,
      appliedAssetCount: selections.filter((selection) => selection.mode !== "exclude").length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자산/부채 반영 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
