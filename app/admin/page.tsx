import { AppShell } from "@/components/layout/AppShell";

export default function AdminPage() {
  return (
    <AppShell title="관리자" description="허용 사용자, 계좌 마스터, 카드 정책, 분류 규칙을 관리합니다.">
      <section className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {["허용 사용자", "계좌 마스터", "카드 정책", "분류 규칙", "수정 이력", "환경 설정"].map((title) => (
          <div className="card" key={title}>
            <h2 className="font-black text-lg">{title}</h2>
            <p className="text-sm text-slate-500 leading-6 mt-2">2단계 이후 DB 연결 후 관리 화면으로 확장합니다.</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
