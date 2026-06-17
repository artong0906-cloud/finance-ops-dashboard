# FinanceOps Webapp v3 Password Auth

광고인 경영지원 대시보드 웹앱 3단계 골격입니다.

## v3 변경사항
- 이메일 링크 로그인 제거
- 아이디 + 비밀번호 로그인 적용
- 관리자 계정생성 화면 추가
- 사용자는 이메일을 입력하지 않음
- 내부적으로는 `아이디@financeops.local` 형식의 Supabase Auth 계정을 자동 생성
- 최초 관리자 생성용 `/setup-admin` 페이지 추가
- 관리자 전용 `/admin` 사용자 생성 기능 추가

## 중요 파일
- `app/login/page.tsx`
- `app/login/LoginForm.tsx`
- `app/setup-admin/page.tsx`
- `app/api/setup-admin/route.ts`
- `app/admin/UserAdminPanel.tsx`
- `app/api/admin/users/route.ts`
- `lib/auth/internal-email.ts`
- `lib/supabase/admin.ts`
- `database/migrations/20260617_login_id_password_auth.sql`
- `docs/STEP_02_PASSWORD_AUTH_GUIDE.md`

## 추가 환경변수
기존 Supabase 환경변수 3개 외에 최초 관리자 생성키를 추가합니다.

```env
INITIAL_ADMIN_SETUP_KEY=직접정한_초기관리자생성키
```

최초 관리자 계정을 만든 뒤에는 Vercel에서 이 값을 삭제하거나 다른 값으로 바꿔두는 것을 권장합니다.
