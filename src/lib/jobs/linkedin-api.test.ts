import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/linkedin-active-jb.json";
import { buildLinkedInQuery, fetchLinkedIn, normalizeLinkedIn, timeFrame, type LinkedInItem } from "./linkedin-api";

const items = fixture as LinkedInItem[];

describe("normalizeLinkedIn", () => {
  it("maps a real /active-jb item to a Job", () => {
    const job = normalizeLinkedIn(items[0]);
    expect(job).toMatchObject({
      sourceId: `li:${items[0].id}`,
      title: "Senior Software Engineer (5G)",
      company: "CyberCoders",
      location: "Vista, California, United States",
      remote: false,
      publisher: "LinkedIn",
      employmentType: "FULLTIME",
      salary: "$200k–$250k / year",
    });
    expect(job.applyUrl).toMatch(/^https:\/\/www\.linkedin\.com\/jobs\/view\//);
    expect(job.postedAt).toBe(items[0].date_posted);
  });

  it("flags remote arrangements and falls back to 'Remote' with no location", () => {
    const job = normalizeLinkedIn({ id: 1, title: "Dev", ai_work_arrangement: "Remote Solely" });
    expect(job).toMatchObject({ remote: true, location: "Remote", salary: "" });
  });
});

describe("buildLinkedInQuery", () => {
  it("maps date windows to the API's time frames", () => {
    expect(timeFrame("today")).toBe("24h");
    expect(timeFrame("month")).toBe("7d");
    expect(timeFrame(undefined)).toBe("7d");
  });

  it("sends title, location, remote and a capped limit", () => {
    const qs = new URLSearchParams(
      buildLinkedInQuery({ query: " React Developer ", location: "California", remoteOnly: true, datePosted: "week" }),
    );
    expect(Object.fromEntries(qs)).toEqual({
      time_frame: "7d",
      title: "React Developer",
      source: "linkedin",
      description_format: "text",
      limit: "25",
      location: "California",
      ai_work_arrangement: "Remote OK,Remote Solely",
    });
  });
});

describe("fetchLinkedIn", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("calls /active-jb and normalizes the array", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "k");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(items))) as unknown as typeof fetch;
    const jobs = await fetchLinkedIn({ query: "Software Engineer" }, fetchImpl);
    expect(jobs).toHaveLength(items.length);
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/linkedin-job-search-api\.p\.rapidapi\.com\/active-jb\?/);
  });

  it("explains quota errors", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "k");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 429 })) as unknown as typeof fetch;
    await expect(fetchLinkedIn({ query: "x" }, fetchImpl)).rejects.toThrow(/quota/);
  });
});
