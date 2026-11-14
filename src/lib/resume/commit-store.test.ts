import { describe, expect, it } from "vitest";
import { openTestDb } from "@/lib/db";
import { addHighlight, insertReviews, knownShas, listReviews, setReviewStatus } from "./commit-store";

const commits = [
  { repo: "o/r", sha: "a", message: "Add search", committedAt: "2026-02-01" },
  { repo: "o/r", sha: "b", message: "typo", committedAt: "2026-02-02" },
];
const review = {
  sha: "a", what: "Adds search", why: "Users needed it", impactScore: 4, resumeWorthy: true,
  bullet: "Built full-text search", experienceIndex: 0,
};

describe("commit store", () => {
  it("stores worthy reviews as pending, others as rejected, and skips repeats", async () => {
    const db = await openTestDb();
    expect(await insertReviews(1, commits, [review], db)).toBe(1);
    expect(await insertReviews(1, commits, [review], db)).toBe(0);
    expect(await knownShas(1, "o/r", db)).toEqual(new Set(["a", "b"]));
    const pending = await listReviews(1, "pending", db);
    expect(pending.map((r) => [r.sha, r.bullet, r.impactScore])).toEqual([["a", "Built full-text search", 4]]);
    expect((await listReviews(1, "rejected", db)).map((r) => r.sha)).toEqual(["b"]);
    expect(await listReviews(2, "pending", db)).toEqual([]);

    await setReviewStatus(2, pending[0].id, "accepted", db); // other user: no effect
    expect(await listReviews(1, "pending", db)).toHaveLength(1);
    await setReviewStatus(1, pending[0].id, "accepted", db);
    expect(await listReviews(1, "accepted", db)).toHaveLength(1);
  });
});

describe("addHighlight", () => {
  const profile = { experience: [{ highlights: ["x"] }, { highlights: [] as string[] }] };

  it("appends to the chosen role without mutating", () => {
    const out = addHighlight(profile, 1, "  Built search ");
    expect(out.experience[1].highlights).toEqual(["Built search"]);
    expect(profile.experience[1].highlights).toEqual([]);
    expect(addHighlight(out, 1, "Built search").experience[1].highlights).toHaveLength(1);
  });

  it("rejects empty bullets and bad indexes", () => {
    expect(() => addHighlight(profile, 0, " ")).toThrow();
    expect(() => addHighlight(profile, -1, "y")).toThrow();
    expect(() => addHighlight(profile, 2, "y")).toThrow();
  });
});
