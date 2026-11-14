"use client";

import { useState, useTransition } from "react";
import { generateCoverLetterAction, saveCoverLetterAction } from "./actions";

export function CoverLetter({ jobId, initial }: { jobId: number; initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const generate = (regenerate: boolean) =>
    start(async () => {
      setError("");
      const res = await generateCoverLetterAction(jobId, regenerate);
      if ("error" in res) return setError(res.error);
      setText(res.text);
      setSaved(res.text);
      setOpen(true);
    });

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!saved) {
    return (
      <div className="flex items-center gap-3">
        <button className="btn-secondary" disabled={pending} onClick={() => generate(false)}>
          {pending ? "Writing…" : "✍ Write cover letter"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button className="text-sm text-blue-600 hover:underline" onClick={() => setOpen(!open)}>
        {open ? "Hide cover letter" : "Show cover letter"}
      </button>
      {open && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            disabled={pending}
            className="input w-full font-[inherit] text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
            {text !== saved && (
              <button
                className="btn-secondary"
                disabled={pending}
                onClick={() => start(async () => { await saveCoverLetterAction(jobId, text); setSaved(text); })}
              >
                Save edits
              </button>
            )}
            <button className="btn-secondary" disabled={pending} onClick={() => generate(true)}>
              {pending ? "Writing…" : "Regenerate"}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
