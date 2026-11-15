"use server";

import { revalidatePath } from "next/cache";
import { isWorthReviewing, reviewCommits } from "@/lib/ai/commit-review";
import { getCommitDetail, searchMyCommits } from "@/lib/github/client";
import { addBullet, getReview, insertReviews, knownShas, setReviewStatus, type BulletTarget } from "@/lib/resume/commit-store";
import { getLatestResume, updateProfile } from "@/lib/resume/store";
import { requireAdmin } from "@/lib/session";

export type GitActionState = { error?: string; ok?: string } | null;

/** Max new commits sent through the AI per scan, to bound cost. */
const MAX_COMMITS_PER_SCAN = 50;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Form `target` is "exp:<i>", "proj:<i>", "new-exp", or "new-proj" (with new* fields). */
function parseTarget(f: FormData): BulletTarget {
  const t = str(f, "target");
  if (t === "new-exp") {
    return {
      kind: "newExperience",
      entry: { title: str(f, "newTitle"), company: str(f, "newCompany"), location: str(f, "newLocation"), startDate: str(f, "newStart"), endDate: str(f, "newEnd") },
    };
  }
  if (t === "new-proj") {
    return {
      kind: "newProject",
      entry: {
        name: str(f, "newName"), url: str(f, "newUrl"), startDate: str(f, "newStart"), endDate: str(f, "newEnd"),
        tech: str(f, "newTech").split(",").map((s) => s.trim()).filter(Boolean),
      },
    };
  }
  const [kind, i] = t.split(":");
  if (kind === "proj") return { kind: "project", index: Number(i) };
  if (kind === "exp") return { kind: "experience", index: Number(i) };
  throw new Error("Pick where this bullet goes.");
}
const REPO = /^[\w.-]+\/[\w.-]+$/;

// GITHUB_TOKEN belongs to the admin, so only the admin can scan (and act on) their commits.
export async function scanCommitsAction(_prev: GitActionState, formData: FormData): Promise<GitActionState> {
  const user = await requireAdmin();
  const repo = String(formData.get("repo") ?? "").trim();
  const since = String(formData.get("since") ?? "").trim() || undefined;
  const until = String(formData.get("until") ?? "").trim() || undefined;
  if (!REPO.test(repo)) return { error: "Pick a repo (owner/name)." };
  try {
    const resume = await getLatestResume(user.id);
    const seen = await knownShas(user.id, repo);
    const fresh = (await searchMyCommits({ repo, since, until, limit: 100 }))
      .filter((c) => !seen.has(c.sha))
      .slice(0, MAX_COMMITS_PER_SCAN);
    if (fresh.length === 0) return { ok: "No new commits to review." };
    const details = await Promise.all(fresh.map((c) => getCommitDetail(repo, c.sha)));
    const reviews = await reviewCommits(details.filter(isWorthReviewing), resume?.profile ?? null);
    const added = await insertReviews(user.id, fresh, reviews);
    revalidatePath("/resume");
    return { ok: `Reviewed ${fresh.length} commits; ${added} suggestion${added === 1 ? "" : "s"} ready.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function acceptReviewAction(_prev: GitActionState, formData: FormData): Promise<GitActionState> {
  const user = await requireAdmin();
  const id = Number(formData.get("id"));
  const bullet = String(formData.get("bullet") ?? "");
  const review = await getReview(user.id, id);
  if (!review || review.status !== "pending") return { error: "Suggestion not found." };
  const resume = await getLatestResume(user.id);
  if (!resume?.profile) return { error: "Upload a resume first." };
  try {
    await updateProfile(user.id, resume.id, addBullet(resume.profile, parseTarget(formData), bullet));
    await setReviewStatus(user.id, id, "accepted");
    revalidatePath("/resume");
    return { ok: "Added to your resume." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function rejectReviewAction(_prev: GitActionState, formData: FormData): Promise<GitActionState> {
  const user = await requireAdmin();
  await setReviewStatus(user.id, Number(formData.get("id")), "rejected");
  revalidatePath("/resume");
  return { ok: "Dismissed." };
}
