# FinanceOps 데이터 모델 v1

## 핵심 원칙

1. 은행 거래의 사업부는 통장 기준으로 확정한다.
2. 법인카드 거래의 최종 사업부는 파로스 분개 사업부 기준으로 확정한다.
3. 공통사용분은 별도 표기하고 광고사업부 지출에서 제외한다.
4. 내부이체는 현금흐름에는 표시하지만 매출/지출에서는 제외한다.
5. 자산/부채는 기초 + 증가 - 감소 = 기말 구조로 관리한다.
6. 자본은 총자산 - 총부채로 자동 계산한다.

## 주요 테이블

| 테이블 | 역할 |
|---|---|
| allowed_users | 접속 허용 사용자와 권한 |
| bank_account_master | 계좌별 사업부 매핑 |
| card_policy_master | 카드 예산그룹/공통사용분 기준 |
| upload_batches | 업로드 파일 이력 |
| transactions | 대시보드 통합 거래 데이터 |
| balance_movements | 자산·부채 증감 입력 |
| mapping_rules | 자동분류 규칙 |
| audit_logs | 수정 이력 |

## 거래 데이터 최종 컬럼

`transactions`에는 다음 기준값이 반드시 들어가야 합니다.

- source: 은행 / 카드 / 파로스 / 수기입력
- business_unit: 광고사업부 / 플랫폼 / 대외협력 / 공통사용분 / 미배분
- cash_flow_type: 입금 / 출금 / 내부이체 / 제외
- main_category: 매출 / 급여 / 광고비 / 세금 / 운영비 / 플랫폼 / 인재투자비 / 내부이체 등
- expense_basis: 비용성 / 자산성 / 해당없음
- is_internal_transfer
- is_common_use
- journal_status
- review_status

## 업로드 확정 전 상태

업로드된 데이터는 바로 대시보드에 반영하지 않습니다.

1. uploaded
2. previewed
3. validated
4. confirmed
5. rejected

`confirmed` 상태만 대시보드 집계에 반영합니다.
