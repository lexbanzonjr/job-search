import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { openTestDb } from "@/lib/db";
import { buildQueryString, decodeEntities, fetchJSearch, isLinkedInJob, normalizeJob, type JSearchItem } from "./jsearch";
import { cacheKey, searchJobs } from "./store";

const linkedin: JSearchItem = {
  job_id: "a1",
  job_title: "Frontend Engineer",
  employer_name: "Acme",
  job_publisher: "LinkedIn",
  job_apply_link: "https://www.linkedin.com/jobs/view/1",
  job_is_remote: true,
  job_city: "Anaheim",
  job_state: "CA",
  job_country: "US",
  job_min_salary: 120000,
  job_max_salary: 150000,
  job_salary_period: "YEAR",
  job_posted_at_datetime_utc: "2026-11-10T00:00:00.000Z",
};
const indeedWithLinkedInOption: JSearchItem = {
  job_id: "b2",
  job_title: "React Dev",
  job_publisher: "Indeed",
  job_apply_link: "https://indeed.com/2",
  apply_options: [{ publisher: "LinkedIn", apply_link: "https://www.linkedin.com/jobs/view/2" }],
};
const indeedOnly: JSearchItem = { job_id: "c3", job_title: "Dev", job_publisher: "Indeed", job_apply_link: "https://indeed.com/3" };

describe("normalizeJob", () => {
  it("maps fields and formats salary and location", () => {
    expect(normalizeJob(linkedin)).toMatchObject({
      sourceId: "a1",
      title: "Frontend Engineer",
      company: "Acme",
      location: "Anaheim, CA, US",
      remote: true,
      publisher: "LinkedIn",
      applyUrl: "https://www.linkedin.com/jobs/view/1",
      salary: "$120k–$150k / year",
    });
  });

  it("prefers the LinkedIn apply option when the main publisher is elsewhere", () => {
    const job = normalizeJob(indeedWithLinkedInOption);
    expect(job.publisher).toBe("LinkedIn");
    expect(job.applyUrl).toBe("https://www.linkedin.com/jobs/view/2");
  });

  it("keeps the original publisher when there is no LinkedIn option", () => {
    expect(normalizeJob(indeedOnly)).toMatchObject({ publisher: "Indeed", applyUrl: "https://indeed.com/3", salary: "" });
  });
});

describe("decodeEntities", () => {
  it("decodes numeric and named entities", () => {
    expect(decodeEntities("Tech Lead &#8211; React &#038; Python &amp; Go &#x27;24")).toBe("Tech Lead – React & Python & Go '24");
  });
});

describe("isLinkedInJob", () => {
  it("detects LinkedIn via publisher or apply options", () => {
    expect(isLinkedInJob(linkedin)).toBe(true);
    expect(isLinkedInJob(indeedWithLinkedInOption)).toBe(true);
    expect(isLinkedInJob(indeedOnly)).toBe(false);
  });
});

describe("buildQueryString", () => {
  it("adds location, LinkedIn hint and filters", () => {
    const qs = new URLSearchParams(
      buildQueryString({ query: "react", location: "Anaheim", linkedinOnly: true, remoteOnly: true, datePosted: "week", employmentType: "FULLTIME", cursor: "abc" }),
    );
    expect(qs.get("query")).toBe("react in Anaheim via linkedin");
    expect(qs.get("work_from_home")).toBe("true");
    expect(qs.get("date_posted")).toBe("week");
    expect(qs.get("employment_types")).toBe("FULLTIME");
    expect(qs.get("cursor")).toBe("abc");
    expect(qs.get("country")).toBe("us");
  });

  it("omits defaults", () => {
    const qs = new URLSearchParams(buildQueryString({ query: "react", datePosted: "all" }));
    expect(qs.has("date_posted")).toBe(false);
    expect(qs.has("work_from_home")).toBe(false);
  });
});

describe("fetchJSearch", () => {
  afterEach(() => {
    delete process.env.RAPIDAPI_KEY;
  });

  it("filters to LinkedIn jobs when asked", async () => {
    process.env.RAPIDAPI_KEY = "k";
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: { jobs: [linkedin, indeedWithLinkedInOption, indeedOnly], cursor: "next1" } }),
    );
    const page = await fetchJSearch({ query: "dev", linkedinOnly: true }, fetchMock);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/search-v2?");
    expect(page.jobs.map((j) => j.sourceId)).toEqual(["a1", "b2"]);
    expect(page.nextCursor).toBe("next1");
  });

  it("explains a 403 from RapidAPI", async () => {
    process.env.RAPIDAPI_KEY = "k";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 403 }));
    await expect(fetchJSearch({ query: "dev" }, fetchMock as unknown as typeof fetch)).rejects.toThrow(/subscribed to JSearch/);
  });

  it("throws a clear error without an API key", async () => {
    await expect(fetchJSearch({ query: "dev" })).rejects.toThrow(/RAPIDAPI_KEY/);
  });
});

describe("searchJobs cache", () => {
  afterAll(() => vi.unstubAllGlobals());

  it("calls the API once per parameter set within the TTL", async () => {
    const db = await openTestDb();
    process.env.RAPIDAPI_KEY = "k";
    const fetchMock = vi.fn(async () => Response.json({ data: { jobs: [linkedin, indeedOnly], cursor: "c2" } }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await searchJobs({ query: "Dev" }, db);
    const second = await searchJobs({ query: " dev " }, db);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.jobs.map((j) => j.sourceId)).toEqual(first.jobs.map((j) => j.sourceId));
    expect(second.nextCursor).toBe("c2");
    expect(cacheKey({ query: "Dev" })).toBe(cacheKey({ query: " dev " }));
  });
});
