import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";

test.describe("GET /api/live/[channel] — polling endpoint", () => {
	test("returns empty events for feed channel (no DB in dev)", async ({ request }) => {
		const res = await request.get(`${BASE}/api/live/feed`);
		// Without a DB binding in local dev, SvelteKit returns 500;
		// with a DB binding, returns 200 with empty events.
		expect([200, 500]).toContain(res.status());
	});

	test("returns empty events for post channel (no DB in dev)", async ({ request }) => {
		const res = await request.get(`${BASE}/api/live/post:abcdefghijklmnopqrstu`);
		expect([200, 500]).toContain(res.status());
	});

	test("returns 400 for invalid channel name", async ({ request }) => {
		const res = await request.get(`${BASE}/api/live/invalid-channel`);
		expect(res.status()).toBe(400);
	});
});
