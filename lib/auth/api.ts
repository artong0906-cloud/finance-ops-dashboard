import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApiUserProfile = {
  email: string;
  login_id: string | null;
  internal_email: string | null;
  name: string | null;
  role: UserRole;
  status: "active" | "inactive";
};

type ApiUserResult =
  | { ok: true; user: User; profile: ApiUserProfile }
  | { ok: false; response: NextResponse };

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

async function getUserFromBearerToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

async function getUserFromRequestCookies(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        } catch {
          // Route handlers return their own responses; bearer token auth remains the primary path.
        }
      }
    }
  });

  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

async function getCurrentUser(request: NextRequest) {
  const token = getBearerToken(request);
  if (token) {
    const user = await getUserFromBearerToken(token);
    if (user?.email) return user;
  }

  const user = await getUserFromRequestCookies(request);
  return user?.email ? user : null;
}

export async function getApiUser(request: NextRequest): Promise<ApiUserResult> {
  const user = await getCurrentUser(request);
  if (!user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("allowed_users")
    .select("email,login_id,internal_email,name,role,status")
    .eq("email", user.email)
    .eq("status", "active")
    .maybeSingle<ApiUserProfile>();

  if (error || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "활성 사용자 권한이 없습니다." }, { status: 403 })
    };
  }

  return { ok: true, user, profile };
}
