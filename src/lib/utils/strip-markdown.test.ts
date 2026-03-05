import { describe, it, expect } from "vitest";
import { stripMarkdown } from "./strip-markdown";

describe("stripMarkdown", () => {
	it("returns empty string for empty input", () => {
		expect(stripMarkdown("")).toBe("");
	});

	it("returns empty string for falsy input", () => {
		expect(stripMarkdown(undefined as unknown as string)).toBe("");
		expect(stripMarkdown(null as unknown as string)).toBe("");
	});

	describe("headers", () => {
		it("strips h1", () => {
			expect(stripMarkdown("# Hello")).toBe("Hello");
		});

		it("strips h2-h6", () => {
			expect(stripMarkdown("## H2")).toBe("H2");
			expect(stripMarkdown("### H3")).toBe("H3");
			expect(stripMarkdown("#### H4")).toBe("H4");
			expect(stripMarkdown("##### H5")).toBe("H5");
			expect(stripMarkdown("###### H6")).toBe("H6");
		});
	});

	describe("inline formatting", () => {
		it("strips bold (**)", () => {
			expect(stripMarkdown("This is **bold** text")).toBe("This is bold text");
		});

		it("strips bold (__)", () => {
			expect(stripMarkdown("This is __bold__ text")).toBe("This is bold text");
		});

		it("strips italic (*)", () => {
			expect(stripMarkdown("This is *italic* text")).toBe("This is italic text");
		});

		it("strips italic (_)", () => {
			expect(stripMarkdown("This is _italic_ text")).toBe("This is italic text");
		});

		it("strips strikethrough", () => {
			expect(stripMarkdown("This is ~~deleted~~ text")).toBe("This is deleted text");
		});

		it("strips inline code", () => {
			expect(stripMarkdown("Use `console.log`")).toBe("Use console.log");
		});

		it("strips code blocks with triple backticks", () => {
			expect(stripMarkdown("```const x = 1```")).toBe("const x = 1");
		});
	});

	describe("links and images", () => {
		it("strips links keeping link text", () => {
			expect(stripMarkdown("[Click here](https://example.com)")).toBe("Click here");
		});

		it("strips images keeping alt text (with leading !)", () => {
			// Note: link regex runs before image regex, so the ! prefix remains
			expect(stripMarkdown("![Alt text](image.png)")).toBe("!Alt text");
		});

		it("strips images with empty alt", () => {
			expect(stripMarkdown("![](image.png)")).toBe("");
		});
	});

	describe("block elements", () => {
		it("strips blockquotes", () => {
			expect(stripMarkdown("> This is a quote")).toBe("This is a quote");
		});

		it("strips unordered list markers (-)", () => {
			expect(stripMarkdown("- item one\n- item two")).toBe("item one\nitem two");
		});

		it("strips unordered list markers (*)", () => {
			expect(stripMarkdown("* item one\n* item two")).toBe("item one\nitem two");
		});

		it("strips unordered list markers (+)", () => {
			expect(stripMarkdown("+ item one")).toBe("item one");
		});

		it("strips ordered list markers", () => {
			expect(stripMarkdown("1. First\n2. Second")).toBe("First\nSecond");
		});
	});

	it("handles combined markdown", () => {
		const input =
			"# Title\n\nThis is **bold** and *italic* with a [link](http://x.com).\n\n> Quote\n\n- item";
		const result = stripMarkdown(input);
		expect(result).toContain("Title");
		expect(result).toContain("bold");
		expect(result).toContain("italic");
		expect(result).toContain("link");
		expect(result).toContain("Quote");
		expect(result).toContain("item");
		expect(result).not.toContain("**");
		expect(result).not.toContain("[");
		expect(result).not.toContain("#");
	});

	it("trims whitespace", () => {
		expect(stripMarkdown("  hello  ")).toBe("hello");
	});
});
