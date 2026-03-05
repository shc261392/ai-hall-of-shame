import type { ServerLoad } from "@sveltejs/kit";
import {
	REACTION_EMOJIS,
	REACTION_LABELS,
	computeIsGolden,
	type ReactionEmoji,
	type PostRow,
	type Post,
} from "$lib/types";
import { stripMarkdown } from "$lib/utils/strip-markdown";
import { getEnv } from "$lib/server/middleware";

export interface PostPageData {
	post: Post | null;
	ogDescription: string;
}

export const load: ServerLoad = async ({ platform, params }) => {
	const db = getEnv(platform).DB;
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

	// Get reaction counts and tags in a single batch
	const batchResults = await db.batch([
		db
			.prepare("SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji")
			.bind(postId),
		db.prepare("SELECT tag FROM post_tags WHERE post_id = ?").bind(postId),
	]);

	const reactionCounts = batchResults[0].results as unknown as { emoji: string; count: number }[];
	const tagRows = batchResults[1].results as unknown as { tag: string }[];

	const countMap = new Map(reactionCounts.map((c) => [c.emoji, c.count]));
	const tags = tagRows.map((t) => t.tag);

	const description = post.body
		? stripMarkdown(post.body).slice(0, 200)
		: "An AI fail story on AI Hall of Shame";

	const reactions = REACTION_EMOJIS.map((e) => ({
		emoji: e,
		label: REACTION_LABELS[e as ReactionEmoji],
		count: countMap.get(e) ?? 0,
		userReacted: false,
	}));

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
			reactions,
			tags,
			isGolden: computeIsGolden(reactions, post.upvotes, post.downvotes),
		},
		ogDescription: description,
	};
};
