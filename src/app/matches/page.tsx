import Link from "next/link";
import { JobCard } from "@/components/JobCard";
import { getCoverLetters } from "@/lib/ai/cover-letter";
import { listMatches } from "@/lib/ai/match-agent";
import { SORT_KEYS, parseSortKey, sortMatches, type SortKey } from "@/lib/jobs/sort";
import { getSavedIds } from "@/lib/jobs/store";
import { getLatestResume } from "@/lib/resume/store";
import { requireUser } from "@/lib/session";
import { CoverLetter } from "./CoverLetter";
import { RunMatch } from "./RunMatch";

export const dynamic = "force-dynamic";

function scoreClass(score: number) {
  if (score >= 85) return "bg-green-100 text-green-800";
  if (score >= 70) return "bg-lime-100 text-lime-800";
  if (score >= 50) return "bg-amber-100 text-amber-800";
  return "bg-zinc-100 text-zinc-600";
}

const SORT_LABELS: Record<SortKey, string> = { match: "Match %", posted: "Newest", salary: "Salary" };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sort = parseSortKey((await searchParams).sort);
  const user = await requireUser();
  const resume = await getLatestResume(user.id);
  if (!resume?.profile) {
    return (
      <main className="card text-sm">
        Upload your resume on the <Link href="/resume" className="text-blue-600 hover:underline">Resume</Link> page first.
        The AI reads it, plans searches, and ranks the jobs that fit you best.
      </main>
    );
  }
  const [rawMatches, saved] = await Promise.all([listMatches(resume.id), getSavedIds(user.id)]);
  const matches = sortMatches(rawMatches, sort);
  const letters = await getCoverLetters(user.id, matches.map((m) => m.jobId));

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">AI matches</h1>
        <p className="text-sm text-zinc-500">
          Based on <span className="font-medium">{resume.filename}</span>, targeting {resume.profile.targetTitles.slice(0, 3).join(", ")}.
        </p>
      </div>
      <RunMatch defaultLocation={resume.profile.locations[0] ?? ""} />
      {matches.length > 1 && (
        <nav className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">Sort by:</span>
          {SORT_KEYS.map((k) => (
            <Link
              key={k}
              href={k === "match" ? "/matches" : `/matches?sort=${k}`}
              className={k === sort ? "font-semibold text-zinc-900" : "text-blue-600 hover:underline"}
            >
              {SORT_LABELS[k]}
            </Link>
          ))}
        </nav>
      )}
      {matches.length === 0 &&<p className="text-sm text-zinc-500">No matches yet. Click Find matches.</p>}
      {matches.map((m) => (
        <JobCard key={m.jobId} job={m.job} saved={saved.has(m.jobId)}>
          <div className="space-y-1 rounded bg-zinc-50 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${scoreClass(m.score)}`}>{m.score}% match</span>
              <span className="text-zinc-700">{m.reason}</span>
            </div>
            {m.matchedSkills.length > 0 && <p className="text-xs text-green-700">✓ {m.matchedSkills.join(", ")}</p>}
            {m.gaps.length > 0 && <p className="text-xs text-amber-700">Gaps: {m.gaps.join(", ")}</p>}
          </div>
          <CoverLetter jobId={m.jobId} initial={letters.get(m.jobId) ?? null} />
        </JobCard>
      ))}
    </main>
  );
}
