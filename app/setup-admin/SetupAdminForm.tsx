"use client";

import { useState } from "react";

export function SetupAdminForm() {
  const [setupKey, setSetupKey] = useState("");
  const [loginId, setLoginId] = useState("admin");
  const [name, setName] = useState("후후");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/setup-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupKey, loginId, name, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "초기 관리자 생성 실패");
      setMessage(`관리자 계정이 생성되었습니다. 아이디 ${result.loginId}로 로그인하세요.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "초기 관리자 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        초기 관리자 생성키
        <input className="field" type="password" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} required />
      </label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        관리자 아이디
        <input className="field" value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
      </label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        이름
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        초기 비밀번호
        <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" required />
      </label>
      <button className="btn btn-primary w-full" type="submit" disabled={isLoading}>{isLoading ? "생성 중..." : "초기 관리자 생성"}</button>
      {message ? <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm font-bold text-green-700">{message}</div> : null}
      {error ? <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-700">{error}</div> : null}
    </form>
  );
}
