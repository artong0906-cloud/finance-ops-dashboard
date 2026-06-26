import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/dashboard",
  "/revenue",
  "/bank",
  "/cards",
  "/expenses",
  "/balance",
  "/uploads",
  "/admin"
];

function isLocalDesignReview(request: NextRequest) {
  const host = request.nextUrl.hostname;
  return process.env.NODE_ENV === "development" && (host === "127.0.0.1" || host === "localhost");
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token") && Boolean(cookie.value));
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("next", pathname);
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) return NextResponse.next();
  if (isLocalDesignReview(request)) return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const response = NextResponse.redirect(new URL("/login?error=missing-env", request.url));
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }

  if (!hasSupabaseAuthCookie(request)) {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|prototype-v11.html).*)"]
};
