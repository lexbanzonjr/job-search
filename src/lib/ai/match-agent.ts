import { generateText, Output } from "ai";
import { z } from "zod";
import { all, dbOr, type Db } from "@/lib/db";
import { isListingDead } from "@/lib/jobs/liveness";
import { getJobsByIds } from "@/lib/jobs/store";
import type { SearchParams, StoredJob } from "@/lib/jobs/types";
import { getModel } from "./model";
import type { ResumeProfile } from "./profile";

export interface MatchOptions {
  location?: string;
  remoteOnly?: boolean;
  linkedinOnly?: boolean;
  datePosted?: SearchParams["datePosted"];
}

export interface JobScore {
  jobId: number;
  score: number;
  matchedSkills: string[];
  gaps: string[];
  reason: string;
}

export interface MatchResult extends JobScore {
  job: StoredJob;
}

export type ProgressEvent =
  | { type: "status"; message: string }
  | { type: "queries"; queries: string[] }
  | { type: "found"; count: number }
  | { type: "scored"; done: number; total: number }
  | { type: "done"; count: number }
  | { type: "error"; message: string };

export interface AgentDeps {
  generateQueries(profile: ResumeProfile, opts: MatchOptions): Promise<string[]>;
  search(params: SearchParams): Promise<StoredJob[]>;
  scoreJobs(profile: ResumeProfile, jobs: StoredJob[]): Promise<JobScore[]>;
  /** True when the listing is confirmed gone. Omitted → every job is treated as live. */
  isDead?(job: StoredJob): Promise<boolean>;
}

export const MAX_SCORED = 30;
const SCORE_BATCH = 10;
const LIVENESS_BATCH = 5;

// ---------- pure helpers ----------

export function dedupeJobs(jobs: StoredJob[]): StoredJob[] {
  const seen = new Set<string>();
  return jobs.filter((j) => {
    // Same posting is often syndicated with different ids; key on title+company too.
    const key = `${j.title}|${j.company}`.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(String(j.id)) || seen.has(key)) return false;
    seen.add(String(j.id));
    seen.add(key);
    return true;
  });
}

const tokens = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []);

/** Cheap keyword relevance so only the most promising jobs are sent to the model. */
export function keywordScore(profile: ResumeProfile, job: StoredJob): number {
  const title = job.title.toLowerCase();
  const desc = job.description.toLowerCase();
  let score = 0;
  for (const t of profile.targetTitles) {
    const tt = t.toLowerCase();
    if (title.includes(tt)) score += 10;
    else {
      const words = [...tokens(tt)].filter((w) => w.length > 2);
      score += words.filter((w) => title.includes(w)).length * 2;
    }
  }
  for (const skill of profile.skills) {
    const s = skill.toLowerCase();
    if (title.includes(s)) score += 3;
    else if (desc.includes(s)) score += 1;
  }
  return score;
}

export function prefilter(profile: ResumeProfile, jobs: StoredJob[], limit = MAX_SCORED): StoredJob[] {
  return jobs
    .map((job, i) => ({ job, i, s: keywordScore(profile, job) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.job);
}

export function mergeScores(jobs: StoredJob[], scores: JobScore[]): MatchResult[] {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const seen = new Set<number>();
  const out: MatchResult[] = [];
  for (const s of scores) {
    const job = byId.get(s.jobId);
    if (!job || seen.has(s.jobId)) continue;
    seen.add(s.jobId);
    out.push({ ...s, score: Math.max(0, Math.min(100, Math.round(s.score))), job });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------- agent ----------

export async function runMatchAgent(
  profile: ResumeProfile,
  opts: MatchOptions,
  deps: AgentDeps,
  onProgress: (e: ProgressEvent) => void = () => {},
): Promise<MatchResult[]> {
  onProgress({ type: "status", message: "Planning searches from your resume…" });
  const queries = (await deps.generateQueries(profile, opts)).slice(0, 5);
  onProgress({ type: "queries", queries });

  const found: StoredJob[] = [];
  for (const query of queries) {
    onProgress({ type: "status", message: `Searching: ${query}` });
    try {
      found.push(
        ...(await deps.search({
          query,
          location: opts.location,
          remoteOnly: opts.remoteOnly,
          linkedinOnly: opts.linkedinOnly,
          datePosted: opts.datePosted ?? "month",
        })),
      );
    } catch (e) {
      onProgress({ type: "status", message: `Search failed for "${query}": ${e instanceof Error ? e.message : e}` });
    }
  }
  const unique = dedupeJobs(found);
  onProgress({ type: "found", count: unique.length });
  if (!unique.length) return [];

  const ranked = prefilter(profile, unique, unique.length);
  let shortlist = ranked.slice(0, MAX_SCORED);
  if (deps.isDead) {
    onProgress({ type: "status", message: "Checking listings are still open…" });
    shortlist = [];
    let skipped = 0;
    for (let i = 0; i < ranked.length && shortlist.length < MAX_SCORED; i += LIVENESS_BATCH) {
      const batch = ranked.slice(i, i + LIVENESS_BATCH);
      const dead = await Promise.all(batch.map((j) => deps.isDead!(j).catch(() => false)));
      batch.forEach((j, k) => {
        if (dead[k]) skipped++;
        else if (shortlist.length < MAX_SCORED) shortlist.push(j);
      });
    }
    if (skipped) onProgress({ type: "status", message: `Skipped ${skipped} expired listing${skipped === 1 ? "" : "s"}` });
    if (!shortlist.length) return [];
  }
  const scores: JobScore[] = [];
  for (let i = 0; i < shortlist.length; i += SCORE_BATCH) {
    onProgress({ type: "scored", done: i, total: shortlist.length });
    scores.push(...(await deps.scoreJobs(profile, shortlist.slice(i, i + SCORE_BATCH))));
  }
  onProgress({ type: "scored", done: shortlist.length, total: shortlist.length });
  return mergeScores(shortlist, scores);
}

// ---------- LLM-backed deps ----------

const profileBlock = (p: ResumeProfile) =>
  [
    `Summary: ${p.summary}`,
    `Target titles: ${p.targetTitles.join(", ")}`,
    `Skills: ${p.skills.join(", ")}`,
    `Experience: ${p.yearsExperience} years (${p.seniority})`,
    `Locations: ${p.locations.join(", ") || "n/a"}`,
    `Industries: ${p.industries.join(", ") || "n/a"}`,
  ].join("\n");

export async function llmGenerateQueries(profile: ResumeProfile, opts: MatchOptions): Promise<string[]> {
  const { output } = await generateText({
    model: getModel(),
    instructions:
      "You plan job searches. Write 3-5 short job-board search queries (2-5 words each, like a human would type) " +
      "that together cover the best-fitting roles for this candidate. Vary titles and key skills. " +
      "Do not include locations, 'remote', or site names; those are added separately.",
    prompt: `${profileBlock(profile)}\n${opts.remoteOnly ? "Candidate wants remote roles." : ""}`,
    output: Output.object({ schema: z.object({ queries: z.array(z.string()).min(1).max(5) }) }),
  });
  return [...new Set(output.queries.map((q) => q.trim()).filter(Boolean))];
}

const scoreSchema = z.object({
  scores: z.array(
    z.object({
      jobId: z.number(),
      score: z.number().describe("0-100 fit score"),
      matchedSkills: z.array(z.string()),
      gaps: z.array(z.string()).describe("Requirements the candidate appears to lack"),
      reason: z.string().describe("One or two sentences explaining the score"),
    }),
  ),
});

export async function llmScoreJobs(profile: ResumeProfile, jobs: StoredJob[]): Promise<JobScore[]> {
  const jobsBlock = jobs
    .map(
      (j) =>
        `<job id="${j.id}">\nTitle: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location}${j.remote ? " (remote)" : ""}\n` +
        `Type: ${j.employmentType}\n${j.description.slice(0, 2500)}\n</job>`,
    )
    .join("\n");
  const { output } = await generateText({
    model: getModel(),
    instructions:
      "You are an expert recruiter scoring how well a candidate fits each job. Score 0-100: " +
      "90+ = excellent fit, 70-89 = strong, 50-69 = partial, <50 = weak. Weigh title/seniority match, " +
      "required skills, years of experience, and domain. Be honest about gaps. Return one entry per job id.",
    prompt: `<candidate>\n${profileBlock(profile)}\n</candidate>\n\n${jobsBlock}`,
    output: Output.object({ schema: scoreSchema }),
  });
  return output.scores;
}

export const llmDeps = (search: AgentDeps["search"]): AgentDeps => ({
  generateQueries: llmGenerateQueries,
  scoreJobs: llmScoreJobs,
  isDead: (job) => isListingDead(job.applyUrl),
  search,
});

// ---------- persistence ----------

export async function saveMatches(resumeId: number, results: MatchResult[], db?: Db) {
  await (await dbOr(db)).batch(
    [
      { sql: "DELETE FROM matches WHERE resume_id = ?", args: [resumeId] },
      ...results.map((r) => ({
        sql: "INSERT INTO matches (resume_id, job_id, score, reasons_json) VALUES (?, ?, ?, ?)",
        args: [resumeId, r.jobId, r.score, JSON.stringify({ matchedSkills: r.matchedSkills, gaps: r.gaps, reason: r.reason })],
      })),
    ],
    "write",
  );
}

export async function listMatches(resumeId: number, db?: Db): Promise<MatchResult[]> {
  const c = await dbOr(db);
  const rows = await all<{ job_id: number; score: number; reasons_json: string }>(
    c,
    "SELECT job_id, score, reasons_json FROM matches WHERE resume_id = ? ORDER BY score DESC",
    [resumeId],
  );
  const jobs = new Map((await getJobsByIds(rows.map((r) => Number(r.job_id)), c)).map((j) => [j.id, j]));
  return rows.flatMap((r) => {
    const job = jobs.get(Number(r.job_id));
    return job ? [{ jobId: Number(r.job_id), score: Number(r.score), ...JSON.parse(r.reasons_json), job }] : [];
  });
}
