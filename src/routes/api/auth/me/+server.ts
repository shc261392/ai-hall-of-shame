import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUser, signToken } from '$lib/server/auth';
import { jsonError } from '$lib/server/middleware';
import { usernameUpdateSchema } from '$lib/server/validation';
import { isReservedUsername } from '$lib/server/username';

export const GET: RequestHandler = async ({ request, platform }) => {
	const user = await getAuthUser(request, platform!.env.JWT_SECRET);
	if (!user) {
		return jsonError(401, 'unauthorized', 'Authentication required');
	}

	const row = await platform!.env.DB
		.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
		.bind(user.sub)
		.first<{ id: string; username: string; created_at: number }>();

	if (!row) {
		return jsonError(404, 'user_not_found', 'User not found');
	}

	return json({
		id: row.id,
		username: row.username,
		createdAt: new Date(row.created_at * 1000).toISOString()
	});
};

export const PATCH: RequestHandler = async ({ request, platform }) => {
	const user = await getAuthUser(request, platform!.env.JWT_SECRET);
	if (!user) {
		return jsonError(401, 'unauthorized', 'Authentication required');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonError(400, 'invalid_request', 'Invalid JSON body');
	}

	const parsed = usernameUpdateSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, 'validation_error', parsed.error.issues[0].message);
	}

	const newUsername = parsed.data.username;

	if (isReservedUsername(newUsername)) {
		return jsonError(400, 'reserved_username', 'This username is reserved');
	}

	const db = platform!.env.DB;

	// Check for uniqueness
	const existing = await db
		.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?')
		.bind(newUsername, user.sub)
		.first();

	if (existing) {
		return jsonError(409, 'username_taken', 'This username is already taken');
	}

	await db
		.prepare('UPDATE users SET username = ? WHERE id = ?')
		.bind(newUsername, user.sub)
		.run();

	// Issue new token with updated username
	const token = await signToken(user.sub, newUsername, platform!.env.JWT_SECRET);

	return json({ token, username: newUsername });
};
