import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ArrowUpRight, BarChart3, CheckCircle2, Landmark, ShieldCheck, WalletCards } from "lucide-react";
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
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(next);
  } catch {
    // Keep the login page renderable even before local env vars are configured.
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_12%,#dbeafe_0%,transparent_28%),linear-gradient(135deg,#f7faff_0%,#eef4fb_46%,#f9fbfd_100%)] text-[#111827]">
      <section className="grid min-h-screen grid-cols-[minmax(0,1fr)_minmax(420px,31vw)] max-lg:grid-cols-1">
        <div className="relative min-h-screen overflow-hidden px-8 py-7 max-lg:min-h-[620px] max-md:px-5">
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent_0%,rgba(221,231,243,.72)_100%)]" />
          <div className="relative z-10 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-100 bg-white/85 shadow-[0_18px_38px_rgba(47,95,158,.16)]">
              <img src="/brand-symbol.png" alt="광고인" className="h-9 w-9 object-contain" />
            </span>
            <div>
              <div className="text-sm font-black text-[#14233b]">광고인</div>
              <div className="text-xs font-black tracking-[0.18em] text-[#647896]">FINANCE OPERATION</div>
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-16 grid max-w-5xl place-items-center text-center max-lg:mt-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3 py-1.5 text-xs font-black text-[#2f5f9e] shadow-sm backdrop-blur">
              <ShieldCheck size={14} />
              Private finance operation room
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-[-0.03em] text-[#111827] max-md:text-3xl">
              경영 흐름을 한 화면에서 읽는 재무 컨트롤룸
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-[#647084]">
              통장, 카드, 자산과 부채 데이터를 연결해 월간 자금 흐름과 운영 지표를 빠르게 확인합니다.
            </p>
          </div>

          <div className="relative z-10 mx-auto mt-12 max-w-5xl">
            <div className="login-visual-shell">
              <div className="login-glow login-glow-a" />
              <div className="login-glow login-glow-b" />

              <div className="login-float-card login-float-a">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf2ff] text-[#2f5f9e]"><Landmark size={18} /></span>
                <div>
                  <div className="text-[11px] font-black text-[#647896]">Cash Balance</div>
                  <div className="mt-1 text-lg font-black text-[#13233b]">4.8억</div>
                </div>
              </div>

              <div className="login-float-card login-float-b">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e9f8f6] text-[#327f98]"><WalletCards size={18} /></span>
                <div>
                  <div className="text-[11px] font-black text-[#647896]">Equity Ratio</div>
                  <div className="mt-1 text-lg font-black text-[#13233b]">41%</div>
                </div>
              </div>

              <div className="login-dashboard-card">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#8aa0b7]">May Closing</div>
                    <div className="mt-1 text-2xl font-black text-[#111827]">FinanceOps Board</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-black text-[#138a61]">
                    <CheckCircle2 size={13} />
                    Synced
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                  {[
                    ["입금", "8.7억", "#2f5f9e"],
                    ["출금", "9.3억", "#f2a65e"],
                    ["자본", "30.5억", "#327f98"]
                  ].map(([label, value, color]) => (
                    <div className="rounded-2xl border border-[#dbe4ef] bg-white/72 p-4 shadow-sm" key={label}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#647896]">{label}</span>
                        <ArrowUpRight size={14} style={{ color }} />
                      </div>
                      <div className="mt-3 text-2xl font-black text-[#111827]">{value}</div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf2f7]">
                        <div className="h-full rounded-full" style={{ width: label === "출금" ? "72%" : label === "입금" ? "66%" : "58%", backgroundColor: color }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-[#dbe4ef] bg-[#f8fbff]/80 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-[#13233b]">월간 자금 흐름</div>
                      <div className="mt-1 text-xs font-bold text-[#647896]">최근 거래일 기준 입금/출금</div>
                    </div>
                    <BarChart3 size={20} className="text-[#8aa0b7]" />
                  </div>
                  <div className="login-bars" aria-hidden="true">
                    {[32, 48, 24, 62, 42, 86, 58, 76, 30, 40].map((height, index) => (
                      <div className="login-bar-pair" key={index}>
                        <span style={{ height: `${height}%` }} />
                        <span style={{ height: `${Math.max(14, 92 - height)}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
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
