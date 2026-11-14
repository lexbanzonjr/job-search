"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { NavLinks } from "./nav";

/** Top bar + slide-out drawer for small screens. `account` is the server-rendered sign-out block. */
export function MobileNav({ isAdmin, account }: { isAdmin: boolean; account: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2">
        <button
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="-ml-2 rounded-md p-2 text-zinc-600 hover:bg-zinc-100"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/" className="font-semibold">Job Search</Link>
      </header>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 bg-white px-3 py-5 shadow-xl">
            <span className="px-3 text-lg font-semibold">Job Search</span>
            <div className="flex-1">
              <NavLinks isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
            </div>
            {account}
          </aside>
        </div>
      )}
    </div>
  );
}
