export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireAdmin } from "@/lib/auth/session";
import { UserAdminPanel } from "./UserAdminPanel";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <AppShell title="관리자" description="아이디, 초기 비밀번호, 권한을 입력해 내부 사용자 계정을 생성합니다.">
      <UserAdminPanel />
      <section className="grid grid-cols-3 gap-4 max-md:grid-cols-1 mt-6">
        {["계좌 마스터", "카드 정책", "분류 규칙", "수정 이력", "환경 설정", "권한 정책"].map((title) => (
          <div className="card" key={title}>
            <h2 className="font-black text-lg">{title}</h2>
            <p className="text-sm text-slate-500 leading-6 mt-2">다음 단계에서 관리 화면으로 확장합니다.</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
