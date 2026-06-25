import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  Database,
  FileUp,
  Gauge,
  Landmark,
  LogOut,
  Settings,
  ShieldCheck,
  TrendingUp,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAllowedUser } from "@/lib/auth/session";

const nav: { href: string; label: string; kicker: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "경영현황", kicker: "Overview", icon: Gauge },
  { href: "/revenue", label: "매출 분석", kicker: "Revenue", icon: TrendingUp },
  { href: "/expenses", label: "지출 분석", kicker: "Expense", icon: BarChart3 },
  { href: "/balance", label: "자산/부채", kicker: "Balance", icon: WalletCards },
  { href: "/bank", label: "통장 입출금", kicker: "Cash", icon: Landmark },
  { href: "/cards", label: "카드 사용내역", kicker: "Cards", icon: CreditCard },
  { href: "/uploads", label: "업로드 검증", kicker: "Review", icon: FileUp },
  { href: "/admin", label: "관리자", kicker: "Admin", icon: Settings }
];

export async function AppShell({
  title,
  description,
  periodLabel = "2026-05",
  activePath,
  children
}: {
  title: string;
  description?: string;
  periodLabel?: string;
  activePath?: string;
  children: React.ReactNode;
}) {
  const { profile } = await getAllowedUser();
  const displayName = profile.name || profile.login_id || profile.email || "사용자";

  return (
    <div className="min-h-screen bg-[var(--bg)] lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
      <aside className="border-r border-[#d8e0ec] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_50%,#f7f9fc_100%)] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto max-lg:border-r-0 max-lg:border-b">
        <div className="flex h-full flex-col p-3">
          <Link
            href="/dashboard"
            className="group flex items-center gap-3 rounded-xl border border-white/80 bg-white/85 px-3 py-3 shadow-[0_12px_28px_rgba(47,95,158,.08)] transition hover:-translate-y-0.5 hover:border-[#c8d7ee] hover:bg-white"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f1f5ff] ring-1 ring-[#d7e3ff] transition group-hover:ring-[#b9ccf4]">
              <img src="/brand-symbol.png" alt="" className="h-8 w-8 object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-[#13233b]">광고인 파이낸스OPS</span>
              <span className="mt-0.5 block truncate text-[11px] font-bold text-[#647896]">경영지원 대시보드</span>
            </span>
          </Link>

          <div className="mt-4 rounded-xl border border-[#d9e5f4] bg-[linear-gradient(135deg,#ffffff_0%,#eef5ff_100%)] p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2f5f9e] text-white shadow-sm shadow-blue-100">
                <ShieldCheck size={16} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-[#13233b]">{displayName}</div>
                <div className="mt-0.5 text-xs font-bold text-[#647896]">{profile.role}</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[#dde7f3] bg-white/80 p-2 text-[11px] leading-5 text-[#647896]">
              로컬 디자인 검토 모드
            </div>
          </div>

          <nav className="mt-5 grid gap-1.5 max-lg:flex max-lg:overflow-x-auto max-lg:pb-2">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = activePath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition max-lg:min-w-[150px] ${
                    active
                      ? "bg-[#2f5f9e] text-white shadow-[0_12px_24px_rgba(47,95,158,.18)]"
                      : "text-[#526781] hover:bg-white/85 hover:text-[#13233b] hover:shadow-sm"
                  }`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                    active
                      ? "bg-white/15 text-white"
                      : "bg-white/70 text-[#8aa0b7] ring-1 ring-[#e0e8f2] group-hover:text-[#2f5f9e]"
                  }`}>
                    <Icon size={16} />
                  </span>
                  <span className={`min-w-0 ${active ? "text-white" : "text-[#526781] group-hover:text-[#13233b]"}`}>
                    <span className="block truncate">{item.label}</span>
                    <span className={`block text-[11px] font-bold ${active ? "text-white/65" : "text-[#8aa0b7]"}`}>{item.kicker}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-3 pt-5 max-lg:hidden">
            <div className="rounded-xl border border-[#d9e5f4] bg-white/75 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-black text-[#526781]">
                <Database size={14} />
                운영 기준
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="font-black text-[#13233b]">{periodLabel}</div>
                  <div className="mt-1 text-[#647896]">집계월</div>
                </div>
                <div>
                  <div className="font-black text-[#13233b]">실데이터</div>
                  <div className="mt-1 text-[#647896]">화면 기준</div>
                </div>
              </div>
            </div>
            <Link href="/auth/logout" className="btn w-full">
              <LogOut size={15} />
              로그아웃
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="border-b border-[var(--line)] bg-white/85 px-6 py-4 backdrop-blur max-md:px-4">
          <div className="flex items-center justify-between gap-4 max-xl:flex-col max-xl:items-start">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="badge badge-muted">FinanceOps</span>
                <span className="badge">{periodLabel}</span>
              </div>
              <h1 className="text-2xl font-black text-slate-950">{title}</h1>
              {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="surface flex min-h-[38px] items-center gap-2 px-3 text-sm font-bold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                운영
              </div>
              <Link className="btn btn-soft" href="/dashboard">
                실데이터 보기
              </Link>
              <Link href="/auth/logout" className="btn lg:hidden">
                <LogOut size={15} />
                로그아웃
              </Link>
            </div>
          </div>
        </header>

        <div className="px-6 py-6 max-md:px-4">
          {children}
        </div>
      </main>
    </div>
  );
}
