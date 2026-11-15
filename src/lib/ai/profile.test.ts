import { describe, expect, it } from "vitest";
import { normalizeProfile } from "./profile";

describe("normalizeProfile", () => {
  it("fills in projects for profiles saved before they existed", () => {
    const old = { name: "Jane", experience: [{ title: "Eng" }] };
    const p = normalizeProfile(old);
    expect(p.projects).toEqual([]);
    expect(p.experience).toEqual([{ title: "Eng" }]);
    expect(p.name).toBe("Jane");
  });

  it("keeps existing projects", () => {
    const projects = [{ name: "app", url: "", tech: [], startDate: "", endDate: "", highlights: [] }];
    expect(normalizeProfile({ experience: [], projects }).projects).toBe(projects);
  });
});
