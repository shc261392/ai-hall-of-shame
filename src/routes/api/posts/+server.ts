import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import type { RequestHandler } from "./$types";
import { cachedJson, getEnv, guardGet, guardPost, jsonError } from "$lib/server/middleware";
import { postCreateSchema, paginationSchema } from "$lib/server/validation";
import {
	REACTION_EMOJIS,
	REACTION_LABELS,
	computeIsGolden,
	type ReactionEmoji,
	type PostRow,
} from "$lib/types";
import { broadcast } from "$lib/server/broadcast";
import { suggestAndApplyTags } from "$lib/server/ai-tags";

function escapeLike(s: string): string {
	return s.replace(/[%_\\]/g, "\\$&");
}

const SORT_ORDER = {
	trending: `ORDER BY (p.upvotes - p.downvotes) * 1.0 / (((unixepoch() - p.created_at) / 3600.0) + 2) DESC`,
	top: `ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC`,
	latest: `ORDER BY p.created_at DESC`,
} as const;

export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ("error" in guard && guard.error) return guard.error;

	const params = paginationSchema.safeParse(Object.fromEntries(event.url.searchParams));
	if (!params.success) {
		return jsonError(400, "validation_error", params.error.issues[0].message);
	}

	const { sort, page, limit, q, tag } = params.data;
	const offset = (page - 1) * limit;
	const db = getEnv(event.platform).DB;

	// Build query dynamically based on search/tag filter
	const binds: (string | number)[] = [];
	let whereExtra = "";

	if (tag) {
		whereExtra = ` AND EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag = ?)`;
		binds.push(tag.toLowerCase());
	} else if (q && q.length >= 2) {
		const pattern = `%${escapeLike(q)}%`;
		whereExtra = ` AND (p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag LIKE ? ESCAPE '\\'))`;
		binds.push(pattern, pattern, pattern);
	}

	const query = `SELECT p.*, u.username, u.display_name
		FROM posts p JOIN users u ON p.user_id = u.id
		WHERE p.deleted_at IS NULL${whereExtra}
		${SORT_ORDER[sort]}
		LIMIT ? OFFSET ?`;
	binds.push(limit + 1, offset);

	const { results } = await db
		.prepare(query)
		.bind(...binds)
		.all<PostRow>();

	const hasMore = results.length > limit;
	const posts = results.slice(0, limit);

	const postIds = posts.map((p: PostRow) => p.id);
	const userVotes: Record<string, number> = {};
	const reactionsByPost: Record<string, Record<string, number>> = {};
	const userReactionsByPost: Record<string, Set<string>> = {};
	const tagsByPost: Record<string, string[]> = {};

	if (postIds.length > 0) {
		const placeholders = postIds.map(() => "?").join(",");
		const authedUser = "user" in guard ? guard.user : null;

		// Build batch of secondary queries
		const statements: D1PreparedStatement[] = [
			db
				.prepare(
					`SELECT post_id, emoji, COUNT(*) as count FROM reactions WHERE post_id IN (${placeholders}) GROUP BY post_id, emoji`,
				)
				.bind(...postIds),
			db
				.prepare(`SELECT post_id, tag FROM post_tags WHERE post_id IN (${placeholders})`)
				.bind(...postIds),
		];
		if (authedUser) {
			statements.push(
				db
					.prepare(
						`SELECT target_id, value FROM votes WHERE user_id = ? AND target_type = 'post' AND target_id IN (${placeholders})`,
					)
					.bind(authedUser.sub, ...postIds),
				db
					.prepare(
						`SELECT post_id, emoji FROM reactions WHERE post_id IN (${placeholders}) AND user_id = ?`,
					)
					.bind(...postIds, authedUser.sub),
			);
		}

		const batchResults = await db.batch(statements);

		// Parse reaction counts (index 0)
		for (const r of batchResults[0].results as unknown as {
			post_id: string;
			emoji: string;
			count: number;
		}[]) {
			if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = {};
			reactionsByPost[r.post_id][r.emoji] = r.count;
		}

		// Parse tags (index 1)
		for (const t of batchResults[1].results as unknown as {
			post_id: string;
			tag: string;
		}[]) {
			if (!tagsByPost[t.post_id]) tagsByPost[t.post_id] = [];
			tagsByPost[t.post_id].push(t.tag);
		}

		if (authedUser) {
			// Parse user votes (index 2)
			for (const v of batchResults[2].results as unknown as {
				target_id: string;
				value: number;
			}[]) {
				userVotes[v.target_id] = v.value;
			}
			// Parse user reactions (index 3)
			for (const r of batchResults[3].results as unknown as {
				post_id: string;
				emoji: string;
			}[]) {
				if (!userReactionsByPost[r.post_id]) userReactionsByPost[r.post_id] = new Set();
				userReactionsByPost[r.post_id].add(r.emoji);
			}
		}
	}

	const buildReactions = (postId: string) =>
		REACTION_EMOJIS.map((e) => ({
			emoji: e,
			label: REACTION_LABELS[e as ReactionEmoji],
			count: reactionsByPost[postId]?.[e] ?? 0,
			userReacted: userReactionsByPost[postId]?.has(e) ?? false,
		}));

	return cachedJson(
		{
			data: posts.map((p: PostRow) => {
				const reactions = buildReactions(p.id);
				return {
					id: p.id,
					userId: p.user_id,
					username: p.username,
					displayName: p.display_name || undefined,
					title: p.title,
					body: p.body,
					upvotes: p.upvotes,
					downvotes: p.downvotes,
					commentCount: p.comment_count,
					createdAt: p.created_at,
					userVote: userVotes[p.id] ?? null,
					reactions,
					tags: tagsByPost[p.id] ?? [],
					isGolden: computeIsGolden(reactions, p.upvotes, p.downvotes),
				};
			}),
			page,
			limit,
			has_more: hasMore,
		},
		event.request,
	);
};

export const POST: RequestHandler = async (event) => {
	const guard = await guardPost(event);
	if ("error" in guard && guard.error) return guard.error;

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	const parsed = postCreateSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, "validation_error", parsed.error.issues[0].message);
	}

	const env = getEnv(event.platform);
	const db = env.DB;
	const postId = nanoid();
	const tags = [...new Set(parsed.data.tags)]; // dedupe
	const user = guard.user as { sub: string; username: string };

	await db.batch([
		db
			.prepare("INSERT INTO posts (id, user_id, title, body) VALUES (?, ?, ?, ?)")
			.bind(postId, user.sub, parsed.data.title, parsed.data.body),
		...tags.map((tag) =>
			db.prepare("INSERT INTO post_tags (post_id, tag) VALUES (?, ?)").bind(postId, tag),
		),
	]);

	broadcast(event.platform, "feed", "new_post", {
		id: postId,
		title: parsed.data.title,
		username: user.username,
		createdAt: Math.floor(Date.now() / 1000),
	});

	// Fire-and-forget AI tagging when user provided no manual tags
	if (tags.length === 0) {
		const ai = event.platform?.env?.AI;
		if (ai) {
			event.platform?.context.waitUntil(
				suggestAndApplyTags(ai, db, postId, parsed.data.title, parsed.data.body).catch((err) =>
					console.error("AI tag error:", err),
				),
			);
		}
	}

	return json(
		{
			id: postId,
			message: "Post created successfully",
		},
		{ status: 201 },
	);
};
