# STEP 03 Build Fix - Upload Auth Session

## 목적
Vercel 배포 중 `app/api/uploads/route.ts`의 TypeScript 타입 검사 오류를 보정합니다.

## 원인
Supabase client의 제네릭 타입 추론이 `tableExists()` helper 함수와 맞지 않아 Vercel production build에서 타입 에러가 발생했습니다.

## 보정
- `tableExists()` 인자의 타입을 런타임 Supabase client로 안전하게 받을 수 있도록 완화했습니다.
- `/uploads` 인증 세션 보정은 v4.2 내용 그대로 유지했습니다.
- 기업은행 업로드 미리보기 보정은 v4.1 내용 그대로 유지했습니다.

## 적용 후 절차
```bash
cd ~/Downloads
unzip -o finance_ops_webapp_v4_3_upload_build_fix.zip
rsync -av finance_ops_webapp_v4_3/ finance_ops_webapp_v1/
cd ~/Downloads/finance_ops_webapp_v1
rm -rf .next
pnpm install
pnpm dev
```

정상 확인 후:
```bash
git status
git add .
git commit -m "Fix upload API build type error"
git push
```
