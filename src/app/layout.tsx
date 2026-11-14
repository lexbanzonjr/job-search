import type { Metadata } from "next";
import { Account } from "@/components/shell/account";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { getUser } from "@/lib/session";
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
        {user ? (
          <div className="flex min-h-dvh">
            <Sidebar username={user.username} isAdmin={user.isAdmin} />
            <div className="min-w-0 flex-1">
              <MobileNav isAdmin={user.isAdmin} account={<Account username={user.username} />} />
              <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
        )}
      </body>
    </html>
  );
}
