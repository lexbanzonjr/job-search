"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Search" },
  { href: "/matches", label: "AI Matches" },
  { href: "/resume", label: "Resume" },
  { href: "/saved", label: "Saved" },
];

const within = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, { href: "/users", label: "Users" }] : NAV;
  return (
    <nav className="grid gap-1">
      {items.map(({ href, label }) => {
        const active = within(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
