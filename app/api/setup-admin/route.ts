import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPassword, loginIdToInternalEmail, normalizeLoginId } from "@/lib/auth/internal-email";

type SetupPayload = {
  setupKey?: string;
  loginId?: string;
  name?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    const setupKey = process.env.INITIAL_ADMIN_SETUP_KEY;
    if (!setupKey) {
      return NextResponse.json({ error: "INITIAL_ADMIN_SETUP_KEY 환경변수가 없습니다." }, { status: 500 });
    }

    const body = (await request.json()) as SetupPayload;
    if (body.setupKey !== setupKey) {
      return NextResponse.json({ error: "초기 관리자 생성키가 맞지 않습니다." }, { status: 401 });
    }

    const loginId = normalizeLoginId(body.loginId || "admin");
    const name = (body.name || "관리자").trim();
    const password = body.password || "";

    if (!loginId) return NextResponse.json({ error: "아이디를 입력하세요." }, { status: 400 });
    if (!isValidPassword(password)) return NextResponse.json({ error: "비밀번호는 최소 8자 이상이어야 합니다." }, { status: 400 });

    const internalEmail = loginIdToInternalEmail(loginId);
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("allowed_users")
      .select("id,login_id,role")
      .eq("login_id", loginId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "이미 같은 아이디가 존재합니다." }, { status: 409 });
    }

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        login_id: loginId,
        name,
        role: "admin"
      }
    });

    if (createError) throw createError;

    const { error: upsertError } = await admin.from("allowed_users").upsert(
      {
        email: internalEmail,
        internal_email: internalEmail,
        login_id: loginId,
        name,
        role: "admin",
        status: "active"
      },
      { onConflict: "email" }
    );

    if (upsertError) throw upsertError;

    return NextResponse.json({ ok: true, loginId, userId: createdUser.user?.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "초기 관리자 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
