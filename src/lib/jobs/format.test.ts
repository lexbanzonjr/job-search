import { describe, expect, it } from "vitest";
import { formatDescription } from "./format";

describe("formatDescription", () => {
  it("returns nothing for empty input", () => {
    expect(formatDescription("")).toEqual([]);
    expect(formatDescription("   \n ")).toEqual([]);
  });

  it("keeps plain paragraphs separated by blank lines", () => {
    expect(formatDescription("First line\nsame para.\n\nSecond para.")).toEqual([
      { type: "para", text: "First line same para." },
      { type: "para", text: "Second para." },
    ]);
  });

  it("splits inline bullets into a list", () => {
    expect(formatDescription("You will: • Build APIs • Write tests • Mentor peers")).toEqual([
      { type: "heading", text: "You will" },
      { type: "list", items: ["Build APIs", "Write tests", "Mentor peers"] },
    ]);
  });

  it("pulls run-in headings onto their own line", () => {
    const blocks = formatDescription("We build things. Requirements: 5 years of React.");
    expect(blocks).toEqual([
      { type: "para", text: "We build things." },
      { type: "heading", text: "Requirements" },
      { type: "para", text: "5 years of React." },
    ]);
  });

  it("treats short ALL-CAPS lines and dash bullets", () => {
    expect(formatDescription("BENEFITS\n- Health\n- 401k")).toEqual([
      { type: "heading", text: "BENEFITS" },
      { type: "list", items: ["Health", "401k"] },
    ]);
  });
});
