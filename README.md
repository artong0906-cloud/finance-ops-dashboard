# 광고인 FinanceOps Dashboard v1

경영지원팀의 은행·카드·파로스 로우데이터를 업로드하고, 사업부별 매출/지출과 자산·부채·자본을 관리하기 위한 Next.js 웹앱 1단계 골격입니다.

## 포함 내용

- Next.js App Router 구조
- 메인/은행/카드/지출/자산부채/업로드/관리자 페이지
- v11 프로토타입 원본 HTML: `public/prototype-v11.html`
- Supabase 연결 준비 파일
- DB 설계 SQL: `database/schema.sql`
- 초기 seed SQL: `database/seed.sql`
- mock data 기반 화면
- 1단계 실행 가이드: `docs/STEP_01_SETUP_GUIDE.md`

## 실행

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 다음 단계

2단계에서 Supabase 로그인, 업로드, 파일 미리보기, 검증대기 기능을 연결합니다.
