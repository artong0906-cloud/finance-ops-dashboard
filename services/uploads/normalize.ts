import { classifyFirstPass, type BusinessUnitValue, type ExpenseBasisValue, type UserMappingRule } from "@/services/classification/firstPass";

export type UploadType = "bank" | "card" | "pharos" | "balance" | "mixed";
export type PersistedUploadType = Exclude<UploadType, "mixed">;

export type NormalizedTransaction = {
  transaction_date: string;
  source: "은행" | "카드" | "파로스" | "수기입력";
  business_unit: BusinessUnitValue;
  account_id?: string | null;
  card_budget_group?: string | null;
  vendor: string | null;
  description: string | null;
  amount: number;
  cash_flow_type: "입금" | "출금" | "내부이체" | "제외";
  main_category: string | null;
  sub_category: string | null;
  detail_category?: string | null;
  talent_investment_type?: string | null;
  expense_basis?: ExpenseBasisValue | null;
  is_internal_transfer?: boolean;
  is_common_use?: boolean;
  common_policy?: string | null;
  review_status: "정상" | "확인필요" | "보류" | "확정";
  memo: string | null;
};

export type NormalizedBalanceMovement = {
  month: string;
  statement_type: "자산" | "부채";
  category: string;
  opening_amount: number;
  increase_amount: number;
  decrease_amount: number;
  memo: string | null;
};

export type NormalizedUploadRow = {
  rowIndex: number;
  rawData: Record<string, string>;
  normalizedData: Record<string, unknown>;
  parseStatus: "정상" | "확인필요" | "오류";
  memo: string | null;
  transaction: NormalizedTransaction | null;
  balanceMovement: NormalizedBalanceMovement | null;
};

const sheetNameKeys = ["__sheetName"];
const detectedMonthKeys = ["__detectedMonth"];
const dateKeys = ["거래일자", "거래일시", "거래일", "거래일자(년월일)", "승인일자", "이용일자", "사용일자", "전표일자", "일자", "날짜", "date"];
const monthKeys = ["__detectedMonth", "월", "기준월", "집계월", "마감월", "month", "기간"];
const statementTypeKeys = ["구분", "재무구분", "자산부채구분", "statement_type"];
const balanceCategoryKeys = ["항목", "계정", "계정과목", "분류", "자산항목", "부채항목", "category"];
const openingAmountKeys = ["기초", "기초금액", "전월말", "전월잔액", "opening_amount"];
const increaseAmountKeys = ["증가", "증가금액", "당월증가", "차변", "increase_amount"];
const decreaseAmountKeys = ["감소", "감소금액", "당월감소", "대변", "decrease_amount"];
const balanceMemoKeys = ["메모", "비고", "상세", "세부항목", "적요", "memo"];
const vendorKeys = ["거래처", "가맹점명", "사용처", "상호", "업체명", "거래상대방", "받는분", "보내는분", "예금주", "상대계좌예금주명", "상대예금주명", "vendor"];
const descriptionKeys = ["적요", "거래내용", "기재내용", "내용", "내역", "거래구분", "거래명", "비고", "품목", "메모", "입금의뢰인", "출금계좌인자내용", "description"];
const amountKeys = ["금액", "거래금액", "거래 금액", "승인금액", "이용금액", "사용금액", "합계", "amount"];
const incomeKeys = ["입금", "입금액", "입금금액", "입금 금액", "수입", "대변"];
const outcomeKeys = ["출금", "출금액", "출금금액", "출금 금액", "지출", "차변"];
const businessUnitKeys = ["사업부", "사업단위", "귀속사업부", "부서", "business_unit"];
const cardBudgetGroupKeys = ["카드사", "카드회사", "카드명", "카드구분", "카드사/사용자", "card_budget_group"];
const cardSignalKeys = ["카드사", "카드회사", "카드명", "카드구분", "카드사/사용자", "카드번호", "승인번호", "승인구분", "card_budget_group"];
const bankAccountKeys = ["계좌", "계좌번호", "입금계좌", "출금계좌", "통장", "은행", "account_id"];
const bankBalanceKeys = ["잔액", "거래후잔액", "거래 후 잔액", "현재잔액", "balance"];
const cashFlowHintKeys = ["입출금", "입지급", "거래구분", "구분", "현금흐름", "cash_flow_type"];
const mainCategoryKeys = ["대분류", "분류", "계정과목", "계정", "main_category"];
const subCategoryKeys = ["중분류", "소분류", "세부분류", "sub_category"];
const sourceHintKeys = ["__sheetName", "자료유형", "자료 구분", "원천", "출처", "source", "업로드유형", "데이터구분"];
const knownBankAccountIds = new Set(["BANK_AD_001", "BANK_PLATFORM_001", "BANK_PARTNER_001", "BANK_COMMON_001"]);

function compact(value: string) {
  return String(value || "").replace(/\s/g, "").toLowerCase();
}

function inferMonthFromText(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const fullMatches = Array.from(raw.matchAll(/(20\d{2}|19\d{2})[.\-/년\s]*(\d{1,2})\s*월?/g));
  if (fullMatches.length === 1) {
    const [, year, month] = fullMatches[0];
    return `${year}-${month.padStart(2, "0")}`;
  }

  const monthMatches = Array.from(raw.matchAll(/(?:^|[^0-9])(\d{1,2})\s*월/g))
    .map((match) => Number(match[1]))
    .filter((month) => month >= 1 && month <= 12);
  const uniqueMonths = Array.from(new Set(monthMatches));
  if (uniqueMonths.length === 1) {
    return `${new Date().getFullYear()}-${String(uniqueMonths[0]).padStart(2, "0")}`;
  }

  return "";
}

function pick(row: Record<string, string>, keys: string[]) {
  const entries = Object.entries(row);
  const targets = keys.map((key) => compact(key));

  for (const target of targets) {
    const exact = entries.find(([key]) => compact(key) === target);
    if (exact && exact[1]) return exact[1];
  }

  for (const target of targets) {
    const partial = entries.find(([key, value]) => {
      const normalizedKey = compact(key);
      return value && (normalizedKey.includes(target) || target.includes(normalizedKey));
    });
    if (partial) return partial[1];
  }

  return "";
}

function hasHeader(row: Record<string, string>, keys: string[]) {
  const headerText = compact(Object.keys(row).join(" "));
  return keys.some((key) => headerText.includes(compact(key)));
}

function hasValue(row: Record<string, string>, keys: string[]) {
  return Boolean(String(pick(row, keys) || "").trim());
}

function hasAmountValue(row: Record<string, string>, keys: string[]) {
  return Math.abs(parseAmount(pick(row, keys))) > 0;
}

export function inferMixedUploadType(row: Record<string, string>): PersistedUploadType {
  const sourceHint = compact(pick(row, sourceHintKeys));
  const hasBankAmount = hasAmountValue(row, incomeKeys) || hasAmountValue(row, outcomeKeys);
  const hasBankValue = hasBankAmount || hasValue(row, bankBalanceKeys) || hasValue(row, bankAccountKeys);
  const hasCardValue = hasValue(row, cardSignalKeys);
  const hasBalanceValue = hasValue(row, statementTypeKeys) && hasValue(row, balanceCategoryKeys);
  const hasBankTransactionHeader = hasHeader(row, ["거래일자", "입금", "출금", "거래후잔액", "거래 후 잔액", "입금의뢰인", "출금계좌인자내용"]);
  const hasBalanceTemplateHeader = hasHeader(row, ["기초금액", "전월잔액", "당월증가", "당월감소", "자산부채구분", "opening_amount", "increase_amount", "decrease_amount"]);
  const sourceSaysBalance = sourceHint.includes("자산")
    || sourceHint.includes("부채")
    || sourceHint.includes("현금성자산")
    || sourceHint.includes("유무형자산")
    || sourceHint.includes("무형자산")
    || sourceHint.includes("유형자산")
    || sourceHint.includes("비품")
    || sourceHint.includes("보증금")
    || sourceHint.includes("대여금")
    || sourceHint.includes("대출")
    || sourceHint.includes("balance");
  const sourceSaysBank = sourceHint.includes("은행")
    || sourceHint.includes("통장")
    || sourceHint.includes("계좌")
    || sourceHint.includes("입출금")
    || sourceHint.includes("입출")
    || sourceHint.includes("예금")
    || sourceHint.includes("bank")
    || sourceHint.includes("입금")
    || sourceHint.includes("출금")
    || sourceHint.includes("입지급");
  const sourceSaysCard = sourceHint.includes("카드")
    || sourceHint.includes("승인")
    || sourceHint.includes("가맹점")
    || sourceHint.includes("card");

  if ((sourceSaysBank || hasBankTransactionHeader || (hasBankValue && !sourceSaysBalance)) && !hasBalanceTemplateHeader) return "bank";
  if (sourceSaysBalance || hasBalanceValue || hasBalanceTemplateHeader) return "balance";
  if (hasBankValue || sourceSaysBank) return "bank";
  if (hasCardValue) return "card";
  if (sourceSaysCard) return "card";
  if (hasBalanceValue) return "balance";

  if (sourceHint.includes("파로스") || sourceHint.includes("분개") || sourceHint.includes("전표") || sourceHint.includes("pharos")) return "pharos";
  if (hasHeader(row, ["기초금액", "전월잔액", "당월증가", "당월감소", "자산부채구분", "statement_type"])) return "balance";
  if (hasHeader(row, ["전표일자", "분개"]) && (hasAmountValue(row, ["차변"]) || hasAmountValue(row, ["대변"]))) return "pharos";
  if (hasHeader(row, ["승인일자", "이용일자", "사용일자", "가맹점명", "카드사", "카드명", "카드사/사용자"])) return "card";

  return "bank";
}

export function parseAmount(value: string) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return 0;

  const isNegativeByParentheses = /^\(.*\)$/.test(raw);
  const normalized = raw
    .replace(/원/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[()]/g, "")
    .replace(/[^0-9.-]/g, "");

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
  return isNegativeByParentheses ? -Math.abs(amount) : amount;
}

function normalizeDate(value: string, fallbackMonth = "") {
  const raw = String(value || "").trim();
  if (!raw && !fallbackMonth) return "";

  const match = raw.match(/(20\d{2}|19\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  if (fallbackMonth) {
    const [year, fallbackMonthNumber] = fallbackMonth.split("-");
    const monthDay = raw.match(/(?:^|[^0-9])(\d{1,2})[.\-/월\s]+(\d{1,2})\s*일?(?:[^0-9]|$)/);
    if (monthDay) {
      const [, month, day] = monthDay;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    const dayOnly = raw.match(/(?:^|[^0-9])(\d{1,2})\s*일?(?:[^0-9]|$)/);
    if (dayOnly) {
      const day = dayOnly[1];
      return `${year}-${fallbackMonthNumber}-${day.padStart(2, "0")}`;
    }
  }

  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 25000 && serial < 90000) {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return "";
}

function normalizeMonth(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^(20\d{2}|19\d{2})-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/(20\d{2}|19\d{2})[.\-/년\s]*(\d{1,2})/);
  if (match) {
    const [, y, m] = match;
    return `${y}-${m.padStart(2, "0")}`;
  }

  const inferred = inferMonthFromText(raw);
  if (inferred) return inferred;

  const date = normalizeDate(raw);
  return date ? date.slice(0, 7) : "";
}

function normalizeStatementType(value: string) {
  const raw = String(value || "").trim();
  if (raw.includes("부채")) return "부채" as const;
  if (raw.includes("자산")) return "자산" as const;
  return null;
}

function normalizeBalanceCategory(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/토지|비품|차량|건물|시설|전자칠판|나스|장비|집기/.test(raw)) return raw.replace(/무형자산/g, "유형자산");
  return raw;
}

function normalizeBusinessUnit(value: string): NormalizedTransaction["business_unit"] {
  if (value.includes("플랫폼")) return "플랫폼";
  if (value.includes("대외")) return "대외협력";
  if (value.includes("공통")) return "공통사용분";
  if (value.includes("광고")) return "광고사업부";
  return "미배분";
}

function persistedAccountId(uploadType: UploadType, value?: string | null) {
  if (uploadType !== "bank") return null;
  const accountId = String(value || "").trim();
  return knownBankAccountIds.has(accountId) ? accountId : null;
}

function sourceByType(uploadType: UploadType): NormalizedTransaction["source"] {
  if (uploadType === "bank") return "은행";
  if (uploadType === "card") return "카드";
  if (uploadType === "pharos") return "파로스";
  return "수기입력";
}

function hasLikelyTransactionSignal(row: Record<string, string>) {
  const joined = Object.values(row).join(" ").trim();
  if (!joined || joined === "-") return false;
  if (/^(\d+|-)$/.test(joined)) return false;
  return true;
}

function getAmountAndFlow(row: Record<string, string>, uploadType: UploadType) {
  const income = parseAmount(pick(row, incomeKeys));
  const outcome = parseAmount(pick(row, outcomeKeys));
  const flowHint = compact(pick(row, cashFlowHintKeys));

  if (income > 0 || outcome > 0) {
    if (income >= outcome && income > 0) return { amount: income, cashFlowType: "입금" as const };
    return { amount: outcome, cashFlowType: "출금" as const };
  }

  const amount = parseAmount(pick(row, amountKeys));
  if (uploadType === "card") return { amount: Math.abs(amount), cashFlowType: "출금" as const };
  if (amount < 0) return { amount: Math.abs(amount), cashFlowType: "출금" as const };
  if (flowHint.includes("출금") || flowHint.includes("지급") || flowHint === "출") return { amount: Math.abs(amount), cashFlowType: "출금" as const };
  if (flowHint.includes("입금") || flowHint.includes("수입") || flowHint === "입") return { amount: Math.abs(amount), cashFlowType: "입금" as const };
  return { amount: Math.abs(amount), cashFlowType: amount >= 0 ? ("입금" as const) : ("출금" as const) };
}

function inferMemo(missing: string[]) {
  if (missing.length === 0) return null;
  return `자동 인식 필요: ${missing.join(", ")}`;
}

function normalizeBalanceRow(row: Record<string, string>) {
  const sheetName = pick(row, sheetNameKeys);
  const detectedMonth = pick(row, detectedMonthKeys) || inferMonthFromText(sheetName);
  const month = normalizeMonth(pick(row, monthKeys) || pick(row, dateKeys) || detectedMonth || sheetName);
  const statementType = normalizeStatementType(pick(row, statementTypeKeys));
  const category = normalizeBalanceCategory(pick(row, balanceCategoryKeys));
  const openingAmount = parseAmount(pick(row, openingAmountKeys));
  const increaseAmount = parseAmount(pick(row, increaseAmountKeys));
  const decreaseAmount = parseAmount(pick(row, decreaseAmountKeys));
  const memo = pick(row, balanceMemoKeys) || null;

  const missing: string[] = [];
  if (!hasLikelyTransactionSignal(row)) missing.push("거래행 아님");
  if (!month) missing.push("기준월");
  if (!statementType) missing.push("자산/부채 구분");
  if (!category) missing.push("항목");

  const parseStatus: NormalizedUploadRow["parseStatus"] = missing.length === 0 ? "정상" : "확인필요";
  const baseMemo = inferMemo(missing);
  const finalMemo = [memo, baseMemo].filter(Boolean).join(" / ") || null;

  return {
    parseStatus,
    memo: finalMemo,
    balanceMovement: month && statementType && category
      ? {
          month,
          statement_type: statementType,
          category,
          opening_amount: openingAmount,
          increase_amount: increaseAmount,
          decrease_amount: decreaseAmount,
          memo: finalMemo
        }
      : null,
    normalizedData: {
      sheet_name: sheetName,
      detected_month: detectedMonth || month,
      month,
      statement_type: statementType,
      category,
      opening_amount: openingAmount,
      increase_amount: increaseAmount,
      decrease_amount: decreaseAmount,
      memo: finalMemo
    }
  };
}

export function normalizeUploadRows(uploadType: UploadType, rows: Record<string, string>[], userMappingRules: UserMappingRule[] = []): NormalizedUploadRow[] {
  return rows.map((row, index) => {
    if (uploadType === "mixed") {
      const detectedUploadType = inferMixedUploadType(row);
      const normalized = normalizeUploadRows(detectedUploadType, [row], userMappingRules)[0];
      const detectedLabel = detectedUploadType === "bank" ? "은행"
        : detectedUploadType === "card" ? "카드"
          : detectedUploadType === "balance" ? "자산·부채"
            : "파로스";

      return {
        ...normalized,
        rowIndex: index + 1,
        normalizedData: {
          ...normalized.normalizedData,
          detected_upload_type: detectedUploadType,
          detected_upload_label: detectedLabel
        },
        memo: [normalized.memo, `통합업로드 감지: ${detectedLabel}`].filter(Boolean).join(" / ") || null
      };
    }

    if (uploadType === "balance") {
      const normalized = normalizeBalanceRow(row);

      return {
        rowIndex: index + 1,
        rawData: row,
        normalizedData: normalized.normalizedData,
        parseStatus: normalized.parseStatus,
        memo: normalized.memo,
        transaction: null,
        balanceMovement: normalized.balanceMovement
      };
    }

    const sheetName = pick(row, sheetNameKeys);
    const detectedMonth = pick(row, detectedMonthKeys) || inferMonthFromText(sheetName);
    const transactionDate = normalizeDate(pick(row, dateKeys), detectedMonth);
    const vendor = pick(row, vendorKeys) || null;
    const description = pick(row, descriptionKeys) || vendor || null;
    const { amount, cashFlowType } = getAmountAndFlow(row, uploadType);
    const businessUnit = normalizeBusinessUnit(pick(row, businessUnitKeys));
    const accountId = uploadType === "bank" ? pick(row, bankAccountKeys) || null : null;
    const accountLookupText = uploadType === "bank" ? [accountId, sheetName].filter(Boolean).join(" ") : accountId;
    const cardBudgetGroup = uploadType === "card" ? pick(row, cardBudgetGroupKeys) || null : null;
    const mainCategory = pick(row, mainCategoryKeys) || null;
    const subCategory = pick(row, subCategoryKeys) || null;

    const missing: string[] = [];
    if (!hasLikelyTransactionSignal(row)) missing.push("거래행 아님");
    if (!transactionDate) missing.push(detectedMonth ? "거래일자" : "거래일자/시트 기준월");
    if (!amount) missing.push("금액");
    if (!description) missing.push("적요/거래처");

    const parseStatus = missing.length === 0 ? "정상" : "확인필요";
    const baseMemo = inferMemo(missing);
    const source = sourceByType(uploadType);
    const firstPass = classifyFirstPass({
      source,
      businessUnit,
      accountId: accountLookupText,
      cardBudgetGroup,
      vendor,
      description,
      amount,
      cashFlowType,
      mainCategory,
      subCategory,
      memo: [baseMemo, sheetName].filter(Boolean).join(" ")
    }, userMappingRules);
    const accountIdForDb = persistedAccountId(uploadType, firstPass.accountId || accountId);
    const autoMemo = `1차분류: ${firstPass.matchedRule}`;
    const memo = [baseMemo, autoMemo].filter(Boolean).join(" / ") || null;

    const transaction = transactionDate && amount
      ? {
          transaction_date: transactionDate,
          source,
          business_unit: firstPass.businessUnit,
          account_id: accountIdForDb,
          card_budget_group: cardBudgetGroup,
          vendor,
          description,
          amount,
          cash_flow_type: cashFlowType,
          main_category: firstPass.mainCategory,
          sub_category: firstPass.subCategory,
          detail_category: firstPass.detailCategory,
          talent_investment_type: firstPass.talentInvestmentType || null,
          expense_basis: firstPass.expenseBasis,
          is_internal_transfer: firstPass.isInternalTransfer,
          is_common_use: firstPass.isCommonUse,
          common_policy: firstPass.commonPolicy || null,
          review_status: parseStatus === "정상" ? firstPass.reviewStatus : ("확인필요" as const),
          memo
        }
      : null;

    return {
      rowIndex: index + 1,
      rawData: row,
      normalizedData: {
        transaction_date: transactionDate,
        sheet_name: sheetName,
        detected_month: detectedMonth,
        account_id: accountIdForDb,
        card_budget_group: cardBudgetGroup,
        vendor,
        description,
        amount,
        cash_flow_type: cashFlowType,
        business_unit: firstPass.businessUnit,
        main_category: firstPass.mainCategory,
        sub_category: firstPass.subCategory,
        detail_category: firstPass.detailCategory,
        talent_investment_type: firstPass.talentInvestmentType || null,
        expense_basis: firstPass.expenseBasis,
        review_status: firstPass.reviewStatus,
        matched_rule: firstPass.matchedRule
      },
      parseStatus,
      memo,
      transaction,
      balanceMovement: null
    };
  });
}
