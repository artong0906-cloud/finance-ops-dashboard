"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const next = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    router.prefetch(next);
  }, [next, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
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

      router.replace(String(result.next || next));
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
      setError(message);
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-black text-[#42526e]">
        아이디
        <input
          className="field min-h-[48px] rounded-2xl border-[#d8e1ee] bg-[#f8fbff] px-4 font-bold shadow-inner shadow-slate-100 focus:bg-white"
          type="text"
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          placeholder="admin 또는 finance01"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#42526e]">
        비밀번호
        <input
          className="field min-h-[48px] rounded-2xl border-[#d8e1ee] bg-[#f8fbff] px-4 font-bold shadow-inner shadow-slate-100 focus:bg-white"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="관리자가 부여한 비밀번호"
          required
        />
      </label>
      <button className="mt-1 min-h-[48px] w-full rounded-2xl border border-[#2f5f9e] bg-[linear-gradient(135deg,#2f5f9e_0%,#264f87_100%)] px-4 text-sm font-black text-white shadow-[0_16px_34px_rgba(47,95,158,.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(47,95,158,.28)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isLoading}>
        {isLoading ? "로그인 중..." : "로그인"}
      </button>
      {error ? <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-700">{error}</div> : null}
    </form>
  );
}
