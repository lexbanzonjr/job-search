import { JobCard } from "@/components/JobCard";
import { listSaved } from "@/lib/jobs/store";
import { SAVED_STATUSES } from "@/lib/jobs/types";
import { updateSavedAction } from "../actions";

export const dynamic = "force-dynamic";

export default function SavedPage() {
  const jobs = listSaved();
  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Saved jobs ({jobs.length})</h1>
      {jobs.length === 0 && <p className="text-sm text-zinc-500">Nothing saved yet. Use ☆ Save on any job.</p>}
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} saved>
          <form action={updateSavedAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="jobId" value={job.id} />
            <select name="status" defaultValue={job.status} className="input w-36">
              {SAVED_STATUSES.map((s) => (
                <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <input name="notes" defaultValue={job.notes} placeholder="Notes" className="input flex-1" />
            <button className="btn-secondary">Update</button>
          </form>
        </JobCard>
      ))}
    </main>
  );
}
