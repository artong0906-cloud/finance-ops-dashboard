import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card max-w-2xl w-full">
        <div className="text-sm font-black text-blue-700 mb-3">FinanceOps Webapp v3</div>
        <h1 className="text-4xl font-black tracking-[-0.06em] mb-4">광고인 경영지원 대시보드</h1>
        <p className="text-slate-600 leading-7 mb-6">아이디·비밀번호 로그인과 관리자 계정생성을 적용한 내부용 경영지원 대시보드입니다.</p>
        <div className="flex gap-3 flex-wrap">
          <Link className="btn btn-primary" href="/dashboard">대시보드 열기</Link>
          <Link className="btn" href="/login">로그인</Link>
          <Link className="btn" href="/setup-admin">초기 관리자 생성</Link>
          <Link className="btn" href="/prototype-v11.html" target="_blank">v11 원본 보기</Link>
        </div>
      </section>
    </main>
  );
}
