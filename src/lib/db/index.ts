import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
];

export function openDb(dir: string): DatabaseSync {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "job-search.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync) {
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

const g = globalThis as unknown as { __jobSearchDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!g.__jobSearchDb) g.__jobSearchDb = openDb(process.env.DATA_DIR || path.join(process.cwd(), "data"));
  return g.__jobSearchDb;
}
