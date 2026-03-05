import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import type { RequestHandler } from "./$types";
import {
	cachedJson,
	guardGet,
	guardPost,
	jsonError,
} from "$lib/server/middleware";
import { postCreateSchema, paginationSchema } from "$lib/server/validation";
import {
	REACTION_EMOJIS,
	REACTION_LABELS,
	type ReactionEmoji,
	type PostRow,
} from "$lib/types";
import { broadcast } from "$lib/server/broadcast";

const SORT_QUERIES = {
	trending: `SELECT p.*, u.username, u.display_name,
		(p.upvotes - p.downvotes) * 1.0 / (((unixepoch() - p.created_at) / 3600.0) + 2) AS trending_score
		FROM posts p JOIN users u ON p.user_id = u.id
		WHERE p.deleted_at IS NULL
		ORDER BY trending_score DESC LIMIT ? OFFSET ?`,
	top: `SELECT p.*, u.username, u.display_name
		FROM posts p JOIN users u ON p.user_id = u.id
		WHERE p.deleted_at IS NULL
		ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC LIMIT ? OFFSET ?`,
	latest: `SELECT p.*, u.username, u.display_name
		FROM posts p JOIN users u ON p.user_id = u.id
		WHERE p.deleted_at IS NULL
		ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
} as const;

export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ("error" in guard && guard.error) return guard.error;

	const params = paginationSchema.safeParse(
		Object.fromEntries(event.url.searchParams),
	);
	if (!params.success) {
		return jsonError(400, "validation_error", params.error.issues[0].message);
	}

	const { sort, page, limit } = params.data;
	const offset = (page - 1) * limit;
	const db = event.platform!.env.DB;

	const query = SORT_QUERIES[sort];
	const { results } = await db
		.prepare(query)
		.bind(limit + 1, offset)
		.all<PostRow>();

	const hasMore = results.length > limit;
	const posts = results.slice(0, limit);

	const postIds = posts.map((p: PostRow) => p.id);
	let userVotes: Record<string, number> = {};
	const reactionsByPost: Record<string, Record<string, number>> = {};
	const userReactionsByPost: Record<string, Set<string>> = {};

	if (postIds.length > 0) {
		const placeholders = postIds.map(() => "?").join(",");
		const isAuthed = "user" in guard && guard.user;

		// Build batch of secondary queries
		const statements: D1PreparedStatement[] = [
			db
				.prepare(
					`SELECT post_id, emoji, COUNT(*) as count FROM reactions WHERE post_id IN (${placeholders}) GROUP BY post_id, emoji`,
				)
				.bind(...postIds),
		];
		if (isAuthed) {
			statements.push(
				db
					.prepare(
						`SELECT target_id, value FROM votes WHERE user_id = ? AND target_type = 'post' AND target_id IN (${placeholders})`,
					)
					.bind(guard.user!.sub, ...postIds),
				db
					.prepare(
						`SELECT post_id, emoji FROM reactions WHERE post_id IN (${placeholders}) AND user_id = ?`,
					)
					.bind(...postIds, guard.user!.sub),
			);
		}

		const batchResults = await db.batch(statements);

		// Parse reaction counts (always index 0)
		for (const r of batchResults[0].results as unknown as {
			post_id: string;
			emoji: string;
			count: number;
		}[]) {
			if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = {};
			reactionsByPost[r.post_id][r.emoji] = r.count;
		}

		if (isAuthed) {
			// Parse user votes (index 1)
			for (const v of batchResults[1].results as unknown as {
				target_id: string;
				value: number;
			}[]) {
				userVotes[v.target_id] = v.value;
			}
			// Parse user reactions (index 2)
			for (const r of batchResults[2].results as unknown as {
				post_id: string;
				emoji: string;
			}[]) {
				if (!userReactionsByPost[r.post_id])
					userReactionsByPost[r.post_id] = new Set();
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

	return cachedJson({
		data: posts.map((p: PostRow) => ({
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
			reactions: buildReactions(p.id),
		})),
		page,
		limit,
		has_more: hasMore,
	}, event.request);
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

	const db = event.platform!.env.DB;
	const postId = nanoid();

	await db
		.prepare("INSERT INTO posts (id, user_id, title, body) VALUES (?, ?, ?, ?)")
		.bind(postId, guard.user!.sub, parsed.data.title, parsed.data.body)
		.run();

	broadcast(event.platform, "feed", "new_post", {
		id: postId,
		title: parsed.data.title,
		username: guard.user!.username,
		createdAt: Math.floor(Date.now() / 1000),
	});

	return json(
		{
			id: postId,
			message: "Post created successfully",
		},
		{ status: 201 },
	);
};
