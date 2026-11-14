import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { findUser, type User } from "@/lib/users";

/** The signed-in user, or null (cookie missing/invalid, or the account was removed). */
export async function getUser(): Promise<User | null> {
  const username = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return username ? findUser(username) : null;
}

/** The signed-in user; redirects to /login if there isn't one. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in admin; non-admins get a 404 so admin pages stay hidden. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}
