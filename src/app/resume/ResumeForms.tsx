"use client";

import { useActionState } from "react";
import type { ResumeProfile } from "@/lib/ai/profile";
import { reanalyzeAction, saveProfileAction, uploadResumeAction, type ActionState } from "./actions";

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`text-sm ${state.error ? "text-red-600" : "text-green-700"}`}>{state.error ?? state.ok}</p>;
}

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadResumeAction, null);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Upload resume</h2>
      <input type="file" name="resume" accept=".pdf,.docx,.txt,.md" required className="block text-sm" />
      <button disabled={pending} className="btn">{pending ? "Reading resume…" : "Upload & analyze"}</button>
      <Status state={state} />
    </form>
  );
}

const SENIORITY = ["intern", "junior", "mid", "senior", "lead", "principal", "executive"] as const;

export function ProfileForm({ profile }: { profile: ResumeProfile | null }) {
  const [state, action, pending] = useActionState(saveProfileAction, null);
  const [reState, reAction, rePending] = useActionState(reanalyzeAction, null);
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
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">AI profile</h2>
        <form action={reAction}>
          <button disabled={rePending} className="btn-secondary">{rePending ? "Analyzing…" : "Re-analyze"}</button>
        </form>
      </div>
      <Status state={reState} />
      {!p && <p className="text-sm text-zinc-500">No profile yet. Click Re-analyze.</p>}
      <form action={action} key={JSON.stringify(p)} className="space-y-3">
        {field("Name", "name", p?.name ?? "")}
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Summary</span>
          <textarea name="summary" defaultValue={p?.summary ?? ""} rows={3} className="input" />
        </label>
        {field("Target titles", "targetTitles", p?.targetTitles.join(", ") ?? "", "comma-separated; drives AI search queries")}
        {field("Skills", "skills", p?.skills.join(", ") ?? "", "comma-separated")}
        <div className="grid grid-cols-2 gap-3">
          {field("Years of experience", "yearsExperience", String(p?.yearsExperience ?? 0))}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Seniority</span>
            <select name="seniority" defaultValue={p?.seniority ?? "mid"} className="input">
              {SENIORITY.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        {field("Locations", "locations", p?.locations.join(", ") ?? "", "comma-separated")}
        {field("Industries", "industries", p?.industries.join(", ") ?? "", "comma-separated")}
        <button disabled={pending} className="btn">{pending ? "Saving…" : "Save profile"}</button>
        <Status state={state} />
      </form>
    </div>
  );
}
