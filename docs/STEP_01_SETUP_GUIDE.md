# 1단계 실행 가이드: 사이트 골격 올리기

## 목표

이 단계의 목표는 완성된 대시보드가 아니라, 앞으로 계속 수정하고 배포할 수 있는 작업판을 만드는 것입니다.

완료 기준은 다음입니다.

- GitHub private 저장소에 코드가 올라간다.
- 로컬에서 `pnpm dev`로 실행된다.
- Vercel에 연결되어 임시 사이트 주소가 생긴다.
- Supabase 프로젝트와 환경변수 입력 위치를 준비한다.
- DB 설계 SQL을 Supabase에 실행할 수 있다.

## 1. 압축 해제

`finance_ops_webapp_v1.zip`을 다운로드하고 압축을 풉니다.

```bash
cd finance_ops_webapp_v1
```

## 2. 패키지 설치

```bash
pnpm install
```

`pnpm`이 없다면 먼저 설치합니다.

```bash
npm install -g pnpm
```

## 3. 로컬 실행

```bash
pnpm dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:3000
```

## 4. GitHub에 올리기

```bash
git init
git add .
git commit -m "Initial FinanceOps webapp scaffold"
git branch -M main
git remote add origin <GitHub repository URL>
git push -u origin main
```

저장소는 반드시 Private으로 유지합니다.

## 5. Supabase 준비

Supabase 프로젝트를 만들고 SQL editor에서 아래 순서대로 실행합니다.

1. `database/schema.sql`
2. `database/seed.sql`

`seed.sql`에는 최초 관리자 이메일 `artong0906@gmail.com`이 들어 있습니다.

## 6. 환경변수 설정

`.env.example`을 복사해서 `.env.local`을 만듭니다.

```bash
cp .env.example .env.local
```

Supabase 프로젝트의 URL과 anon key를 넣습니다.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

1단계에서는 화면이 mock data로 동작하므로, 환경변수가 없어도 일부 페이지 구조는 확인할 수 있습니다.

## 7. Vercel 연결

Vercel에서 GitHub 저장소를 선택하고 배포합니다. 환경변수는 Vercel Project Settings의 Environment Variables에 동일하게 넣습니다.

## 다음 단계

2단계에서는 다음을 구현합니다.

- Supabase Google 로그인 연결
- allowed_users 기준 접속 제한
- 은행/카드 업로드 화면 실제 작동
- 업로드 파일 미리보기
- 검증대기 상태 저장
