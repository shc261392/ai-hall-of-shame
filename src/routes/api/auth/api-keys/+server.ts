import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getAuthUser, createApiKey, listApiKeys, deleteApiKey } from "$lib/server/auth";
import { getClientIp, jsonError } from "$lib/server/middleware";
import { apiKeyCreateSchema } from "$lib/server/validation";
import { checkRateLimit } from "$lib/server/ratelimit";

/** List all API keys for the authenticated user. */
export const GET: RequestHandler = async ({ request, platform }) => {
	const user = await getAuthUser(request, platform!.env.JWT_SECRET);
	if (!user) {
		return jsonError(401, "unauthorized", "Authentication required");
	}

	const keys = await listApiKeys(user.sub, platform!.env.DB);

	return json({
		keys: keys.map((k) => ({
			id: k.id,
			name: k.name,
			prefix: k.key_prefix,
			lastUsedAt: k.last_used_at ? new Date(k.last_used_at * 1000).toISOString() : null,
			expiresAt: new Date(k.expires_at * 1000).toISOString(),
			createdAt: new Date(k.created_at * 1000).toISOString(),
		})),
	});
};

/** Create a new API key. Requires JWT auth (not API key auth — can't bootstrap keys with keys). */
export const POST: RequestHandler = async ({ request, platform }) => {
	const user = await getAuthUser(request, platform!.env.JWT_SECRET);
	if (!user) {
		return jsonError(
			401,
			"unauthorized",
			"Authentication required. API keys cannot be created using another API key — use your JWT session token.",
		);
	}

	const db = platform!.env.DB;
	const ip = getClientIp(request);

	// Rate limit key creation
	const limit = await checkRateLimit(db, user.sub, "heavy");
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

	const parsed = apiKeyCreateSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, "validation_error", parsed.error.issues[0].message);
	}

	// Auto-generate name if not provided
	let keyName = parsed.data.name;
	if (!keyName) {
		const existing = await listApiKeys(user.sub, db);
		keyName = `ApiKey${existing.length + 1}`;
	}

	try {
		const result = await createApiKey(user.sub, keyName, db);
		return json(
			{
				id: result.keyId,
				key: result.key,
				prefix: result.prefix,
				expiresAt: new Date(result.expiresAt * 1000).toISOString(),
				message: "API key created. Save this key — it will not be shown again.",
			},
			{ status: 201 },
		);
	} catch (e) {
		if (e instanceof Error && e.message.includes("Maximum")) {
			return jsonError(400, "key_limit_reached", e.message);
		}
		throw e;
	}
};

/** Revoke an API key by ID. */
export const DELETE: RequestHandler = async ({ request, platform, url }) => {
	const user = await getAuthUser(request, platform!.env.JWT_SECRET);
	if (!user) {
		return jsonError(401, "unauthorized", "Authentication required");
	}

	const keyId = url.searchParams.get("id");
	if (!keyId) {
		return jsonError(400, "invalid_request", "Missing key id parameter");
	}

	const deleted = await deleteApiKey(keyId, user.sub, platform!.env.DB);
	if (!deleted) {
		return jsonError(404, "not_found", "API key not found or not yours");
	}

	return json({ message: "API key revoked" });
};
