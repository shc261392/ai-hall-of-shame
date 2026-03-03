import { SignJWT, jwtVerify } from 'jose';

const JWT_EXPIRY = '7d';
const JWT_ALGORITHM = 'HS256';

interface JwtPayload {
	sub: string;
	username: string;
}

export async function signToken(
	userId: string,
	username: string,
	secret: string
): Promise<string> {
	const key = new TextEncoder().encode(secret);
	return new SignJWT({ sub: userId, username } satisfies JwtPayload)
		.setProtectedHeader({ alg: JWT_ALGORITHM })
		.setIssuedAt()
		.setExpirationTime(JWT_EXPIRY)
		.sign(key);
}

export async function verifyToken(
	token: string,
	secret: string
): Promise<JwtPayload | null> {
	try {
		const key = new TextEncoder().encode(secret);
		const { payload } = await jwtVerify(token, key, {
			algorithms: [JWT_ALGORITHM]
		});
		if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') {
			return null;
		}
		return { sub: payload.sub, username: payload.username as string };
	} catch {
		return null;
	}
}

export function getAuthToken(request: Request): string | null {
	const header = request.headers.get('Authorization');
	if (!header?.startsWith('Bearer ')) return null;
	return header.slice(7);
}

export async function getAuthUser(
	request: Request,
	secret: string
): Promise<JwtPayload | null> {
	const token = getAuthToken(request);
	if (!token) return null;
	return verifyToken(token, secret);
}

export async function hashBackupCode(code: string): Promise<string> {
	const data = new TextEncoder().encode(code);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function verifyBackupCode(
	provided: string,
	storedHash: string
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
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 32; i++) {
		code += chars[bytes[i % 24] % chars.length];
	}
	return code.match(/.{4}/g)!.join('-');
}
