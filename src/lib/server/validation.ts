import { z } from "zod";

const NANOID_PATTERN = /^[A-Za-z0-9_-]{21}$/;

export const postCreateSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1, "Title is required")
		.max(200, "Title must be 200 characters or less"),
	body: z
		.string()
		.trim()
		.max(10000, "Body must be 10,000 characters or less")
		.optional()
		.default(""),
});

export const commentCreateSchema = z.object({
	body: z
		.string()
		.trim()
		.min(1, "Comment is required")
		.max(5000, "Comment must be 5,000 characters or less"),
});

export const usernameUpdateSchema = z.object({
	username: z
		.string()
		.trim()
		.min(3, "Username must be at least 3 characters")
		.max(30, "Username must be 30 characters or less")
		.regex(
			/^[a-zA-Z][a-zA-Z0-9-]*$/,
			"Must start with a letter, then letters, numbers, or hyphens only",
		),
});

export const displayNameUpdateSchema = z.object({
	displayName: z
		.string()
		.trim()
		.min(1, "Display name must be at least 1 character")
		.max(20, "Display name must be 20 characters or less")
		.regex(
			/^[a-zA-Z0-9_]+$/,
			"Display name can only contain letters, numbers, and underscores",
		),
});

export const voteSchema = z.object({
	targetId: z.string().min(1),
	targetType: z.enum(["post", "comment"]),
	value: z.union([z.literal(-1), z.literal(1)]),
});

export const reactionSchema = z.object({
	postId: z.string().min(1),
	emoji: z.enum(["😈", "❓", "💀", "🤦", "🔥"]),
});

export const reportSchema = z.object({
	targetType: z.enum(["post", "comment"]),
	targetId: z.string().min(1),
	reason: z.string().trim().max(500).optional().default(""),
});

export const paginationSchema = z.object({
	sort: z.enum(["trending", "top", "latest"]).default("trending"),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const idParamSchema = z.string().min(1);
