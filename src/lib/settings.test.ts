import { describe, expect, it } from "vitest";
import { openTestDb } from "@/lib/db";
import { getAppSettings, getSetting, setLinkedInApi, setSetting } from "./settings";

describe("settings", () => {
  it("defaults the LinkedIn API to off", async () => {
    const db = await openTestDb();
    expect(await getAppSettings(db)).toEqual({ linkedinApi: false });
  });

  it("round-trips the LinkedIn API toggle", async () => {
    const db = await openTestDb();
    await setLinkedInApi(true, db);
    expect((await getAppSettings(db)).linkedinApi).toBe(true);
    await setLinkedInApi(false, db);
    expect((await getAppSettings(db)).linkedinApi).toBe(false);
  });

  it("overwrites an existing key", async () => {
    const db = await openTestDb();
    expect(await getSetting("x", db)).toBeNull();
    await setSetting("x", "a", db);
    await setSetting("x", "b", db);
    expect(await getSetting("x", db)).toBe("b");
  });
});
