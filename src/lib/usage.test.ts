import { afterEach, describe, expect, it } from "vitest";
import { openTestDb } from "@/lib/db";
import { consume, LimitError } from "./usage";

const user = { id: 7, username: "u", isAdmin: false };

afterEach(() => delete process.env.MATCH_DAILY_LIMIT);

describe("consume", () => {
  it("allows up to the daily limit, then throws, and resets the next day", async () => {
    const db = await openTestDb();
    process.env.MATCH_DAILY_LIMIT = "2";
    const day1 = new Date("2026-01-01T10:00:00Z");
    await consume(user, "match", db, day1);
    await consume(user, "match", db, day1);
    await expect(consume(user, "match", db, day1)).rejects.toBeInstanceOf(LimitError);
    await expect(consume(user, "match", db, new Date("2026-01-02T00:00:00Z"))).resolves.toBeUndefined();
    await expect(consume(user, "cover", db, day1)).resolves.toBeUndefined();
  });

  it("never limits admins and blocks everything at 0", async () => {
    const db = await openTestDb();
    process.env.MATCH_DAILY_LIMIT = "0";
    await expect(consume({ ...user, isAdmin: true }, "match", db)).resolves.toBeUndefined();
    await expect(consume(user, "match", db)).rejects.toThrow(/0 match runs/);
  });
});
