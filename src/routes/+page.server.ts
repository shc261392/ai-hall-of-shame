import type { ServerLoad } from "@sveltejs/kit";
import {
	REACTION_EMOJIS,
	REACTION_LABELS,
	type ReactionEmoji,
	type PostRow,
	type Post,
} from "$lib/types";

export interface HomePageData {
	posts: Post[];
	hasMore: boolean;
	sort: string;
}

export const load: ServerLoad = async ({ platform, url }) => {
	const db = platform?.env.DB;
	const sort = url.searchParams.get("sort") || "trending";
	const limit = 20;

	const SORT_QUERIES: Record<string, string> = {
		trending: `SELECT p.*, u.username, u.display_name,
			(p.upvotes - p.downvotes) * 1.0 / (((unixepoch() - p.created_at) / 3600.0) + 2) AS trending_score
			FROM posts p JOIN users u ON p.user_id = u.id
			WHERE p.deleted_at IS NULL
			ORDER BY trending_score DESC LIMIT ? OFFSET 0`,
		top: `SELECT p.*, u.username, u.display_name
			FROM posts p JOIN users u ON p.user_id = u.id
			WHERE p.deleted_at IS NULL
			ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC LIMIT ? OFFSET 0`,
		latest: `SELECT p.*, u.username, u.display_name
			FROM posts p JOIN users u ON p.user_id = u.id
			WHERE p.deleted_at IS NULL
			ORDER BY p.created_at DESC LIMIT ? OFFSET 0`,
	};

	const query = SORT_QUERIES[sort] || SORT_QUERIES.trending;

	try {
		const { results } = await db
			.prepare(query)
			.bind(limit + 1)
			.all<PostRow>();

		const hasMore = results.length > limit;
		const posts = results.slice(0, limit);

		// Get reaction counts for all posts
		const postIds = posts.map((p) => p.id);
		const reactionMap = new Map<string, Map<string, number>>();

		if (postIds.length > 0) {
			const placeholders = postIds.map(() => "?").join(",");
			const { results: reactionRows } = await db
				.prepare(
					`SELECT post_id, emoji, COUNT(*) as count FROM reactions WHERE post_id IN (${placeholders}) GROUP BY post_id, emoji`,
				)
				.bind(...postIds)
				.all<{ post_id: string; emoji: string; count: number }>();

			for (const r of reactionRows) {
				if (!reactionMap.has(r.post_id)) reactionMap.set(r.post_id, new Map());
				reactionMap.get(r.post_id)?.set(r.emoji, r.count);
			}
		}

		return {
			posts: posts.map((p) => {
				const counts = reactionMap.get(p.id) || new Map();
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
					userVote: null,
					reactions: REACTION_EMOJIS.map((e) => ({
						emoji: e,
						label: REACTION_LABELS[e as ReactionEmoji],
						count: counts.get(e) ?? 0,
						userReacted: false,
					})),
				};
			}),
			hasMore,
			sort,
		};
	} catch {
		return { posts: [], hasMore: false, sort };
	}
};
