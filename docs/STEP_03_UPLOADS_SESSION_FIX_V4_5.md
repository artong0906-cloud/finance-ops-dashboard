# STEP 03 Uploads Session Fix v4.5

## 목적

`/uploads` 화면은 로그인 상태로 열리지만 `검증대기 저장` 버튼을 누르면 `로그인이 필요합니다.`가 표시되는 문제를 보정했습니다.

## 원인

브라우저 화면은 Supabase 쿠키 세션으로 보호 페이지 접근이 가능하지만, 업로드 저장 API는 Authorization Bearer 토큰만 우선 확인하고 있었습니다. 특정 배포/브라우저 환경에서 클라이언트 `getSession()` 토큰 전달이 불안정하면 같은 로그인 상태에서도 API가 401로 응답할 수 있습니다.

## 수정

- `/api/uploads`에서 Bearer token 확인 후 실패하면 Supabase server cookie 세션을 fallback으로 확인합니다.
- 업로드 화면 fetch 요청은 토큰이 없어도 같은 도메인 쿠키를 전송하도록 유지합니다.
- v4.1 기업은행 미리보기 보정 및 v4.4 빌드 타입 보정은 유지합니다.
