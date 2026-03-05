/**
 * Strip all markdown formatting and return plain text.
 * Zero-dependency — separated from markdown.ts to avoid pulling in marked+dompurify.
 */
export function stripMarkdown(markdown: string): string {
	if (!markdown) return "";
	return markdown
		.replace(/#{1,6}\s/g, "") // headers
		.replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
		.replace(/(\*|_)(.*?)\1/g, "$2") // italic
		.replace(/~~(.*?)~~/g, "$1") // strikethrough
		.replace(/`{1,3}([^`]+)`{1,3}/g, "$1") // code
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images
		.replace(/^>\s/gm, "") // blockquotes
		.replace(/^[-*+]\s/gm, "") // lists
		.replace(/^\d+\.\s/gm, "") // ordered lists
		.trim();
}
