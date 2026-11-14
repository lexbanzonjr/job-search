"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toggleSaveAction } from "@/app/actions";
import type { StoredJob } from "@/lib/jobs/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return days < 30 ? `${days} days ago` : `${Math.floor(days / 30)} mo ago`;
}

export function JobCard({ job, saved, children }: { job: StoredJob; saved: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const meta = [job.location, job.employmentType, job.salary, timeAgo(job.postedAt)].filter(Boolean);

  return (
    <article className="card space-y-2">
      <div className="flex items-start gap-3">
        {job.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-100 text-zinc-400">
            {job.company.charAt(0) || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{job.title}</h3>
          <p className="text-sm text-zinc-600">{job.company}</p>
          <p className="text-xs text-zinc-500">{meta.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {job.publisher && (
            <span
              className={`rounded px-2 py-0.5 text-xs ${/linkedin/i.test(job.publisher) ? "bg-sky-100 text-sky-800" : "bg-zinc-100 text-zinc-600"}`}
            >
              {job.publisher}
            </span>
          )}
          <button
            className="btn-secondary"
            disabled={pending}
            onClick={() => start(() => toggleSaveAction(job.id, saved))}
          >
            {saved ? "★ Saved" : "☆ Save"}
          </button>
          {job.applyUrl && (
            <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="btn">
              Apply
            </a>
          )}
        </div>
      </div>
      {children}
      {job.description && (
        <div>
          <button className="text-sm text-blue-600 hover:underline" onClick={() => setOpen(!open)}>
            {open ? "Hide description" : "Show description"}
          </button>
          {open && <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{job.description}</p>}
        </div>
      )}
    </article>
  );
}
