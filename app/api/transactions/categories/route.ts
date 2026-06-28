import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth/api";
import { canUpload } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

type CategoryMode = "revenue" | "expense";

type CategoryPayload = {
  transactionIds?: unknown;
  mode?: unknown;
  category?: unknown;
  detail?: unknown;
};

const revenueCategories = ["광고사업부 매출", "대외협력부 매출", "플랫폼 매출", "정부지원금", "기타매출"] as const;
const expenseCategories = ["인재투자", "환불", "급여", "광고비", "세금", "운영비", "기타"] as const;
const talentDetails = ["인투1 집", "인투2 차", "인투3 밥", "인투4 돈", "인투5 성장", "인투6 환경"] as const;
const operatingDetails = ["일반운영비", "이자"] as const;
const transferCategory = "통장간 이동";

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value);
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean))).slice(0, 500);
}

function businessUnitForRevenue(category: string) {
  if (category === "대외협력부 매출") return "대외협력";
  if (category === "플랫폼 매출") return "플랫폼";
  return "광고사업부";
}

function revenuePatch(category: string) {
  return {
    business_unit: businessUnitForRevenue(category),
    main_category: category === "정부지원금" || category === "기타매출" ? "영업외수익" : "매출",
    sub_category: category,
    detail_category: "수동분류",
    talent_investment_type: null,
    expense_basis: "해당없음",
    is_internal_transfer: false,
    is_common_use: false,
    common_policy: null,
    review_status: "정상"
  };
}

function transferPatch() {
  return {
    business_unit: "공통사용분",
    main_category: "계좌이체",
    sub_category: "계좌 간 이동",
    detail_category: "중복 집계 제외",
    talent_investment_type: null,
    expense_basis: "해당없음",
    is_internal_transfer: true,
    is_common_use: true,
    common_policy: null,
    review_status: "정상"
  };
}

function expensePatch(category: string, detail: string) {
  if (category === "인재투자") {
    const talentType = isOneOf(detail, talentDetails) ? detail : "인투1 집";
    return {
      main_category: "인재투자비",
      sub_category: talentType,
      detail_category: talentType,
      talent_investment_type: talentType,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "환불") {
    return {
      main_category: "매출환불",
      sub_category: "환불",
      detail_category: "환불/취소",
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "급여") {
    return {
      main_category: "인건비",
      sub_category: "급여",
      detail_category: detail || "급여",
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "광고비") {
    return {
      main_category: "광고비",
      sub_category: "매체비",
      detail_category: detail || "광고비",
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "세금") {
    return {
      main_category: "세금과공과",
      sub_category: "세금",
      detail_category: detail || "세금",
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  if (category === "운영비") {
    const operatingType = isOneOf(detail, operatingDetails) ? detail : "일반운영비";
    return {
      main_category: "운영비",
      sub_category: operatingType,
      detail_category: operatingType,
      talent_investment_type: null,
      expense_basis: "비용성",
      is_internal_transfer: false,
      review_status: "정상"
    };
  }

  return {
    main_category: "기타",
    sub_category: "기타",
    detail_category: detail || "기타",
    talent_investment_type: null,
    expense_basis: "비용성",
    is_internal_transfer: false,
    review_status: "정상"
  };
}

function buildPatch(mode: CategoryMode, category: string, detail: string) {
  if (category === transferCategory) {
    return transferPatch();
  }

  if (mode === "revenue") {
    if (!isOneOf(category, revenueCategories)) {
      throw new Error("지원하지 않는 매출 카테고리입니다.");
    }
    return revenuePatch(category);
  }

  if (!isOneOf(category, expenseCategories)) {
    throw new Error("지원하지 않는 지출 카테고리입니다.");
  }
  return expensePatch(category, detail);
}

function replaceManualMemo(currentMemo: string, manualMemo: string) {
  const preserved = currentMemo
    .split(" / ")
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("수동분류:"));

  return [...preserved, manualMemo].join(" / ");
}

export async function PATCH(request: NextRequest) {
  const profileResult = await getApiUser(request);
  if (!profileResult.ok) return profileResult.response;

  if (!canUpload(profileResult.profile.role)) {
    return NextResponse.json({ error: "카테고리 변경은 admin 또는 finance 권한만 가능합니다." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CategoryPayload;
    const transactionIds = normalizeIds(body.transactionIds);
    const mode = String(body.mode || "") as CategoryMode;
    const category = String(body.category || "").trim();
    const detail = String(body.detail || "").trim();

    if (transactionIds.length === 0) {
      return NextResponse.json({ error: "선택된 거래가 없습니다." }, { status: 400 });
    }
    if (mode !== "revenue" && mode !== "expense") {
      return NextResponse.json({ error: "카테고리 변경 모드가 올바르지 않습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const patch = buildPatch(mode, category, detail);
    const manualMemo = `수동분류:${category}${detail ? `:${detail}` : ""}`;

    const { data: existingRows, error: fetchError } = await admin
      .from("transactions")
      .select("id,memo")
      .in("id", transactionIds);

    if (fetchError) throw fetchError;

    let updatedCount = 0;
    for (const row of existingRows || []) {
      const currentMemo = String(row.memo || "");
      const memo = replaceManualMemo(currentMemo, manualMemo);

      const { error } = await admin
        .from("transactions")
        .update({
          ...patch,
          memo,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);

      if (error) throw error;
      updatedCount += 1;
    }

    revalidateTag("dashboard-data", { expire: 0 });

    return NextResponse.json({ ok: true, updatedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "카테고리 변경 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
