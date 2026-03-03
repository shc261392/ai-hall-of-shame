export interface User {
	id: string;
	username: string;
	created_at: number;
}

export interface Post {
	id: string;
	userId: string;
	username: string;
	title: string;
	body: string;
	upvotes: number;
	downvotes: number;
	commentCount: number;
	createdAt: number;
	userVote?: number | null;
}

export interface Comment {
	id: string;
	postId: string;
	userId: string;
	username: string;
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

export type SortOption = 'trending' | 'top' | 'latest';

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
