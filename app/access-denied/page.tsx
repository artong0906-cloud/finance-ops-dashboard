import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card max-w-lg w-full">
        <div className="text-sm font-black text-red-600 mb-3">Access Denied</div>
        <h1 className="text-3xl font-black tracking-[-0.05em]">접근 권한이 없습니다</h1>
        <p className="mt-3 text-sm text-slate-500 leading-6">
          로그인은 되었지만 활성 사용자로 등록되어 있지 않습니다. 관리자에게 아이디 활성화 또는 권한 부여를 요청하세요.
        </p>
        <div className="mt-6 flex gap-3">
          <Link className="btn" href="/login">다시 로그인</Link>
          <Link className="btn btn-primary" href="/auth/logout">로그아웃</Link>
        </div>
      </section>
    </main>
  );
}
