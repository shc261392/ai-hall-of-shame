import { describe, it, expect } from "vitest";
import {
computeIsGolden,
GOLDEN_REACTION_THRESHOLD,
GOLDEN_UPVOTE_THRESHOLD,
} from "./index";
import type { ReactionCount } from "./index";

describe("computeIsGolden", () => {
const makeReactions = (trophyCount: number): ReactionCount[] => [
{ emoji: "🔥", label: "Dumpster Fire", count: 5, userReacted: false },
{ emoji: "🏆", label: "GOAT Advice", count: trophyCount, userReacted: false },
];

it("returns false for undefined reactions", () => {
expect(computeIsGolden(undefined, 100, 0)).toBe(false);
});

it("returns false when no trophy reaction exists", () => {
const reactions: ReactionCount[] = [
{ emoji: "🔥", label: "Dumpster Fire", count: 20, userReacted: false },
];
expect(computeIsGolden(reactions, 100, 0)).toBe(false);
});

it("returns false when trophy count < threshold", () => {
expect(computeIsGolden(makeReactions(9), 100, 0)).toBe(false);
});

it("returns false when upvote margin < threshold", () => {
expect(computeIsGolden(makeReactions(15), 5, 0)).toBe(false);
});

it("returns false when upvotes - downvotes < threshold", () => {
expect(computeIsGolden(makeReactions(15), 20, 15)).toBe(false);
});

it("returns true when both thresholds are met", () => {
expect(computeIsGolden(makeReactions(15), 20, 5)).toBe(true);
});

it("returns true at exact thresholds", () => {
expect(
computeIsGolden(
makeReactions(GOLDEN_REACTION_THRESHOLD),
GOLDEN_UPVOTE_THRESHOLD,
0,
),
).toBe(true);
});

it("returns false when one threshold is exactly met but the other is not", () => {
// Trophy exactly at threshold, but upvote margin below
expect(
computeIsGolden(
makeReactions(GOLDEN_REACTION_THRESHOLD),
GOLDEN_UPVOTE_THRESHOLD - 1,
0,
),
).toBe(false);
// Upvote margin at threshold, but trophy below
expect(
computeIsGolden(
makeReactions(GOLDEN_REACTION_THRESHOLD - 1),
GOLDEN_UPVOTE_THRESHOLD,
0,
),
).toBe(false);
});

it("returns false for empty reactions array", () => {
expect(computeIsGolden([], 100, 0)).toBe(false);
});
});
