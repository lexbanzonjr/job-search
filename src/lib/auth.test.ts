import { describe, expect, it } from "vitest";
import { signSession, verifySession, SESSION_MAX_AGE } from "./auth";

const KEY = "test-secret";

describe("session tokens", () => {
  it("round-trips a username", () => {
    expect(verifySession(signSession("lex", Date.now(), KEY), Date.now(), KEY)).toBe("lex");
  });

  it("rejects a tampered token", () => {
    const [u, exp, sig] = signSession("lex", Date.now(), KEY).split(".");
    expect(verifySession(`${u}.${Number(exp) + 999}.${sig}`, Date.now(), KEY)).toBeNull();
  });

  it("rejects a token signed with another key", () => {
    expect(verifySession(signSession("lex", Date.now(), "other"), Date.now(), KEY)).toBeNull();
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const token = signSession("lex", now, KEY);
    expect(verifySession(token, now + (SESSION_MAX_AGE + 1) * 1000, KEY)).toBeNull();
  });

  it("rejects missing or malformed tokens", () => {
    expect(verifySession(undefined, Date.now(), KEY)).toBeNull();
    expect(verifySession("garbage", Date.now(), KEY)).toBeNull();
  });
});
