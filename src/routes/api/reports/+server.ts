import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import type { RequestHandler } from "./$types";
import { guardPost, jsonError } from "$lib/server/middleware";
import { reportSchema } from "$lib/server/validation";

const REPORT_HIDE_THRESHOLD = 10;

export const POST: RequestHandler = async (event) => {
	const guard = await guardPost(event);
	if ("error" in guard && guard.error) return guard.error;

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	const parsed = reportSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, "validation_error", parsed.error.issues[0].message);
	}

	const { targetType, targetId, reason } = parsed.data;
	const userId = guard.user!.sub;
	const db = event.platform!.env.DB;

	// Verify target exists and is not already deleted
	const table = targetType === "post" ? "posts" : "comments";
	const target = await db
		.prepare(
			`SELECT id, user_id FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
		)
		.bind(targetId)
		.first<{ id: string; user_id: string }>();

	if (!target) return jsonError(404, "not_found", `${targetType} not found`);
	if (target.user_id === userId)
		return jsonError(
			400,
			"invalid_request",
			"You cannot report your own content",
		);

	// Insert report (UNIQUE constraint prevents duplicate reports)
	try {
		await db
			.prepare(
				"INSERT INTO reports (id, target_type, target_id, user_id, reason) VALUES (?, ?, ?, ?, ?)",
			)
			.bind(nanoid(), targetType, targetId, userId, reason)
			.run();
	} catch (e) {
		if (e instanceof Error && e.message.includes("UNIQUE constraint")) {
			return jsonError(
				409,
				"already_reported",
				"You have already reported this content",
			);
		}
		throw e;
	}

	// Increment report count and auto-hide if threshold reached
	await db
		.prepare(`UPDATE ${table} SET report_count = report_count + 1 WHERE id = ?`)
		.bind(targetId)
		.run();

	const updated = await db
		.prepare(`SELECT report_count FROM ${table} WHERE id = ?`)
		.bind(targetId)
		.first<{ report_count: number }>();

	if (updated && updated.report_count >= REPORT_HIDE_THRESHOLD) {
		await db
			.prepare(
				`UPDATE ${table} SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
			)
			.bind(targetId)
			.run();
	}

	return json(
		{
			message:
				"Report submitted. Thank you for helping keep the community safe.",
		},
		{ status: 201 },
	);
};
