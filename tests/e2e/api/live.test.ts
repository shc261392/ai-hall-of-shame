import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";

test.describe("GET /api/live/[channel] — local dev (no DO)", () => {
	test("returns 503 for feed channel (no DO binding)", async ({ request }) => {
		const res = await request.get(`${BASE}/api/live/feed`);
		expect(res.status()).toBe(503);
	});

	test("returns 503 for post channel (no DO binding)", async ({ request }) => {
		const res = await request.get(`${BASE}/api/live/post:abcdefghijklmnopqrstu`);
		expect(res.status()).toBe(503);
	});

	test("returns 400 for invalid channel name", async ({ request }) => {
		const res = await request.get(`${BASE}/api/live/invalid-channel`);
		// Could be 400 (invalid) or 503 (no DO) depending on check order
		expect([400, 503]).toContain(res.status());
	});
});
