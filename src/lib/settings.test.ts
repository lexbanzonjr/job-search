import { afterEach, describe, expect, it } from "vitest";
import { openTestDb } from "@/lib/db";
import { getAppSettings, getGitHubConfig, getSetting, setGitHubConfig, setLinkedInApi, setSetting } from "./settings";

describe("settings", () => {
  it("defaults the LinkedIn API to off", async () => {
    const db = await openTestDb();
    expect(await getAppSettings(db)).toEqual({ linkedinApi: false, githubTokenSet: false, githubLogin: "" });
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

describe("GitHub settings", () => {
  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_LOGIN;
  });

  it("prefers saved values over .env", async () => {
    const db = await openTestDb();
    process.env.GITHUB_TOKEN = "env-token";
    process.env.GITHUB_LOGIN = "env-login";
    expect(await getGitHubConfig(db)).toEqual({ token: "env-token", login: "env-login" });
    await setGitHubConfig({ token: "db-token", login: "me" }, db);
    expect(await getGitHubConfig(db)).toEqual({ token: "db-token", login: "me" });
  });

  it("keeps the token on blank and removes it on clear", async () => {
    const db = await openTestDb();
    await setGitHubConfig({ token: " t1 ", login: "me" }, db);
    await setGitHubConfig({ token: "", login: "me" }, db);
    expect((await getGitHubConfig(db)).token).toBe("t1");
    await setGitHubConfig({ login: "me", clearToken: true }, db);
    expect((await getGitHubConfig(db)).token).toBeNull();
  });

  it("never exposes the token in app settings", async () => {
    const db = await openTestDb();
    await setGitHubConfig({ token: "secret", login: "me" }, db);
    const s = await getAppSettings(db);
    expect(s).toEqual({ linkedinApi: false, githubTokenSet: true, githubLogin: "me" });
    expect(JSON.stringify(s)).not.toContain("secret");
  });
});
