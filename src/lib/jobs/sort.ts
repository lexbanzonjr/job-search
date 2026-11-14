import type { Job } from "./types";

export const SORT_KEYS = ["match", "posted", "salary"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const PER_YEAR: Record<string, number> = { hour: 2080, day: 260, week: 52, month: 12, year: 1 };

/** Parse a stored salary string (e.g. "$120k–$150k / year") into the annualized top of the range. */
export function annualSalary(salary: string): number | null {
  const nums = [...salary.matchAll(/\$([\d,.]+)(k?)/gi)].map((m) => parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1));
  const valid = nums.filter((n) => Number.isFinite(n) && n > 0);
  if (!valid.length) return null;
  const period = salary.match(/\/\s*(hour|day|week|month|year)/i)?.[1].toLowerCase() ?? "year";
  return Math.max(...valid) * PER_YEAR[period];
}

export function parseSortKey(v: unknown): SortKey {
  return SORT_KEYS.includes(v as SortKey) ? (v as SortKey) : "match";
}

/** Sort match rows; rows missing the sort field go last, ties broken by score. */
export function sortMatches<T extends { score: number; job: Job }>(rows: T[], key: SortKey): T[] {
  const value = (r: T): number | null => {
    if (key === "posted") {
      const t = r.job.postedAt ? Date.parse(r.job.postedAt) : NaN;
      return Number.isFinite(t) ? t : null;
    }
    if (key === "salary") return annualSalary(r.job.salary);
    return r.score;
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    return (vb ?? 0) - (va ?? 0) || b.score - a.score;
  });
}
