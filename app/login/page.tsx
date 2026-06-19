import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/dashboard");
  } catch {
    // Keep the login page renderable even before local env vars are configured.
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card max-w-md w-full">
        <div className="text-sm font-black text-blue-700 mb-3">FinanceOps Login</div>
        <h1 className="text-2xl font-black">아이디 로그인</h1>
        <p className="mt-3 text-sm text-slate-500 leading-6">
          관리자가 생성한 아이디와 비밀번호로 접속합니다. 이메일 링크 로그인은 사용하지 않습니다.
        </p>
        <Suspense fallback={<div className="mt-6 text-sm text-slate-500">로그인 화면을 불러오는 중...</div>}>
          <LoginForm />
        </Suspense>
        <div className="mt-4 text-xs text-slate-500 leading-5">
          계정 생성은 관리자 메뉴에서만 가능합니다. 최초 관리자 계정은 /setup-admin에서 1회 생성하세요.
        </div>
      </section>
    </main>
  );
}
