import { describe, expect, it } from "vitest";
import { pdfFilename, renderResumePdf } from "./pdf";

const profile = {
  name: "Jane Doe", summary: "Engineer.", targetTitles: ["Senior Engineer"], skills: ["TypeScript", "React"],
  yearsExperience: 8, seniority: "senior" as const, locations: ["Anaheim, CA"], industries: [],
  experience: [{ title: "Engineer", company: "Acme", location: "Remote", startDate: "2020", endDate: "Present", highlights: ["Built search"] }],
};

describe("resume pdf", () => {
  it("renders a PDF", async () => {
    const buf = await renderResumePdf(profile);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("renders an empty profile", async () => {
    const buf = await renderResumePdf({ ...profile, name: "", summary: "", skills: [], experience: [] });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("builds a safe filename", () => {
    expect(pdfFilename("Jane  O'Doe")).toBe("Jane-ODoe-Resume.pdf");
    expect(pdfFilename("")).toBe("Resume.pdf");
  });
});
