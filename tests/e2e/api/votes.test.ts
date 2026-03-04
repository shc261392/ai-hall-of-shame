import { test, expect } from "@playwright/test";
import { createTestUser, authHeaders } from "../helpers/auth";

const BASE = "http://localhost:5173";
const FAKE_POST_ID = "aaaabbbbccccddddeeee1";

test.describe("POST /api/votes — auth required", () => {
	test("rejects without token (401)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/votes`, {
			data: { targetId: FAKE_POST_ID, targetType: "post", value: 1 },
		});
		expect(res.status()).toBe(401);
	});
});

test.describe("POST /api/votes — validation", () => {
	let token: string;
	test.beforeAll(async () => {
		({ token } = await createTestUser("voter"));
	});

	test("rejects invalid value (0) — must be 1 or -1 (400)", async ({
		request,
	}) => {
		const res = await request.post(`${BASE}/api/votes`, {
			headers: authHeaders(token),
			data: { targetId: FAKE_POST_ID, targetType: "post", value: 0 },
		});
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe("validation_error");
	});

	test("rejects invalid targetType (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/votes`, {
			headers: authHeaders(token),
			data: { targetId: FAKE_POST_ID, targetType: "invalid", value: 1 },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects missing targetId (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/votes`, {
			headers: authHeaders(token),
			data: { targetType: "post", value: 1 },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects vote on non-existent post (404)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/votes`, {
			headers: authHeaders(token),
			data: {
				targetId: "nonexistent-post-id-xyz",
				targetType: "post",
				value: 1,
			},
		});
		expect(res.status()).toBe(404);
		expect((await res.json()).error).toBe("not_found");
	});

	test("rejects vote value of 2 (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/votes`, {
			headers: authHeaders(token),
			data: { targetId: FAKE_POST_ID, targetType: "post", value: 2 },
		});
		expect(res.status()).toBe(400);
	});

	test("accepts value of -1 (upvote/downvote) for non-existent target → 404", async ({
		request,
	}) => {
		const res = await request.post(`${BASE}/api/votes`, {
			headers: authHeaders(token),
			data: { targetId: FAKE_POST_ID, targetType: "post", value: -1 },
		});
		expect(res.status()).toBe(404);
	});
});
