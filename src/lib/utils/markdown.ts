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
		ALLOWED_ATTR: ["href", "title", "class"],
		ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
	});
}

/**
 * Strip all markdown formatting and return plain text.
 */
export function stripMarkdown(markdown: string): string {
	if (!markdown) return "";
	// Remove markdown syntax
	return markdown
		.replace(/#{1,6}\s/g, "") // headers
		.replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
		.replace(/(\*|_)(.*?)\1/g, "$2") // italic
		.replace(/~~(.*?)~~/g, "$1") // strikethrough
		.replace(/`{1,3}([^`]+)`{1,3}/g, "$1") // code
		.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // links
		.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1") // images
		.replace(/^>\s/gm, "") // blockquotes
		.replace(/^[-*+]\s/gm, "") // lists
		.replace(/^\d+\.\s/gm, "") // ordered lists
		.trim();
}
