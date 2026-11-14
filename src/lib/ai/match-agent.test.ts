import { describe, expect, it, vi } from "vitest";
import { openTestDb } from "@/lib/db";
import { insertResume } from "@/lib/resume/store";
import { upsertJobs } from "@/lib/jobs/store";
import type { StoredJob } from "@/lib/jobs/types";
import {
  dedupeJobs, keywordScore, listMatches, mergeScores, prefilter, runMatchAgent, saveMatches,
  type AgentDeps, type ProgressEvent,
} from "./match-agent";
import type { ResumeProfile } from "./profile";

const profile: ResumeProfile = {
  name: "Jane",
  summary: "Frontend engineer",
  targetTitles: ["Frontend Engineer", "React Developer"],
  skills: ["React", "TypeScript", "GraphQL"],
  yearsExperience: 6,
  seniority: "senior",
  locations: ["Anaheim, CA"],
  industries: [],
};

let nextId = 1;
const job = (title: string, company = "Acme", description = ""): StoredJob => {
  const id = nextId++;
  return {
    id, sourceId: `s${id}`, title, company, description, location: "", remote: false,
    publisher: "LinkedIn", applyUrl: "", employmentType: "", salary: "", logoUrl: "", postedAt: null,
  };
};

describe("dedupeJobs", () => {
  it("drops repeated ids and the same title+company", () => {
    const a = job("Frontend Engineer");
    const b = job("frontend  engineer", "ACME");
    const c = job("Backend Engineer");
    expect(dedupeJobs([a, a, b, c]).map((j) => j.id)).toEqual([a.id, c.id]);
  });
});

describe("prefilter", () => {
  it("ranks title and skill matches first and respects the limit", () => {
    const chef = job("Line Cook", "Diner", "cook food");
    const fe = job("Senior Frontend Engineer", "X", "react typescript");
    const be = job("Backend Engineer", "Y", "go, uses graphql");
    expect(keywordScore(profile, fe)).toBeGreaterThan(keywordScore(profile, be));
    expect(keywordScore(profile, be)).toBeGreaterThan(keywordScore(profile, chef));
    expect(prefilter(profile, [chef, be, fe], 2).map((j) => j.id)).toEqual([fe.id, be.id]);
  });
});

describe("mergeScores", () => {
  it("clamps, drops unknown/duplicate ids, and sorts by score", () => {
    const a = job("A");
    const b = job("B");
    const s = (jobId: number, score: number) => ({ jobId, score, matchedSkills: [], gaps: [], reason: "" });
    const merged = mergeScores([a, b], [s(a.id, 55.4), s(b.id, 140), s(999_999, 90), s(a.id, 10)]);
    expect(merged.map((m) => [m.jobId, m.score])).toEqual([[b.id, 100], [a.id, 55]]);
  });
});

describe("runMatchAgent", () => {
  it("searches each query, dedupes, scores in batches, and reports progress", async () => {
    const jobsA = Array.from({ length: 8 }, (_, i) => job(`Frontend Engineer ${i}`, "A"));
    const jobsB = [...jobsA.slice(0, 3), ...Array.from({ length: 6 }, (_, i) => job(`React Developer ${i}`, "B"))];
    const deps: AgentDeps = {
      generateQueries: vi.fn(async () => ["frontend engineer", "react developer"]),
      search: vi.fn(async (p) => (p.query.startsWith("frontend") ? jobsA : jobsB)),
      scoreJobs: vi.fn(async (_p, jobs: StoredJob[]) =>
        jobs.map((j, i) => ({ jobId: j.id, score: 50 + i, matchedSkills: ["React"], gaps: [], reason: "ok" })),
      ),
    };
    const events: ProgressEvent[] = [];
    const results = await runMatchAgent(profile, { linkedinOnly: true, location: "Anaheim" }, deps, (e) => events.push(e));

    expect(deps.search).toHaveBeenCalledTimes(2);
    expect(deps.search).toHaveBeenCalledWith(expect.objectContaining({ linkedinOnly: true, location: "Anaheim", datePosted: "month" }));
    expect(events).toContainEqual({ type: "found", count: 14 });
    expect(deps.scoreJobs).toHaveBeenCalledTimes(2); // 14 jobs in batches of 10
    expect(results).toHaveLength(14);
    expect(results[0].score).toBeGreaterThanOrEqual(results[13].score);
  });

  it("skips dead listings and backfills with the next-best live jobs", async () => {
    const jobs = Array.from({ length: 40 }, (_, i) => job(`Frontend Engineer ${i}`, `C${i}`));
    const deadIds = new Set(jobs.slice(0, 5).map((j) => j.id));
    const deps: AgentDeps = {
      generateQueries: async () => ["frontend engineer"],
      search: async () => jobs,
      scoreJobs: vi.fn(async (_p, js: StoredJob[]) =>
        js.map((j) => ({ jobId: j.id, score: 60, matchedSkills: [], gaps: [], reason: "" })),
      ),
      isDead: vi.fn(async (j: StoredJob) => deadIds.has(j.id)),
    };
    const events: ProgressEvent[] = [];
    const results = await runMatchAgent(profile, {}, deps, (e) => events.push(e));
    expect(results).toHaveLength(30);
    expect(results.some((r) => deadIds.has(r.jobId))).toBe(false);
    expect(deps.isDead).toHaveBeenCalledTimes(35); // stops once 30 live jobs are found
    expect(events).toContainEqual({ type: "status", message: "Skipped 5 expired listings" });
  });

  it("keeps going when a search fails and returns [] with no jobs", async () => {
    const deps: AgentDeps = {
      generateQueries: async () => ["a", "b"],
      search: vi.fn(async () => {
        throw new Error("quota");
      }),
      scoreJobs: vi.fn(),
    };
    const events: ProgressEvent[] = [];
    expect(await runMatchAgent(profile, {}, deps, (e) => events.push(e))).toEqual([]);
    expect(deps.search).toHaveBeenCalledTimes(2);
    expect(deps.scoreJobs).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === "status" && e.message.includes("quota"))).toBe(true);
  });
});

describe("saveMatches / listMatches", () => {
  it("replaces previous matches for the resume and reads them back ranked", async () => {
    const db = await openTestDb();
    const [id1, id2] = await upsertJobs([job("A"), job("B")], db);
    const resumeId = await insertResume(1, "r", "t", null, db);
    const result = (jobId: number, score: number) => ({ jobId, score, matchedSkills: ["x"], gaps: [], reason: "r", job: job("tmp") });
    await saveMatches(resumeId, [result(id1, 10)], db);
    await saveMatches(resumeId, [result(id1, 40), result(id2, 90)], db);
    const rows = await listMatches(resumeId, db);
    expect(rows.map((r) => [r.jobId, r.score])).toEqual([[id2, 90], [id1, 40]]);
    expect(rows[0]).toMatchObject({ matchedSkills: ["x"], reason: "r", job: { title: "B" } });
    db.close();
  });
});
