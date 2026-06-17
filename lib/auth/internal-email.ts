export const INTERNAL_EMAIL_DOMAIN = "financeops.local";

export function normalizeLoginId(loginId: string) {
  return loginId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function loginIdToInternalEmail(loginId: string) {
  const normalized = normalizeLoginId(loginId);
  if (!normalized) throw new Error("아이디를 입력하세요.");
  return `${normalized}@${INTERNAL_EMAIL_DOMAIN}`;
}

export function internalEmailToLoginId(email: string | null | undefined) {
  if (!email) return "";
  return email.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`) ? email.replace(`@${INTERNAL_EMAIL_DOMAIN}`, "") : email;
}

export function isValidPassword(password: string) {
  return password.length >= 8;
}
