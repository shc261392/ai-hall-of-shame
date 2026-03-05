import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { cachedJson, getEnv, guardGet, guardPost, jsonError } from "$lib/server/middleware";
import {
	REACTION_EMOJIS,
	REACTION_LABELS,
	computeIsGolden,
	type ReactionEmoji,
	type PostRow,
} from "$lib/types";
import { tagUpdateSchema } from "$lib/server/validation";
import { broadcast } from "$lib/server/broadcast";

export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ("error" in guard && guard.error) return guard.error;

	const postId = event.params.id;
	const db = getEnv(event.platform).DB;

	const post = await db
		.prepare(
			"SELECT p.*, u.username, u.display_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.deleted_at IS NULL",
		)
		.bind(postId)
		.first<PostRow>();

	if (!post) {
		return jsonError(404, "not_found", "Post not found");
	}

	// Batch: reactions, tags, and optionally user vote + user reactions
	const statements: D1PreparedStatement[] = [
		db
			.prepare("SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji")
			.bind(postId),
		db.prepare("SELECT tag FROM post_tags WHERE post_id = ?").bind(postId),
	];

	const authedUser = "user" in guard ? guard.user : null;
	if (authedUser) {
		statements.push(
			db
				.prepare(
					"SELECT value FROM votes WHERE user_id = ? AND target_id = ? AND target_type = 'post'",
				)
				.bind(authedUser.sub, postId),
			db
				.prepare("SELECT emoji FROM reactions WHERE post_id = ? AND user_id = ?")
				.bind(postId, authedUser.sub),
		);
	}

	const batchResults = await db.batch(statements);

	const countMap = new Map(
		(batchResults[0].results as unknown as { emoji: string; count: number }[]).map((c) => [
			c.emoji,
			c.count,
		]),
	);
	const tags = (batchResults[1].results as unknown as { tag: string }[]).map((t) => t.tag);

	let userVote: number | null = null;
	let userReactionSet = new Set<string>();
	if (authedUser) {
		const voteRow = batchResults[2].results[0] as { value: number } | undefined;
		userVote = voteRow?.value ?? null;
		userReactionSet = new Set(
			(batchResults[3].results as unknown as { emoji: string }[]).map((r) => r.emoji),
		);
	}

	const reactions = REACTION_EMOJIS.map((e) => ({
		emoji: e,
		label: REACTION_LABELS[e as ReactionEmoji],
		count: countMap.get(e) ?? 0,
		userReacted: userReactionSet.has(e),
	}));

	return cachedJson(
		{
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
			tags,
			isGolden: computeIsGolden(reactions, post.upvotes, post.downvotes),
		},
		event.request,
	);
};

/** Update tags on own post. */
export const PATCH: RequestHandler = async (event) => {
	const guard = await guardPost(event, "light");
	if ("error" in guard && guard.error) return guard.error;
	const user = guard.user as { sub: string; username: string };

	const postId = event.params.id;
	const db = getEnv(event.platform).DB;

	const post = await db
		.prepare("SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL")
		.bind(postId)
		.first<{ user_id: string }>();

	if (!post) return jsonError(404, "not_found", "Post not found");
	if (post.user_id !== user.sub)
		return jsonError(403, "forbidden", "You can only edit your own posts");

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	const parsed = tagUpdateSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, "validation_error", parsed.error.issues[0].message);
	}

	const tags = [...new Set(parsed.data.tags)];

	await db.batch([
		db.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(postId),
		...tags.map((tag) =>
			db.prepare("INSERT INTO post_tags (post_id, tag) VALUES (?, ?)").bind(postId, tag),
		),
	]);

	return json({ tags, message: "Tags updated" });
};

/** Soft-delete own post. */
export const DELETE: RequestHandler = async (event) => {
	const guard = await guardPost(event, "light");
	if ("error" in guard && guard.error) return guard.error;
	const user = guard.user as { sub: string; username: string };

	const postId = event.params.id;
	const db = getEnv(event.platform).DB;

	const post = await db
		.prepare("SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL")
		.bind(postId)
		.first<{ user_id: string }>();

	if (!post) return jsonError(404, "not_found", "Post not found");
	if (post.user_id !== user.sub)
		return jsonError(403, "forbidden", "You can only delete your own posts");

	await db.prepare("UPDATE posts SET deleted_at = unixepoch() WHERE id = ?").bind(postId).run();

	broadcast(event.platform, "feed", "delete", { type: "post", id: postId });
	broadcast(event.platform, `post:${postId}`, "delete", {
		type: "post",
		id: postId,
	});

	return json({ message: "Post deleted" });
};
