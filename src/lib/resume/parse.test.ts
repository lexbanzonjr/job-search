import { describe, expect, it } from "vitest";
import { cleanText, detectKind, extractResumeText, MAX_RESUME_BYTES } from "./parse";

const RESUME = `Jane Doe\r\nSenior Software Engineer\n\n\n\nSkills:   TypeScript,  React,\tNode.js\nExperience: 8 years building web apps at scale.`;

describe("detectKind", () => {
  it("detects by extension or mime", () => {
    expect(detectKind("cv.PDF")).toBe("pdf");
    expect(detectKind("cv", "application/pdf")).toBe("pdf");
    expect(detectKind("cv.docx")).toBe("docx");
    expect(detectKind("cv.txt")).toBe("text");
    expect(detectKind("cv.png", "image/png")).toBeNull();
  });
});

describe("cleanText", () => {
  it("normalizes newlines and whitespace", () => {
    expect(cleanText(RESUME)).toBe(
      "Jane Doe\nSenior Software Engineer\n\nSkills: TypeScript, React, Node.js\nExperience: 8 years building web apps at scale.",
    );
  });
});

describe("extractResumeText", () => {
  it("reads plain text", async () => {
    expect(await extractResumeText(Buffer.from(RESUME), "resume.txt")).toContain("Skills: TypeScript, React, Node.js");
  });

  it("rejects unsupported types", async () => {
    await expect(extractResumeText(Buffer.from(RESUME), "resume.png", "image/png")).rejects.toThrow(/Unsupported/);
  });

  it("rejects files with almost no text", async () => {
    await expect(extractResumeText(Buffer.from("hi"), "resume.txt")).rejects.toThrow(/Could not read/);
  });

  it("rejects oversized files", async () => {
    await expect(extractResumeText(Buffer.alloc(MAX_RESUME_BYTES + 1), "resume.txt")).rejects.toThrow(/5 MB/);
  });

  it("rejects a corrupt PDF", async () => {
    await expect(extractResumeText(Buffer.from("not really a pdf".repeat(10)), "resume.pdf")).rejects.toThrow();
  });
});
