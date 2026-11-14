import { llmDeps, runMatchAgent, saveMatches, type MatchOptions, type ProgressEvent } from "@/lib/ai/match-agent";
import { linkedInEnabled } from "@/lib/jobs/linkedin-api";
import { searchJobs, searchLinkedIn } from "@/lib/jobs/store";
import type { SearchParams } from "@/lib/jobs/types";
import { getLatestResume } from "@/lib/resume/store";
import { getUser } from "@/lib/session";
import { consume, LimitError } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Runs the match agent and streams progress as newline-delimited JSON. */
export async function POST(request: Request) {
  const opts = (await request.json().catch(() => ({}))) as MatchOptions;
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const resume = await getLatestResume(user.id);
  if (!resume?.profile) {
    return Response.json({ error: "Upload a resume and generate its profile first." }, { status: 400 });
  }
  const profile = resume.profile;
  try {
    await consume(user, "match");
  } catch (e) {
    if (e instanceof LimitError) return Response.json({ error: e.message }, { status: 429 });
    throw e;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ProgressEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const extra = opts.linkedinApi && linkedInEnabled() ? (p: SearchParams) => searchLinkedIn(p) : undefined;
        const deps = llmDeps(async (p) => (await searchJobs(p)).jobs, extra);
        const results = await runMatchAgent(profile, opts, deps, send);
        await saveMatches(resume.id, results);
        send({ type: "done", count: results.length });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
