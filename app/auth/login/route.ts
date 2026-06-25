import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { loginIdToInternalEmail } from "@/lib/auth/internal-email";

function safeNext(value: unknown) {
  const next = typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
  return next;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase 환경변수가 없습니다." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const loginId = String(body.loginId || "").trim();
  const password = String(body.password || "");
  const next = safeNext(body.next);

  if (!loginId || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, next });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            path: options?.path || "/",
            sameSite: options?.sameSite || "lax"
          });
        });
      }
    }
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: loginIdToInternalEmail(loginId),
    password
  });

  if (error) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  return response;
}
