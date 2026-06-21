# FinanceOps Webapp v2 Auth

광고인 경영지원 대시보드 웹앱 2단계 골격입니다.

## v2 추가사항
- Supabase 이메일 로그인 연결
- 로그인하지 않은 사용자의 대시보드 접근 차단
- `allowed_users` 기반 접근 허용
- 로그아웃 기능
- 접근 거부 화면
- Tailwind 4 PostCSS 설정 수정
- 인증 정책 보정 SQL 추가

## 중요 파일
- `app/login/page.tsx`
- `app/login/LoginForm.tsx`
- `app/auth/callback/route.ts`
- `app/auth/logout/route.ts`
- `middleware.ts`
- `lib/supabase/server.ts`
- `lib/auth/session.ts`
- `database/migrations/20260617_auth_policy_fix.sql`
- `docs/STEP_02_AUTH_GUIDE.md`

## v4.2 Auth/Upload session fix

- 로그인 성공 후 client-side router 이동 대신 full reload로 이동해 Supabase cookie/session 반영을 안정화했습니다.
- 보호 페이지를 force-dynamic 처리해 로그인 상태가 정적 캐시/이전 redirect 상태로 남는 문제를 줄였습니다.
- v4.1 기업은행 미리보기 보정은 유지합니다.


## v4.4 Upload build type fix

- Fixed TypeScript strict build failure in `services/uploads/parse.ts` by explicitly typing the PapaParse error callback parameter.
- Keeps v4.1 bank preview parsing and v4.2 upload auth session fixes.

## v4.5 Deployment merge

- Merged dashboard UI shell changes from PR #3 with upload-save auth fixes from PR #1.
- Added stable unauthenticated landing/login card sizing for deployment preview checks.
- See `docs/DEPLOYMENT_CHECKLIST.md` before connecting GitHub and Vercel.
