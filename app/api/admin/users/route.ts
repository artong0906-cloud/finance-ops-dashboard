import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPassword, loginIdToInternalEmail, normalizeLoginId } from "@/lib/auth/internal-email";

type CreateUserPayload = {
  loginId?: string;
  name?: string;
  password?: string;
  role?: "admin" | "finance" | "executive" | "viewer";
  status?: "active" | "inactive";
};

async function getAuthenticatedEmail(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();

  if (token) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data.user?.email) {
      return data.user.email;
    }
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (!authError && authData.user?.email) {
    return authData.user.email;
  }

  return null;
}

async function assertAdmin(request: NextRequest) {
  const email = await getAuthenticatedEmail(request);
  if (!email) {
    return { ok: false as const, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("allowed_users")
    .select("email,login_id,role,status")
    .eq("email", email)
    .eq("status", "active")
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }

  return { ok: true as const, profile };
}

export async function GET(request: NextRequest) {
  const adminCheck = await assertAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("allowed_users")
    .select("id,login_id,name,role,status,created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

export async function POST(request: NextRequest) {
  const adminCheck = await assertAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const body = (await request.json()) as CreateUserPayload;
    const loginId = normalizeLoginId(body.loginId || "");
    const name = (body.name || "").trim();
    const password = body.password || "";
    const role = body.role || "viewer";
    const status = body.status || "active";

    if (!loginId) return NextResponse.json({ error: "아이디를 입력하세요." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
    if (!isValidPassword(password)) return NextResponse.json({ error: "비밀번호는 최소 8자 이상이어야 합니다." }, { status: 400 });

    const internalEmail = loginIdToInternalEmail(loginId);
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("allowed_users")
      .select("id")
      .eq("login_id", loginId)
      .maybeSingle();

    if (existing) return NextResponse.json({ error: "이미 존재하는 아이디입니다." }, { status: 409 });

    const { error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { login_id: loginId, name, role }
    });
    if (createError) throw createError;

    const { error: upsertError } = await admin.from("allowed_users").upsert(
      {
        email: internalEmail,
        internal_email: internalEmail,
        login_id: loginId,
        name,
        role,
        status
      },
      { onConflict: "email" }
    );
    if (upsertError) throw upsertError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사용자 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
