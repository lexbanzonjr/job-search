import Link from "next/link";
import { Account } from "./account";
import { NavLinks } from "./nav";

export function Sidebar({ username, isAdmin }: { username: string; isAdmin: boolean }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-6 border-r border-zinc-200 bg-white px-3 py-5 md:flex">
      <Link href="/" className="px-3 text-lg font-semibold">Job Search</Link>
      <div className="flex-1">
        <NavLinks isAdmin={isAdmin} />
      </div>
      <Account username={username} />
    </aside>
  );
}
