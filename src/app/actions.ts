"use server";

import { revalidatePath } from "next/cache";
import { saveJob, unsaveJob, updateSaved } from "@/lib/jobs/store";
import { requireUser } from "@/lib/session";
import { SAVED_STATUSES, type SavedStatus } from "@/lib/jobs/types";

export async function toggleSaveAction(jobId: number, saved: boolean) {
  const user = await requireUser();
  if (saved) await unsaveJob(user.id, jobId);
  else await saveJob(user.id, jobId);
  revalidatePath("/", "layout");
}

export async function updateSavedAction(formData: FormData) {
  const user = await requireUser();
  const jobId = Number(formData.get("jobId"));
  const status = String(formData.get("status")) as SavedStatus;
  if (!SAVED_STATUSES.includes(status)) throw new Error("Invalid status");
  await updateSaved(user.id, jobId, status, String(formData.get("notes") ?? ""));
  revalidatePath("/saved");
}
