import type { BankAccount, BusinessUnit, Transaction } from "@/types/finance";

export function resolveBankBusinessUnit(accountId: string | undefined, accounts: BankAccount[]): BusinessUnit {
  const account = accounts.find((item) => item.id === accountId);
  return account?.businessUnit ?? "미배분";
}

export function resolveCardBusinessUnit(row: Transaction): BusinessUnit {
  if (row.isCommonUse) return "공통사용분";
  if (row.journalBusinessUnit) return row.journalBusinessUnit;
  return row.businessUnit ?? "미배분";
}
