import { llmDeps, runMatchAgent, saveMatches, type MatchOptions, type ProgressEvent } from "@/lib/ai/match-agent";
import { searchJobs } from "@/lib/jobs/store";
import { getLatestResume } from "@/lib/resume/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Runs the match agent and streams progress as newline-delimited JSON. */
export async function POST(request: Request) {
  const opts = (await request.json().catch(() => ({}))) as MatchOptions;
  const resume = getLatestResume();
  if (!resume?.profile) {
    return Response.json({ error: "Upload a resume and generate its profile first." }, { status: 400 });
  }
  const profile = resume.profile;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ProgressEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const results = await runMatchAgent(profile, opts, llmDeps(async (p) => (await searchJobs(p)).jobs), send);
        saveMatches(resume.id, results);
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
