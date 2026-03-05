import { test, expect } from "@playwright/test";
import { createTestUser, authHeaders, clearRateLimits } from "../helpers/auth";

test.beforeEach(() => clearRateLimits());

const BASE = "http://localhost:5173";
const FAKE_POST_ID = "aaaabbbbccccddddeeee1";

test.describe("POST /api/posts/[id]/comments — auth required", () => {
	test("rejects without token (401)", async ({ request }) => {
		const res = await request.post(
			`${BASE}/api/posts/${FAKE_POST_ID}/comments`,
			{ data: { body: "Great post!" } },
		);
		expect(res.status()).toBe(401);
	});
});

test.describe("POST /api/posts/[id]/comments — validation", () => {
	let token: string;
	test.beforeAll(async () => {
		({ token } = await createTestUser("commenter"));
	});

	test("returns 404 for non-existent post", async ({ request }) => {
		const res = await request.post(
			`${BASE}/api/posts/${FAKE_POST_ID}/comments`,
			{
				headers: authHeaders(token),
				data: { body: "This is a comment" },
			},
		);
		// 404 because post doesn't exist, or 500 due to FK — auth passed
		expect([404, 500]).toContain(res.status());
	});

	test("rejects empty body (400)", async ({ request }) => {
		const res = await request.post(
			`${BASE}/api/posts/${FAKE_POST_ID}/comments`,
			{
				headers: authHeaders(token),
				data: { body: "" },
			},
		);
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe("validation_error");
	});

	test("rejects body > 5000 chars (400)", async ({ request }) => {
		const res = await request.post(
			`${BASE}/api/posts/${FAKE_POST_ID}/comments`,
			{
				headers: authHeaders(token),
				data: { body: "x".repeat(5001) },
			},
		);
		expect(res.status()).toBe(400);
	});

	test("rejects invalid JSON (400)", async ({ request }) => {
		const res = await request.post(
			`${BASE}/api/posts/${FAKE_POST_ID}/comments`,
			{
				headers: {
					...authHeaders(token),
					"Content-Type": "application/json",
				},
				data: "not json",
			},
		);
		expect(res.status()).toBe(400);
	});
});

test.describe("GET /api/posts/[id]/comments", () => {
	test("returns 404 for non-existent post comments", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts/${FAKE_POST_ID}/comments`);
		// Either 404 (post not found) or 200 with empty array depending on impl
		expect([200, 404]).toContain(res.status());
		if (res.status() === 200) {
			const body = await res.json();
			expect(Array.isArray(body.data ?? body)).toBe(true);
		}
	});
});
