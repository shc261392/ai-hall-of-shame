import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { signToken } from "$lib/server/auth";
import { getEnv, jsonError, resolveAuth } from "$lib/server/middleware";
import { usernameUpdateSchema, displayNameUpdateSchema } from "$lib/server/validation";
import { isReservedUsername } from "$lib/server/username";
import { checkRateLimit } from "$lib/server/ratelimit";

export const GET: RequestHandler = async ({ request, platform }) => {
	const env = getEnv(platform);
	const user = await resolveAuth(request, env.JWT_SECRET, env.DB);
	if (!user) {
		return jsonError(401, "unauthorized", "Authentication required");
	}

	const row = await env.DB.prepare(
		"SELECT id, username, display_name, created_at FROM users WHERE id = ?",
	)
		.bind(user.sub)
		.first<{
			id: string;
			username: string;
			display_name: string | null;
			created_at: number;
		}>();

	if (!row) {
		return jsonError(404, "user_not_found", "User not found");
	}

	return json({
		id: row.id,
		username: row.username,
		displayName: row.display_name || undefined,
		createdAt: new Date(row.created_at * 1000).toISOString(),
	});
};

export const PATCH: RequestHandler = async ({ request, platform }) => {
	const env = getEnv(platform);
	const user = await resolveAuth(request, env.JWT_SECRET, env.DB);
	if (!user) {
		return jsonError(401, "unauthorized", "Authentication required");
	}

	// Rate limit profile updates
	const db = env.DB;
	const limit = await checkRateLimit(db, user.sub, "light");
	if (!limit.allowed) {
		return jsonError(
			429,
			"rate_limited",
			`Too many requests. Retry in ${limit.retryAfterSeconds}s.`,
			{ retry_after_seconds: limit.retryAfterSeconds },
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	// Check if it's a displayName update
	if ("displayName" in (body as object)) {
		const parsed = displayNameUpdateSchema.safeParse(body);
		if (!parsed.success) {
			return jsonError(400, "validation_error", parsed.error.issues[0].message);
		}

		const newDisplayName = parsed.data.displayName;

		// Check reserved names
		if (isReservedUsername(newDisplayName)) {
			return jsonError(400, "reserved_name", "This display name is reserved");
		}

		// Use DB constraint to handle uniqueness (avoids TOCTOU race)
		try {
			await db
				.prepare("UPDATE users SET display_name = ? WHERE id = ?")
				.bind(newDisplayName, user.sub)
				.run();
		} catch (e) {
			if (e instanceof Error && e.message.includes("UNIQUE constraint")) {
				return jsonError(409, "display_name_taken", "This display name is already taken");
			}
			throw e;
		}

		return json({ displayName: newDisplayName });
	}

	// Otherwise, handle username update (legacy)
	const parsed = usernameUpdateSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, "validation_error", parsed.error.issues[0].message);
	}

	const newUsername = parsed.data.username;

	if (isReservedUsername(newUsername)) {
		return jsonError(400, "reserved_username", "This username is reserved");
	}

	// Use DB constraint to handle uniqueness (avoids TOCTOU race)
	try {
		await db
			.prepare("UPDATE users SET username = ? WHERE id = ?")
			.bind(newUsername, user.sub)
			.run();
	} catch (e) {
		if (e instanceof Error && e.message.includes("UNIQUE constraint")) {
			return jsonError(409, "username_taken", "This username is already taken");
		}
		throw e;
	}

	// Issue new token with updated username
	const token = await signToken(user.sub, newUsername, env.JWT_SECRET);

	return json({ token, username: newUsername });
};
