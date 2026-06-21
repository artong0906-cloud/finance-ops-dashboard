"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type UserRow = {
  id: string;
  login_id: string | null;
  name: string | null;
  role: "admin" | "finance" | "executive" | "viewer";
  status: "active" | "inactive";
  created_at: string;
};

export function UserAdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRow["role"]>("finance");
  const [status, setStatus] = useState<UserRow["status"]>("active");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function getAuthHeaders(includeJson = false) {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      throw new Error("로그인이 필요합니다. 로그아웃 후 다시 로그인해주세요.");
    }

    return {
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`
    };
  }

  async function loadUsers() {
    try {
      const headers = await getAuthHeaders(false);
      const response = await fetch("/api/admin/users", {
        headers,
        credentials: "same-origin",
        cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "사용자 목록을 불러오지 못했습니다.");
      setUsers(result.users || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용자 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    loadUsers().catch(() => undefined);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsLoading(true);

    try {
      const headers = await getAuthHeaders(true);
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ loginId, name, password, role, status })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "계정 생성 실패");
      setMessage(`계정이 생성되었습니다. 아이디: ${loginId}`);
      setLoginId("");
      setName("");
      setPassword("");
      setRole("finance");
      setStatus("active");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "계정 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid grid-cols-[420px_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
      <div className="card">
        <h2 className="section-title">계정 생성</h2>
        <p className="text-sm text-slate-500 leading-6 mt-2">이메일 없이 아이디, 초기 비밀번호, 권한만 부여합니다.</p>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-slate-700">아이디<input className="field" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="finance01" required /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">이름<input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="경영지원 담당자" required /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">초기 비밀번호<input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" required /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">권한<select className="field" value={role} onChange={(e) => setRole(e.target.value as UserRow["role"])}><option value="admin">admin</option><option value="finance">finance</option><option value="executive">executive</option><option value="viewer">viewer</option></select></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">상태<select className="field" value={status} onChange={(e) => setStatus(e.target.value as UserRow["status"])}><option value="active">active</option><option value="inactive">inactive</option></select></label>
          <button className="btn btn-primary" disabled={isLoading}>
            <UserPlus size={15} />
            {isLoading ? "생성 중..." : "계정 생성"}
          </button>
        </form>
        {message ? <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4 text-sm font-bold text-green-700">{message}</div> : null}
        {error ? <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-700">{error}</div> : null}
      </div>

      <div className="card">
        <h2 className="section-title mb-4">사용자 목록</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>아이디</th><th>이름</th><th>권한</th><th>상태</th><th>생성일</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-black">{user.login_id}</td>
                  <td>{user.name}</td>
                  <td><span className="badge">{user.role}</span></td>
                  <td><span className={user.status === "active" ? "badge badge-good" : "badge badge-muted"}>{user.status}</span></td>
                  <td>{new Date(user.created_at).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
              {users.length === 0 ? <tr><td colSpan={5} className="text-slate-500">아직 표시할 사용자가 없습니다.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
