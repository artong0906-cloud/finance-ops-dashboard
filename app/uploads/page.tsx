import { AppShell } from "@/components/layout/AppShell";

export default function UploadsPage() {
  const items = [
    ["은행 입출금", "기업은행, 하나은행, 신한/한투 입출금 엑셀"],
    ["카드 사용내역", "매입신용카드, 법인카드 사용내역"],
    ["파로스 전표", "파로스 분개 export"],
    ["자산·부채 증감", "기초, 증가, 감소 입력 템플릿"]
  ];
  return (
    <AppShell title="자료 업로드" description="2단계에서 실제 파일 업로드, 미리보기, 컬럼매핑, 검증대기 기능을 연결합니다.">
      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        {items.map(([title, desc]) => (
          <div className="card" key={title}>
            <h2 className="font-black text-lg">{title}</h2>
            <p className="text-sm text-slate-500 leading-6 mt-2">{desc}</p>
            <button className="btn mt-4 w-full">업로드 준비중</button>
          </div>
        ))}
      </section>
      <section className="card mt-6">
        <h2 className="text-xl font-black tracking-[-0.04em] mb-3">업로드 운영 원칙</h2>
        <ol className="list-decimal pl-5 text-sm text-slate-600 leading-8">
          <li>원본 파일은 먼저 저장한다.</li>
          <li>미리보기와 컬럼 자동인식 후 검증대기 상태로 둔다.</li>
          <li>확인필요 거래를 수정한 뒤 확정한다.</li>
          <li>확정된 데이터만 대시보드에 반영한다.</li>
        </ol>
      </section>
    </AppShell>
  );
}
