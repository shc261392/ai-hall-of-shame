import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { getAuthUser } from "./auth";
import {
	checkBan,
	checkRateLimit,
	checkAndAutoBan,
	cleanupExpiredData,
} from "./ratelimit";

export function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		(dev ? "127.0.0.1" : "unknown")
	);
}

export function jsonError(
	status: number,
	error: string,
	message: string,
	extra?: Record<string, unknown>,
) {
	return json({ error, message, ...extra }, { status });
}

const MAX_BODY_BYTES = 64 * 1024; // 64 KB

/** Run ban + rate limit + optional auth checks for POST endpoints. */
export async function guardPost(event: RequestEvent) {
	const { request, platform } = event;
	const db = platform!.env.DB;
	const ip = getClientIp(request);

	// Reject oversized bodies before parsing
	const contentLength = request.headers.get("content-length");
	if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
		return {
			error: jsonError(
				413,
				"payload_too_large",
				"Request body must be under 64 KB",
			),
		};
	}

	// Reject if no IP (direct access bypassing CF) — skip in dev
	if (ip === "unknown") {
		return {
			error: jsonError(403, "forbidden", "Request must go through Cloudflare"),
		};
	}

	// Auth required for POST
	const user = await getAuthUser(request, platform!.env.JWT_SECRET);
	if (!user) {
		return {
			error: jsonError(
				401,
				"unauthorized",
				"Authentication required. Provide a valid JWT in the Authorization header.",
			),
		};
	}

	// Check bans (user + IP)
	for (const identifier of [user.sub, `ip:${ip}`]) {
		const ban = await checkBan(db, identifier);
		if (ban.banned) {
			return {
				error: jsonError(
					403,
					"banned",
					`Account suspended for abusive activity. Ban expires: ${ban.expiresAt}`,
					{
						expires_at: ban.expiresAt,
					},
				),
			};
		}
	}

	// Rate limit (user + IP)
	for (const identifier of [user.sub, `ip:${ip}`]) {
		const limit = await checkRateLimit(db, identifier, true);
		if (!limit.allowed) {
			return {
				error: jsonError(
					429,
					"rate_limited",
					`Too many requests. You can make 5 POST requests per minute. Retry in ${limit.retryAfterSeconds}s.`,
					{
						retry_after_seconds: limit.retryAfterSeconds,
					},
				),
			};
		}
	}

	// Check for auto-ban after incrementing counters
	await checkAndAutoBan(db, [user.sub, `ip:${ip}`]);

	// Opportunistic cleanup (roughly 1 in 20 requests)
	if (Math.random() < 0.05) {
		event.platform!.context.waitUntil(cleanupExpiredData(db));
	}

	return { user, ip };
}

/** Lightweight rate limit check for GET endpoints. */
export async function guardGet(event: RequestEvent) {
	const { request, platform } = event;
	const db = platform!.env.DB;
	const ip = getClientIp(request);

	if (ip === "unknown") {
		return {
			error: jsonError(403, "forbidden", "Request must go through Cloudflare"),
		};
	}

	// Check ban
	const ban = await checkBan(db, `ip:${ip}`);
	if (ban.banned) {
		return {
			error: jsonError(
				403,
				"banned",
				`IP suspended for abusive activity. Ban expires: ${ban.expiresAt}`,
				{
					expires_at: ban.expiresAt,
				},
			),
		};
	}

	// Lightweight rate limit for GETs
	const limit = await checkRateLimit(db, `ip:${ip}`, false);
	if (!limit.allowed) {
		return {
			error: jsonError(
				429,
				"rate_limited",
				`Too many requests. Retry in ${limit.retryAfterSeconds}s.`,
				{
					retry_after_seconds: limit.retryAfterSeconds,
				},
			),
		};
	}

	// Optional auth (for user vote status)
	const user = await getAuthUser(request, platform!.env.JWT_SECRET);

	return { user, ip };
}

/** JSON response with short cache for public GET endpoints. */
export function cachedJson(data: unknown, maxAge = 10) {
	return json(data, {
		headers: {
			"Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=30`,
		},
	});
}
