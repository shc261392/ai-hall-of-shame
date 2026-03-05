import { describe, it, expect } from "vitest";
import {
postCreateSchema,
commentCreateSchema,
usernameUpdateSchema,
displayNameUpdateSchema,
voteSchema,
reactionSchema,
paginationSchema,
idParamSchema,
} from "./validation";

describe("postCreateSchema", () => {
it("accepts a valid post", () => {
const result = postCreateSchema.safeParse({
title: "AI made a mistake",
body: "It told me to eat glue.",
tags: ["chatgpt", "ai-fail"],
});
expect(result.success).toBe(true);
});

it("accepts a post with no body or tags (defaults)", () => {
const result = postCreateSchema.safeParse({ title: "Minimal post" });
expect(result.success).toBe(true);
if (result.success) {
expect(result.data.body).toBe("");
expect(result.data.tags).toEqual([]);
}
});

it("rejects missing title", () => {
const result = postCreateSchema.safeParse({ body: "No title" });
expect(result.success).toBe(false);
});

it("rejects title >200 chars", () => {
const result = postCreateSchema.safeParse({ title: "x".repeat(201) });
expect(result.success).toBe(false);
});

it("rejects body >10000 chars", () => {
const result = postCreateSchema.safeParse({
title: "ok",
body: "x".repeat(10001),
});
expect(result.success).toBe(false);
});

it("rejects >3 tags", () => {
const result = postCreateSchema.safeParse({
title: "ok",
tags: ["aa", "bb", "cc", "dd"],
});
expect(result.success).toBe(false);
});

it("rejects invalid tag format", () => {
const result = postCreateSchema.safeParse({
title: "ok",
tags: ["-invalid-"],
});
expect(result.success).toBe(false);
});
});

describe("commentCreateSchema", () => {
it("accepts a valid comment", () => {
const result = commentCreateSchema.safeParse({ body: "Great post!" });
expect(result.success).toBe(true);
});

it("rejects empty body", () => {
const result = commentCreateSchema.safeParse({ body: "" });
expect(result.success).toBe(false);
});

it("rejects body >5000 chars", () => {
const result = commentCreateSchema.safeParse({ body: "x".repeat(5001) });
expect(result.success).toBe(false);
});
});

describe("usernameUpdateSchema", () => {
it("accepts a valid username", () => {
const result = usernameUpdateSchema.safeParse({ username: "cool-user" });
expect(result.success).toBe(true);
});

it("rejects username <3 chars", () => {
const result = usernameUpdateSchema.safeParse({ username: "ab" });
expect(result.success).toBe(false);
});

it("rejects username >30 chars", () => {
const result = usernameUpdateSchema.safeParse({
username: "a".repeat(31),
});
expect(result.success).toBe(false);
});

it("rejects username starting with a number", () => {
const result = usernameUpdateSchema.safeParse({ username: "1badname" });
expect(result.success).toBe(false);
});

it("rejects username with special chars", () => {
const result = usernameUpdateSchema.safeParse({ username: "bad@user!" });
expect(result.success).toBe(false);
});
});

describe("displayNameUpdateSchema", () => {
it("accepts a valid display name", () => {
const result = displayNameUpdateSchema.safeParse({ displayName: "CoolUser" });
expect(result.success).toBe(true);
});

it("accepts underscores", () => {
const result = displayNameUpdateSchema.safeParse({ displayName: "cool_user" });
expect(result.success).toBe(true);
});

it("rejects display name >20 chars", () => {
const result = displayNameUpdateSchema.safeParse({
displayName: "a".repeat(21),
});
expect(result.success).toBe(false);
});

it("rejects special characters", () => {
const result = displayNameUpdateSchema.safeParse({ displayName: "bad name!" });
expect(result.success).toBe(false);
});
});

describe("voteSchema", () => {
it("accepts upvote (1)", () => {
const result = voteSchema.safeParse({
targetId: "abc123",
targetType: "post",
value: 1,
});
expect(result.success).toBe(true);
});

it("accepts downvote (-1)", () => {
const result = voteSchema.safeParse({
targetId: "abc123",
targetType: "comment",
value: -1,
});
expect(result.success).toBe(true);
});

it("rejects value 0", () => {
const result = voteSchema.safeParse({
targetId: "abc123",
targetType: "post",
value: 0,
});
expect(result.success).toBe(false);
});

it("rejects value 2", () => {
const result = voteSchema.safeParse({
targetId: "abc123",
targetType: "post",
value: 2,
});
expect(result.success).toBe(false);
});

it("rejects missing fields", () => {
expect(voteSchema.safeParse({}).success).toBe(false);
expect(voteSchema.safeParse({ targetId: "x" }).success).toBe(false);
});
});

describe("reactionSchema", () => {
it("accepts valid emoji", () => {
const result = reactionSchema.safeParse({
postId: "abc123",
emoji: "🔥",
});
expect(result.success).toBe(true);
});

it("accepts all valid emojis", () => {
for (const emoji of ["😈", "❓", "💀", "🤦", "🔥", "🏆"]) {
const result = reactionSchema.safeParse({ postId: "abc", emoji });
expect(result.success).toBe(true);
}
});

it("rejects invalid emoji", () => {
const result = reactionSchema.safeParse({
postId: "abc",
emoji: "👍",
});
expect(result.success).toBe(false);
});
});

describe("paginationSchema", () => {
it("provides defaults when no input given", () => {
const result = paginationSchema.safeParse({});
expect(result.success).toBe(true);
if (result.success) {
expect(result.data.sort).toBe("trending");
expect(result.data.page).toBe(1);
expect(result.data.limit).toBe(20);
}
});

it("accepts valid sort/page/limit", () => {
const result = paginationSchema.safeParse({
sort: "top",
page: 3,
limit: 10,
});
expect(result.success).toBe(true);
if (result.success) {
expect(result.data.sort).toBe("top");
expect(result.data.page).toBe(3);
expect(result.data.limit).toBe(10);
}
});

it("rejects invalid sort value", () => {
const result = paginationSchema.safeParse({ sort: "invalid" });
expect(result.success).toBe(false);
});

it("rejects page < 1", () => {
const result = paginationSchema.safeParse({ page: 0 });
expect(result.success).toBe(false);
});

it("coerces string page to number", () => {
const result = paginationSchema.safeParse({ page: "2" });
expect(result.success).toBe(true);
if (result.success) {
expect(result.data.page).toBe(2);
}
});
});

describe("idParamSchema", () => {
it("accepts a valid id", () => {
const result = idParamSchema.safeParse("abc123");
expect(result.success).toBe(true);
});

it("rejects empty string", () => {
const result = idParamSchema.safeParse("");
expect(result.success).toBe(false);
});
});
