import type { Job, SearchParams } from "./types";

const HOST = "jsearch.p.rapidapi.com";

/** Subset of the JSearch `/search` response item that we use. */
export interface JSearchItem {
  job_id: string;
  job_title?: string;
  employer_name?: string;
  employer_logo?: string | null;
  job_publisher?: string;
  job_employment_type?: string;
  job_apply_link?: string;
  apply_options?: { publisher?: string; apply_link?: string }[];
  job_description?: string;
  job_is_remote?: boolean;
  job_location?: string;
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_posted_at_datetime_utc?: string | null;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_period?: string | null;
}

const isLinkedIn = (s?: string) => !!s && /linkedin/i.test(s);

function formatSalary(i: JSearchItem): string {
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  const { job_min_salary: min, job_max_salary: max, job_salary_period: per } = i;
  if (!min && !max) return "";
  const range = min && max && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt((min || max)!);
  return per ? `${range} / ${per.toLowerCase()}` : range;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Decode the HTML entities JSearch leaves in titles (e.g. `&#8211;`, `&#038;`, `&amp;`). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function normalizeJob(i: JSearchItem): Job {
  const linkedinOption = i.apply_options?.find((o) => isLinkedIn(o.publisher) || isLinkedIn(o.apply_link));
  const location =
    i.job_location || [i.job_city, i.job_state, i.job_country].filter(Boolean).join(", ");
  return {
    sourceId: i.job_id,
    title: decodeEntities(i.job_title?.trim() || "Untitled"),
    company: decodeEntities(i.employer_name ?? ""),
    location: location || (i.job_is_remote ? "Remote" : ""),
    remote: !!i.job_is_remote,
    publisher: isLinkedIn(i.job_publisher) || !linkedinOption ? (i.job_publisher ?? "") : "LinkedIn",
    applyUrl: (isLinkedIn(i.job_publisher) ? i.job_apply_link : linkedinOption?.apply_link) || i.job_apply_link || "",
    description: i.job_description ?? "",
    employmentType: i.job_employment_type ?? "",
    salary: formatSalary(i),
    logoUrl: i.employer_logo ?? "",
    postedAt: i.job_posted_at_datetime_utc ?? null,
  };
}

/** True when the job is posted on, or can be applied to via, LinkedIn. */
export function isLinkedInJob(i: JSearchItem): boolean {
  return (
    isLinkedIn(i.job_publisher) ||
    isLinkedIn(i.job_apply_link) ||
    !!i.apply_options?.some((o) => isLinkedIn(o.publisher) || isLinkedIn(o.apply_link))
  );
}

export function buildQueryString(p: SearchParams): string {
  let query = p.query.trim();
  if (p.location?.trim()) query += ` in ${p.location.trim()}`;
  // Google Jobs (which JSearch wraps) honours "via <publisher>" to favour a source.
  if (p.linkedinOnly) query += " via linkedin";
  const qs = new URLSearchParams({ query, num_pages: "1", country: "us" });
  if (p.cursor) qs.set("cursor", p.cursor);
  if (p.datePosted && p.datePosted !== "all") qs.set("date_posted", p.datePosted);
  if (p.remoteOnly) qs.set("work_from_home", "true");
  if (p.employmentType) qs.set("employment_types", p.employmentType);
  return qs.toString();
}

export interface JSearchPage {
  jobs: Job[];
  /** Opaque token for the next page, or null when there are no more results. */
  nextCursor: string | null;
}

export async function fetchJSearch(p: SearchParams, fetchImpl: typeof fetch = fetch): Promise<JSearchPage> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set. Add it to .env.");
  const res = await fetchImpl(`https://${HOST}/search-v2?${buildQueryString(p)}`, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 403 ? " Check that your RapidAPI key is subscribed to JSearch." :
      res.status === 429 ? " JSearch rate limit or monthly quota reached." : "";
    throw new Error(`JSearch request failed (${res.status}).${hint} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { jobs?: JSearchItem[]; cursor?: string | null } | JSearchItem[] };
  // v2 returns { data: { jobs, cursor } }; v1 returned { data: [...] }.
  const items = Array.isArray(json.data) ? json.data : (json.data?.jobs ?? []);
  const nextCursor = Array.isArray(json.data) ? null : (json.data?.cursor ?? null);
  return { jobs: (p.linkedinOnly ? items.filter(isLinkedInJob) : items).map(normalizeJob), nextCursor };
}
