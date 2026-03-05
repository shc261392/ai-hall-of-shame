/**
 * Markdown utilities for safe rendering of user-generated markdown content.
 * Uses xss (DOM-free) instead of DOMPurify so it works in Cloudflare Workers SSR.
 */
import { marked } from "marked";
import xss from "xss";

// Configure marked for GitHub-flavored markdown
marked.setOptions({
	gfm: true,
	breaks: true,
});

// Add target="_blank" and rel="noopener noreferrer" via custom renderer
// (avoids needing DOMPurify hooks, works server-side)
marked.use({
	renderer: {
		link({ href, title, text }) {
			const titleAttr = title ? ` title="${title}"` : "";
			return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
		},
	},
});

const XSS_WHITELIST: Record<string, string[]> = {
	p: [],
	br: [],
	strong: [],
	em: [],
	u: [],
	s: [],
	code: [],
	pre: [],
	a: ["href", "title", "target", "rel"],
	ul: [],
	ol: [],
	li: [],
	blockquote: [],
	h1: [],
	h2: [],
	h3: [],
	h4: [],
	h5: [],
	h6: [],
	hr: [],
};

/**
 * Parse and sanitize markdown to HTML.
 * Strips all dangerous HTML/JS while preserving markdown formatting.
 * Works in both browser and Cloudflare Worker (no DOM required).
 */
export function renderMarkdown(markdown: string): string {
	if (!markdown) return "";
	const html = marked.parse(markdown, { async: false }) as string;
	return xss(html, {
		whiteList: XSS_WHITELIST,
		onTagAttr(tag, name, value) {
			// Block dangerous URL schemes in href attributes
			if (tag === "a" && name === "href") {
				if (!/^(?:https?|mailto):/i.test(value)) {
					return ""; // strip attribute
				}
			}
		},
	});
}

// stripMarkdown lives in strip-markdown.ts to avoid pulling marked+xss into the home page bundle.
export { stripMarkdown } from "./strip-markdown";
