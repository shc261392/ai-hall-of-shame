const WINDOW_SECONDS = 60;
const BAN_THRESHOLD_COUNT = 100;
const BAN_THRESHOLD_WINDOW = 600; // 10 minutes
const BAN_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Rate limit tiers.
 *
 * "heavy" — expensive operations: create post, register, auth, report
 * "light" — cheap interactions: vote, react, comment, profile update
 * "get"   — read-only fetches
 */
const LIMITS: Record<string, { user: number; ip: number }> = {
	heavy: { user: 5, ip: 15 },
	light: { user: 30, ip: 60 },
	get: { user: 0, ip: 120 }, // user: 0 means not checked per-user for GETs
};

export type RateLimitTier = "heavy" | "light" | "get";

interface RateLimitResult {
	allowed: boolean;
	retryAfterSeconds?: number;
}

export async function checkBan(
	db: D1Database,
	identifier: string,
): Promise<{ banned: boolean; reason?: string; expiresAt?: string }> {
	const ban = await db
		.prepare(
			"SELECT reason, expires_at FROM bans WHERE identifier = ? AND expires_at > unixepoch()",
		)
		.bind(identifier)
		.first<{ reason: string; expires_at: number }>();

	if (!ban) return { banned: false };

	return {
		banned: true,
		reason: ban.reason,
		expiresAt: new Date(ban.expires_at * 1000).toISOString(),
	};
}

export async function checkRateLimit(
	db: D1Database,
	identifier: string,
	tier: RateLimitTier,
): Promise<RateLimitResult> {
	const tierLimits = LIMITS[tier];
	const limit = identifier.startsWith("ip:")
		? tierLimits.ip
		: tierLimits.user;

	// Skip if limit is 0 (e.g. per-user for GET)
	if (limit === 0) return { allowed: true };

	const windowStart =
		Math.floor(Date.now() / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS;

	// Check current + previous window for sliding window approximation BEFORE incrementing
	const { results } = await db
		.prepare(
			"SELECT window_start, count FROM rate_limits WHERE identifier = ? AND window_start >= ?",
		)
		.bind(identifier, windowStart - WINDOW_SECONDS)
		.all<{ window_start: number; count: number }>();

	const totalCount = results.reduce((sum, r) => sum + r.count, 0);

	if (totalCount >= limit) {
		const retryAfterSeconds =
			WINDOW_SECONDS - (Math.floor(Date.now() / 1000) - windowStart);
		return {
			allowed: false,
			retryAfterSeconds: Math.max(1, retryAfterSeconds),
		};
	}

	// Only increment after confirming the request is allowed
	await db
		.prepare(
			`INSERT INTO rate_limits (identifier, window_start, count)
			 VALUES (?, ?, 1)
			 ON CONFLICT(identifier, window_start) DO UPDATE SET count = count + 1`,
		)
		.bind(identifier, windowStart)
		.run();

	return { allowed: true };
}

export async function checkAndAutoBan(
	db: D1Database,
	identifiers: string[],
): Promise<void> {
	const tenMinAgo = Math.floor(Date.now() / 1000) - BAN_THRESHOLD_WINDOW;

	for (const identifier of identifiers) {
		const result = await db
			.prepare(
				"SELECT SUM(count) as total FROM rate_limits WHERE identifier = ? AND window_start > ?",
			)
			.bind(identifier, tenMinAgo)
			.first<{ total: number }>();

		if (result && result.total > BAN_THRESHOLD_COUNT) {
			const expiresAt = Math.floor(Date.now() / 1000) + BAN_DURATION;
			await db
				.prepare(
					`INSERT INTO bans (identifier, reason, expires_at)
					 VALUES (?, ?, ?)
					 ON CONFLICT(identifier) DO UPDATE SET reason = excluded.reason, expires_at = excluded.expires_at`,
				)
				.bind(identifier, "Automatic ban: excessive request rate", expiresAt)
				.run();
		}
	}
}

export async function cleanupExpiredData(db: D1Database): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	await db.batch([
		db.prepare("DELETE FROM challenges WHERE expires_at < ?").bind(now),
		db
			.prepare("DELETE FROM rate_limits WHERE window_start < ?")
			.bind(now - BAN_THRESHOLD_WINDOW),
		db.prepare("DELETE FROM bans WHERE expires_at < ?").bind(now),
	]);
}
