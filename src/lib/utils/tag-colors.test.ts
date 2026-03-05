import { describe, it, expect } from "vitest";
import { tagColor, tagStyle } from "./tag-colors";

describe("tagColor", () => {
it("returns an object with bg, border, and text properties", () => {
const result = tagColor("test");
expect(result).toHaveProperty("bg");
expect(result).toHaveProperty("border");
expect(result).toHaveProperty("text");
});

it("returns valid HSL strings", () => {
const result = tagColor("ai-fail");
expect(result.bg).toMatch(/^hsl\(\d+(\.\d+)? 60% 15%\)$/);
expect(result.border).toMatch(/^hsl\(\d+(\.\d+)? 50% 30%\)$/);
expect(result.text).toMatch(/^hsl\(\d+(\.\d+)? 70% (75|82)%\)$/);
});

it("is deterministic (same input = same output)", () => {
const a = tagColor("hallucination");
const b = tagColor("hallucination");
expect(a).toEqual(b);
});

it("produces different colors for different tags", () => {
const a = tagColor("chatgpt");
const b = tagColor("hallucination");
const c = tagColor("legal");
// At least some of these should differ
const bgs = new Set([a.bg, b.bg, c.bg]);
expect(bgs.size).toBeGreaterThan(1);
});
});

describe("tagStyle", () => {
it("returns a valid CSS inline style string", () => {
const style = tagStyle("test");
expect(style).toContain("background-color:");
expect(style).toContain("border-color:");
expect(style).toContain("color:");
});

it("contains the same colors as tagColor", () => {
const tag = "example";
const color = tagColor(tag);
const style = tagStyle(tag);
expect(style).toBe(
`background-color:${color.bg};border-color:${color.border};color:${color.text}`,
);
});

it("is deterministic", () => {
expect(tagStyle("foo")).toBe(tagStyle("foo"));
});
});
