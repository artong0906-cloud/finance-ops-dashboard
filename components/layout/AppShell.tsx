import Link from "next/link";
import { getAllowedUser } from "@/lib/auth/session";

const nav = [
  { href: "/dashboard", label: "메인 경영현황판" },
  { href: "/bank", label: "은행 입출금" },
  { href: "/cards", label: "카드 사용내역" },
  { href: "/expenses", label: "지출 분석" },
  { href: "/balance", label: "자산·자본·부채" },
  { href: "/uploads", label: "자료 업로드" },
  { href: "/admin", label: "관리자" }
];

export async function AppShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const { profile } = await getAllowedUser();

  return (
    <div className="min-h-screen grid grid-cols-[260px_minmax(0,1fr)] max-lg:grid-cols-1">
      <aside className="bg-white border-r border-[var(--line)] p-5 max-lg:border-r-0 max-lg:border-b">
        <div className="font-black text-2xl tracking-[-0.04em] mb-2">광고인 FinanceOps</div>
        <div className="rounded-2xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs font-bold text-blue-700 mb-5">
          {profile.name || profile.login_id || profile.email} · {profile.role}
        </div>
        <nav className="grid gap-2">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs leading-6 text-slate-500">
          아이디별 권한에 따라 업로드와 수정 권한을 제한합니다. 실제 로우데이터 업로드는 다음 단계에서 연결합니다.
        </div>
        <Link href="/auth/logout" className="btn w-full mt-4 text-center">로그아웃</Link>
      </aside>
      <main className="p-7 max-lg:p-4">
        <header className="mb-6 flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.05em]">{title}</h1>
            {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
          </div>
          <Link className="btn" href="/prototype-v11.html" target="_blank">v11 원본 보기</Link>
        </header>
        {children}
      </main>
    </div>
  );
}
