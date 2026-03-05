import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
	rotateRefreshToken,
	revokeRefreshToken,
	getAuthUser,
	revokeRefreshTokens,
} from "$lib/server/auth";
import { getClientIp, jsonError } from "$lib/server/middleware";
import { checkBan, checkRateLimit } from "$lib/server/ratelimit";

/** Rotate refresh token → new access + refresh token pair. */
export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform!.env.DB;

	// Rate limit refresh requests by IP
	const ip = getClientIp(request);
	const ban = await checkBan(db, `ip:${ip}`);
	if (ban.banned) {
		return jsonError(
			403,
			"banned",
			`IP suspended. Ban expires: ${ban.expiresAt}`,
			{ expires_at: ban.expiresAt },
		);
	}
	const limit = await checkRateLimit(db, `ip:${ip}`, "heavy");
	if (!limit.allowed) {
		return jsonError(
			429,
			"rate_limited",
			`Too many requests. Retry in ${limit.retryAfterSeconds}s.`,
			{ retry_after_seconds: limit.retryAfterSeconds },
		);
	}

	let body: { refreshToken?: string };
	try {
		body = await request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	if (!body.refreshToken) {
		return jsonError(400, "invalid_request", "Missing refreshToken");
	}

	const result = await rotateRefreshToken(
		body.refreshToken,
		platform!.env.JWT_SECRET,
		db,
	);

	if (!result) {
		return jsonError(
			401,
			"invalid_refresh_token",
			"Refresh token is invalid or expired",
		);
	}

	return json({
		token: result.token,
		refreshToken: result.refreshToken,
		expiresIn: result.expiresIn,
		userId: result.userId,
		username: result.username,
	});
};

/** Revoke refresh token (logout). */
export const DELETE: RequestHandler = async ({ request, platform }) => {
	const db = platform!.env.DB;

	let body: { refreshToken?: string };
	try {
		body = await request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	if (body.refreshToken) {
		await revokeRefreshToken(db, body.refreshToken);
	} else {
		// If no specific token, revoke all tokens for the authenticated user
		const user = await getAuthUser(request, platform!.env.JWT_SECRET);
		if (user) {
			await revokeRefreshTokens(db, user.sub);
		}
	}

	return json({ message: "Logged out" });
};
