import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/lib/db";
import { fetchJSearch } from "./jsearch";
import type { Job, SavedStatus, SearchParams, StoredJob } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;

interface JobRow {
  id: number;
  source_id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: number;
  publisher: string | null;
  apply_url: string | null;
  description: string | null;
  employment_type: string | null;
  salary: string | null;
  logo_url: string | null;
  posted_at: string | null;
}

export function rowToJob(r: JobRow): StoredJob {
  return {
    id: r.id,
    sourceId: r.source_id,
    title: r.title,
    company: r.company ?? "",
    location: r.location ?? "",
    remote: !!r.remote,
    publisher: r.publisher ?? "",
    applyUrl: r.apply_url ?? "",
    description: r.description ?? "",
    employmentType: r.employment_type ?? "",
    salary: r.salary ?? "",
    logoUrl: r.logo_url ?? "",
    postedAt: r.posted_at,
  };
}

export function upsertJobs(jobs: Job[], db: DatabaseSync = getDb()): number[] {
  const stmt = db.prepare(
    `INSERT INTO jobs (source_id, title, company, location, remote, publisher, apply_url, description,
                       employment_type, salary, logo_url, posted_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(source_id) DO UPDATE SET
       title=excluded.title, company=excluded.company, location=excluded.location, remote=excluded.remote,
       publisher=excluded.publisher, apply_url=excluded.apply_url, description=excluded.description,
       employment_type=excluded.employment_type, salary=excluded.salary, logo_url=excluded.logo_url,
       posted_at=excluded.posted_at, updated_at=datetime('now')
     RETURNING id`,
  );
  return jobs.map((j) => {
    const row = stmt.get(
      j.sourceId, j.title, j.company, j.location, j.remote ? 1 : 0, j.publisher, j.applyUrl,
      j.description, j.employmentType, j.salary, j.logoUrl, j.postedAt,
    ) as { id: number };
    return row.id;
  });
}

export function getJobsByIds(ids: number[], db: DatabaseSync = getDb()): StoredJob[] {
  if (!ids.length) return [];
  const rows = db
    .prepare(`SELECT * FROM jobs WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as unknown as JobRow[];
  const byId = new Map(rows.map((r) => [r.id, rowToJob(r)]));
  return ids.map((id) => byId.get(id)).filter((j): j is StoredJob => !!j);
}

export function cacheKey(p: SearchParams): string {
  return JSON.stringify({
    q: p.query.trim().toLowerCase(),
    l: (p.location ?? "").trim().toLowerCase(),
    r: !!p.remoteOnly,
    d: p.datePosted ?? "all",
    e: p.employmentType ?? "",
    p: p.page ?? 1,
    li: !!p.linkedinOnly,
  });
}

/** Search JSearch, caching each parameter set for an hour to save API quota. */
export async function searchJobs(p: SearchParams, db: DatabaseSync = getDb()): Promise<StoredJob[]> {
  const key = cacheKey(p);
  const cached = db
    .prepare("SELECT job_ids_json, created_at FROM searches WHERE cache_key = ?")
    .get(key) as { job_ids_json: string; created_at: string } | undefined;
  if (cached && Date.now() - Date.parse(cached.created_at + "Z") < CACHE_TTL_MS) {
    return getJobsByIds(JSON.parse(cached.job_ids_json), db);
  }

  const ids = upsertJobs(await fetchJSearch(p), db);
  db.prepare(
    `INSERT INTO searches (cache_key, params_json, job_ids_json) VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET job_ids_json=excluded.job_ids_json, created_at=datetime('now')`,
  ).run(key, JSON.stringify(p), JSON.stringify(ids));
  return getJobsByIds(ids, db);
}

// ---------- saved jobs ----------

export interface SavedJob extends StoredJob {
  status: SavedStatus;
  notes: string;
  savedAt: string;
}

export function getSavedIds(db: DatabaseSync = getDb()): Set<number> {
  return new Set((db.prepare("SELECT job_id FROM saved_jobs").all() as { job_id: number }[]).map((r) => r.job_id));
}

export function listSaved(db: DatabaseSync = getDb()): SavedJob[] {
  const rows = db
    .prepare(
      `SELECT j.*, s.status, s.notes, s.saved_at FROM saved_jobs s JOIN jobs j ON j.id = s.job_id
       ORDER BY s.saved_at DESC`,
    )
    .all() as unknown as (JobRow & { status: SavedStatus; notes: string; saved_at: string })[];
  return rows.map((r) => ({ ...rowToJob(r), status: r.status, notes: r.notes, savedAt: r.saved_at }));
}

export function saveJob(jobId: number, db: DatabaseSync = getDb()) {
  db.prepare("INSERT OR IGNORE INTO saved_jobs (job_id) VALUES (?)").run(jobId);
}

export function unsaveJob(jobId: number, db: DatabaseSync = getDb()) {
  db.prepare("DELETE FROM saved_jobs WHERE job_id = ?").run(jobId);
}

export function updateSaved(jobId: number, status: SavedStatus, notes: string, db: DatabaseSync = getDb()) {
  db.prepare("UPDATE saved_jobs SET status = ?, notes = ? WHERE job_id = ?").run(status, notes, jobId);
}
