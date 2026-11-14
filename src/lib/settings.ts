import { dbOr, one, type Db } from "@/lib/db";

/** App-wide settings (shared by every user of a deploy), edited by admins on /settings. */
export interface AppSettings {
  /** Pull AI matches from the LinkedIn Job Search API too (shares a tiny monthly quota). */
  linkedinApi: boolean;
}

const LINKEDIN_API = "linkedin_api";

export async function getSetting(key: string, db?: Db): Promise<string | null> {
  const row = await one<{ value: string }>(await dbOr(db), "SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string, db?: Db): Promise<void> {
  await (await dbOr(db)).execute({
    sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

export async function getAppSettings(db?: Db): Promise<AppSettings> {
  return { linkedinApi: (await getSetting(LINKEDIN_API, db)) === "1" };
}

export const setLinkedInApi = (on: boolean, db?: Db) => setSetting(LINKEDIN_API, on ? "1" : "0", db);
