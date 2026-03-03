import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { guardGet, jsonError } from "$lib/server/middleware";
import { REACTION_EMOJIS, REACTION_LABELS, type ReactionEmoji } from "$lib/types";

export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ("error" in guard && guard.error) return guard.error;

	const postId = event.params.id;
	const db = event.platform!.env.DB;

	const post = await db
		.prepare(
			"SELECT p.*, u.username FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?",
		)
		.bind(postId)
		.first();

	if (!post) {
		return jsonError(404, "not_found", "Post not found");
	}

	// Get user vote if authenticated
	let userVote: number | null = null;
	if ("user" in guard && guard.user) {
		const vote = await db
			.prepare(
				"SELECT value FROM votes WHERE user_id = ? AND target_id = ? AND target_type = 'post'",
			)
			.bind(guard.user.sub, postId)
			.first<{ value: number }>();
		userVote = vote?.value ?? null;
	}

	// Get reaction counts
	const { results: reactionCounts } = await db
		.prepare("SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji")
		.bind(postId)
		.all<{ emoji: string; count: number }>();

	const countMap = new Map(reactionCounts.map((c) => [c.emoji, c.count]));
	let userReactionSet = new Set<string>();

	if ("user" in guard && guard.user) {
		const { results: userReactions } = await db
			.prepare("SELECT emoji FROM reactions WHERE post_id = ? AND user_id = ?")
			.bind(postId, guard.user.sub)
			.all<{ emoji: string }>();
		userReactionSet = new Set(userReactions.map((r) => r.emoji));
	}

	const reactions = REACTION_EMOJIS.map((e) => ({
		emoji: e,
		label: REACTION_LABELS[e as ReactionEmoji],
		count: countMap.get(e) ?? 0,
		userReacted: userReactionSet.has(e),
	}));

	return json({
		id: (post as any).id,
		userId: (post as any).user_id,
		username: (post as any).username,
		title: (post as any).title,
		body: (post as any).body,
		upvotes: (post as any).upvotes,
		downvotes: (post as any).downvotes,
		commentCount: (post as any).comment_count,
		createdAt: (post as any).created_at,
		userVote,
		reactions,
	});
};
