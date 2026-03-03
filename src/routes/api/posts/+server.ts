import { json } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import type { RequestHandler } from './$types';
import { guardGet, guardPost, jsonError } from '$lib/server/middleware';
import { postCreateSchema, paginationSchema } from '$lib/server/validation';

const SORT_QUERIES = {
	trending: `SELECT p.*, u.username,
		(p.upvotes - p.downvotes) * 1.0 / (((unixepoch() - p.created_at) / 3600.0) + 2) AS trending_score
		FROM posts p JOIN users u ON p.user_id = u.id
		ORDER BY trending_score DESC LIMIT ? OFFSET ?`,
	top: `SELECT p.*, u.username
		FROM posts p JOIN users u ON p.user_id = u.id
		ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC LIMIT ? OFFSET ?`,
	latest: `SELECT p.*, u.username
		FROM posts p JOIN users u ON p.user_id = u.id
		ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
} as const;

export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ('error' in guard && guard.error) return guard.error;

	const params = paginationSchema.safeParse(Object.fromEntries(event.url.searchParams));
	if (!params.success) {
		return jsonError(400, 'validation_error', params.error.issues[0].message);
	}

	const { sort, page, limit } = params.data;
	const offset = (page - 1) * limit;
	const db = event.platform!.env.DB;

	const query = SORT_QUERIES[sort];
	const { results } = await db.prepare(query).bind(limit + 1, offset).all();

	const hasMore = results.length > limit;
	const posts = results.slice(0, limit);

	// If user is authenticated, get their votes for these posts
	let userVotes: Record<string, number> = {};
	if ('user' in guard && guard.user) {
		const postIds = posts.map((p: any) => p.id);
		if (postIds.length > 0) {
			const placeholders = postIds.map(() => '?').join(',');
			const { results: votes } = await db
				.prepare(`SELECT target_id, value FROM votes WHERE user_id = ? AND target_type = 'post' AND target_id IN (${placeholders})`)
				.bind(guard.user.sub, ...postIds)
				.all<{ target_id: string; value: number }>();
			userVotes = Object.fromEntries(votes.map((v) => [v.target_id, v.value]));
		}
	}

	return json({
		data: posts.map((p: any) => ({
			id: p.id,
			userId: p.user_id,
			username: p.username,
			title: p.title,
			body: p.body,
			upvotes: p.upvotes,
			downvotes: p.downvotes,
			commentCount: p.comment_count,
			createdAt: p.created_at,
			userVote: userVotes[p.id] ?? null
		})),
		page,
		limit,
		has_more: hasMore
	});
};

export const POST: RequestHandler = async (event) => {
	const guard = await guardPost(event);
	if ('error' in guard && guard.error) return guard.error;

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return jsonError(400, 'invalid_request', 'Invalid JSON body');
	}

	const parsed = postCreateSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, 'validation_error', parsed.error.issues[0].message);
	}

	const db = event.platform!.env.DB;
	const postId = nanoid();

	await db
		.prepare('INSERT INTO posts (id, user_id, title, body) VALUES (?, ?, ?, ?)')
		.bind(postId, guard.user!.sub, parsed.data.title, parsed.data.body)
		.run();

	return json(
		{
			id: postId,
			message: 'Post created successfully'
		},
		{ status: 201 }
	);
};
