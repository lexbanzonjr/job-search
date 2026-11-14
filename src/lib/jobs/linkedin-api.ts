import { decodeEntities } from "./jsearch";
import type { Job, SearchParams } from "./types";

/** Fantastic.jobs "LinkedIn Job Search API" on RapidAPI. Free tier: 25 requests / 250 jobs per month. */
const HOST = "linkedin-job-search-api.p.rapidapi.com";
export const LINKEDIN_LIMIT = 25;

/** Subset of the `/active-jb` response item that we use. */
export interface LinkedInItem {
  id: number;
  title?: string;
  organization?: string | null;
  organization_logo?: string | null;
  url?: string | null;
  date_posted?: string | null;
  locations_derived?: string[] | null;
  ai_work_arrangement?: string | null;
  ai_salary_min_value?: number | null;
  ai_salary_max_value?: number | null;
  ai_salary_value?: number | null;
  ai_salary_unit_text?: string | null;
  ai_employment_type?: string[] | null;
  description_text?: string | null;
}

/** Only 1h / 24h / 7d / 6m windows exist; "today" → 24h, everything else → 7d (6m is a big, slow feed). */
export function timeFrame(d: SearchParams["datePosted"]): "24h" | "7d" {
  return d === "today" ? "24h" : "7d";
}

export function buildLinkedInQuery(p: SearchParams, limit = LINKEDIN_LIMIT): string {
  const qs = new URLSearchParams({
    time_frame: timeFrame(p.datePosted),
    title: p.query.trim(),
    source: "linkedin",
    description_format: "text",
    limit: String(limit),
  });
  if (p.location?.trim()) qs.set("location", p.location.trim());
  if (p.remoteOnly) qs.set("ai_work_arrangement", "Remote OK,Remote Solely");
  return qs.toString();
}

const UNIT: Record<string, string> = { YEAR: "year", MONTH: "month", WEEK: "week", DAY: "day", HOUR: "hour" };

function formatSalary(i: LinkedInItem): string {
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  const min = i.ai_salary_min_value ?? i.ai_salary_value;
  const max = i.ai_salary_max_value ?? i.ai_salary_value;
  if (!min && !max) return "";
  const range = min && max && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt((min || max)!);
  const per = i.ai_salary_unit_text ? (UNIT[i.ai_salary_unit_text] ?? i.ai_salary_unit_text.toLowerCase()) : "";
  return per ? `${range} / ${per}` : range;
}

export function normalizeLinkedIn(i: LinkedInItem): Job {
  const remote = /remote/i.test(i.ai_work_arrangement ?? "");
  return {
    sourceId: `li:${i.id}`,
    title: decodeEntities(i.title?.trim() || "Untitled"),
    company: decodeEntities(i.organization ?? ""),
    location: i.locations_derived?.[0] || (remote ? "Remote" : ""),
    remote,
    publisher: "LinkedIn",
    applyUrl: i.url ?? "",
    description: i.description_text ?? "",
    employmentType: i.ai_employment_type?.[0]?.replace("_", "") ?? "",
    salary: formatSalary(i),
    logoUrl: i.organization_logo ?? "",
    postedAt: i.date_posted ?? null,
  };
}

export async function fetchLinkedIn(p: SearchParams, fetchImpl: typeof fetch = fetch): Promise<Job[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set. Add it to .env.");
  const res = await fetchImpl(`https://${HOST}/active-jb?${buildLinkedInQuery(p)}`, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 403 ? " Check that your RapidAPI key is subscribed to LinkedIn Job Search API." :
      res.status === 429 ? " LinkedIn API monthly quota reached." : "";
    throw new Error(`LinkedIn API request failed (${res.status}).${hint} ${body.slice(0, 200)}`);
  }
  const items = (await res.json()) as LinkedInItem[];
  return Array.isArray(items) ? items.map(normalizeLinkedIn) : [];
}

export const linkedInEnabled = () => process.env.LINKEDIN_API_ENABLED === "1";
