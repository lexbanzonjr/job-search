import { afterEach, describe, expect, it } from "vitest";
import { openTestDb } from "@/lib/db";
import { getSavedIds, saveJob, upsertJobs } from "@/lib/jobs/store";
import { getLatestResume, insertResume } from "@/lib/resume/store";
import { authenticate, ensureAdmin, hashPassword, upsertUser, verifyPassword } from "./users";

const job = (t: string) => ({
  sourceId: t, title: t, company: "C", location: "", remote: false, publisher: "", applyUrl: "",
  description: "", employmentType: "", salary: "", logoUrl: "", postedAt: null,
});

afterEach(() => {
  delete process.env.AUTH_USERNAME;
  delete process.env.AUTH_PASSWORD;
});

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const h = await hashPassword("secret-pw");
    expect(h).not.toBe(await hashPassword("secret-pw"));
    expect(await verifyPassword("secret-pw", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("authenticate", () => {
  it("accepts invited users and rejects bad logins", async () => {
    const db = await openTestDb();
    await upsertUser("sam", "password1", false, db);
    expect(await authenticate("sam", "password1", db)).toMatchObject({ username: "sam", isAdmin: false });
    expect(await authenticate("SAM", "password1", db)).not.toBeNull();
    expect(await authenticate("sam", "nope", db)).toBeNull();
    expect(await authenticate("nobody", "password1", db)).toBeNull();
    await expect(upsertUser("x", "short", false, db)).rejects.toThrow(/8 characters/);
  });

  it("creates the env admin, follows env password changes, and claims pre-account data", async () => {
    const db = await openTestDb();
    const [jobId] = await upsertJobs([job("A")], db);
    await db.execute("INSERT INTO resumes (filename, text) VALUES ('old', 't')");
    await db.execute({ sql: "INSERT INTO saved_jobs (user_id, job_id) VALUES (0, ?)", args: [jobId] });
    process.env.AUTH_USERNAME = "admin";
    process.env.AUTH_PASSWORD = "pw";
    const admin = await authenticate("admin", "pw", db);
    expect(admin).toMatchObject({ isAdmin: true });
    expect((await getLatestResume(admin!.id, db))?.filename).toBe("old");
    expect(await getSavedIds(admin!.id, db)).toEqual(new Set([jobId]));
    process.env.AUTH_PASSWORD = "new-pw";
    expect(await authenticate("admin", "pw", db)).toBeNull();
    expect((await ensureAdmin(db))?.id).toBe(admin!.id);
    expect(await authenticate("admin", "new-pw", db)).not.toBeNull();
  });
});

describe("per-user data", () => {
  it("keeps resumes and saved jobs separate", async () => {
    const db = await openTestDb();
    const a = await upsertUser("a", "password1", false, db);
    const b = await upsertUser("b", "password2", false, db);
    const [jobId] = await upsertJobs([job("A")], db);
    await saveJob(a.id, jobId, db);
    await insertResume(a.id, "a.pdf", "t", null, db);
    expect(await getSavedIds(a.id, db)).toEqual(new Set([jobId]));
    expect(await getSavedIds(b.id, db)).toEqual(new Set());
    expect(await getLatestResume(b.id, db)).toBeNull();
  });
});
