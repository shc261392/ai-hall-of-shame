import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { getAuthUser, getAuthToken, verifyApiKey } from "./auth";
import type { RateLimitTier } from "./ratelimit";
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

/** Try JWT auth first, then fall back to API key auth. */
export async function resolveAuth(
	request: Request,
	jwtSecret: string,
	db: D1Database,
): Promise<{ sub: string; username: string } | null> {
	// Try JWT first
	const jwtUser = await getAuthUser(request, jwtSecret);
	if (jwtUser) return jwtUser;

	// Fall back to API key (same Authorization: Bearer header)
	const token = getAuthToken(request);
	if (token?.startsWith("pak_")) {
		try {
			return await verifyApiKey(token, db);
		} catch {
			// DB error (e.g. table missing) — treat as unauthenticated
			return null;
		}
	}

	return null;
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

/** Run ban + rate limit + optional auth checks for POST endpoints.
 *  tier: "heavy" for expensive ops (create post, register), "light" for cheap ops (vote, react, comment). */
export async function guardPost(
	event: RequestEvent,
	tier: RateLimitTier = "heavy",
) {
	const { request, platform } = event;
	const db = platform?.env.DB;
	const ip = getClientIp(request);

	// Reject oversized bodies before parsing
	const contentLength = request.headers.get("content-length");
	if (contentLength) {
		const size = parseInt(contentLength, 10);
		if (!Number.isNaN(size) && size > MAX_BODY_BYTES) {
			return {
				error: jsonError(
					413,
					"payload_too_large",
					"Request body must be under 64 KB",
				),
			};
		}
	}

	// Reject if no IP (direct access bypassing CF) — skip in dev
	if (ip === "unknown") {
		return {
			error: jsonError(403, "forbidden", "Request must go through Cloudflare"),
		};
	}

	// Auth required for POST
	const user = await resolveAuth(request, platform?.env.JWT_SECRET, db);
	if (!user) {
		return {
			error: jsonError(
				401,
				"unauthorized",
				"Authentication required. Provide a valid JWT in the Authorization header.",
			),
		};
	}

	// Check bans (user + IP) in a single batch
	const banResults = await db.batch([
		db
			.prepare(
				"SELECT reason, expires_at FROM bans WHERE identifier = ? AND expires_at > unixepoch()",
			)
			.bind(user.sub),
		db
			.prepare(
				"SELECT reason, expires_at FROM bans WHERE identifier = ? AND expires_at > unixepoch()",
			)
			.bind(`ip:${ip}`),
	]);

	for (const banResult of banResults) {
		const ban = banResult.results[0] as
			| { reason: string; expires_at: number }
			| undefined;
		if (ban) {
			return {
				error: jsonError(
					403,
					"banned",
					`Account suspended for abusive activity. Ban expires: ${new Date(ban.expires_at * 1000).toISOString()}`,
					{
						expires_at: new Date(ban.expires_at * 1000).toISOString(),
					},
				),
			};
		}
	}

	// Rate limit (user + IP)
	for (const identifier of [user.sub, `ip:${ip}`]) {
		const limit = await checkRateLimit(db, identifier, tier);
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
	}

	// Check for auto-ban after incrementing counters
	await checkAndAutoBan(db, [user.sub, `ip:${ip}`]);

	// Opportunistic cleanup (roughly 1 in 20 requests)
	if (Math.random() < 0.05) {
		event.platform?.context.waitUntil(cleanupExpiredData(db));
	}

	return { user, ip };
}

/** Lightweight rate limit check for GET endpoints. */
export async function guardGet(event: RequestEvent) {
	const { request, platform } = event;
	const db = platform?.env.DB;
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
	const limit = await checkRateLimit(db, `ip:${ip}`, "get");
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

	// Optional auth (for user vote status) — supports JWT and API keys
	const user = await resolveAuth(request, platform?.env.JWT_SECRET, db);

	return { user, ip };
}

/** JSON response with short cache for public GET endpoints. */
export function cachedJson(data: unknown, request?: Request, maxAge = 10) {
	const isAuthed = !!request?.headers.get("Authorization");
	const cacheControl = isAuthed
		? `private, max-age=${maxAge}`
		: `public, max-age=${maxAge}, stale-while-revalidate=30`;
	return json(data, {
		headers: {
			"Cache-Control": cacheControl,
			Vary: "Authorization",
		},
	});
}
