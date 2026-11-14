"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { ExperienceEntry, ResumeProfile } from "@/lib/ai/profile";
import { reanalyzeAction, saveProfileAction, uploadResumeAction, type ActionState } from "./actions";

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`text-sm ${state.error ? "text-red-600" : "text-green-700"}`}>{state.error ?? state.ok}</p>;
}

export function UploadForm({ hasResume }: { hasResume: boolean }) {
  const [state, action, pending] = useActionState(uploadResumeAction, null);
  const [reState, reAction, rePending] = useActionState(reanalyzeAction, null);
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Upload resume</h2>
      <form id="upload-form" action={action}>
        <input
          type="file"
          name="resume"
          accept=".pdf,.docx,.txt,.md"
          required
          className="block text-sm text-zinc-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-50"
        />
      </form>
      <div className="flex flex-wrap gap-2">
        <button form="upload-form" disabled={pending} className="btn">{pending ? "Reading resume…" : "Upload & analyze"}</button>
        {hasResume && (
          <form action={reAction}>
            <button disabled={rePending} className="btn-secondary h-full">{rePending ? "Analyzing…" : "Re-analyze"}</button>
          </form>
        )}
      </div>
      <Status state={state} />
      <Status state={reState} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-zinc-200 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

const SENIORITY = ["intern", "junior", "mid", "senior", "lead", "principal", "executive"] as const;

export function ProfileForm({ profile }: { profile: ResumeProfile | null }) {
  const [state, action, pending] = useActionState(saveProfileAction, null);
  const p = profile;
  const field = (label: string, name: string, value: string, hint?: string) => (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="ml-2 text-xs text-zinc-500">{hint}</span>}
      <input name={name} defaultValue={value} className="input" />
    </label>
  );

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Profile</h2>
      {!p && <p className="text-sm text-zinc-500">No profile yet. Click Re-analyze above.</p>}
      <form action={action} key={JSON.stringify(p)} className="space-y-5">
        <Section title="Basics">
          {field("Name", "name", p?.name ?? "")}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Summary</span>
            <textarea name="summary" defaultValue={p?.summary ?? ""} rows={3} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            {field("Years of experience", "yearsExperience", String(p?.yearsExperience ?? 0))}
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Seniority</span>
              <select name="seniority" defaultValue={p?.seniority ?? "mid"} className="input">
                {SENIORITY.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </Section>
        <Section title="Targeting">
          {field("Target titles", "targetTitles", p?.targetTitles.join(", ") ?? "", "comma-separated; drives AI search queries")}
          {field("Locations", "locations", p?.locations.join(", ") ?? "", "comma-separated")}
          {field("Industries", "industries", p?.industries.join(", ") ?? "", "comma-separated")}
        </Section>
        <Section title="Skills">
          {field("Skills", "skills", p?.skills.join(", ") ?? "", "comma-separated")}
        </Section>
        <Section title="Experience">
          <ExperienceEditor initial={p?.experience ?? []} />
        </Section>
        <button disabled={pending} className="btn">{pending ? "Saving…" : "Save profile"}</button>
        <Status state={state} />
      </form>
    </div>
  );
}

const EMPTY_ROLE: ExperienceEntry = { title: "", company: "", location: "", startDate: "", endDate: "", highlights: [] };
type RoleField = "title" | "company" | "location" | "startDate" | "endDate";

function ExperienceEditor({ initial }: { initial: ExperienceEntry[] }) {
  const [roles, setRoles] = useState(initial);
  const [editing, setEditing] = useState(-1);
  const update = (i: number, patch: Partial<ExperienceEntry>) =>
    setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const input = (i: number, key: RoleField, label: string) => (
    <label className="block space-y-1 text-xs">
      <span className="font-medium text-zinc-600">{label}</span>
      <input value={roles[i][key]} onChange={(e) => update(i, { [key]: e.target.value })} className="input" />
    </label>
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name="experience" value={JSON.stringify(roles)} />
      {roles.length === 0 && <p className="text-sm text-zinc-500">No roles yet.</p>}
      {roles.map((r, i) => (
        <div key={i} className="rounded-md border border-zinc-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {r.title || "Untitled role"}
                {r.company && <span className="font-normal text-zinc-600"> · {r.company}</span>}
              </p>
              <p className="text-xs text-zinc-500">
                {[r.location, [r.startDate, r.endDate].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditing(editing === i ? -1 : i)}>
                {editing === i ? "Done" : "Edit"}
              </button>
              <button
                type="button"
                className="btn-secondary text-red-600"
                onClick={() => {
                  setRoles((rs) => rs.filter((_, j) => j !== i));
                  setEditing(-1);
                }}
              >
                Remove
              </button>
            </div>
          </div>
          {editing === i ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {input(i, "title", "Title")}
                {input(i, "company", "Company")}
                {input(i, "location", "Location")}
                <div className="grid grid-cols-2 gap-2">
                  {input(i, "startDate", "Start")}
                  {input(i, "endDate", "End")}
                </div>
              </div>
              <label className="block space-y-1 text-xs">
                <span className="font-medium text-zinc-600">Highlights (one per line)</span>
                <textarea
                  rows={4}
                  className="input"
                  value={r.highlights.join("\n")}
                  onChange={(e) => update(i, { highlights: e.target.value.split("\n") })}
                />
              </label>
            </div>
          ) : (
            r.highlights.some((h) => h.trim()) && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {r.highlights.filter((h) => h.trim()).map((h, k) => <li key={k}>{h}</li>)}
              </ul>
            )
          )}
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          setRoles((rs) => [...rs, EMPTY_ROLE]);
          setEditing(roles.length);
        }}
      >
        + Add role
      </button>
    </div>
  );
}
