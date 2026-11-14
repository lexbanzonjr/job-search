import { getLatestResume } from "@/lib/resume/store";
import { ProfileForm, UploadForm } from "./ResumeForms";

export const dynamic = "force-dynamic";

export default function ResumePage() {
  const resume = getLatestResume();
  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Resume</h1>
      <UploadForm />
      {resume && (
        <>
          <p className="text-sm text-zinc-500">
            Current: <span className="font-medium text-zinc-700">{resume.filename}</span> (uploaded {resume.createdAt} UTC)
          </p>
          <ProfileForm profile={resume.profile} />
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium">Extracted text</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-zinc-700">{resume.text}</pre>
          </details>
        </>
      )}
    </main>
  );
}
