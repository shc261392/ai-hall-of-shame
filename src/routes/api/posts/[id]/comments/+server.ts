import { json } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import type { RequestHandler } from './$types';
import { guardGet, guardPost, jsonError } from '$lib/server/middleware';
import { commentCreateSchema } from '$lib/server/validation';

export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ('error' in guard && guard.error) return guard.error;

	const postId = event.params.id;
	const db = event.platform!.env.DB;

	// Verify post exists
	const post = await db.prepare('SELECT 1 FROM posts WHERE id = ?').bind(postId).first();
	if (!post) {
		return jsonError(404, 'not_found', 'Post not found');
	}

	const { results } = await db
		.prepare('SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC')
		.bind(postId)
		.all();

	// Get user votes if authenticated
	let userVotes: Record<string, number> = {};
	if ('user' in guard && guard.user && results.length > 0) {
		const commentIds = results.map((c: any) => c.id);
		const placeholders = commentIds.map(() => '?').join(',');
		const { results: votes } = await db
			.prepare(`SELECT target_id, value FROM votes WHERE user_id = ? AND target_type = 'comment' AND target_id IN (${placeholders})`)
			.bind(guard.user.sub, ...commentIds)
			.all<{ target_id: string; value: number }>();
		userVotes = Object.fromEntries(votes.map((v) => [v.target_id, v.value]));
	}

	return json({
		data: results.map((c: any) => ({
			id: c.id,
			postId: c.post_id,
			userId: c.user_id,
			username: c.username,
			body: c.body,
			upvotes: c.upvotes,
			downvotes: c.downvotes,
			createdAt: c.created_at,
			userVote: userVotes[c.id] ?? null
		}))
	});
};

export const POST: RequestHandler = async (event) => {
	const guard = await guardPost(event);
	if ('error' in guard && guard.error) return guard.error;

	const postId = event.params.id;
	const db = event.platform!.env.DB;

	// Verify post exists
	const post = await db.prepare('SELECT 1 FROM posts WHERE id = ?').bind(postId).first();
	if (!post) {
		return jsonError(404, 'not_found', 'Post not found');
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return jsonError(400, 'invalid_request', 'Invalid JSON body');
	}

	const parsed = commentCreateSchema.safeParse(body);
	if (!parsed.success) {
		return jsonError(400, 'validation_error', parsed.error.issues[0].message);
	}

	const commentId = nanoid();

	await db.batch([
		db
			.prepare('INSERT INTO comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)')
			.bind(commentId, postId, guard.user!.sub, parsed.data.body),
		db
			.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?')
			.bind(postId)
	]);

	return json(
		{
			id: commentId,
			message: 'Comment posted successfully'
		},
		{ status: 201 }
	);
};
