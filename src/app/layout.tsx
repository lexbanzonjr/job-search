import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/session";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Search",
  description: "Search jobs and match them to your resume",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {user && (
          <header className="border-b border-zinc-200 bg-white">
            <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
              <Link href="/" className="font-semibold">Job Search</Link>
              <Link href="/" className="text-zinc-600 hover:text-zinc-900">Search</Link>
              <Link href="/matches" className="text-zinc-600 hover:text-zinc-900">AI Matches</Link>
              <Link href="/resume" className="text-zinc-600 hover:text-zinc-900">Resume</Link>
              <Link href="/saved" className="text-zinc-600 hover:text-zinc-900">Saved</Link>
              {user.isAdmin && <Link href="/users" className="text-zinc-600 hover:text-zinc-900">Users</Link>}
              <span className="ml-auto text-zinc-400">{user.username}</span>
              <form action={logout}>
                <button className="text-zinc-500 hover:text-zinc-900">Sign out</button>
              </form>
            </nav>
          </header>
        )}
        <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
