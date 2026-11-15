"use client";

import { useActionState, useState } from "react";
import type { StoredReview } from "@/lib/resume/commit-store";
import { acceptReviewAction, rejectReviewAction, scanCommitsAction, type GitActionState } from "./git/actions";

export type Choice = { index: number; label: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-02-14T…" -> "Feb 2026". */
export function monthYear(iso: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}

/** The AI's pick when it still exists, else a sensible default for work vs personal. */
export function defaultTarget(review: StoredReview, roles: Choice[], projects: Choice[]): string {
  if (review.kind === "personal") {
    if (projects.some((p) => p.index === review.projectIndex)) return `proj:${review.projectIndex}`;
    return "new-proj";
  }
  if (roles.some((r) => r.index === review.experienceIndex)) return `exp:${review.experienceIndex}`;
  return roles.length ? `exp:${roles[0].index}` : "new-exp";
}

function Status({ state }: { state: GitActionState }) {
  if (!state) return null;
  return <p className={`text-sm ${state.error ? "text-red-600" : "text-green-700"}`}>{state.error ?? state.ok}</p>;
}

function Field({ label, name, defaultValue, required, placeholder }: {
  label: string; name: string; defaultValue?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="block space-y-1 text-xs">
      <span className="font-medium text-zinc-600">{label}</span>
      <input name={name} defaultValue={defaultValue} required={required} placeholder={placeholder} className="input" />
    </label>
  );
}

function Suggestion({ review, roles, projects }: { review: StoredReview; roles: Choice[]; projects: Choice[] }) {
  const [state, accept, accepting] = useActionState(acceptReviewAction, null);
  const [rejState, reject, rejecting] = useActionState(rejectReviewAction, null);
  const [target, setTarget] = useState(() => defaultTarget(review, roles, projects));
  const date = monthYear(review.committedAt);
  const repoName = review.repo.split("/")[1] ?? review.repo;

  return (
    <li className="space-y-2 border-t border-zinc-200 pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">Impact {review.impactScore}/5</span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5">{review.kind === "personal" ? "Personal" : "Work"}</span>
        <span>{review.repo}</span>
        <code>{review.sha.slice(0, 7)}</code>
        {review.committedAt && <span>{review.committedAt.slice(0, 10)}</span>}
      </div>
      <p className="text-sm"><span className="font-medium">What:</span> {review.what}</p>
      <p className="text-sm"><span className="font-medium">Why:</span> {review.why}</p>
      <form action={accept} className="space-y-2">
        <input type="hidden" name="id" value={review.id} />
        <textarea name="bullet" defaultValue={review.bullet} rows={2} className="input w-full" />
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-zinc-600">Add to</span>
          <select name="target" value={target} onChange={(e) => setTarget(e.target.value)} className="input">
            <optgroup label="Experience">
              {roles.map((r) => (
                <option key={r.index} value={`exp:${r.index}`}>{r.label}</option>
              ))}
              <option value="new-exp">+ New experience…</option>
            </optgroup>
            <optgroup label="Projects">
              {projects.map((p) => (
                <option key={p.index} value={`proj:${p.index}`}>{p.label}</option>
              ))}
              <option value="new-proj">+ New project…</option>
            </optgroup>
          </select>
        </label>
        {target === "new-exp" && (
          <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 p-3">
            <Field label="Title" name="newTitle" required />
            <Field label="Company" name="newCompany" required />
            <Field label="Location" name="newLocation" placeholder="City or Remote" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start" name="newStart" defaultValue={date} />
              <Field label="End" name="newEnd" defaultValue="Present" />
            </div>
          </div>
        )}
        {target === "new-proj" && (
          <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 p-3">
            <Field label="Name" name="newName" defaultValue={repoName} required />
            <Field label="Link" name="newUrl" defaultValue={`https://github.com/${review.repo}`} />
            <Field label="Tech (comma-separated)" name="newTech" placeholder="TypeScript, Next.js" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start" name="newStart" defaultValue={date} />
              <Field label="End" name="newEnd" defaultValue="Present" />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={accepting} className="btn">{accepting ? "Adding…" : "Add to resume"}</button>
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

export function GitCommitsPanel({ reviews, roles, projects, repos, repoError }: {
  reviews: StoredReview[];
  roles: Choice[];
  projects: Choice[];
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
      {reviews.length > 0 ? (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <Suggestion key={r.id} review={r} roles={roles} projects={projects} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No suggestions waiting.</p>
      )}
    </div>
  );
}
