import { afterAll, describe, expect, it } from "vitest";
import { all, migrate, one, openTestDb, schemaVersion } from "./index";

const db = await openTestDb();
afterAll(() => db.close());

describe("migrations", () => {
  it("creates all tables", async () => {
    const names = (await all<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["resumes", "jobs", "searches", "matches", "saved_jobs", "users"]));
  });

  it("is idempotent", async () => {
    await expect(migrate(db)).resolves.toBeUndefined();
    expect(Number((await one<{ version: number }>(db, "SELECT version FROM schema_version"))!.version)).toBe(schemaVersion());
  });

  it("cascades deletes from jobs", async () => {
    await db.execute("INSERT INTO jobs (source_id, title) VALUES ('x', 'Dev')");
    const { id } = (await one<{ id: number }>(db, "SELECT id FROM jobs WHERE source_id='x'"))!;
    await db.execute({ sql: "INSERT INTO saved_jobs (user_id, job_id) VALUES (1, ?)", args: [id] });
    await db.execute({ sql: "DELETE FROM jobs WHERE id=?", args: [id] });
    expect(Number((await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM saved_jobs"))!.n)).toBe(0);
  });
});
