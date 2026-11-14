import { describe, expect, it } from "vitest";
import { commitReviewPrompt, commitReviewSchema, isWorthReviewing } from "./commit-review";

const commit = (over: Partial<Parameters<typeof isWorthReviewing>[0]> = {}) => ({
  repo: "o/r", sha: "a", message: "Add search", committedAt: "2026-02-01",
  additions: 40, deletions: 5, files: [], patch: "--- a.ts\n@@", ...over,
});

describe("commit review", () => {
  it("skips trivial commits", () => {
    expect(isWorthReviewing(commit())).toBe(true);
    expect(isWorthReviewing(commit({ message: "typo in header" }))).toBe(false);
    expect(isWorthReviewing(commit({ message: "WIP" }))).toBe(false);
    expect(isWorthReviewing(commit({ additions: 3, deletions: 1 }))).toBe(false);
    expect(isWorthReviewing(commit({ patch: "" }))).toBe(false);
  });

  it("includes experience and commits in the prompt", () => {
    const prompt = commitReviewPrompt([commit()], {
      experience: [{ title: "Engineer", company: "Acme", location: "", startDate: "2024", endDate: "Present", highlights: [] }],
    } as never);
    expect(prompt).toContain("0. Engineer at Acme (2024 - Present)");
    expect(prompt).toContain('sha="a"');
    expect(prompt).toContain("Add search");
    expect(commitReviewPrompt([], null)).toContain("(none)");
  });

  it("validates review output", () => {
    const ok = { sha: "a", what: "w", why: "y", impactScore: 3, resumeWorthy: true, bullet: "b", experienceIndex: 0 };
    expect(commitReviewSchema.safeParse(ok).success).toBe(true);
    expect(commitReviewSchema.safeParse({ ...ok, impactScore: 9 }).success).toBe(false);
  });
});
