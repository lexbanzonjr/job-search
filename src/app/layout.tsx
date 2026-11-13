import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Search",
  description: "Search jobs and match them to your resume",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
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
              <form action={logout} className="ml-auto">
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
