import Link from "next/link";
import { JobCard } from "@/components/JobCard";
import { getSavedIds, searchJobs } from "@/lib/jobs/store";
import { requireUser } from "@/lib/session";
import type { DatePosted, EmploymentType, SearchParams, StoredJob } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function parseParams(q: Query): SearchParams {
  return {
    query: one(q.q),
    location: one(q.location),
    remoteOnly: one(q.remote) === "1",
    datePosted: (one(q.date) || "all") as DatePosted,
    employmentType: one(q.type) as EmploymentType | "",
    linkedinOnly: one(q.linkedin) === "1",
    cursor: one(q.cursor) || undefined,
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const q = await searchParams;
  const p = parseParams(q);
  // LinkedIn-only is on by default for a fresh form.
  const linkedinChecked = p.query ? p.linkedinOnly : true;

  let jobs: StoredJob[] = [];
  let nextCursor: string | null = null;
  let error = "";
  if (p.query.trim()) {
    try {
      ({ jobs, nextCursor } = await searchJobs(p));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const saved = await getSavedIds(user.id);
  const nextHref = (cursor: string) => `/?${new URLSearchParams({ ...(q as Record<string, string>), cursor })}`;

  return (
    <main className="space-y-6">
      <form className="card grid gap-3 md:grid-cols-6">
        <input name="q" defaultValue={p.query} placeholder="Job title, skills, or company" required className="input md:col-span-3" />
        <input name="location" defaultValue={p.location} placeholder="Location (e.g. Anaheim, CA)" className="input md:col-span-2" />
        <button className="btn">Search</button>
        <select name="date" defaultValue={p.datePosted} className="input md:col-span-2">
          <option value="all">Any time</option>
          <option value="today">Past 24 hours</option>
          <option value="3days">Past 3 days</option>
          <option value="week">Past week</option>
          <option value="month">Past month</option>
        </select>
        <select name="type" defaultValue={p.employmentType} className="input md:col-span-2">
          <option value="">Any type</option>
          <option value="FULLTIME">Full-time</option>
          <option value="PARTTIME">Part-time</option>
          <option value="CONTRACTOR">Contract</option>
          <option value="INTERN">Internship</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="remote" value="1" defaultChecked={p.remoteOnly} /> Remote only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="linkedin" value="1" defaultChecked={linkedinChecked} /> LinkedIn only
        </label>
      </form>

      {error && <p className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</p>}
      {!p.query && <p className="text-sm text-zinc-500">Search for jobs, or let the AI find matches from your resume on <Link href="/matches" className="text-blue-600 hover:underline">AI Matches</Link>.</p>}
      {p.query && !error && jobs.length === 0 && <p className="text-sm text-zinc-500">No jobs found. Try broader terms or turn off LinkedIn only.</p>}

      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} saved={saved.has(job.id)} />
        ))}
      </div>

      {p.query && !error && nextCursor && (
        <div className="flex justify-end">
          <Link href={nextHref(nextCursor)} className="btn-secondary">Next page →</Link>
        </div>
      )}
    </main>
  );
}
