import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo } from "./time";

describe("timeAgo", () => {
afterEach(() => {
vi.useRealTimers();
});

function setNow(unixSeconds: number) {
vi.useFakeTimers();
vi.setSystemTime(unixSeconds * 1000);
}

it('returns "just now" for <60 seconds ago', () => {
const now = 1700000000;
setNow(now);
expect(timeAgo(now)).toBe("just now");
expect(timeAgo(now - 30)).toBe("just now");
expect(timeAgo(now - 59)).toBe("just now");
});

it("returns minutes ago for <1 hour", () => {
const now = 1700000000;
setNow(now);
expect(timeAgo(now - 60)).toBe("1m ago");
expect(timeAgo(now - 120)).toBe("2m ago");
expect(timeAgo(now - 3599)).toBe("59m ago");
});

it("returns hours ago for <1 day", () => {
const now = 1700000000;
setNow(now);
expect(timeAgo(now - 3600)).toBe("1h ago");
expect(timeAgo(now - 7200)).toBe("2h ago");
expect(timeAgo(now - 86399)).toBe("23h ago");
});

it("returns days ago for <1 week", () => {
const now = 1700000000;
setNow(now);
expect(timeAgo(now - 86400)).toBe("1d ago");
expect(timeAgo(now - 172800)).toBe("2d ago");
expect(timeAgo(now - 604799)).toBe("6d ago");
});

it("returns formatted date for >=1 week", () => {
const now = 1700000000;
setNow(now);
const oneWeekAgo = now - 604800;
const result = timeAgo(oneWeekAgo);
// Should be a localized date string, not a relative time
expect(result).not.toContain("ago");
expect(result).not.toBe("just now");
});

it("returns boundary at exactly 60 seconds as 1m ago", () => {
const now = 1700000000;
setNow(now);
expect(timeAgo(now - 60)).toBe("1m ago");
});
});
