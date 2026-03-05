import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import type { RequestHandler } from "./$types";
import { guardPost, jsonError } from "$lib/server/middleware";
import { reactionSchema } from "$lib/server/validation";
import {
	REACTION_EMOJIS,
	REACTION_LABELS,
	type ReactionEmoji,
} from "$lib/types";
import { broadcast } from "$lib/server/broadcast";

export const POST: RequestHandler = async (event) => {
	const guard = await guardPost(event, "light");
	if ("error" in guard && guard.error) return guard.error;

	const body = await event.request.json().catch(() => null);
	const parsed = reactionSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, "validation_error", parsed.error.issues[0].message);
	}

	const { postId, emoji } = parsed.data;
	const db = event.platform?.env.DB;
	const userId = (guard as { user: { sub: string } }).user.sub;

	// Verify post exists and is not deleted
	const post = await db
		.prepare("SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL")
		.bind(postId)
		.first();
	if (!post) {
		return jsonError(404, "not_found", "Post not found");
	}

	// Toggle: try delete first, if nothing deleted then insert (avoids race condition)
	const deleted = await db
		.prepare(
			"DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND emoji = ? RETURNING id",
		)
		.bind(postId, userId, emoji)
		.first();

	if (!deleted) {
		try {
			await db
				.prepare(
					"INSERT INTO reactions (id, post_id, user_id, emoji) VALUES (?, ?, ?, ?)",
				)
				.bind(nanoid(), postId, userId, emoji)
				.run();
		} catch (e) {
			// Handle concurrent insert race (UNIQUE constraint)
			if (!(e instanceof Error && e.message.includes("UNIQUE constraint"))) {
				throw e;
			}
		}
	}

	// Return updated reaction counts for that post
	const { results: counts } = await db
		.prepare(
			"SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji",
		)
		.bind(postId)
		.all<{ emoji: string; count: number }>();

	const { results: userReactions } = await db
		.prepare("SELECT emoji FROM reactions WHERE post_id = ? AND user_id = ?")
		.bind(postId, userId)
		.all<{ emoji: string }>();

	const countMap = new Map(counts.map((c) => [c.emoji, c.count]));
	const userSet = new Set(userReactions.map((r) => r.emoji));

	const reactions = REACTION_EMOJIS.map((e) => ({
		emoji: e,
		label: REACTION_LABELS[e as ReactionEmoji],
		count: countMap.get(e) ?? 0,
		userReacted: userSet.has(e),
	}));

	// Broadcast reaction update to both channels
	const reactionCounts = Object.fromEntries(
		REACTION_EMOJIS.map((e) => [e, countMap.get(e) ?? 0]),
	);
	broadcast(event.platform, "feed", "reaction", {
		postId,
		reactions: reactionCounts,
	});
	broadcast(event.platform, `post:${postId}`, "reaction", {
		postId,
		reactions: reactionCounts,
	});

	return json({ reactions });
};
