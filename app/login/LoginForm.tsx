"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const next = searchParams.get("next") || "/dashboard";
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ loginId, password, next })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(result.error || "아이디 또는 비밀번호가 맞지 않습니다."));
      }

      router.refresh();
      window.location.replace(String(result.next || next));
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        아이디
        <input
          className="field"
          type="text"
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          placeholder="admin 또는 finance01"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        비밀번호
        <input
          className="field"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="관리자가 부여한 비밀번호"
          required
        />
      </label>
      <button className="btn btn-primary w-full" type="submit" disabled={isLoading}>
        {isLoading ? "로그인 중..." : "로그인"}
      </button>
      {error ? <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-700">{error}</div> : null}
    </form>
  );
}
