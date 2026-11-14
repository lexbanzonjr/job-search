import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client, type InValue } from "@libsql/client";

export type Db = Client;

const MIGRATIONS: string[] = [
  `CREATE TABLE resumes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     filename TEXT NOT NULL,
     text TEXT NOT NULL,
     profile_json TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE jobs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     source_id TEXT NOT NULL UNIQUE,
     title TEXT NOT NULL,
     company TEXT,
     location TEXT,
     remote INTEGER NOT NULL DEFAULT 0,
     publisher TEXT,
     apply_url TEXT,
     description TEXT,
     employment_type TEXT,
     salary TEXT,
     logo_url TEXT,
     posted_at TEXT,
     raw_json TEXT,
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE searches (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     cache_key TEXT NOT NULL UNIQUE,
     params_json TEXT NOT NULL,
     job_ids_json TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE matches (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
     job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     score INTEGER NOT NULL,
     reasons_json TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE (resume_id, job_id)
   );
   CREATE TABLE saved_jobs (
     job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
     status TEXT NOT NULL DEFAULT 'saved',
     notes TEXT NOT NULL DEFAULT '',
     saved_at TEXT NOT NULL DEFAULT (datetime('now'))
   );`,
  // JSearch v2 pages with an opaque cursor.
  `ALTER TABLE searches ADD COLUMN next_cursor TEXT;`,
  // Multi-user. Rows that existed before get user 0 / NULL and are claimed by the admin (see ensureAdmin).
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     password_hash TEXT NOT NULL,
     is_admin INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   ALTER TABLE resumes ADD COLUMN user_id INTEGER;
   CREATE INDEX resumes_user ON resumes (user_id, id);
   CREATE TABLE saved_jobs_v3 (
     user_id INTEGER NOT NULL,
     job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     status TEXT NOT NULL DEFAULT 'saved',
     notes TEXT NOT NULL DEFAULT '',
     saved_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (user_id, job_id)
   );
   INSERT INTO saved_jobs_v3 (user_id, job_id, status, notes, saved_at)
     SELECT 0, job_id, status, notes, saved_at FROM saved_jobs;
   DROP TABLE saved_jobs;
   ALTER TABLE saved_jobs_v3 RENAME TO saved_jobs;`,
  // Per-user daily counters for paid API calls.
  `CREATE TABLE usage (
     user_id INTEGER NOT NULL,
     day TEXT NOT NULL,
     kind TEXT NOT NULL,
     count INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, day, kind)
   );`,
  `CREATE TABLE cover_letters (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     text TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE (user_id, job_id)
   );`,
  // App-wide settings edited by admins on /settings.
  `CREATE TABLE settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
];

/**
 * Schema version lives in its own table (Turso doesn't reliably keep PRAGMA user_version).
 * Databases created before the switch carry their version in user_version; adopt it once.
 */
async function currentVersion(db: Db): Promise<number> {
  await db.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = (await db.execute("SELECT version FROM schema_version")).rows[0];
  if (row) return Number(row.version);
  let legacy = 0;
  try {
    legacy = Number((await db.execute("PRAGMA user_version")).rows[0]?.user_version ?? 0);
  } catch {
    // remote databases may not allow it
  }
  await db.execute({ sql: "INSERT INTO schema_version (version) VALUES (?)", args: [legacy] });
  return legacy;
}

export async function migrate(db: Db) {
  for (let v = await currentVersion(db); v < MIGRATIONS.length; v++) {
    await db.executeMultiple(`BEGIN;\n${MIGRATIONS[v]}\nUPDATE schema_version SET version = ${v + 1};\nCOMMIT;`);
  }
}

export function schemaVersion(): number {
  return MIGRATIONS.length;
}

/** Open (and migrate) a database. `url` is a libSQL URL: `file:...`, `:memory:`, or `libsql://...`. */
export async function openDb(url: string, authToken?: string): Promise<Db> {
  if (url.startsWith("file:")) mkdirSync(path.dirname(url.slice(5)), { recursive: true });
  const db = createClient({ url, authToken });
  if (!url.startsWith("libsql:") && !url.startsWith("https:")) {
    await db.execute("PRAGMA journal_mode = WAL").catch(() => {});
  }
  await db.execute("PRAGMA foreign_keys = ON").catch(() => {});
  await migrate(db);
  return db;
}

/** A fresh in-memory database for tests. */
export const openTestDb = () => openDb(":memory:");

const g = globalThis as unknown as { __jobSearchDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__jobSearchDb) {
    if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
      // Vercel's filesystem is ephemeral; a local file DB would silently lose data.
      return Promise.reject(new Error("TURSO_DATABASE_URL is not set. Add the Turso database URL and token to the Vercel project."));
    }
    const url =
      process.env.TURSO_DATABASE_URL ||
      `file:${path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "job-search.db").replace(/\\/g, "/")}`;
    g.__jobSearchDb = openDb(url, process.env.TURSO_AUTH_TOKEN || undefined).catch((e) => {
      g.__jobSearchDb = undefined;
      throw e;
    });
  }
  return g.__jobSearchDb;
}

/** Use the given database, or the app's shared one. */
export const dbOr = (db?: Db): Promise<Db> => (db ? Promise.resolve(db) : getDb());

/** Run a query and return its rows typed as T. */
export async function all<T>(db: Db, sql: string, args: InValue[] = []): Promise<T[]> {
  return (await db.execute({ sql, args })).rows as unknown as T[];
}

export async function one<T>(db: Db, sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(db, sql, args))[0];
}
