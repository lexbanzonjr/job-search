"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { deleteUser, upsertUser } from "@/lib/users";

export async function saveUserAction(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireAdmin();
  try {
    await upsertUser(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  revalidatePath("/users");
  return null;
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (id === admin.id) throw new Error("You can't delete yourself.");
  await deleteUser(id);
  revalidatePath("/users");
}
