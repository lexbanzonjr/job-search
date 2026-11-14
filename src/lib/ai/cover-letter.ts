import { generateText } from "ai";
import { all, dbOr, one, type Db } from "@/lib/db";
import type { StoredJob } from "@/lib/jobs/types";
import type { Resume } from "@/lib/resume/store";
import { getModel } from "./model";

export function coverLetterPrompt(resume: Resume, job: StoredJob): string {
  const p = resume.profile;
  return [
    "<resume>",
    resume.text.slice(0, 20_000),
    "</resume>",
    p ? `<profile>\nName: ${p.name}\nSummary: ${p.summary}\nSkills: ${p.skills.join(", ")}\n</profile>` : "",
    "<job>",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}${job.remote ? " (remote)" : ""}`,
    job.description.slice(0, 6_000),
    "</job>",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function llmCoverLetter(resume: Resume, job: StoredJob): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    instructions:
      "You write cover letters for job applications. Write one for this candidate and job: 3-4 short paragraphs, " +
      "about 250-350 words, confident and specific, no clichés. Open with why this role at this company, connect " +
      "2-3 concrete achievements from the resume to the job's key requirements, and close with a brief call to action. " +
      "Only use facts from the resume; never invent experience, numbers or employers. Do not use placeholders or " +
      "brackets: if a detail (like the hiring manager's name) is unknown, write around it (e.g. 'Dear Hiring Team,'). " +
      "Sign off with the candidate's name if it's in the resume. Output only the letter as plain text.",
    prompt: coverLetterPrompt(resume, job),
  });
  return text.trim();
}

export async function getCoverLetters(userId: number, jobIds: number[], db?: Db): Promise<Map<number, string>> {
  if (!jobIds.length) return new Map();
  const rows = await all<{ job_id: number; text: string }>(
    await dbOr(db),
    `SELECT job_id, text FROM cover_letters WHERE user_id = ? AND job_id IN (${jobIds.map(() => "?").join(",")})`,
    [userId, ...jobIds],
  );
  return new Map(rows.map((r) => [Number(r.job_id), r.text]));
}

export async function getCoverLetter(userId: number, jobId: number, db?: Db): Promise<string | null> {
  return (await one<{ text: string }>(await dbOr(db), "SELECT text FROM cover_letters WHERE user_id = ? AND job_id = ?", [userId, jobId]))?.text ?? null;
}

export async function saveCoverLetter(userId: number, jobId: number, text: string, db?: Db) {
  await (await dbOr(db)).execute({
    sql: `INSERT INTO cover_letters (user_id, job_id, text) VALUES (?, ?, ?)
          ON CONFLICT(user_id, job_id) DO UPDATE SET text = excluded.text, created_at = datetime('now')`,
    args: [userId, jobId, text],
  });
}
