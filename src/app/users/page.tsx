import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";
import { deleteUserAction } from "./actions";
import { UserForm } from "./UserForm";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await listUsers();
  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-zinc-500">Invite-only: add an account here and send the person their username and password.</p>
      </div>
      <UserForm />
      <ul className="card divide-y divide-zinc-100 p-0">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="font-medium">{u.username}</span>
            {u.isAdmin && <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">admin</span>}
            <span className="text-xs text-zinc-400">since {u.createdAt.slice(0, 10)}</span>
            {u.id !== me.id && (
              <form action={deleteUserAction} className="ml-auto">
                <input type="hidden" name="id" value={u.id} />
                <button className="text-xs text-red-600 hover:underline">Delete</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
