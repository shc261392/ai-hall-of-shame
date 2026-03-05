import { test, expect } from "@playwright/test";
import { createTestUser, authHeaders, clearRateLimits } from "../helpers/auth";

test.beforeEach(() => clearRateLimits());

const BASE = "http://localhost:5173";
const FAKE_POST_ID = "aaaabbbbccccddddeeee1";

test.describe("POST /api/reactions — auth required", () => {
	test("rejects without token (401)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/reactions`, {
			data: { postId: FAKE_POST_ID, emoji: "😈" },
		});
		expect(res.status()).toBe(401);
	});
});

test.describe("POST /api/reactions — validation", () => {
	let token: string;
	test.beforeAll(async () => {
		({ token } = await createTestUser("reactor"));
	});

	test("rejects invalid emoji (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/reactions`, {
			headers: authHeaders(token),
			data: { postId: FAKE_POST_ID, emoji: "🎉" },
		});
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe("validation_error");
	});

	test("rejects text instead of emoji (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/reactions`, {
			headers: authHeaders(token),
			data: { postId: FAKE_POST_ID, emoji: "laugh" },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects missing postId (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/reactions`, {
			headers: authHeaders(token),
			data: { emoji: "😈" },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects missing emoji (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/reactions`, {
			headers: authHeaders(token),
			data: { postId: FAKE_POST_ID },
		});
		expect(res.status()).toBe(400);
	});

	test("returns 404 for non-existent post", async ({ request }) => {
		const res = await request.post(`${BASE}/api/reactions`, {
			headers: authHeaders(token),
			data: { postId: "nonexistent-post-xyz", emoji: "😈" },
		});
		expect(res.status()).toBe(404);
		expect((await res.json()).error).toBe("not_found");
	});

	// All 5 valid emojis accepted (against fake post → 404, but validation passes)
	for (const emoji of ["😈", "❓", "💀", "🤦", "🔥"]) {
		test(`accepts valid emoji ${emoji} (404 because post is fake)`, async ({
			request,
		}) => {
			const res = await request.post(`${BASE}/api/reactions`, {
				headers: authHeaders(token),
				data: { postId: "nonexistent-post-xyz", emoji },
			});
			// Valid emoji → passes validation → 404 for missing post
			expect(res.status()).toBe(404);
		});
	}
});
