import { describe, expect, it } from "vitest";
import { annualSalary, parseSortKey, sortMatches } from "./sort";
import type { Job } from "./types";

describe("annualSalary", () => {
  it("annualizes the top of the range", () => {
    expect(annualSalary("$120k–$150k / year")).toBe(150_000);
    expect(annualSalary("$45 / hour")).toBe(45 * 2080);
    expect(annualSalary("$8k / month")).toBe(96_000);
    expect(annualSalary("$90k")).toBe(90_000);
    expect(annualSalary("")).toBeNull();
  });
});

describe("parseSortKey", () => {
  it("defaults to match", () => {
    expect(parseSortKey("salary")).toBe("salary");
    expect(parseSortKey("bogus")).toBe("match");
    expect(parseSortKey(undefined)).toBe("match");
  });
});

describe("sortMatches", () => {
  const row = (id: string, score: number, salary = "", postedAt: string | null = null) => ({
    id, score, job: { salary, postedAt } as Job,
  });
  const rows = [
    row("a", 90, "", "2026-11-01T00:00:00Z"),
    row("b", 70, "$200k / year", null),
    row("c", 80, "$60 / hour", "2026-11-12T00:00:00Z"),
    row("d", 60, "", null),
  ];
  const ids = (k: Parameters<typeof sortMatches>[1]) => sortMatches(rows, k).map((r) => r.id);

  it("sorts by score, salary, and posted date with missing values last", () => {
    expect(ids("match")).toEqual(["a", "c", "b", "d"]);
    expect(ids("salary")).toEqual(["b", "c", "a", "d"]);
    expect(ids("posted")).toEqual(["c", "a", "b", "d"]);
  });
});
