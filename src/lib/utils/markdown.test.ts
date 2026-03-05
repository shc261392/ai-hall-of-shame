import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
	it("returns empty string for empty input", () => {
		expect(renderMarkdown("")).toBe("");
	});

	it("returns empty string for falsy input", () => {
		expect(renderMarkdown(undefined as unknown as string)).toBe("");
	});

	it("renders bold text", () => {
		const html = renderMarkdown("**bold**");
		expect(html).toContain("<strong>bold</strong>");
	});

	it("renders italic text", () => {
		const html = renderMarkdown("*italic*");
		expect(html).toContain("<em>italic</em>");
	});

	it("renders headers", () => {
		const html = renderMarkdown("# Hello");
		expect(html).toContain("<h1>Hello</h1>");
	});

	it("renders links with target=_blank", () => {
		const html = renderMarkdown("[link](https://example.com)");
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	it("strips script tags (XSS prevention)", () => {
		const html = renderMarkdown('<script>alert("xss")</script>');
		expect(html).not.toContain("<script>");
		expect(html).not.toContain("</script>");
	});

	it("strips javascript: href (XSS prevention)", () => {
		const html = renderMarkdown('[click](javascript:alert("xss"))');
		expect(html).not.toContain("javascript:");
	});

	it("preserves safe https links", () => {
		const html = renderMarkdown("[safe](https://example.com)");
		expect(html).toContain('href="https://example.com"');
	});

	it("preserves mailto links", () => {
		const html = renderMarkdown("[email](mailto:test@example.com)");
		expect(html).toContain('href="mailto:test@example.com"');
	});

	it("renders code blocks", () => {
		const html = renderMarkdown("```\nconst x = 1;\n```");
		expect(html).toContain("<code>");
		expect(html).toContain("const x = 1;");
	});

	it("renders inline code", () => {
		const html = renderMarkdown("Use `console.log`");
		expect(html).toContain("<code>console.log</code>");
	});

	it("strips dangerous HTML tags", () => {
		const html = renderMarkdown("<img src=x onerror=alert(1)>");
		expect(html).not.toContain("<img");
	});

	it("allows whitelisted tags", () => {
		const html = renderMarkdown("**bold** and *italic*");
		expect(html).toContain("<strong>");
		expect(html).toContain("<em>");
	});
});
