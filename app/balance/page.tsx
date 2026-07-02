export const dynamic = "force-dynamic";

import Link from "next/link";
import { AssetCandidateApplyClient, type AssetCandidateRow, type ExistingAssetOption } from "./AssetCandidateApplyClient";
import { AppShell } from "@/components/layout/AppShell";
import { chartColors, DonutPanel, equityColor, FinancialCard, outflowColor, StackedBar } from "@/components/shared/FinanceViz";
import { resolveMonthParam, type MonthSearchParams } from "@/lib/month-filter";
import { endingAmount, formatCompactKRW, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { BalanceMovement, BankAccount, Transaction } from "@/types/finance";

type BalanceViewRow = BalanceMovement & {
  group: string;
  ending: number;
};

type BalanceDetailRow = {
  id: string;
  name: string;
  caption: string;
  openingAmount: number | null;
  increaseAmount: number | null;
  decreaseAmount: number | null;
  ending: number;
  acquiredAt?: string;
  monthlyDepreciation?: number;
  memo: string;
};

const assetGroupOrder = ["현금성자산", "차량가액", "보증금", "대여금", "광고비", "유형자산", "무형자산", "기타자산"];
const liabilityGroupOrder = ["차량부채", "은행대출부채", "미지급/예정부채", "기타부채"];

function compact(value: string | undefined) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(compact(keyword)));
}

function classifyBalanceGroup(row: BalanceMovement) {
  const text = compact([row.category, row.memo].filter(Boolean).join(" "));

  if (row.statementType === "부채") {
    if (includesAny(text, ["차량", "리스"])) return "차량부채";
    if (includesAny(text, ["은행", "대출", "차입", "중진공", "기.보", "기보", "증신공", "클린보증"])) return "은행대출부채";
    if (includesAny(text, ["카드", "광고비", "급여", "예정", "미지급"])) return "미지급/예정부채";
    return "기타부채";
  }

  if (includesAny(text, ["현금", "예금", "통장", "증권", "현금성", "선급금", "공제부금"])) return "현금성자산";
  if (includesAny(text, ["차량", "법인차"])) return "차량가액";
  if (includesAny(text, ["보증금", "임차보증금"])) return "보증금";
  if (includesAny(text, ["대여금", "투자금"])) return "대여금";
  if (includesAny(text, ["광고비", "메조미디어", "역량지급"])) return "광고비";
  if (includesAny(text, ["토지", "비품", "유형자산", "건물", "시설", "전자칠판", "나스", "장비", "집기", "인테리어", "사옥", "필지", "건축설계", "두암동", "동명동"])) return "유형자산";
  if (includesAny(text, ["무형자산", "앱개발", "앱", "소프트웨어", "지식재산", "특허", "상표"])) return "무형자산";
  return "기타자산";
}

function toViewRows(rows: BalanceMovement[]): BalanceViewRow[] {
  return rows.map((row) => ({
    ...row,
    group: classifyBalanceGroup(row),
    ending: endingAmount(row)
  }));
}

function groupRows(rows: BalanceViewRow[], order: string[]) {
  const grouped = rows.reduce((acc, row) => {
    const list = acc.get(row.group) || [];
    list.push(row);
    acc.set(row.group, list);
    return acc;
  }, new Map<string, BalanceViewRow[]>());

  return Array.from(grouped.entries()).sort(([a], [b]) => {
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function detailLabelFor(group: string) {
  const labels: Record<string, string> = {
    현금성자산: "은행별 잔액",
    차량가액: "차량 목록",
    보증금: "물건별 보증금",
    대여금: "대여처별 잔액",
    광고비: "광고비 잔액",
    유형자산: "유형자산 목록",
    무형자산: "무형자산 목록",
    차량부채: "차량별 부채",
    은행대출부채: "은행별 대출잔액",
    "미지급/예정부채": "지급 예정 항목"
  };
  return labels[group] || "세부 항목";
}

function displayAmount(value: number | null) {
  return value === null ? "-" : formatKRW(value);
}

function balanceDelta(row: BalanceMovement) {
  return row.increaseAmount - row.decreaseAmount;
}

function bankAccountDetails(bankAccounts: BankAccount[]): BalanceDetailRow[] {
  return bankAccounts
    .filter((account) => Math.abs(account.currentBalance) > 0)
    .map((account) => ({
      id: `bank-${account.id}`,
      name: `${account.bankName} ${account.accountName}`,
      caption: [account.businessUnit, account.maskedNo].filter(Boolean).join(" · "),
      openingAmount: account.previousBalance,
      increaseAmount: null,
      decreaseAmount: null,
      ending: account.currentBalance,
      memo: account.purpose || "계좌 잔액 기준"
    }));
}

function movementDetail(row: BalanceViewRow): BalanceDetailRow {
  return {
    id: row.id,
    name: row.category,
    caption: row.month,
    openingAmount: row.openingAmount,
    increaseAmount: row.increaseAmount,
    decreaseAmount: row.decreaseAmount,
    ending: row.ending,
    acquiredAt: row.acquiredAt,
    monthlyDepreciation: row.monthlyDepreciation,
    memo: row.memo || "-"
  };
}

function detailRowsForGroup(group: string, rows: BalanceViewRow[], bankAccounts: BankAccount[] = []) {
  const hasGranularRows = rows.length > 1 || rows.some((row) => !includesAny(compact(row.category), ["현금성자산"]));
  if (group === "현금성자산" && !hasGranularRows) {
    const accountDetails = bankAccountDetails(bankAccounts);
    if (accountDetails.length > 0) return accountDetails;
  }

  return rows.map(movementDetail);
}

function balanceGroupSegments(rows: BalanceViewRow[], order: string[], bankAccounts: BankAccount[] = []) {
  return groupRows(rows, order)
    .map(([group, groupRows], index) => ({
      label: group,
      amount: sumBy(detailRowsForGroup(group, groupRows, bankAccounts), (row) => row.ending),
      color: chartColors[index % chartColors.length]
    }))
    .filter((segment) => segment.amount > 0);
}

function memoValue(memo: string | null | undefined, key: string) {
  const pattern = new RegExp(`${key}:([^·/]+)`);
  return memo?.match(pattern)?.[1]?.trim();
}

function appliedAssetInfo(row: Transaction, appliedRows: BalanceMovement[]) {
  const rowDescription = row.rawDescription || row.description;
  const rowVendor = compact(row.vendor);
  const rowMemo = compact(rowDescription);
  const directMatch = appliedRows.find((movement) => compact(movement.memo).includes(compact(`거래ID:${row.id}`)));
  const inferredMatch = directMatch || appliedRows.find((movement) => {
    const memo = compact(movement.memo);
    const vendorMatched = rowVendor.length === 0 || memo.includes(rowVendor);
    const descriptionKey = rowMemo.slice(0, 12);
    const descriptionMatched = descriptionKey.length === 0 || memo.includes(descriptionKey);
    return movement.increaseAmount === row.amount && vendorMatched && descriptionMatched;
  });

  if (!inferredMatch) {
    return {
      applied: false
    };
  }

  return {
    applied: true,
    appliedMode: inferredMatch.decreaseAmount > 0 ? "depreciate" as const : "as_is" as const,
    appliedAssetTarget: compact(inferredMatch.memo).includes(compact("기존 자산 증액")) ? "existing" as const : "new" as const,
    appliedAssetCategory: memoValue(inferredMatch.memo, "자산분류") || inferredMatch.category,
    appliedAssetName: inferredMatch.category,
    appliedMonthlyDepreciation: inferredMatch.decreaseAmount
  };
}

function existingAssetOptions(rows: BalanceViewRow[]): ExistingAssetOption[] {
  const options = rows
    .filter((row) => (
      row.statementType === "자산"
      && row.group !== "현금성자산"
      && row.category
    ))
    .map((row) => ({
      name: row.category,
      category: row.group
    }));

  return Array.from(new Map(options.map((option) => [option.name, option])).values())
    .sort((a, b) => a.name.localeCompare(b.name));
}

function assetCandidateRows(rows: Transaction[], month: string, balanceMovements: BalanceMovement[]): AssetCandidateRow[] {
  const appliedRows = balanceMovements.filter((row) => (
    row.month === month
    && row.statementType === "자산"
    && compact(row.memo).includes(compact("자산성 지출 반영"))
  ));

  return rows
    .filter((row) => (
      row.date.startsWith(month)
      && row.cashFlowType === "출금"
      && row.expenseBasis === "자산"
      && !row.isInternalTransfer
    ))
    .map((row) => ({
      id: row.id,
      date: row.date,
      source: row.source,
      vendor: row.vendor,
      description: row.rawDescription || row.description,
      amount: row.amount,
      businessUnit: row.businessUnit,
      category: row.detailCategory && row.detailCategory !== "미분류" ? row.detailCategory : row.mainCategory,
      ...appliedAssetInfo(row, appliedRows)
    }));
}

function BalanceGroupSection({
  rows,
  statementType,
  title,
  bankAccounts = []
}: {
  rows: BalanceViewRow[];
  statementType: "자산" | "부채";
  title: string;
  bankAccounts?: BankAccount[];
}) {
  const order = statementType === "자산" ? assetGroupOrder : liabilityGroupOrder;
  const groups = groupRows(rows, order);
  const total = sumBy(
    groups.flatMap(([group, groupRows]) => detailRowsForGroup(group, groupRows, bankAccounts)),
    (row) => row.ending
  );

  return (
    <section className="card">
      <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {statementType} 그룹을 실제 구성 항목 단위로 확인합니다.
          </p>
        </div>
        <div className="text-right max-md:text-left">
          <div className="eyebrow">기말 합계</div>
          <div className="mt-1 text-xl font-black text-slate-950">{formatKRW(total)}</div>
        </div>
      </div>

      <div className="grid gap-4">
        {groups.map(([group, groupRows]) => {
          const details = detailRowsForGroup(group, groupRows, bankAccounts);
          const groupTotal = sumBy(details, (row) => row.ending);
          const label = detailLabelFor(group);

          return (
            <details className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50" key={group}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-white max-md:flex-col max-md:items-start [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div>
                    <span className={statementType === "자산" ? "badge badge-good" : "badge badge-warning"}>{group}</span>
                    <span className="ml-2 text-xs font-bold text-slate-500">
                      {label} · {details.length.toLocaleString("ko-KR")}개
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {group === "현금성자산" && details.some((row) => row.id.startsWith("bank-"))
                      ? "계좌 마스터의 은행별 잔액을 우선 표시합니다."
                      : "월별 자산·부채 업로드의 세부 항목명을 그대로 표시합니다."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 max-md:w-full max-md:justify-between">
                  <div className="text-right max-md:text-left">
                    <div className="text-xs font-black text-slate-400">상세내역 총액</div>
                    <div className="mt-1 text-lg font-black text-slate-950">{formatKRW(groupTotal)}</div>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600 group-open:hidden">
                    상세 열기
                  </span>
                  <span className="hidden rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 group-open:inline-flex">
                    상세 닫기
                  </span>
                </div>
              </summary>
              <div className="border-t border-slate-200 bg-white p-4">
                <div className="table-wrap">
                  {group === "차량가액" ? (
                    <table>
                      <thead>
                        <tr>
                          <th>차량명</th>
                          <th>취득일</th>
                          <th className="text-right">취득가</th>
                          <th className="text-right">누적 감가</th>
                          <th className="text-right">차량가액</th>
                          <th className="text-right">당월 감가</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <div className="font-black">{row.name}</div>
                              <div className="mt-1 text-xs font-bold text-slate-400">{row.caption}</div>
                            </td>
                            <td>{row.acquiredAt || "-"}</td>
                            <td className="text-right">{displayAmount(row.openingAmount)}</td>
                            <td className="text-right">{displayAmount(row.decreaseAmount)}</td>
                            <td className="text-right font-black">{formatKRW(row.ending)}</td>
                            <td className="text-right">{displayAmount(row.monthlyDepreciation ?? null)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>{label}</th>
                          <th className="text-right">기초</th>
                          <th className="text-right">증가</th>
                          <th className="text-right">감소</th>
                          <th className="text-right">잔액</th>
                          <th>메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <div className="font-black">{row.name}</div>
                              <div className="mt-1 text-xs font-bold text-slate-400">{row.caption}</div>
                            </td>
                            <td className="text-right">{displayAmount(row.openingAmount)}</td>
                            <td className="text-right">{displayAmount(row.increaseAmount)}</td>
                            <td className="text-right">{displayAmount(row.decreaseAmount)}</td>
                            <td className="text-right font-black">{formatKRW(row.ending)}</td>
                            <td>{row.memo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </details>
          );
        })}

        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">
            표시할 {statementType} 항목이 없습니다.
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default async function BalancePage({
  searchParams
}: {
  searchParams?: Promise<MonthSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const selectedMonth = resolveMonthParam(params);
  const data = await getDashboardData(selectedMonth);
  const { balanceMovements, bankAccounts, transactions } = data;
  const activeMonth = data.currentMonth || "2026-05";
  const viewRows = toViewRows(balanceMovements);
  const assets = viewRows.filter((row) => row.statementType === "자산");
  const liabilities = viewRows.filter((row) => row.statementType === "부채");
  const cashRows = assets.filter((row) => row.group === "현금성자산");
  const cashDetails = detailRowsForGroup("현금성자산", cashRows, bankAccounts);
  const totalAssets = sumBy(assets.filter((row) => row.group !== "현금성자산"), (row) => row.ending) + sumBy(cashDetails, (row) => row.ending);
  const totalLiabilities = sumBy(liabilities, (row) => row.ending);
  const equity = totalAssets - totalLiabilities;
  const assetChange = sumBy(assets, balanceDelta);
  const liabilityChange = sumBy(liabilities, balanceDelta);
  const equityChange = assetChange - liabilityChange;
  const assetSegments = balanceGroupSegments(assets, assetGroupOrder, bankAccounts);
  const liabilitySegments = balanceGroupSegments(liabilities, liabilityGroupOrder);
  const capitalSegments = [
    { label: "부채", amount: totalLiabilities, color: outflowColor },
    { label: "자본", amount: equity, color: equityColor }
  ].filter((segment) => segment.amount > 0);

  return (
    <AppShell title="자산/부채 현황" description="월별 업로드 증감표를 기준으로 자산·부채 항목별 상세를 확인합니다." periodLabel={activeMonth} availableMonths={data.availableMonths} activePath="/balance">
      <section className="card mb-6">
        <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <h2 className="section-title">자산 · 부채 · 자본</h2>
            <p className="mt-1 text-sm text-slate-500">기말 잔액, 전월비 증감액, 구성 비중을 한 섹션에서 확인합니다.</p>
          </div>
          <span className="badge badge-muted">총자산 {formatCompactKRW(totalAssets)}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          <FinancialCard change={assetChange} color={equityColor} label="총자산" value={totalAssets} />
          <FinancialCard change={liabilityChange} color={outflowColor} label="총부채" value={totalLiabilities} />
          <FinancialCard change={equityChange} color="#52beb7" label="자본" value={equity} />
        </div>
        <div className="mt-4">
          <StackedBar segments={capitalSegments} />
        </div>
      </section>

      <section className="mb-6 grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        <DonutPanel segments={capitalSegments} title="자산 대비 부채/자본" totalLabel="총자산" totalValue={formatCompactKRW(totalAssets)} />
        <DonutPanel segments={assetSegments} title="자산 구성" totalLabel="총자산" totalValue={formatCompactKRW(totalAssets)} />
        <DonutPanel segments={liabilitySegments} title="부채 구성" totalLabel="총부채" totalValue={formatCompactKRW(totalLiabilities)} />
      </section>

      <section className="mb-6 grid items-start grid-cols-[minmax(0,1fr)_320px] gap-4 max-xl:grid-cols-1">
        <div className="card self-start">
          <h2 className="section-title">월별 업데이트 방식</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            초기 운영은 자료 업로드의 <b>자산·부채 증감</b> 파일로 매월 기초·증가·감소를 교체 저장합니다. 차량은 차량명, 보증금은 물건명, 유형자산은 비품·토지명처럼 항목 단위로 올리면 화면도 같은 단위로 표시됩니다.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">업로드 기준</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            권장 컬럼: 기준월, 구분, 항목, 기초, 증가, 감소, 메모<br />
            현금성자산은 업로드된 은행별 잔액이 있으면 그 값을 우선 표시합니다.
          </div>
          <Link className="btn mt-4 w-full" href="/uploads">자산·부채 파일 업로드</Link>
        </div>
      </section>

      {activeMonth === "2026-06" ? (
        <AssetCandidateApplyClient
          existingAssetOptions={existingAssetOptions(assets)}
          month={activeMonth}
          rows={assetCandidateRows(transactions, activeMonth, balanceMovements)}
        />
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <BalanceGroupSection rows={assets} statementType="자산" title="자산 상세" bankAccounts={bankAccounts} />
        <BalanceGroupSection rows={liabilities} statementType="부채" title="부채 상세" />
      </section>

      <section className="card">
        <h2 className="section-title mb-4">전체 증감 입력표</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>구분</th>
                <th>분류</th>
                <th>항목</th>
                <th className="text-right">기초</th>
                <th className="text-right">증가</th>
                <th className="text-right">감소</th>
                <th className="text-right">기말</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {viewRows.map((row) => (
                <tr key={row.id}>
                  <td><span className={row.statementType === "자산" ? "badge badge-good" : "badge badge-warning"}>{row.statementType}</span></td>
                  <td>{row.group}</td>
                  <td className="font-black">{row.category}</td>
                  <td className="text-right">{formatKRW(row.openingAmount)}</td>
                  <td className="text-right">{formatKRW(row.increaseAmount)}</td>
                  <td className="text-right">{formatKRW(row.decreaseAmount)}</td>
                  <td className="text-right font-black">{formatKRW(row.ending)}</td>
                  <td>{row.memo || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
