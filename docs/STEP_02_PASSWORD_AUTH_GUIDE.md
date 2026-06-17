# STEP 02 — 아이디/비밀번호 로그인 적용 가이드

## 목표
이메일 링크 로그인을 사용하지 않고, 내부 관리자가 생성한 아이디와 비밀번호로 로그인합니다.

사용자 화면:

```text
아이디
비밀번호
[로그인]
```

관리자 화면:

```text
아이디
이름
초기 비밀번호
권한
상태
[계정 생성]
```

시스템 내부에서는 Supabase Auth 사용을 위해 자동으로 `아이디@financeops.local` 이메일을 생성합니다. 사용자는 이 이메일을 알 필요가 없습니다.

---

## 1. v3 파일 덮어쓰기

다운로드한 `finance_ops_webapp_v3_password_auth.zip` 압축을 풀고 기존 v1 폴더에 덮어씁니다.

```bash
cd ~/Downloads
unzip finance_ops_webapp_v3_password_auth.zip
rsync -av finance_ops_webapp_v3/ finance_ops_webapp_v1/
cd finance_ops_webapp_v1
```

---

## 2. Supabase SQL 실행

Supabase SQL Editor에서 아래 파일 내용을 실행합니다.

```text
database/migrations/20260617_login_id_password_auth.sql
```

성공 문구가 나오면 정상입니다.

```text
Success. No rows returned
```

---

## 3. Vercel 환경변수 추가

Vercel → Settings → Environment Variables에서 아래 값을 추가합니다.

```text
INITIAL_ADMIN_SETUP_KEY
```

값은 직접 정하면 됩니다. 예:

```text
financeops-setup-2026
```

이 값은 최초 관리자 생성 화면에서 한 번 입력합니다.

---

## 4. 로컬 실행 확인

```bash
pnpm install
pnpm dev
```

브라우저에서 확인합니다.

```text
http://localhost:3000
```

---

## 5. GitHub push

```bash
git status
git add .
git commit -m "Switch to login-id password auth"
git push
```

Vercel이 자동 배포합니다.

---

## 6. 최초 관리자 생성

배포 주소에서 아래로 접속합니다.

```text
https://배포주소/setup-admin
```

입력값:

```text
초기 관리자 생성키: Vercel에 넣은 INITIAL_ADMIN_SETUP_KEY
관리자 아이디: admin
이름: 후후
초기 비밀번호: 직접 설정
```

성공하면 로그인 화면으로 이동합니다.

---

## 7. 로그인

```text
아이디: admin
비밀번호: 방금 설정한 비밀번호
```

로그인 후 `/admin`에서 직원 계정을 생성합니다.

---

## 8. 직원 계정 생성 예시

```text
아이디: finance01
이름: 경영지원 담당자
초기 비밀번호: Abcd1234!
권한: finance
상태: active
```

직원은 로그인 화면에서 `finance01`과 비밀번호만 입력하면 됩니다.

---

## 권한 기준

| 권한 | 설명 |
|---|---|
| admin | 계정 생성, 권한 관리, 전체 수정 |
| finance | 업로드, 검증, 수정 |
| executive | 조회 중심 |
| viewer | 제한 조회 |

---

## 주의
- 공용 계정 하나를 여러 명이 함께 쓰지 마세요.
- 실제 로우데이터 업로드 전에는 반드시 로그인 제한을 확인하세요.
- `SUPABASE_SERVICE_ROLE_KEY`와 `INITIAL_ADMIN_SETUP_KEY`는 외부에 노출하지 마세요.
