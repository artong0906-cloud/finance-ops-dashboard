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
