import { all, one, dbOr, type Db } from "@/lib/db";
import { fetchJSearch } from "./jsearch";
import { fetchLinkedIn } from "./linkedin-api";
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
    id: Number(r.id),
    sourceId: r.source_id,
    title: r.title,
    company: r.company ?? "",
    location: r.location ?? "",
    remote: !!Number(r.remote),
    publisher: r.publisher ?? "",
    applyUrl: r.apply_url ?? "",
    description: r.description ?? "",
    employmentType: r.employment_type ?? "",
    salary: r.salary ?? "",
    logoUrl: r.logo_url ?? "",
    postedAt: r.posted_at,
  };
}

export async function upsertJobs(jobs: Job[], db?: Db): Promise<number[]> {
  if (!jobs.length) return [];
  const c = await dbOr(db);
  const results = await c.batch(
    jobs.map((j) => ({
      sql: `INSERT INTO jobs (source_id, title, company, location, remote, publisher, apply_url, description,
                             employment_type, salary, logo_url, posted_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(source_id) DO UPDATE SET
              title=excluded.title, company=excluded.company, location=excluded.location, remote=excluded.remote,
              publisher=excluded.publisher, apply_url=excluded.apply_url, description=excluded.description,
              employment_type=excluded.employment_type, salary=excluded.salary, logo_url=excluded.logo_url,
              posted_at=excluded.posted_at, updated_at=datetime('now')
            RETURNING id`,
      args: [
        j.sourceId, j.title, j.company, j.location, j.remote ? 1 : 0, j.publisher, j.applyUrl,
        j.description, j.employmentType, j.salary, j.logoUrl, j.postedAt,
      ],
    })),
    "write",
  );
  return results.map((r) => Number(r.rows[0].id));
}

export async function getJobsByIds(ids: number[], db?: Db): Promise<StoredJob[]> {
  if (!ids.length) return [];
  const rows = await all<JobRow>(await dbOr(db), `SELECT * FROM jobs WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  const byId = new Map(rows.map((r) => [Number(r.id), rowToJob(r)]));
  return ids.map((id) => byId.get(id)).filter((j): j is StoredJob => !!j);
}

export function cacheKey(p: SearchParams): string {
  return JSON.stringify({
    q: p.query.trim().toLowerCase(),
    l: (p.location ?? "").trim().toLowerCase(),
    r: !!p.remoteOnly,
    d: p.datePosted ?? "all",
    e: p.employmentType ?? "",
    c: p.cursor ?? "",
    li: !!p.linkedinOnly,
  });
}

export interface SearchResult {
  jobs: StoredJob[];
  nextCursor: string | null;
}

/** Search JSearch, caching each parameter set for an hour to save API quota. Shared across users. */
export function searchJobs(p: SearchParams, db?: Db): Promise<SearchResult> {
  return cachedSearch(cacheKey(p), p, () => fetchJSearch(p), db);
}

/** Search the LinkedIn Job Search API. Its free quota is tiny, so the hour cache matters even more. */
export async function searchLinkedIn(p: SearchParams, db?: Db): Promise<StoredJob[]> {
  const fetchPage = async () => ({ jobs: await fetchLinkedIn(p), nextCursor: null });
  return (await cachedSearch(`li:${cacheKey(p)}`, p, fetchPage, db)).jobs;
}

/** Run `fetchPage` unless the same cache key was fetched within the hour. */
async function cachedSearch(
  key: string,
  p: SearchParams,
  fetchPage: () => Promise<{ jobs: Job[]; nextCursor: string | null }>,
  db?: Db,
): Promise<SearchResult> {
  const c = await dbOr(db);
  const cached = await one<{ job_ids_json: string; next_cursor: string | null; created_at: string }>(
    c,
    "SELECT job_ids_json, next_cursor, created_at FROM searches WHERE cache_key = ?",
    [key],
  );
  if (cached && Date.now() - Date.parse(cached.created_at + "Z") < CACHE_TTL_MS) {
    return { jobs: await getJobsByIds(JSON.parse(cached.job_ids_json), c), nextCursor: cached.next_cursor };
  }

  const page = await fetchPage();
  const ids = await upsertJobs(page.jobs, c);
  await c.execute({
    sql: `INSERT INTO searches (cache_key, params_json, job_ids_json, next_cursor) VALUES (?, ?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET job_ids_json=excluded.job_ids_json, next_cursor=excluded.next_cursor,
            created_at=datetime('now')`,
    args: [key, JSON.stringify(p), JSON.stringify(ids), page.nextCursor],
  });
  return { jobs: await getJobsByIds(ids, c), nextCursor: page.nextCursor };
}

// ---------- saved jobs (per user) ----------

export interface SavedJob extends StoredJob {
  status: SavedStatus;
  notes: string;
  savedAt: string;
}

export async function getSavedIds(userId: number, db?: Db): Promise<Set<number>> {
  const rows = await all<{ job_id: number }>(await dbOr(db), "SELECT job_id FROM saved_jobs WHERE user_id = ?", [userId]);
  return new Set(rows.map((r) => Number(r.job_id)));
}

export async function listSaved(userId: number, db?: Db): Promise<SavedJob[]> {
  const rows = await all<JobRow & { status: SavedStatus; notes: string; saved_at: string }>(
    await dbOr(db),
    `SELECT j.*, s.status, s.notes, s.saved_at FROM saved_jobs s JOIN jobs j ON j.id = s.job_id
     WHERE s.user_id = ? ORDER BY s.saved_at DESC`,
    [userId],
  );
  return rows.map((r) => ({ ...rowToJob(r), status: r.status, notes: r.notes, savedAt: r.saved_at }));
}

export async function saveJob(userId: number, jobId: number, db?: Db) {
  await (await dbOr(db)).execute({ sql: "INSERT OR IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)", args: [userId, jobId] });
}

export async function unsaveJob(userId: number, jobId: number, db?: Db) {
  await (await dbOr(db)).execute({ sql: "DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?", args: [userId, jobId] });
}

export async function updateSaved(userId: number, jobId: number, status: SavedStatus, notes: string, db?: Db) {
  await (await dbOr(db)).execute({
    sql: "UPDATE saved_jobs SET status = ?, notes = ? WHERE user_id = ? AND job_id = ?",
    args: [status, notes, userId, jobId],
  });
}
