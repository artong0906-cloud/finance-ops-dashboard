import { AppShell } from "@/components/layout/AppShell";
import { UploadWorkspace } from "@/app/uploads/UploadWorkspace";

export default function UploadsPage() {
  return (
    <AppShell title="자료 업로드" description="은행, 카드, 파로스, 자산·부채 파일을 업로드하고 원본 저장·미리보기·1차 자동분류를 진행합니다.">
      <UploadWorkspace />
    </AppShell>
  );
}
