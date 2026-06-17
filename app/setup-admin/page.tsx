export const dynamic = "force-dynamic";

import Link from "next/link";
import { SetupAdminForm } from "./SetupAdminForm";

export default function SetupAdminPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card max-w-md w-full">
        <div className="text-sm font-black text-blue-700 mb-3">Initial Setup</div>
        <h1 className="text-3xl font-black tracking-[-0.05em]">초기 관리자 생성</h1>
        <p className="mt-3 text-sm text-slate-500 leading-6">
          최초 1회 관리자 아이디를 생성합니다. Vercel 환경변수 INITIAL_ADMIN_SETUP_KEY에 넣은 값이 필요합니다.
        </p>
        <SetupAdminForm />
        <div className="mt-5 flex gap-3">
          <Link href="/login" className="btn">로그인으로 이동</Link>
        </div>
      </section>
    </main>
  );
}
