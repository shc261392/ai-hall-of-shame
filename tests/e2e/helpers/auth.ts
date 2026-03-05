/**
 * Auth helpers for E2E tests.
 *
 * Creates JWTs and seeds test users via the dev-only HTTP endpoints.
 * The JWT_SECRET must match the value in .dev.vars.
 */
import { SignJWT } from "jose";

const DEV_JWT_SECRET =
	process.env.TEST_JWT_SECRET ?? "CyAhlMouMSZ3Cezj6opc6hqHBWBFEdFtxXzYCJRXGQQ=";

/** Insert a user row into the local D1 via the dev-only seed endpoint. */
async function seedUserInDb(userId: string, username: string): Promise<void> {
	const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
	try {
		await fetch(`${base}/api/test/seed-user`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId, username }),
		});
	} catch {
		// Silently ignore — tests that need a real user will skip gracefully
	}
}

export interface TestUser {
	userId: string;
	username: string;
	token: string;
}

/** Mint a bearer token for a synthetic user without touching the DB. */
export async function mintToken(
	userId: string,
	username: string,
): Promise<string> {
	const secret = new TextEncoder().encode(DEV_JWT_SECRET);
	return new SignJWT({ sub: userId, username })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setIssuer("hallofshame.cc")
		.setAudience("hallofshame.cc")
		.setExpirationTime("1h")
		.sign(secret);
}

/** Create a bearer token for a fresh uniquely-named test user, also seeding the DB. */
export async function createTestUser(prefix = "testuser"): Promise<TestUser> {
	const userId = `test-${prefix}-${Date.now()}`;
	const username = `${prefix}_${Date.now()}`;
	await seedUserInDb(userId, username);
	const token = await mintToken(userId, username);
	return { userId, username, token };
}

export function authHeaders(token: string) {
	return { Authorization: `Bearer ${token}` };
}

/** Clear rate_limits table so tests don't get 429. */
export async function clearRateLimits(): Promise<void> {
	const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
	try {
		await fetch(`${base}/api/test/reset-rate-limits`, { method: "POST" });
	} catch {
		// Silently ignore — server may not be ready
	}
}
