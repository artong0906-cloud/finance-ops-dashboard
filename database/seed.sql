insert into allowed_users (email, name, role, status) values
('artong0906@gmail.com', '후후', 'admin', 'active')
on conflict (email) do update set name = excluded.name, role = excluded.role, status = excluded.status;

insert into bank_account_master (id, bank_name, account_name, account_no_masked, business_unit, purpose, status) values
('BANK_AD_001', '기업은행', '광고사업 운영통장', '***1234', '광고사업부', '광고사업 매출/지출', 'active'),
('BANK_PLATFORM_001', '기업은행', '플랫폼 운영통장', '***5678', '플랫폼', '플랫폼 매출/지출', 'active'),
('BANK_PARTNER_001', '하나은행', '대외협력 운영통장', '***9012', '대외협력', '대외협력 매출/지출', 'active'),
('BANK_COMMON_001', '신한은행', '공통 운영통장', '***0000', '공통사용분', '공통비/내부이체', 'active')
on conflict (id) do update set
bank_name = excluded.bank_name,
account_name = excluded.account_name,
account_no_masked = excluded.account_no_masked,
business_unit = excluded.business_unit,
purpose = excluded.purpose,
status = excluded.status;

insert into card_policy_master (card_budget_group, default_business_unit, common_policy, memo) values
('리더법인카드 예산', '광고사업부', null, '분개 전 임시 기본값. 최종은 파로스 분개 사업부 기준'),
('파트장 법인카드 예산', '광고사업부', null, '분개 전 임시 기본값. 최종은 파로스 분개 사업부 기준'),
('목표달성 팀카드 예산', '광고사업부', null, '팀 소속 기준'),
('메인 법인카드 예산', '공통사용분', '광고사업부 제외', '공통사용분은 별도 표기'),
('PO 법인카드 예산', '플랫폼', null, 'PO/프로젝트 소속 기준'),
('예산 제외 결제내역', '공통사용분', '광고사업부 제외', '예산 제외 관리'),
('출장 결제내역', '미배분', null, '출장 목적 사업부 확인 필요'),
('대표자 카드 사용내역', '공통사용분', '광고사업부 제외', '대표자 카드 별도 표시');
