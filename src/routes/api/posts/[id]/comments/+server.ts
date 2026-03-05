import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import type { RequestHandler } from "./$types";
import {
	cachedJson,
	guardGet,
	guardPost,
	jsonError,
} from "$lib/server/middleware";
import { commentCreateSchema } from "$lib/server/validation";
import type { CommentRow } from "$lib/types";
import { broadcast } from "$lib/server/broadcast";

export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ("error" in guard && guard.error) return guard.error;

	const postId = event.params.id;
	const db = event.platform!.env.DB;

	// Pagination defaults
	const page = Math.max(1, parseInt(event.url.searchParams.get("page") || "1"));
	const limit = Math.min(
		50,
		Math.max(1, parseInt(event.url.searchParams.get("limit") || "50")),
	);
	const offset = (page - 1) * limit;

	// Verify post exists
	const post = await db
		.prepare("SELECT 1 FROM posts WHERE id = ? AND deleted_at IS NULL")
		.bind(postId)
		.first();
	if (!post) {
		return jsonError(404, "not_found", "Post not found");
	}

	const { results } = await db
		.prepare(
			"SELECT c.*, u.username, u.display_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT ? OFFSET ?",
		)
		.bind(postId, limit + 1, offset)
		.all<CommentRow>();

	const hasMore = results.length > limit;
	const comments = results.slice(0, limit);

	// Get user votes if authenticated
	let userVotes: Record<string, number> = {};
	if ("user" in guard && guard.user && comments.length > 0) {
		const commentIds = comments.map((c) => c.id);
		const placeholders = commentIds.map(() => "?").join(",");
		const { results: votes } = await db
			.prepare(
				`SELECT target_id, value FROM votes WHERE user_id = ? AND target_type = 'comment' AND target_id IN (${placeholders})`,
			)
			.bind(guard.user.sub, ...commentIds)
			.all<{ target_id: string; value: number }>();
		userVotes = Object.fromEntries(votes.map((v) => [v.target_id, v.value]));
	}

	return cachedJson({
		data: comments.map((c) => ({
			id: c.id,
			postId: c.post_id,
			userId: c.user_id,
			username: c.username,
			displayName: c.display_name || undefined,
			body: c.body,
			upvotes: c.upvotes,
			downvotes: c.downvotes,
			createdAt: c.created_at,
			userVote: userVotes[c.id] ?? null,
		})),
		page,
		limit,
		has_more: hasMore,
	}, event.request);
};

export const POST: RequestHandler = async (event) => {
	const guard = await guardPost(event, "light");
	if ("error" in guard && guard.error) return guard.error;
	const postId = event.params.id;
	const db = event.platform!.env.DB;

	// Validate body before DB lookup
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	const parsed = commentCreateSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, "validation_error", parsed.error.issues[0].message);
	}

	// Verify post exists
	const post = await db
		.prepare("SELECT 1 FROM posts WHERE id = ? AND deleted_at IS NULL")
		.bind(postId)
		.first();
	if (!post) {
		return jsonError(404, "not_found", "Post not found");
	}

	const commentId = nanoid();

	await db.batch([
		db
			.prepare(
				"INSERT INTO comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)",
			)
			.bind(commentId, postId, guard.user!.sub, parsed.data.body),
		db
			.prepare(
				"UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?",
			)
			.bind(postId),
	]);

	broadcast(event.platform, `post:${postId}`, "new_comment", {
		postId,
		commentId,
	});
	broadcast(event.platform, "feed", "new_comment", {
		postId,
		commentId,
	});

	return json(
		{
			id: commentId,
			message: "Comment posted successfully",
		},
		{ status: 201 },
	);
};

/** Soft-delete own comment. */
export const DELETE: RequestHandler = async (event) => {
	const guard = await guardPost(event, "light");
	if ("error" in guard && guard.error) return guard.error;

	const postId = event.params.id;
	const db = event.platform!.env.DB;
	const commentId = event.url.searchParams.get("commentId");
	if (!commentId)
		return jsonError(400, "invalid_request", "commentId query param required");

	const comment = await db
		.prepare(
			"SELECT user_id FROM comments WHERE id = ? AND post_id = ? AND deleted_at IS NULL",
		)
		.bind(commentId, postId)
		.first<{ user_id: string }>();

	if (!comment) return jsonError(404, "not_found", "Comment not found");
	if (comment.user_id !== guard.user!.sub)
		return jsonError(403, "forbidden", "You can only delete your own comments");

	await db.batch([
		db
			.prepare("UPDATE comments SET deleted_at = unixepoch() WHERE id = ?")
			.bind(commentId),
		db
			.prepare(
				"UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?",
			)
			.bind(postId),
	]);

	broadcast(event.platform, `post:${postId}`, "delete", {
		type: "comment",
		id: commentId,
	});

	return json({ message: "Comment deleted" });
};
