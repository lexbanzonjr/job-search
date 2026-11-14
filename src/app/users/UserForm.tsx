"use client";

import { useActionState } from "react";
import { saveUserAction } from "./actions";

export function UserForm() {
  const [error, action, pending] = useActionState(saveUserAction, null);
  return (
    <form action={action} className="card flex flex-wrap items-center gap-2">
      <input name="username" placeholder="Username" required className="input w-48" />
      <input name="password" type="password" placeholder="Password (8+ chars)" required minLength={8} className="input w-56" />
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Add / reset password"}</button>
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}
