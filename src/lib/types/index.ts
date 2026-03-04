export interface User {
	id: string;
	username: string;
	displayName?: string;
	created_at: number;
}

export const REACTION_EMOJIS = ["😈", "❓", "💀", "🤦", "🔥"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const REACTION_LABELS: Record<ReactionEmoji, string> = {
	"😈": "Bad AI!",
	"❓": "Huh?",
	"💀": "Killed It",
	"🤦": "Facepalm",
	"🔥": "Dumpster Fire",
};

export interface ReactionCount {
	emoji: ReactionEmoji;
	label: string;
	count: number;
	userReacted: boolean;
}

export interface Post {
	id: string;
	userId: string;
	username: string;
	displayName?: string;
	title: string;
	body: string;
	upvotes: number;
	downvotes: number;
	commentCount: number;
	createdAt: number;
	userVote?: number | null;
	reactions?: ReactionCount[];
}

export interface Comment {
	id: string;
	postId: string;
	userId: string;
	username: string;
	displayName?: string;
	body: string;
	upvotes: number;
	downvotes: number;
	createdAt: number;
	userVote?: number | null;
}

export interface AuthPayload {
	token: string;
	username: string;
	userId: string;
	backupCode?: string;
}

export type SortOption = "trending" | "top" | "latest";

export interface ApiError {
	error: string;
	message: string;
	retry_after_seconds?: number;
	expires_at?: string;
}

export interface PaginatedResponse<T> {
	data: T[];
	page: number;
	limit: number;
	has_more: boolean;
}

// ── D1 row shapes (snake_case as returned from SQLite) ──

export interface PostRow {
	id: string;
	user_id: string;
	title: string;
	body: string;
	upvotes: number;
	downvotes: number;
	comment_count: number;
	report_count: number;
	deleted_at: number | null;
	created_at: number;
	username: string;
	display_name: string | null;
	trending_score?: number;
}

export interface CommentRow {
	id: string;
	post_id: string;
	user_id: string;
	body: string;
	upvotes: number;
	downvotes: number;
	report_count: number;
	deleted_at: number | null;
	created_at: number;
	username: string;
	display_name: string | null;
}
