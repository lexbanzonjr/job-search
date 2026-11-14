import { dbOr, one, type Db } from "@/lib/db";

/** App-wide settings (shared by every user of a deploy), edited by admins on /settings. */
export interface AppSettings {
  /** Pull AI matches from the LinkedIn Job Search API too (shares a tiny monthly quota). */
  linkedinApi: boolean;
  /** Whether a GitHub token is saved (the token itself never leaves the server). */
  githubTokenSet: boolean;
  githubLogin: string;
}

export interface GitHubConfig {
  token: string | null;
  login: string | null;
}

const LINKEDIN_API = "linkedin_api";
const GITHUB_TOKEN = "github_token";
const GITHUB_LOGIN = "github_login";

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
  const gh = await getGitHubConfig(db);
  return {
    linkedinApi: (await getSetting(LINKEDIN_API, db)) === "1",
    githubTokenSet: Boolean(gh.token),
    githubLogin: gh.login ?? "",
  };
}

/** GitHub credentials for resume commit scanning: saved settings first, then .env. */
export async function getGitHubConfig(db?: Db): Promise<GitHubConfig> {
  return {
    token: (await getSetting(GITHUB_TOKEN, db)) || process.env.GITHUB_TOKEN || null,
    login: (await getSetting(GITHUB_LOGIN, db)) || process.env.GITHUB_LOGIN || null,
  };
}

/** A blank token keeps the saved one; `clearToken` removes it. */
export async function setGitHubConfig(opts: { token?: string; login: string; clearToken?: boolean }, db?: Db): Promise<void> {
  const token = opts.token?.trim();
  if (opts.clearToken) await setSetting(GITHUB_TOKEN, "", db);
  else if (token) await setSetting(GITHUB_TOKEN, token, db);
  await setSetting(GITHUB_LOGIN, opts.login.trim(), db);
}

export const setLinkedInApi = (on: boolean, db?: Db) => setSetting(LINKEDIN_API, on ? "1" : "0", db);
