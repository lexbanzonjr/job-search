import { generateText, Output } from "ai";
import { z } from "zod";
import type { CommitDetail } from "@/lib/github/client";
import { getModel } from "./model";
import type { ResumeProfile } from "./profile";

export const MIN_CHANGED_LINES = 10;
export const BATCH_SIZE = 5;

export const commitReviewSchema = z.object({
  sha: z.string(),
  what: z.string().describe("1-2 sentences: what the change does, in plain language"),
  why: z.string().describe("1-2 sentences: the likely motivation or problem solved, inferred from message and diff"),
  impactScore: z.number().int().min(1).max(5).describe("1 = trivial, 5 = significant feature/architecture/performance work"),
  resumeWorthy: z.boolean().describe("true only if this shows skill or impact a hiring manager would care about"),
  bullet: z.string().describe("One resume bullet: strong action verb, what + result. No invented metrics. Empty if not resume-worthy"),
  kind: z.enum(["work", "personal"]).describe("work if done for an employer in the experience list, personal for side/open-source projects"),
  experienceIndex: z.number().int().describe("Index into the experience list this work best belongs to, or -1 if none fits"),
  projectIndex: z.number().int().describe("Index into the projects list this work belongs to, or -1 if none fits"),
});

export type CommitReview = z.infer<typeof commitReviewSchema>;

const TRIVIAL = /^(wip|typo|fix typo|lint|format(ting)?|bump|chore\b|merge\b|revert\b|update readme)/i;

/** Cheap filter so the model only sees commits with some substance. */
export function isWorthReviewing(c: CommitDetail): boolean {
  if (TRIVIAL.test(c.message.trim())) return false;
  return c.additions + c.deletions >= MIN_CHANGED_LINES && c.patch.length > 0;
}

export function commitReviewPrompt(commits: CommitDetail[], profile: ResumeProfile | null): string {
  const exp = (profile?.experience ?? [])
    .map((e, i) => `${i}. ${e.title} at ${e.company} (${e.startDate} - ${e.endDate})`)
    .join("\n");
  const projects = (profile?.projects ?? []).map((p, i) => `${i}. ${p.name}${p.url ? ` (${p.url})` : ""}`).join("\n");
  const body = commits
    .map(
      (c) =>
        `<commit sha="${c.sha}" repo="${c.repo}" date="${c.committedAt ?? ""}" additions="${c.additions}" deletions="${c.deletions}">\n` +
        `<message>\n${c.message}\n</message>\n<diff>\n${c.patch}\n</diff>\n</commit>`,
    )
    .join("\n\n");
  return `<experience>\n${exp || "(none)"}\n</experience>\n<projects>\n${projects || "(none)"}\n</projects>\n\n${body}`;
}

export async function reviewCommits(commits: CommitDetail[], profile: ResumeProfile | null): Promise<CommitReview[]> {
  const out: CommitReview[] = [];
  for (let i = 0; i < commits.length; i += BATCH_SIZE) {
    const batch = commits.slice(i, i + BATCH_SIZE);
    const { output } = await generateText({
      model: getModel(),
      instructions:
        "You are a senior engineer helping a developer mine their git history for resume material. " +
        "For each commit, explain what changed and infer why from the message and diff. " +
        "Judge whether it is resume-worthy: features, architecture, performance, reliability, security, and tooling that others use count; " +
        "small fixes, renames, formatting, and config tweaks usually don't. " +
        "Write bullets in past tense with a strong action verb, focused on outcome. Never invent numbers or results not evident in the diff. " +
        "Decide whether each commit is work (for an employer in the experience list) or personal (side, open-source, or hobby). " +
        "A repo under the developer's own account whose name doesn't match an employer is likely personal. " +
        "For work, pick the experience entry whose company and dates fit the commit date; for personal, pick the matching project or -1. " +
        "Return one review per commit, using its sha.",
      prompt: commitReviewPrompt(batch, profile),
      output: Output.object({ schema: z.object({ reviews: z.array(commitReviewSchema) }) }),
    });
    const shas = new Set(batch.map((c) => c.sha));
    out.push(...output.reviews.filter((r) => shas.has(r.sha)));
  }
  return out;
}
