import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card max-w-2xl w-full">
        <div className="text-sm font-black text-blue-700 mb-3">FinanceOps Webapp v1</div>
        <h1 className="text-4xl font-black tracking-[-0.06em] mb-4">광고인 경영지원 대시보드</h1>
        <p className="text-slate-600 leading-7 mb-6">은행·카드·파로스 로우데이터를 업로드하고, 사업부별 매출/지출과 자산·부채·자본을 관리하기 위한 웹앱 1단계 골격입니다.</p>
        <div className="flex gap-3 flex-wrap">
          <Link className="btn btn-primary" href="/dashboard">대시보드 열기</Link>
          <Link className="btn" href="/login">로그인 화면 보기</Link>
          <Link className="btn" href="/prototype-v11.html" target="_blank">v11 원본 보기</Link>
        </div>
      </section>
    </main>
  );
}
