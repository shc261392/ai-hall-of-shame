import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";

const JWT_EXPIRY = "15m";
const JWT_EXPIRY_SECONDS = 900; // Must match JWT_EXPIRY
const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "hallofshame.cc";
const JWT_AUDIENCE = "hallofshame.cc";

/** Refresh token expiry: 30 days for "remember me", 24 hours for session */
const REFRESH_EXPIRY_REMEMBER = 30 * 24 * 60 * 60; // 30 days in seconds
const REFRESH_EXPIRY_SESSION = 24 * 60 * 60; // 24 hours in seconds

interface JwtPayload {
	sub: string;
	username: string;
}

export async function signToken(
	userId: string,
	username: string,
	secret: string,
): Promise<string> {
	const key = new TextEncoder().encode(secret);
	return new SignJWT({ sub: userId, username } satisfies JwtPayload)
		.setProtectedHeader({ alg: JWT_ALGORITHM })
		.setIssuedAt()
		.setIssuer(JWT_ISSUER)
		.setAudience(JWT_AUDIENCE)
		.setExpirationTime(JWT_EXPIRY)
		.sign(key);
}

export async function verifyToken(
	token: string,
	secret: string,
): Promise<JwtPayload | null> {
	try {
		const key = new TextEncoder().encode(secret);
		const { payload } = await jwtVerify(token, key, {
			algorithms: [JWT_ALGORITHM],
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		});
		if (
			typeof payload.sub !== "string" ||
			typeof payload.username !== "string"
		) {
			return null;
		}
		return { sub: payload.sub, username: payload.username as string };
	} catch {
		return null;
	}
}

export function getAuthToken(request: Request): string | null {
	const header = request.headers.get("Authorization");
	if (!header?.startsWith("Bearer ")) return null;
	return header.slice(7);
}

export async function getAuthUser(
	request: Request,
	secret: string,
): Promise<JwtPayload | null> {
	const token = getAuthToken(request);
	if (!token) return null;
	return verifyToken(token, secret);
}

export async function hashBackupCode(code: string): Promise<string> {
	// Always normalize before hashing to support codes with or without dashes
	const normalized = normalizeBackupCode(code);
	const data = new TextEncoder().encode(normalized);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function verifyBackupCode(
	provided: string,
	storedHash: string,
): Promise<boolean> {
	const providedHash = await hashBackupCode(provided);
	const a = new TextEncoder().encode(providedHash);
	const b = new TextEncoder().encode(storedHash);
	if (a.byteLength !== b.byteLength) return false;
	return timingSafeEqual(a, b);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) return false;
	let result = 0;
	for (let i = 0; i < a.byteLength; i++) {
		result |= a[i] ^ b[i];
	}
	return result === 0;
}

export function generateBackupCode(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	for (let i = 0; i < 32; i++) {
		code += chars[bytes[i] % chars.length];
	}
	return code.match(/.{4}/g)!.join("-");
}

export function normalizeBackupCode(code: string): string {
	return code.replace(/-/g, "").toUpperCase();
}

// ── Refresh token utilities ──

async function hashRefreshToken(token: string): Promise<string> {
	const data = new TextEncoder().encode(token);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export interface TokenPair {
	token: string;
	refreshToken: string;
	expiresIn: number; // seconds until access token expires
}

/**
 * Create both access + refresh tokens for a user.
 * Stores the refresh token hash in D1.
 */
export async function createTokenPair(
	userId: string,
	username: string,
	secret: string,
	db: D1Database,
	remember: boolean,
): Promise<TokenPair> {
	const token = await signToken(userId, username, secret);
	const refreshToken = nanoid(48);
	const tokenHash = await hashRefreshToken(refreshToken);
	const refreshExpiry = remember
		? REFRESH_EXPIRY_REMEMBER
		: REFRESH_EXPIRY_SESSION;
	const expiresAt = Math.floor(Date.now() / 1000) + refreshExpiry;

	await db
		.prepare(
			"INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
		)
		.bind(nanoid(), userId, tokenHash, expiresAt)
		.run();

	return { token, refreshToken, expiresIn: JWT_EXPIRY_SECONDS };
}

/**
 * Rotate a refresh token: verify the old one, delete it, issue a new pair.
 * Returns null if the refresh token is invalid/expired.
 */
export async function rotateRefreshToken(
	refreshToken: string,
	secret: string,
	db: D1Database,
): Promise<(TokenPair & { userId: string; username: string }) | null> {
	const tokenHash = await hashRefreshToken(refreshToken);

	// Delete and return the token atomically
	const row = await db
		.prepare(
			"DELETE FROM refresh_tokens WHERE token_hash = ? AND expires_at > unixepoch() RETURNING user_id, expires_at",
		)
		.bind(tokenHash)
		.first<{ user_id: string; expires_at: number }>();

	if (!row) return null;

	// Look up user
	const user = await db
		.prepare("SELECT id, username FROM users WHERE id = ?")
		.bind(row.user_id)
		.first<{ id: string; username: string }>();

	if (!user) return null;

	// Calculate remaining time to preserve "remember" duration
	const remainingSeconds = row.expires_at - Math.floor(Date.now() / 1000);
	const isLongLived = remainingSeconds > REFRESH_EXPIRY_SESSION;

	const pair = await createTokenPair(
		user.id,
		user.username,
		secret,
		db,
		isLongLived,
	);
	return { ...pair, userId: user.id, username: user.username };
}

/**
 * Revoke all refresh tokens for a user (logout everywhere).
 */
export async function revokeRefreshTokens(
	db: D1Database,
	userId: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM refresh_tokens WHERE user_id = ?")
		.bind(userId)
		.run();
}

/**
 * Revoke a single refresh token.
 */
export async function revokeRefreshToken(
	db: D1Database,
	refreshToken: string,
): Promise<void> {
	const tokenHash = await hashRefreshToken(refreshToken);
	await db
		.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?")
		.bind(tokenHash)
		.run();
}
