import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
	cachedJson,
	guardGet,
	guardPost,
	jsonError,
} from "$lib/server/middleware";
import {
	REACTION_EMOJIS,
	REACTION_LABELS,
	type ReactionEmoji,
	type PostRow,
} from "$lib/types";

export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ("error" in guard && guard.error) return guard.error;

	const postId = event.params.id;
	const db = event.platform!.env.DB;

	const post = await db
		.prepare(
			"SELECT p.*, u.username, u.display_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.deleted_at IS NULL",
		)
		.bind(postId)
		.first<PostRow>();

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
		.prepare(
			"SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji",
		)
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

	return cachedJson({
		id: post.id,
		userId: post.user_id,
		username: post.username,
		displayName: post.display_name || undefined,
		title: post.title,
		body: post.body,
		upvotes: post.upvotes,
		downvotes: post.downvotes,
		commentCount: post.comment_count,
		createdAt: post.created_at,
		userVote,
		reactions,
	});
};

/** Soft-delete own post. */
export const DELETE: RequestHandler = async (event) => {
	const guard = await guardPost(event);
	if ("error" in guard && guard.error) return guard.error;

	const postId = event.params.id;
	const db = event.platform!.env.DB;

	const post = await db
		.prepare("SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL")
		.bind(postId)
		.first<{ user_id: string }>();

	if (!post) return jsonError(404, "not_found", "Post not found");
	if (post.user_id !== guard.user!.sub)
		return jsonError(403, "forbidden", "You can only delete your own posts");

	await db
		.prepare("UPDATE posts SET deleted_at = unixepoch() WHERE id = ?")
		.bind(postId)
		.run();

	return json({ message: "Post deleted" });
};
