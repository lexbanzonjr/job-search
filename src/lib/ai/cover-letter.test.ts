import { describe, expect, it } from "vitest";
import { openTestDb } from "@/lib/db";
import { upsertJobs } from "@/lib/jobs/store";
import { coverLetterPrompt, getCoverLetter, getCoverLetters, saveCoverLetter } from "./cover-letter";

const job = {
  sourceId: "j1", title: "Senior Engineer", company: "Acme", location: "Anaheim, CA", remote: true, publisher: "",
  applyUrl: "", description: "Build things with React.", employmentType: "", salary: "", logoUrl: "", postedAt: null,
};

describe("cover letter store", () => {
  it("saves per user and job, replacing on regenerate", async () => {
    const db = await openTestDb();
    const [jobId] = await upsertJobs([job], db);
    expect(await getCoverLetter(1, jobId, db)).toBeNull();
    await saveCoverLetter(1, jobId, "first", db);
    await saveCoverLetter(1, jobId, "second", db);
    await saveCoverLetter(2, jobId, "other user", db);
    expect(await getCoverLetter(1, jobId, db)).toBe("second");
    expect(await getCoverLetters(2, [jobId, 999], db)).toEqual(new Map([[jobId, "other user"]]));
    expect(await getCoverLetters(1, [], db)).toEqual(new Map());
  });
});

describe("coverLetterPrompt", () => {
  it("includes the resume and job details", () => {
    const prompt = coverLetterPrompt(
      { id: 1, filename: "r.pdf", text: "Jane Doe, 8 years React", profile: null, createdAt: "" },
      { ...job, id: 5 },
    );
    expect(prompt).toContain("Jane Doe, 8 years React");
    expect(prompt).toContain("Company: Acme");
    expect(prompt).toContain("Anaheim, CA (remote)");
    expect(prompt).toContain("Build things with React.");
  });
});
