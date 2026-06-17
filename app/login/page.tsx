export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card max-w-md w-full">
        <div className="text-sm font-black text-blue-700 mb-3">Login</div>
        <h1 className="text-3xl font-black tracking-[-0.05em]">로그인</h1>
        <p className="mt-3 text-sm text-slate-500 leading-6">2단계에서 Supabase Google 로그인을 연결합니다. 현재는 화면 골격만 준비되어 있습니다.</p>
        <button className="btn btn-primary w-full mt-6">Google 계정으로 로그인</button>
        <div className="mt-4 text-xs text-slate-500 leading-5">허용 이메일은 Supabase의 allowed_users 테이블에서 관리합니다.</div>
      </section>
    </main>
  );
}
