import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";

test.describe("GET /api/auth/challenge", () => {
	test("rejects invalid purpose (400)", async ({ request }) => {
		const res = await request.get(`${BASE}/api/auth/challenge?purpose=invalid`);
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe("invalid_request");
	});

	test("returns challenge for registration purpose", async ({ request }) => {
		const res = await request.get(
			`${BASE}/api/auth/challenge?purpose=registration`,
		);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("challengeId");
		expect(body).toHaveProperty("challenge");
		expect(typeof body.challenge).toBe("string");
		expect(body.challenge.length).toBeGreaterThan(20);
	});

	test("returns challenge for authentication purpose", async ({ request }) => {
		const res = await request.get(
			`${BASE}/api/auth/challenge?purpose=authentication`,
		);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("challengeId");
		expect(body).toHaveProperty("challenge");
	});

	test("returns unique challenges on repeat calls", async ({ request }) => {
		const [r1, r2] = await Promise.all([
			request.get(`${BASE}/api/auth/challenge?purpose=registration`),
			request.get(`${BASE}/api/auth/challenge?purpose=registration`),
		]);
		const [b1, b2] = await Promise.all([r1.json(), r2.json()]);
		expect(b1.challenge).not.toBe(b2.challenge);
		expect(b1.challengeId).not.toBe(b2.challengeId);
	});

	test("missing purpose returns 400", async ({ request }) => {
		const res = await request.get(`${BASE}/api/auth/challenge`);
		expect(res.status()).toBe(400);
	});
});

test.describe("POST /api/auth/register — rejects bad payloads", () => {
	test("rejects missing challengeId (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/auth/register`, {
			data: { attestation: {} },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects missing attestation (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/auth/register`, {
			data: { challengeId: "some-id" },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects expired/fake challengeId (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/auth/register`, {
			data: {
				challengeId: "not-a-real-challenge-id",
				attestation: { type: "public-key", response: {} },
			},
		});
		// 400: challenge not found or verification failed
		expect(res.status()).toBe(400);
	});
});

test.describe("GET /api/auth/me — unauthenticated", () => {
	test("returns 401 without token", async ({ request }) => {
		const res = await request.get(`${BASE}/api/auth/me`);
		expect(res.status()).toBe(401);
	});

	test("returns 401 with garbage token", async ({ request }) => {
		const res = await request.get(`${BASE}/api/auth/me`, {
			headers: { Authorization: "Bearer garbage.token.here" },
		});
		expect(res.status()).toBe(401);
	});
});
