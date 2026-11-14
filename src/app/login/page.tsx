"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="flex min-h-[80vh] items-center justify-center">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Job Search</h1>
        <input name="username" placeholder="Username" autoComplete="username" required className="input" />
        <input name="password" type="password" placeholder="Password" autoComplete="current-password" required className="input" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={pending} className="btn w-full">{pending ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
