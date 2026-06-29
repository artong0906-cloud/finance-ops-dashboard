import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth/api";
import { canUpload } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

const revenueCategories = ["광고사업부 매출", "대외협력팀 매출", "플랫폼 매출", "정부지원금", "기타매출"] as const;

type RevenueCategory = (typeof revenueCategories)[number];

type SplitPayload = {
  transactionId?: unknown;
  splits?: unknown;
};

type SplitInput = {
  category: RevenueCategory;
  amount: number;
};

function isOneOf<T extends readonly string[]>(value: string, list: T): value is T[number] {
  return list.includes(value as T[number]);
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}#·._-]/g, "");
}

function isCiderpayRow(row: { vendor: string | null; description: string | null; memo: string | null }) {
  const text = normalizeText([row.vendor, row.description, row.memo].filter(Boolean).join(" "));
  return text.includes("ciderpay") || text.includes("cider") || text.includes(normalizeText("사이다페이"));
}

function normalizeSplits(value: unknown): SplitInput[] {
  if (!Array.isArray(value)) return [];

  const totals = new Map<RevenueCategory, number>();
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const category = String((item as { category?: unknown }).category || "").trim();
    const amount = Number((item as { amount?: unknown }).amount);
    if (!isOneOf(category, revenueCategories)) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    totals.set(category, (totals.get(category) || 0) + Math.round(amount));
  });

  return [...totals.entries()].map(([category, amount]) => ({ category, amount }));
}

function replaceSplitMemo(currentMemo: string, splitMemo: string | null) {
  const preserved = currentMemo
    .split(" / ")
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("매출분리:"));

  return [...preserved, splitMemo].filter(Boolean).join(" / ");
}

function buildSplitMemo(splits: SplitInput[]) {
  return `매출분리:${splits.map((item) => `${item.category}=${item.amount}`).join("|")}`;
}

export async function PATCH(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  if (!canUpload(profileResult.profile.role)) {
    return NextResponse.json({ error: "매출 금액분리는 admin 또는 finance 권한만 가능합니다." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as SplitPayload;
    const transactionId = String(body.transactionId || "").trim();
    const splits = normalizeSplits(body.splits);

    if (!transactionId) {
      return NextResponse.json({ error: "금액을 분리할 거래가 없습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: row, error: fetchError } = await admin
      .from("transactions")
      .select("id,source,cash_flow_type,vendor,description,amount,memo")
      .eq("id", transactionId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!row) {
      return NextResponse.json({ error: "거래를 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.source !== "은행" || row.cash_flow_type !== "입금") {
      return NextResponse.json({ error: "은행 입금 거래만 매출 금액분리가 가능합니다." }, { status: 400 });
    }

    const currentMemo = String(row.memo || "");
    if (!isCiderpayRow(row) && !currentMemo.includes("매출분리:")) {
      return NextResponse.json({ error: "ciderpay 입금 거래만 금액분리가 가능합니다." }, { status: 400 });
    }

    const originalAmount = Math.round(Number(row.amount || 0));
    const splitTotal = splits.reduce((sum, item) => sum + item.amount, 0);
    if (splits.length > 0 && splitTotal !== originalAmount) {
      return NextResponse.json({ error: "분리 금액 합계가 원 입금액과 일치해야 합니다." }, { status: 400 });
    }

    const memo = replaceSplitMemo(currentMemo, splits.length > 0 ? buildSplitMemo(splits) : null);
    const { error: updateError } = await admin
      .from("transactions")
      .update({
        memo,
        updated_at: new Date().toISOString()
      })
      .eq("id", transactionId);

    if (updateError) throw updateError;

    revalidateTag("dashboard-data", { expire: 0 });
    ["/dashboard", "/revenue", "/bank", "/uploads"].forEach((path) => {
      revalidatePath(path);
    });

    return NextResponse.json({ ok: true, updatedCount: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "매출 금액분리 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
