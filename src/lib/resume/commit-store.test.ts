import { describe, expect, it } from "vitest";
import { openTestDb } from "@/lib/db";
import type { ResumeProfile } from "@/lib/ai/profile";
import { addBullet, dateRank, insertReviews, knownShas, listReviews, setReviewStatus } from "./commit-store";

const commits = [
  { repo: "o/r", sha: "a", message: "Add search", committedAt: "2026-02-01" },
  { repo: "o/r", sha: "b", message: "typo", committedAt: "2026-02-02" },
];
const review = {
  sha: "a", what: "Adds search", why: "Users needed it", impactScore: 4, resumeWorthy: true,
  bullet: "Built full-text search", kind: "personal" as const, experienceIndex: -1, projectIndex: 0,
};

describe("commit store", () => {
  it("stores worthy reviews as pending, others as rejected, and skips repeats", async () => {
    const db = await openTestDb();
    expect(await insertReviews(1, commits, [review], db)).toBe(1);
    expect(await insertReviews(1, commits, [review], db)).toBe(0);
    expect(await knownShas(1, "o/r", db)).toEqual(new Set(["a", "b"]));
    const pending = await listReviews(1, "pending", db);
    expect(pending.map((r) => [r.sha, r.bullet, r.impactScore, r.kind, r.projectIndex])).toEqual([
      ["a", "Built full-text search", 4, "personal", 0],
    ]);
    expect((await listReviews(1, "rejected", db)).map((r) => r.sha)).toEqual(["b"]);
    expect(await listReviews(2, "pending", db)).toEqual([]);

    await setReviewStatus(2, pending[0].id, "accepted", db); // other user: no effect
    expect(await listReviews(1, "pending", db)).toHaveLength(1);
    await setReviewStatus(1, pending[0].id, "accepted", db);
    expect(await listReviews(1, "accepted", db)).toHaveLength(1);
  });
});

describe("dateRank", () => {
  it("orders month/year, year, and present", () => {
    expect(dateRank("Feb 2024")).toBeGreaterThan(dateRank("Jan 2024"));
    expect(dateRank("2024")).toBeLessThan(dateRank("Jan 2024"));
    expect(dateRank("Present")).toBeGreaterThan(dateRank("Dec 2030"));
    expect(dateRank("")).toBe(-1);
  });
});

describe("addBullet", () => {
  const role = (title: string, startDate: string) => ({ title, company: "Acme", location: "", startDate, endDate: "", highlights: [] as string[] });
  const profile = {
    experience: [role("Senior", "Jan 2022"), role("Junior", "Jun 2018")],
    projects: [{ name: "app", url: "", tech: [], startDate: "", endDate: "", highlights: ["x"] }],
  } as unknown as ResumeProfile;

  it("appends to an existing role without mutating", () => {
    const out = addBullet(profile, { kind: "experience", index: 1 }, "  Built search ");
    expect(out.experience[1].highlights).toEqual(["Built search"]);
    expect(profile.experience[1].highlights).toEqual([]);
    expect(addBullet(out, { kind: "experience", index: 1 }, "Built search").experience[1].highlights).toHaveLength(1);
  });

  it("appends to an existing project", () => {
    expect(addBullet(profile, { kind: "project", index: 0 }, "y").projects[0].highlights).toEqual(["x", "y"]);
  });

  it("inserts a new role by start date, most recent first", () => {
    const entry = { title: "Mid", company: "Beta", location: "", startDate: "Mar 2020", endDate: "Dec 2021" };
    const out = addBullet(profile, { kind: "newExperience", entry }, "Led migration");
    expect(out.experience.map((e) => e.title)).toEqual(["Senior", "Mid", "Junior"]);
    expect(out.experience[1].highlights).toEqual(["Led migration"]);
    const undated = addBullet(profile, { kind: "newExperience", entry: { ...entry, startDate: "" } }, "z");
    expect(undated.experience.at(-1)!.title).toBe("Mid");
  });

  it("appends a new project", () => {
    const entry = { name: "job-search", url: "https://github.com/me/job-search", tech: ["Next.js"], startDate: "", endDate: "" };
    const out = addBullet(profile, { kind: "newProject", entry }, "Built matching");
    expect(out.projects.map((p) => p.name)).toEqual(["app", "job-search"]);
    expect(out.projects[1].highlights).toEqual(["Built matching"]);
  });

  it("rejects empty bullets, bad indexes, and incomplete new entries", () => {
    expect(() => addBullet(profile, { kind: "experience", index: 0 }, " ")).toThrow();
    expect(() => addBullet(profile, { kind: "experience", index: 2 }, "y")).toThrow();
    expect(() => addBullet(profile, { kind: "project", index: -1 }, "y")).toThrow();
    expect(() =>
      addBullet(profile, { kind: "newExperience", entry: { title: "x", company: " ", location: "", startDate: "", endDate: "" } }, "y"),
    ).toThrow("company");
    expect(() =>
      addBullet(profile, { kind: "newProject", entry: { name: "", url: "", tech: [], startDate: "", endDate: "" } }, "y"),
    ).toThrow("name");
  });
});
