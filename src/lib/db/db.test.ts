import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { migrate, openDb } from "./index";

const dir = mkdtempSync(path.join(tmpdir(), "job-search-db-"));
const db = openDb(dir);

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("migrations", () => {
  it("creates all tables", () => {
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["resumes", "jobs", "searches", "matches", "saved_jobs"]));
  });

  it("is idempotent", () => {
    expect(() => migrate(db)).not.toThrow();
    expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(1);
  });

  it("cascades deletes from jobs", () => {
    db.prepare("INSERT INTO jobs (source_id, title) VALUES ('x', 'Dev')").run();
    const { id } = db.prepare("SELECT id FROM jobs WHERE source_id='x'").get() as { id: number };
    db.prepare("INSERT INTO saved_jobs (job_id) VALUES (?)").run(id);
    db.prepare("DELETE FROM jobs WHERE id=?").run(id);
    expect(db.prepare("SELECT COUNT(*) AS n FROM saved_jobs").get()).toEqual({ n: 0 });
  });
});
