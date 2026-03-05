import type { ServerLoad } from "@sveltejs/kit";
import {
	REACTION_EMOJIS,
	REACTION_LABELS,
	type ReactionEmoji,
	type PostRow,
	type Post,
} from "$lib/types";
import { stripMarkdown } from "$lib/utils/strip-markdown";

export interface PostPageData {
	post: Post | null;
	ogDescription: string;
}

export const load: ServerLoad = async ({ platform, params }) => {
	const db = platform!.env.DB;
	const postId = params.id;

	const post = await db
		.prepare(
			"SELECT p.*, u.username, u.display_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.deleted_at IS NULL",
		)
		.bind(postId)
		.first<PostRow>();

	if (!post) {
		return { post: null };
	}

	// Get reaction counts
	const { results: reactionCounts } = await db
		.prepare(
			"SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji",
		)
		.bind(postId)
		.all<{ emoji: string; count: number }>();

	const countMap = new Map(reactionCounts.map((c) => [c.emoji, c.count]));

	const description = post.body
		? stripMarkdown(post.body).slice(0, 200)
		: "An AI fail story on AI Hall of Shame";

	return {
		post: {
			id: post.id,
			userId: post.user_id,
			username: post.username,
			displayName: post.display_name || undefined,
			title: post.title,
			body: post.body,
			upvotes: post.upvotes,
			downvotes: post.downvotes,
			commentCount: post.comment_count,
			createdAt: post.created_at,
			userVote: null,
			reactions: REACTION_EMOJIS.map((e) => ({
				emoji: e,
				label: REACTION_LABELS[e as ReactionEmoji],
				count: countMap.get(e) ?? 0,
				userReacted: false,
			})),
		},
		ogDescription: description,
	};
};
