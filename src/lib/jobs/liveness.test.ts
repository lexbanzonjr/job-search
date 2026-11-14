import { describe, expect, it, vi } from "vitest";
import { isListingDead } from "./liveness";

const respond = (status: number, body = "") => vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

describe("isListingDead", () => {
  it("treats 404 and 410 as dead", async () => {
    expect(await isListingDead("https://x/1", respond(404))).toBe(true);
    expect(await isListingDead("https://x/1", respond(410))).toBe(true);
  });

  it("detects expired-page wording on a 200", async () => {
    expect(await isListingDead("https://x/1", respond(200, "<h1>No longer accepting applications</h1>"))).toBe(true);
    expect(await isListingDead("https://x/1", respond(200, "Sorry, this job has expired."))).toBe(true);
  });

  it("keeps live pages, bot blocks, errors, and empty urls", async () => {
    expect(await isListingDead("https://x/1", respond(200, "<h1>Frontend Engineer</h1> Apply now"))).toBe(false);
    expect(await isListingDead("https://x/1", respond(403))).toBe(false);
    expect(await isListingDead("https://x/1", respond(429))).toBe(false);
    const boom = vi.fn(async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    expect(await isListingDead("https://x/1", boom)).toBe(false);
    expect(await isListingDead("", respond(404))).toBe(false);
  });
});
