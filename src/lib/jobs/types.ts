export type DatePosted = "all" | "today" | "3days" | "week" | "month";
export type EmploymentType = "FULLTIME" | "PARTTIME" | "CONTRACTOR" | "INTERN";

export interface SearchParams {
  query: string;
  location?: string;
  remoteOnly?: boolean;
  datePosted?: DatePosted;
  employmentType?: EmploymentType | "";
  page?: number;
  linkedinOnly?: boolean;
}

export interface Job {
  sourceId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  publisher: string;
  applyUrl: string;
  description: string;
  employmentType: string;
  salary: string;
  logoUrl: string;
  postedAt: string | null;
}

/** A job as stored in SQLite (has a local id). */
export interface StoredJob extends Job {
  id: number;
}

export const SAVED_STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;
export type SavedStatus = (typeof SAVED_STATUSES)[number];
