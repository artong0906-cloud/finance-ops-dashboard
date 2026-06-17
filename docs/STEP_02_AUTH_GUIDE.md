# STEP 02. 로그인 기능 연결 가이드

## 목표
- 로그인하지 않은 사용자는 `/login`으로 이동
- Supabase `allowed_users`에 등록된 active 이메일만 대시보드 접근
- 로그인 후 좌측 메뉴에 사용자 이메일/role 표시
- 로그아웃 가능

## Supabase에서 먼저 할 일
1. SQL Editor에서 `database/migrations/20260617_auth_policy_fix.sql` 실행
2. Authentication > URL Configuration에서 아래 URL 등록
   - Site URL: Vercel 배포 주소
   - Redirect URL: `https://배포주소/auth/callback`
3. Authentication > Providers > Email 이 활성화되어 있는지 확인

## 로컬에서 확인할 일
1. `.env.local` 파일 생성
2. 아래 값 입력
```
NEXT_PUBLIC_SUPABASE_URL=https://프로젝트.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=publishable_key
SUPABASE_SERVICE_ROLE_KEY=secret_key
```
3. `pnpm install`
4. `pnpm dev`
5. `/login`에서 이메일 입력

## 배포
1. 변경사항 commit
2. GitHub push
3. Vercel 자동 배포 확인
