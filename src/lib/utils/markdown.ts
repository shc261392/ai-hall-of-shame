/**
 * Markdown utilities for safe rendering of user-generated markdown content.
 */
import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked for GitHub-flavored markdown
marked.setOptions({
	gfm: true,
	breaks: true,
});

// Add rel="noopener noreferrer" and target="_blank" to all links
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
	if (node.tagName === "A" && node.hasAttribute("href")) {
		node.setAttribute("rel", "noopener noreferrer");
		node.setAttribute("target", "_blank");
	}
});

/**
 * Parse and sanitize markdown to HTML.
 * Strips all dangerous HTML/JS while preserving markdown formatting.
 */
export function renderMarkdown(markdown: string): string {
	if (!markdown) return "";
	const html = marked.parse(markdown, { async: false }) as string;
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			"p",
			"br",
			"strong",
			"em",
			"u",
			"s",
			"code",
			"pre",
			"a",
			"ul",
			"ol",
			"li",
			"blockquote",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"hr",
		],
		ALLOWED_ATTR: ["href", "title", "class", "rel", "target"],
		ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
	});
}

// stripMarkdown lives in strip-markdown.ts to avoid pulling marked+dompurify into the home page bundle.
export { stripMarkdown } from "./strip-markdown";
