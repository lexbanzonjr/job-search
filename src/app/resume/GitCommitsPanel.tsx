"use client";

import { useActionState } from "react";
import type { StoredReview } from "@/lib/resume/commit-store";
import { acceptReviewAction, rejectReviewAction, scanCommitsAction, type GitActionState } from "./git/actions";

type Role = { index: number; label: string };

function Status({ state }: { state: GitActionState }) {
  if (!state) return null;
  return <p className={`text-sm ${state.error ? "text-red-600" : "text-green-700"}`}>{state.error ?? state.ok}</p>;
}

function Suggestion({ review, roles }: { review: StoredReview; roles: Role[] }) {
  const [state, accept, accepting] = useActionState(acceptReviewAction, null);
  const [rejState, reject, rejecting] = useActionState(rejectReviewAction, null);
  const defaultRole = roles.some((r) => r.index === review.experienceIndex) ? review.experienceIndex : roles[0]?.index ?? -1;
  return (
    <li className="space-y-2 border-t border-zinc-200 pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">Impact {review.impactScore}/5</span>
        <span>{review.repo}</span>
        <code>{review.sha.slice(0, 7)}</code>
        {review.committedAt && <span>{review.committedAt.slice(0, 10)}</span>}
      </div>
      <p className="text-sm"><span className="font-medium">What:</span> {review.what}</p>
      <p className="text-sm"><span className="font-medium">Why:</span> {review.why}</p>
      <form action={accept} className="space-y-2">
        <input type="hidden" name="id" value={review.id} />
        <textarea name="bullet" defaultValue={review.bullet} rows={2} className="input w-full" />
        <div className="flex flex-wrap items-center gap-2">
          <select name="experienceIndex" defaultValue={defaultRole} className="input w-auto">
            {roles.map((r) => (
              <option key={r.index} value={r.index}>{r.label}</option>
            ))}
          </select>
          <button disabled={accepting || roles.length === 0} className="btn">{accepting ? "Adding…" : "Add to resume"}</button>
          <button formAction={reject} formNoValidate disabled={rejecting} className="btn-secondary">
            {rejecting ? "…" : "Dismiss"}
          </button>
        </div>
      </form>
      <Status state={state} />
      <Status state={rejState} />
    </li>
  );
}

export function GitCommitsPanel({ reviews, roles, repos, repoError }: {
  reviews: StoredReview[];
  roles: Role[];
  repos: string[];
  repoError?: string;
}) {
  const [state, scan, scanning] = useActionState(scanCommitsAction, null);
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold">From Git</h2>
        <p className="text-sm text-zinc-500">
          Scan your commits; AI explains what and why, and suggests bullets for the ones worth adding.
        </p>
      </div>
      {repoError ? (
        <p className="text-sm text-red-600">{repoError}</p>
      ) : (
        <form action={scan} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Repo</span>
            <select name="repo" required className="input w-auto">
              {repos.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Since</span>
            <input type="date" name="since" className="input w-auto" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Until</span>
            <input type="date" name="until" className="input w-auto" />
          </label>
          <button disabled={scanning} className="btn">{scanning ? "Reviewing commits…" : "Scan"}</button>
        </form>
      )}
      <Status state={state} />
      {roles.length === 0 && reviews.length > 0 && (
        <p className="text-sm text-zinc-500">Add a work experience entry to your profile to place these bullets.</p>
      )}
      {reviews.length > 0 ? (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <Suggestion key={r.id} review={r} roles={roles} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No suggestions waiting.</p>
      )}
    </div>
  );
}
