import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

function safeNext(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(Array.isArray(params?.next) ? params?.next[0] : params?.next);

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) redirect(next);
  } catch {
    // Keep the login page renderable even before local env vars are configured.
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7fb] text-[#111827]">
      <section className="grid min-h-screen grid-cols-[minmax(0,1fr)_minmax(420px,31vw)] max-lg:grid-cols-1">
        <div className="login-money-hero">
          <div className="login-money-bg" aria-hidden="true" />
          <div className="login-money-vignette" aria-hidden="true" />
          <div className="login-money-particles" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="login-coin-field" aria-hidden="true">
            {["coin-main", "coin-a", "coin-b", "coin-c", "coin-d", "coin-e", "coin-f", "coin-g"].map((coin) => (
              <span className={`login-flying-coin ${coin}`} key={coin} />
            ))}
          </div>

          <div className="login-money-brand">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/12 shadow-[0_18px_38px_rgba(0,0,0,.22)] backdrop-blur">
              <img src="/brand-symbol.png" alt="광고인" className="h-9 w-9 object-contain" />
            </span>
            <div>
              <div className="text-sm font-black text-white">광고인</div>
              <div className="text-xs font-black tracking-[0.18em] text-[#d5b165]">FINANCE OPERATION</div>
            </div>
          </div>

          <div className="login-money-copy">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black text-[#f6d98c] shadow-sm backdrop-blur">
              <ShieldCheck size={14} />
              Private finance operation room
            </div>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[1.04] tracking-[-0.04em] text-white max-xl:text-4xl max-md:text-3xl">
              현금 흐름이 성장으로 이어지는 Finance Operation
            </h1>
            <p className="mt-5 max-w-2xl text-base font-bold leading-8 text-[#d9e3ef] max-md:text-sm max-md:leading-7">
              통장, 카드, 자산과 부채 데이터를 연결해 매출 유입부터 비용 통제, 현금 확보, 자본 성장까지 한 화면에서 읽습니다.
            </p>

            <div className="mt-7 h-px w-48 bg-gradient-to-r from-[#f6d98c] via-white/40 to-transparent" aria-hidden="true" />
          </div>

          <svg className="login-money-growth-line" viewBox="0 0 760 260" role="img" aria-label="재무 성장 흐름">
            <defs>
              <linearGradient id="moneyGrowthGradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#f2a65e" />
                <stop offset="54%" stopColor="#f6d98c" />
                <stop offset="100%" stopColor="#7ee7d6" />
              </linearGradient>
            </defs>
            <path className="login-money-growth-area" d="M52 206 C145 170 192 192 267 142 C344 91 406 125 482 82 C576 29 642 48 714 24 L714 235 L52 235 Z" />
            <path className="login-money-growth-path" d="M52 206 C145 170 192 192 267 142 C344 91 406 125 482 82 C576 29 642 48 714 24" />
            {[
              [52, 206],
              [267, 142],
              [482, 82],
              [714, 24]
            ].map(([cx, cy]) => (
              <circle className="login-money-growth-dot" cx={cx} cy={cy} r="7" key={`${cx}-${cy}`} />
            ))}
          </svg>

          <div className="login-money-flow" aria-label="재무 운영 순서">
            <span>매출 유입</span>
            <ArrowRight size={15} />
            <span>비용 통제</span>
            <ArrowRight size={15} />
            <span>현금 확보</span>
            <ArrowRight size={15} />
            <span>자본 성장</span>
          </div>
        </div>

        <aside className="relative flex min-h-screen items-center justify-center border-l border-white/80 bg-white/72 px-8 py-10 shadow-[-24px_0_80px_rgba(47,63,93,.08)] backdrop-blur-xl max-lg:min-h-auto max-lg:border-l-0 max-lg:border-t max-md:px-5">
          <section className="w-full max-w-md">
            <div className="mb-8 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-blue-100 bg-[#f3f7ff]">
                <img src="/brand-symbol.png" alt="광고인" className="h-10 w-10 object-contain" />
              </div>
              <div className="mt-5 text-xs font-black tracking-[0.24em] text-[#647896]">광고인 Finance Operation</div>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#111827]">로그인</h2>
              <p className="mt-3 text-sm font-bold leading-6 text-[#647084]">
                관리자에게 발급받은 아이디와 비밀번호로 접속합니다.
              </p>
            </div>

            <section className="rounded-3xl border border-[#dfe7f2] bg-white/86 p-6 shadow-[0_24px_70px_rgba(47,63,93,.12)]">
              <Suspense fallback={<div className="text-sm text-slate-500">로그인 화면을 불러오는 중...</div>}>
                <LoginForm />
              </Suspense>
            </section>

            <div className="mt-5 rounded-2xl border border-[#e4ebf5] bg-white/55 p-4 text-xs font-bold leading-6 text-[#647084]">
              계정 생성은 관리자 메뉴에서만 가능합니다. 최초 관리자 계정은 <span className="font-black text-[#2f5f9e]">/setup-admin</span>에서 1회 생성하세요.
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
