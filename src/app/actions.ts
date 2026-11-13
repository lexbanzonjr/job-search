"use server";

import { revalidatePath } from "next/cache";
import { saveJob, unsaveJob, updateSaved } from "@/lib/jobs/store";
import { SAVED_STATUSES, type SavedStatus } from "@/lib/jobs/types";

export async function toggleSaveAction(jobId: number, saved: boolean) {
  if (saved) unsaveJob(jobId);
  else saveJob(jobId);
  revalidatePath("/", "layout");
}

export async function updateSavedAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const status = String(formData.get("status")) as SavedStatus;
  if (!SAVED_STATUSES.includes(status)) throw new Error("Invalid status");
  updateSaved(jobId, status, String(formData.get("notes") ?? ""));
  revalidatePath("/saved");
}
