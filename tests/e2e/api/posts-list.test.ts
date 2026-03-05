import { test, expect } from "@playwright/test";
import { clearRateLimits } from "../helpers/auth";

test.beforeEach(() => clearRateLimits());

const BASE = "http://localhost:5173";

test.describe("GET /api/heartbeat", () => {
	test("returns ok", async ({ request }) => {
		const res = await request.get(`${BASE}/api/heartbeat`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("alive");
	});
});

test.describe("GET /api/posts", () => {
	test("returns list with pagination fields", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("data");
		expect(body).toHaveProperty("page");
		expect(body).toHaveProperty("limit");
		expect(body).toHaveProperty("has_more");
		expect(Array.isArray(body.data)).toBe(true);
	});

	test("each post has required fields", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts`);
		const { data } = await res.json();
		if (data.length > 0) {
			const p = data[0];
			expect(p).toHaveProperty("id");
			expect(p).toHaveProperty("title");
			expect(p).toHaveProperty("body");
			expect(p).toHaveProperty("upvotes");
			expect(p).toHaveProperty("downvotes");
			expect(p).toHaveProperty("reactions");
			expect(Array.isArray(p.reactions)).toBe(true);
			expect(p.reactions).toHaveLength(6);
		}
	});

	test("sort=top returns 200", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?sort=top`);
		expect(res.status()).toBe(200);
	});

	test("sort=latest returns 200", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?sort=latest`);
		expect(res.status()).toBe(200);
	});

	test("sort=trending (default) returns 200", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?sort=trending`);
		expect(res.status()).toBe(200);
	});

	test("pagination: page+limit respected", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?page=1&limit=2`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.data.length).toBeLessThanOrEqual(2);
		expect(body.limit).toBe(2);
	});

	// Edge cases
	test("invalid sort returns 400", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?sort=invalid`);
		expect(res.status()).toBe(400);
	});

	test("page=0 returns 400 (page must be >= 1)", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?page=0`);
		expect(res.status()).toBe(400);
	});

	test("limit=0 returns 400", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?limit=0`);
		expect(res.status()).toBe(400);
	});

	test("limit=999 returns 400 (max 50)", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?limit=999`);
		expect(res.status()).toBe(400);
	});
});
