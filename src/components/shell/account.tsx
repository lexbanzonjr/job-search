import { logout } from "@/app/login/actions";

export function Account({ username }: { username: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-3 pt-4 text-sm">
      <span className="truncate text-zinc-500">{username}</span>
      <form action={logout}>
        <button className="text-zinc-500 hover:text-zinc-900">Sign out</button>
      </form>
    </div>
  );
}
