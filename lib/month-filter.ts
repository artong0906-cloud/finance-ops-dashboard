export type MonthSearchParams = {
  month?: string | string[];
};

const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/;

export function normalizeMonthParam(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  const month = typeof raw === "string" ? raw.trim() : "";
  return monthPattern.test(month) ? month : undefined;
}

export function resolveMonthParam(params?: MonthSearchParams | null) {
  return normalizeMonthParam(params?.month);
}

export function withMonthParam(path: string, month?: string | null) {
  if (!month) return path;

  const [base, hash = ""] = path.split("#");
  const [pathname, query = ""] = base.split("?");
  const params = new URLSearchParams(query);
  params.set("month", month);
  const nextQuery = params.toString();

  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}
