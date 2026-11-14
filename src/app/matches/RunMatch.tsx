"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProgressEvent } from "@/lib/ai/match-agent";

export function RunMatch({ defaultLocation }: { defaultLocation: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function run(form: FormData) {
    setRunning(true);
    setLog([]);
    setError("");
    const add = (line: string) => setLog((l) => [...l, line]);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: String(form.get("location") ?? ""),
          remoteOnly: form.get("remote") === "1",
          linkedinOnly: form.get("linkedin") === "1",
          datePosted: String(form.get("date") ?? "month"),
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line) as ProgressEvent;
          if (e.type === "status") add(e.message);
          else if (e.type === "queries") add(`Queries: ${e.queries.join(" · ")}`);
          else if (e.type === "found") add(`Found ${e.count} unique jobs`);
          else if (e.type === "scored") add(`Scoring with AI: ${e.done}/${e.total}`);
          else if (e.type === "done") add(`Done: ${e.count} matches ranked`);
          else if (e.type === "error") setError(e.message);
        }
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <form action={run} className="card space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <input name="location" defaultValue={defaultLocation} placeholder="Location (optional)" className="input md:col-span-2" />
        <select name="date" defaultValue="month" className="input">
          <option value="week">Past week</option>
          <option value="month">Past month</option>
          <option value="all">Any time</option>
        </select>
        <button disabled={running} className="btn">{running ? "Finding matches…" : "Find matches"}</button>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="linkedin" value="1" defaultChecked /> LinkedIn only</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="remote" value="1" /> Remote only</label>
      </div>
      {log.length > 0 && (
        <ul className="space-y-0.5 overflow-x-auto break-words rounded bg-zinc-50 p-3 font-mono text-xs text-zinc-600">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
