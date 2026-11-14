"use server";

import { getCoverLetter, llmCoverLetter, saveCoverLetter } from "@/lib/ai/cover-letter";
import { getJobsByIds } from "@/lib/jobs/store";
import { getLatestResume } from "@/lib/resume/store";
import { requireUser } from "@/lib/session";
import { consume, LimitError } from "@/lib/usage";

export type CoverLetterResult = { text: string } | { error: string };

/** Write (or return the saved) cover letter for a job. Only runs when the user clicks the button. */
export async function generateCoverLetterAction(jobId: number, regenerate = false): Promise<CoverLetterResult> {
  const user = await requireUser();
  if (!regenerate) {
    const existing = await getCoverLetter(user.id, jobId);
    if (existing) return { text: existing };
  }
  const [resume, [job]] = await Promise.all([getLatestResume(user.id), getJobsByIds([jobId])]);
  if (!resume) return { error: "Upload your resume first." };
  if (!job) return { error: "Job not found." };
  try {
    await consume(user, "cover");
    const text = await llmCoverLetter(resume, job);
    await saveCoverLetter(user.id, jobId, text);
    return { text };
  } catch (e) {
    return { error: e instanceof LimitError ? e.message : `Couldn't write the letter: ${e instanceof Error ? e.message : e}` };
  }
}

export async function saveCoverLetterAction(jobId: number, text: string): Promise<void> {
  const user = await requireUser();
  await saveCoverLetter(user.id, jobId, text);
}
