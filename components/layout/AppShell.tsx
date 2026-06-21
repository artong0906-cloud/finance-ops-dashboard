import Link from "next/link";
import {
  BarChart3,
  Building2,
  CreditCard,
  Database,
  FileUp,
  Gauge,
  Landmark,
  LogOut,
  Settings,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAllowedUser } from "@/lib/auth/session";

const nav: { href: string; label: string; kicker: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "경영현황", kicker: "Overview", icon: Gauge },
  { href: "/bank", label: "통장 입출금", kicker: "Cash", icon: Landmark },
  { href: "/cards", label: "카드 사용내역", kicker: "Cards", icon: CreditCard },
  { href: "/expenses", label: "지출 분석", kicker: "Expense", icon: BarChart3 },
  { href: "/balance", label: "자산/부채", kicker: "Balance", icon: WalletCards },
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
    <div className="min-h-screen bg-[var(--bg)] lg:grid lg:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="border-r border-[var(--line)] bg-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto max-lg:border-r-0 max-lg:border-b">
        <div className="flex h-full flex-col p-3">
          <Link href="/dashboard" className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-200">
              <Building2 size={19} />
            </span>
            <span>
              <span className="block text-sm font-black">광고인 FinanceOps</span>
              <span className="block text-[11px] font-bold text-slate-500">경영지원 대시보드</span>
            </span>
          </Link>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 text-white shadow-sm shadow-blue-100">
              <ShieldCheck size={16} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-black">{displayName}</div>
              <div className="mt-0.5 text-xs font-bold text-slate-500">{profile.role}</div>
            </div>
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-5 text-slate-500">
              로컬에서는 디자인 검토 모드로 바로 열립니다.
            </div>
          </div>

          <nav className="mt-5 grid gap-1 max-lg:flex max-lg:overflow-x-auto max-lg:pb-2">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = activePath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition max-lg:min-w-[150px] ${
                    active
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <Icon size={17} className={`shrink-0 ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-700"}`} />
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    <span className="block text-[11px] font-bold text-slate-400">{item.kicker}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-3 pt-5 max-lg:hidden">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-600">
                <Database size={14} />
                운영 기준
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="font-black text-slate-900">{periodLabel}</div>
                  <div className="mt-1 text-slate-500">집계월</div>
                </div>
                <div>
                  <div className="font-black text-slate-900">실데이터</div>
                  <div className="mt-1 text-slate-500">화면 기준</div>
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
