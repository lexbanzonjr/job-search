import { listMyRepos } from "@/lib/github/client";
import { listReviews } from "@/lib/resume/commit-store";
import { getLatestResume } from "@/lib/resume/store";
import { requireUser } from "@/lib/session";
import { GitCommitsPanel } from "./GitCommitsPanel";
import { ProfileForm, UploadForm } from "./ResumeForms";

function profileKey(profile: unknown): string {
  const json = JSON.stringify(profile) ?? "";
  let h = 0;
  for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) | 0;
  return String(h);
}

async function loadRepos(): Promise<{ repos: string[]; repoError?: string }> {
  try {
    const repos = await listMyRepos();
    return repos.length ? { repos } : { repos, repoError: "No repos found for this GitHub token." };
  } catch (e) {
    return { repos: [], repoError: e instanceof Error ? e.message : String(e) };
  }
}

export const dynamic = "force-dynamic";

export default async function ResumePage() {
  const user = await requireUser();
  const resume = await getLatestResume(user.id);
  // Commit scanning uses the admin's GitHub token, so only the admin sees it.
  const git = user.isAdmin && resume?.profile ? { reviews: await listReviews(user.id), ...(await loadRepos()) } : null;
  const roles = (resume?.profile?.experience ?? []).map((e, index) => ({ index, label: `${e.title} · ${e.company}` }));
  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Resume</h1>
        {resume?.profile && (
          <a href="/api/resume/pdf" className="btn-secondary">Download PDF</a>
        )}
      </div>
      <UploadForm hasResume={!!resume} />
      {resume && (
        <>
          <p className="text-sm text-zinc-500">
            Current: <span className="font-medium text-zinc-700">{resume.filename}</span> (uploaded {resume.createdAt} UTC)
          </p>
          {/* Remount when the profile changes (e.g. a Git bullet was added) so the form isn't stale. */}
          <ProfileForm key={profileKey(resume.profile)} profile={resume.profile} />
          {git && <GitCommitsPanel reviews={git.reviews} repos={git.repos} repoError={git.repoError} roles={roles} />}
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium">Extracted text</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-zinc-700">{resume.text}</pre>
          </details>
        </>
      )}
    </main>
  );
}
