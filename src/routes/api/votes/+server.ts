import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { guardPost, jsonError } from "$lib/server/middleware";
import { voteSchema } from "$lib/server/validation";

export const POST: RequestHandler = async (event) => {
	const guard = await guardPost(event);
	if ("error" in guard && guard.error) return guard.error;

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	const parsed = voteSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, "validation_error", parsed.error.issues[0].message);
	}

	const { targetId, targetType, value } = parsed.data;
	const userId = guard.user!.sub;
	const db = event.platform!.env.DB;

	// Verify target exists and get owner for self-vote check
	const table = targetType === "post" ? "posts" : "comments";
	const target = await db
		.prepare(
			`SELECT id, user_id FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
		)
		.bind(targetId)
		.first<{ id: string; user_id: string }>();
	if (!target) {
		return jsonError(404, "not_found", `${targetType} not found`);
	}

	// Prevent self-voting
	if (target.user_id === userId) {
		return jsonError(403, "self_vote", "You cannot vote on your own content");
	}

	// Check existing vote
	const existingVote = await db
		.prepare(
			"SELECT value FROM votes WHERE user_id = ? AND target_id = ? AND target_type = ?",
		)
		.bind(userId, targetId, targetType)
		.first<{ value: number }>();

	if (existingVote) {
		if (existingVote.value === value) {
			// Remove vote (toggle off)
			const upvoteDelta = value === 1 ? -1 : 0;
			const downvoteDelta = value === -1 ? -1 : 0;
			await db.batch([
				db
					.prepare(
						"DELETE FROM votes WHERE user_id = ? AND target_id = ? AND target_type = ?",
					)
					.bind(userId, targetId, targetType),
				db
					.prepare(
						`UPDATE ${table} SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?`,
					)
					.bind(upvoteDelta, downvoteDelta, targetId),
			]);
			return json({ vote: null, message: "Vote removed" });
		} else {
			// Flip vote
			const upvoteDelta = value === 1 ? 1 : -1;
			const downvoteDelta = value === -1 ? 1 : -1;
			await db.batch([
				db
					.prepare(
						"UPDATE votes SET value = ? WHERE user_id = ? AND target_id = ? AND target_type = ?",
					)
					.bind(value, userId, targetId, targetType),
				db
					.prepare(
						`UPDATE ${table} SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?`,
					)
					.bind(upvoteDelta, downvoteDelta, targetId),
			]);
			return json({ vote: value, message: "Vote changed" });
		}
	} else {
		// New vote
		const upvoteDelta = value === 1 ? 1 : 0;
		const downvoteDelta = value === -1 ? 1 : 0;
		await db.batch([
			db
				.prepare(
					"INSERT INTO votes (user_id, target_id, target_type, value) VALUES (?, ?, ?, ?)",
				)
				.bind(userId, targetId, targetType, value),
			db
				.prepare(
					`UPDATE ${table} SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?`,
				)
				.bind(upvoteDelta, downvoteDelta, targetId),
		]);
		return json({ vote: value, message: "Vote recorded" }, { status: 201 });
	}
};
