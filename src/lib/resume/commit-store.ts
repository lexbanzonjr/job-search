import { all, dbOr, one, type Db } from "@/lib/db";
import type { CommitReview } from "@/lib/ai/commit-review";
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
  experienceIndex: number;
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
  target_experience_index: number | null;
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
  experienceIndex: Number(r.target_experience_index ?? -1),
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
               suggested_bullet, target_experience_index, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, repo, sha) DO NOTHING`,
      args: [
        userId, c.repo, c.sha, c.committedAt, c.message,
        r?.what ?? null, r?.why ?? null, r?.impactScore ?? null, r?.resumeWorthy ? 1 : 0,
        r?.bullet ?? null, r?.experienceIndex ?? null, status,
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

/** Return a copy of `profile` with `bullet` appended to experience[index].highlights. */
export function addHighlight<P extends { experience: { highlights: string[] }[] }>(profile: P, index: number, bullet: string): P {
  const text = bullet.trim();
  if (!text) throw new Error("Bullet is empty.");
  if (!Number.isInteger(index) || index < 0 || index >= profile.experience.length) throw new Error("Pick a role for this bullet.");
  return {
    ...profile,
    experience: profile.experience.map((e, i) =>
      i === index && !e.highlights.includes(text) ? { ...e, highlights: [...e.highlights, text] } : e,
    ),
  };
}
