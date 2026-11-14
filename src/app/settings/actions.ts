"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { setLinkedInApi } from "@/lib/settings";

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  await setLinkedInApi(formData.get("linkedinApi") === "1");
  revalidatePath("/settings");
  revalidatePath("/matches");
}
