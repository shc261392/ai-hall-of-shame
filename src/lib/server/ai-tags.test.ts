import { describe, it, expect } from "vitest";
import { parseAiTags } from "./ai-tags";

describe("parseAiTags", () => {
	it("parses simple comma-separated tags", () => {
		expect(parseAiTags("chatgpt, hallucination, legal")).toEqual([
			"chatgpt",
			"hallucination",
			"legal",
		]);
	});

	it('strips "Tags:" prefix', () => {
		expect(parseAiTags("Tags: chatgpt, ai-fail")).toEqual(["chatgpt", "ai-fail"]);
		expect(parseAiTags("Tag: chatgpt")).toEqual(["chatgpt"]);
		expect(parseAiTags("tags: one, two")).toEqual(["one", "two"]);
	});

	it("strips preamble before blank line", () => {
		const input = "Here are 3 possible tags:\n\nchatgpt, hallucination, legal";
		expect(parseAiTags(input)).toEqual(["chatgpt", "hallucination", "legal"]);
	});

	it('strips "here are/here\'s" preamble on single line', () => {
		expect(parseAiTags("Here are some tags: chatgpt, legal")).toEqual(["chatgpt", "legal"]);
		expect(parseAiTags("here's the tags: ai-fail")).toEqual(["ai-fail"]);
	});

	it("parses numbered lists", () => {
		const input = "1. chatgpt\n2. hallucination\n3. legal";
		expect(parseAiTags(input)).toEqual(["chatgpt", "hallucination", "legal"]);
	});

	it("handles quoted tags", () => {
		expect(parseAiTags('"chatgpt", "ai-fail"')).toEqual(["chatgpt", "ai-fail"]);
		expect(parseAiTags("'chatgpt', 'legal'")).toEqual(["chatgpt", "legal"]);
	});

	it("converts spaces to hyphens", () => {
		expect(parseAiTags("ai fail, chat gpt")).toEqual(["ai-fail", "chat-gpt"]);
	});

	it("collapses double hyphens", () => {
		expect(parseAiTags("ai--fail")).toEqual(["ai-fail"]);
	});

	it("splits tags >24 chars on hyphens", () => {
		// A tag that's way too long but contains valid segments
		const longTag = "this-is-a-very-long-combined-tag-that-exceeds-limit";
		const result = parseAiTags(longTag);
		// Should extract valid sub-segments
		expect(result.length).toBeGreaterThan(0);
		for (const tag of result) {
			expect(tag.length).toBeLessThanOrEqual(24);
			expect(tag.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("filters out single-char tags", () => {
		expect(parseAiTags("a, bb, ccc")).toEqual(["bb", "ccc"]);
	});

	it("returns empty array for empty input", () => {
		expect(parseAiTags("")).toEqual([]);
	});

	it("strips # markdown prefix from tags", () => {
		expect(parseAiTags("#chatgpt, #ai-fail")).toEqual(["chatgpt", "ai-fail"]);
	});

	it("strips * bullet markers", () => {
		expect(parseAiTags("* chatgpt\n* legal")).toEqual(["chatgpt", "legal"]);
	});

	it("handles newline-separated tags", () => {
		expect(parseAiTags("chatgpt\nhallucination\nlegal")).toEqual([
			"chatgpt",
			"hallucination",
			"legal",
		]);
	});

	it("strips invalid characters", () => {
		expect(parseAiTags("chat@gpt!, legal$")).toEqual(["chatgpt", "legal"]);
	});

	it("filters single-char results after cleaning", () => {
		// Single char tags are filtered by the length >= 2 check
		expect(parseAiTags("x")).toEqual([]);
	});
});
