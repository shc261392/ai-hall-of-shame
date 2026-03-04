/**
 * Auth helpers for E2E tests.
 *
 * Creates JWTs and seeds test users directly against the local dev server.
 * The JWT_SECRET must match the value in .dev.vars.
 */
import { SignJWT } from "jose";
import { readdirSync } from "fs";
import { join, resolve } from "path";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);

const DEV_JWT_SECRET =
	process.env.TEST_JWT_SECRET ?? "CyAhlMouMSZ3Cezj6opc6hqHBWBFEdFtxXzYCJRXGQQ=";

// Path to the local Miniflare D1 SQLite file
const D1_DIR = resolve(
	process.cwd(),
	".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);

function getLocalDbPath(): string | null {
	try {
		const files = readdirSync(D1_DIR).filter((f) => f.endsWith(".sqlite"));
		return files.length > 0 ? join(D1_DIR, files[0]) : null;
	} catch {
		return null;
	}
}

/** Insert a user row into the local D1 SQLite DB (no-op if not found). */
function seedUserInDb(userId: string, username: string): void {
	const dbPath = getLocalDbPath();
	if (!dbPath) return;
	try {
		// node:sqlite is available in Node 22.5+
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { DatabaseSync } = _require("node:sqlite") as {
			DatabaseSync: new (
				path: string,
			) => {
				exec: (sql: string) => void;
				prepare: (sql: string) => { run: (...args: unknown[]) => void };
				close: () => void;
			};
		};
		const db = new DatabaseSync(dbPath);
		db.prepare("INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)").run(
			userId,
			username,
		);
		db.close();
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
		.setExpirationTime("1h")
		.sign(secret);
}

/** Create a bearer token for a fresh uniquely-named test user, also seeding the DB. */
export async function createTestUser(prefix = "testuser"): Promise<TestUser> {
	const userId = `test-${prefix}-${Date.now()}`;
	const username = `${prefix}_${Date.now()}`;
	seedUserInDb(userId, username);
	const token = await mintToken(userId, username);
	return { userId, username, token };
}

export function authHeaders(token: string) {
	return { Authorization: `Bearer ${token}` };
}
