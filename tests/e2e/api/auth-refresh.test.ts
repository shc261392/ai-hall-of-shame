import { test, expect } from "@playwright/test";
import { createTestUser, authHeaders, clearRateLimits } from "../helpers/auth";

test.beforeEach(() => clearRateLimits());

const BASE = "http://localhost:5173";

test.describe("POST /api/auth/refresh — validation", () => {
	test("rejects invalid JSON body (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/auth/refresh`, {
			headers: { "Content-Type": "application/json" },
			data: "not json",
		});
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe("invalid_request");
	});

	test("rejects missing refreshToken (400)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/auth/refresh`, {
			data: {},
		});
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe("invalid_request");
	});

	test("rejects fake refreshToken (401)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/auth/refresh`, {
			data: { refreshToken: "not-a-real-refresh-token" },
		});
		expect(res.status()).toBe(401);
		expect((await res.json()).error).toBe("invalid_refresh_token");
	});
});

test.describe("DELETE /api/auth/refresh — validation", () => {
	test("succeeds with a fake refreshToken (idempotent revoke)", async ({
		request,
	}) => {
		const res = await request.delete(`${BASE}/api/auth/refresh`, {
			data: { refreshToken: "nonexistent-token" },
		});
		expect(res.status()).toBe(200);
		expect((await res.json()).message).toBe("Logged out");
	});

	test("succeeds with auth token but no refreshToken (revoke all)", async ({
		request,
	}) => {
		const { token } = await createTestUser("logoutall");
		const res = await request.delete(`${BASE}/api/auth/refresh`, {
			headers: authHeaders(token),
			data: {},
		});
		expect(res.status()).toBe(200);
		expect((await res.json()).message).toBe("Logged out");
	});
});
