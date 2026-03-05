import { z } from "zod";
import { REACTION_EMOJIS } from "$lib/types";

const tagSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(2, "Tag must be at least 2 characters")
	.max(24, "Tag must be 24 characters or less")
	.regex(
		/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{2}$/,
		"Tags must be lowercase alphanumeric with optional hyphens",
	);

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
	tags: z.array(tagSchema).max(3, "Maximum 3 tags allowed").optional().default([]),
});

export const tagUpdateSchema = z.object({
	tags: z.array(tagSchema).max(3, "Maximum 3 tags allowed"),
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
		.regex(/^[a-zA-Z0-9_]+$/, "Display name can only contain letters, numbers, and underscores"),
});

export const voteSchema = z.object({
	targetId: z.string().min(1),
	targetType: z.enum(["post", "comment"]),
	value: z.union([z.literal(-1), z.literal(1)]),
});

export const reactionSchema = z.object({
	postId: z.string().min(1),
	emoji: z.enum(REACTION_EMOJIS),
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
	q: z.string().trim().max(100).optional(),
	tag: z
		.string()
		.trim()
		.toLowerCase()
		.max(24)
		.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$/, "Invalid tag format")
		.optional(),
});

export const idParamSchema = z.string().min(1);

export const apiKeyCreateSchema = z.object({
	name: z
		.string()
		.trim()
		.max(40, "Key name must be 40 characters or less")
		.regex(
			/^[a-zA-Z0-9_ -]*$/,
			"Key name can only contain letters, numbers, spaces, hyphens, and underscores",
		)
		.optional()
		.default(""),
});
