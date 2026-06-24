export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { endingAmount, formatKRW, sumBy } from "@/services/dashboard/calculations";
import { getDashboardData } from "@/services/dashboard/liveData";
import type { BalanceMovement, BankAccount } from "@/types/finance";

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
  memo: string;
};

const assetGroupOrder = ["현금성자산", "차량가액", "보증금", "대여금", "유형자산", "무형자산", "기타자산"];
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
    if (includesAny(text, ["은행", "대출", "차입"])) return "은행대출부채";
    if (includesAny(text, ["카드", "광고비", "급여", "예정", "미지급"])) return "미지급/예정부채";
    return "기타부채";
  }

  if (includesAny(text, ["현금", "예금", "통장", "증권", "현금성"])) return "현금성자산";
  if (includesAny(text, ["차량", "법인차"])) return "차량가액";
  if (includesAny(text, ["보증금", "임차보증금"])) return "보증금";
  if (includesAny(text, ["대여금"])) return "대여금";
  if (includesAny(text, ["토지", "비품", "유형자산", "건물", "시설", "전자칠판", "나스", "장비", "집기"])) return "유형자산";
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
    memo: row.memo || "-"
  };
}

function detailRowsForGroup(group: string, rows: BalanceViewRow[], bankAccounts: BankAccount[] = []) {
  if (group === "현금성자산") {
    const accountDetails = bankAccountDetails(bankAccounts);
    if (accountDetails.length > 0) return accountDetails;
  }

  return rows.map(movementDetail);
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
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={group}>
              <div className="mb-3 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
                <div>
                  <span className={statementType === "자산" ? "badge badge-good" : "badge badge-warning"}>{group}</span>
                  <span className="ml-2 text-xs font-bold text-slate-500">
                    {label} · {details.length.toLocaleString("ko-KR")}개
                  </span>
                </div>
                <div className="text-lg font-black text-slate-950">{formatKRW(groupTotal)}</div>
              </div>
              <p className="mb-3 text-xs leading-5 text-slate-500">
                {group === "현금성자산"
                  ? "계좌 마스터의 은행별 잔액을 우선 표시합니다."
                  : "월별 자산·부채 업로드의 세부 항목명을 그대로 표시합니다."}
              </p>
              <div className="table-wrap">
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
              </div>
            </div>
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

export default async function BalancePage() {
  const data = await getDashboardData();
  const { balanceMovements, bankAccounts } = data;
  const viewRows = toViewRows(balanceMovements);
  const assets = viewRows.filter((row) => row.statementType === "자산");
  const liabilities = viewRows.filter((row) => row.statementType === "부채");
  const cashAccountTotal = sumBy(bankAccountDetails(bankAccounts), (row) => row.ending);
  const balanceCashTotal = sumBy(assets.filter((row) => row.group === "현금성자산"), (row) => row.ending);
  const totalAssets = sumBy(assets.filter((row) => row.group !== "현금성자산"), (row) => row.ending) + (cashAccountTotal || balanceCashTotal);
  const totalLiabilities = sumBy(liabilities, (row) => row.ending);
  const equity = totalAssets - totalLiabilities;

  return (
    <AppShell title="자산/부채 현황" description="월별 업로드 증감표를 기준으로 자산·부채 항목별 상세를 확인합니다." periodLabel={data.currentMonth || "2026-05"}>
      <section className="mb-6 grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <div className="card"><div className="eyebrow">총자산</div><div className="metric-value mt-3">{formatKRW(totalAssets)}</div></div>
        <div className="card"><div className="eyebrow">총부채</div><div className="metric-value mt-3">{formatKRW(totalLiabilities)}</div></div>
        <div className="card"><div className="eyebrow">자본</div><div className="metric-value mt-3">{formatKRW(equity)}</div><div className="mt-2 text-xs text-slate-500">총자산 - 총부채</div></div>
      </section>

      <section className="mb-6 grid grid-cols-[minmax(0,1fr)_320px] gap-4 max-xl:grid-cols-1">
        <div className="card">
          <h2 className="section-title">월별 업데이트 방식</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            초기 운영은 자료 업로드의 <b>자산·부채 증감</b> 파일로 매월 기초·증가·감소를 교체 저장합니다. 차량은 차량명, 보증금은 물건명, 유형자산은 비품·토지명처럼 항목 단위로 올리면 화면도 같은 단위로 표시됩니다.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">업로드 기준</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            권장 컬럼: 기준월, 구분, 항목, 기초, 증가, 감소, 메모<br />
            현금성자산은 계좌 마스터의 은행별 잔액을 우선 표시합니다.
          </div>
          <Link className="btn mt-4 w-full" href="/uploads">자산·부채 파일 업로드</Link>
        </div>
      </section>

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
