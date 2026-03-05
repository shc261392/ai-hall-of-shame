const tagPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{2}$/;

/**
 * Robust parser for LLM tag output.
 * Handles common 1B-model failure modes: preamble sentences, "Tags:" prefix,
 * numbered lists, quotes, spaces, missing commas, double hyphens.
 */
export function parseAiTags(raw: string): string[] {
	// Strip preamble: if there's a blank line, take everything after it.
	// Models often prepend "Here are 3 possible tags:\n\ntag1, tag2"
	let text = raw;
	const blankLineIdx = text.indexOf("\n\n");
	if (blankLineIdx !== -1) {
		text = text.slice(blankLineIdx + 2);
	} else {
		// Strip "here are/here's ... :" preamble on a single line
		text = text.replace(/^here['s]*\s.*?:\s*/i, "");
	}

	const cleaned = text
		.replace(/^tags?\s*:?\s*/i, "") // strip "Tags:" prefix
		.split(/[,\n]+/) // split on commas or newlines
		.map(
			(t) =>
				t
					.replace(/^[\d.\-\s"'#*]+/, "") // strip numbering, quotes, #, *
					.replace(/["'\s*]+$/, "") // strip trailing quotes/spaces
					.trim()
					.toLowerCase()
					.replace(/\s+/g, "-") // spaces → hyphens
					.replace(/[^a-z0-9-]/g, "") // strip invalid chars
					.replace(/-{2,}/g, "-") // collapse double hyphens
					.replace(/^-+|-+$/g, ""), // strip leading/trailing hyphens
		)
		.filter((t) => t.length >= 2);

	// If a token is >24 chars and contains hyphens, the LLM likely concatenated
	// multiple tags with hyphens instead of commas. Split on hyphens and keep
	// segments that are valid tags.
	const result: string[] = [];
	for (const t of cleaned) {
		if (t.length <= 24 && tagPattern.test(t)) {
			result.push(t);
		} else if (t.length > 24 && t.includes("-")) {
			for (const seg of t.split("-")) {
				if (seg.length >= 2 && seg.length <= 24 && tagPattern.test(seg)) {
					result.push(seg);
				}
			}
		}
	}
	return result;
}

/**
 * Fire-and-forget AI tag suggestion.
 * Uses @cf/meta/llama-3.2-1b-instruct via Workers AI.
 * Atomically inserts tags respecting the 3-tag cap per post.
 */
export async function suggestAndApplyTags(
	ai: Ai,
	db: D1Database,
	postId: string,
	title: string,
	body: string | null,
): Promise<void> {
	const bodyClause = body ? `\nBody: ${body.slice(0, 500)}` : "";
	const prompt = `You are a tag generator for a website about AI failures and mistakes. Given a post, suggest 1-3 short lowercase tags separated by commas. Each tag must be 2-24 characters, using only lowercase letters, numbers, and hyphens (no leading/trailing hyphens).

Example: chatgpt, hallucination, legal

Title: ${title}${bodyClause}

Tags:`;

	const result = (await ai.run("@cf/meta/llama-3.2-1b-instruct", {
		messages: [{ role: "user", content: prompt }],
		max_tokens: 40,
		temperature: 0.3,
	})) as { response?: string };

	if (!result.response) return;

	const tags = [...new Set(parseAiTags(result.response))].slice(0, 3);
	if (tags.length === 0) return;

	// Atomic inserts: only apply AI tags if the user hasn't manually tagged yet
	// (COUNT = 0 prevents race where user PATCHes tags before AI waitUntil completes)
	const statements = tags.map((tag) =>
		db
			.prepare(
				`INSERT INTO post_tags (post_id, tag)
			SELECT ?, ?
			WHERE (SELECT COUNT(*) FROM post_tags WHERE post_id = ?) = 0
				AND NOT EXISTS (SELECT 1 FROM post_tags WHERE post_id = ? AND tag = ?)`,
			)
			.bind(postId, tag, postId, postId, tag),
	);

	await db.batch(statements);
}
