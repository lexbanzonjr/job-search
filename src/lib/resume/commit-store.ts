import { all, dbOr, one, type Db } from "@/lib/db";
import type { CommitReview } from "@/lib/ai/commit-review";
import type { ExperienceEntry, ProjectEntry, ResumeProfile } from "@/lib/ai/profile";
import type { CommitSummary } from "@/lib/github/client";

export type ReviewStatus = "pending" | "accepted" | "rejected";

export interface StoredReview {
  id: number;
  repo: string;
  sha: string;
  committedAt: string | null;
  message: string;
  what: string;
  why: string;
  impactScore: number;
  resumeWorthy: boolean;
  bullet: string;
  kind: "work" | "personal";
  experienceIndex: number;
  projectIndex: number;
  status: ReviewStatus;
}

interface Row {
  id: number;
  repo: string;
  sha: string;
  committed_at: string | null;
  message: string;
  what: string | null;
  why: string | null;
  impact_score: number | null;
  resume_worthy: number;
  suggested_bullet: string | null;
  suggested_kind: string | null;
  target_experience_index: number | null;
  target_project_index: number | null;
  status: ReviewStatus;
}

const toReview = (r: Row): StoredReview => ({
  id: Number(r.id),
  repo: r.repo,
  sha: r.sha,
  committedAt: r.committed_at,
  message: r.message,
  what: r.what ?? "",
  why: r.why ?? "",
  impactScore: Number(r.impact_score ?? 0),
  resumeWorthy: Boolean(Number(r.resume_worthy)),
  bullet: r.suggested_bullet ?? "",
  kind: r.suggested_kind === "personal" ? "personal" : "work",
  experienceIndex: Number(r.target_experience_index ?? -1),
  projectIndex: Number(r.target_project_index ?? -1),
  status: r.status,
});

/** Shas from `repo` this user has already reviewed (or skipped). */
export async function knownShas(userId: number, repo: string, db?: Db): Promise<Set<string>> {
  const rows = await all<{ sha: string }>(await dbOr(db), "SELECT sha FROM commit_reviews WHERE user_id = ? AND repo = ?", [userId, repo]);
  return new Set(rows.map((r) => r.sha));
}

/**
 * Store reviews. Commits with no review (filtered out as trivial) are stored as rejected so
 * rescans skip them. Existing rows are left alone.
 */
export async function insertReviews(
  userId: number,
  commits: CommitSummary[],
  reviews: CommitReview[],
  db?: Db,
): Promise<number> {
  const d = await dbOr(db);
  const bySha = new Map(reviews.map((r) => [r.sha, r]));
  let added = 0;
  for (const c of commits) {
    const r = bySha.get(c.sha);
    const status: ReviewStatus = r?.resumeWorthy ? "pending" : "rejected";
    const res = await d.execute({
      sql: `INSERT INTO commit_reviews
              (user_id, repo, sha, committed_at, message, what, why, impact_score, resume_worthy,
               suggested_bullet, suggested_kind, target_experience_index, target_project_index, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, repo, sha) DO NOTHING`,
      args: [
        userId, c.repo, c.sha, c.committedAt, c.message,
        r?.what ?? null, r?.why ?? null, r?.impactScore ?? null, r?.resumeWorthy ? 1 : 0,
        r?.bullet ?? null, r?.kind ?? null, r?.experienceIndex ?? null, r?.projectIndex ?? null, status,
      ],
    });
    if (r?.resumeWorthy) added += res.rowsAffected;
  }
  return added;
}

export async function listReviews(userId: number, status: ReviewStatus = "pending", db?: Db): Promise<StoredReview[]> {
  const rows = await all<Row>(
    await dbOr(db),
    "SELECT * FROM commit_reviews WHERE user_id = ? AND status = ? ORDER BY impact_score DESC, committed_at DESC",
    [userId, status],
  );
  return rows.map(toReview);
}

export async function getReview(userId: number, id: number, db?: Db): Promise<StoredReview | null> {
  const row = await one<Row>(await dbOr(db), "SELECT * FROM commit_reviews WHERE id = ? AND user_id = ?", [id, userId]);
  return row ? toReview(row) : null;
}

export async function setReviewStatus(userId: number, id: number, status: ReviewStatus, db?: Db) {
  await (await dbOr(db)).execute({
    sql: "UPDATE commit_reviews SET status = ? WHERE id = ? AND user_id = ?",
    args: [status, id, userId],
  });
}

/** Where an accepted bullet goes. */
export type BulletTarget =
  | { kind: "experience"; index: number }
  | { kind: "newExperience"; entry: Omit<ExperienceEntry, "highlights"> }
  | { kind: "project"; index: number }
  | { kind: "newProject"; entry: Omit<ProjectEntry, "highlights"> };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Sortable number for dates like "Jan 2020", "2020", or "Present" (unknown sorts last). */
export function dateRank(s: string): number {
  const t = s.trim().toLowerCase();
  if (/^(present|current|now)$/.test(t)) return 999_999;
  const year = t.match(/\b(19|20)\d{2}\b/);
  if (!year) return -1;
  const month = MONTHS.findIndex((m) => t.includes(m));
  return Number(year[0]) * 100 + (month < 0 ? 0 : month + 1);
}

const inRange = (i: number, n: number) => Number.isInteger(i) && i >= 0 && i < n;

const withBullet = <T extends { highlights: string[] }>(e: T, text: string): T =>
  e.highlights.includes(text) ? e : { ...e, highlights: [...e.highlights, text] };

/** Return a copy of `profile` with `bullet` added at `target`. */
export function addBullet(profile: ResumeProfile, target: BulletTarget, bullet: string): ResumeProfile {
  const text = bullet.trim();
  if (!text) throw new Error("Bullet is empty.");
  const experience = profile.experience;
  const projects = profile.projects ?? [];
  switch (target.kind) {
    case "experience":
      if (!inRange(target.index, experience.length)) throw new Error("Pick a role for this bullet.");
      return { ...profile, experience: experience.map((e, i) => (i === target.index ? withBullet(e, text) : e)) };
    case "project":
      if (!inRange(target.index, projects.length)) throw new Error("Pick a project for this bullet.");
      return { ...profile, projects: projects.map((p, i) => (i === target.index ? withBullet(p, text) : p)) };
    case "newExperience": {
      const entry = { ...target.entry, highlights: [text] };
      if (!entry.title.trim() || !entry.company.trim()) throw new Error("A new role needs a title and company.");
      // Keep most-recent-first: insert before the first role that started earlier.
      const rank = dateRank(entry.startDate);
      const at = experience.findIndex((e) => dateRank(e.startDate) < rank);
      const next = [...experience];
      next.splice(at < 0 ? next.length : at, 0, entry);
      return { ...profile, experience: next };
    }
    case "newProject": {
      const entry = { ...target.entry, highlights: [text] };
      if (!entry.name.trim()) throw new Error("A new project needs a name.");
      return { ...profile, projects: [...projects, entry] };
    }
  }
}
