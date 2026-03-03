import { json } from '@sveltejs/kit';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RequestHandler } from './$types';
import { signToken, verifyBackupCode, hashBackupCode, generateBackupCode } from '$lib/server/auth';
import { getClientIp, jsonError } from '$lib/server/middleware';
import { checkBan, checkRateLimit } from '$lib/server/ratelimit';

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform!.env.DB;
	const ip = getClientIp(request);
	const rpId = platform!.env.WEBAUTHN_RP_ID;

	// Rate limit recovery by IP (sensitive endpoint)
	const ban = await checkBan(db, `ip:${ip}`);
	if (ban.banned) {
		return jsonError(403, 'banned', `IP suspended. Ban expires: ${ban.expiresAt}`, { expires_at: ban.expiresAt });
	}
	const limit = await checkRateLimit(db, `ip:${ip}`, true);
	if (!limit.allowed) {
		return jsonError(429, 'rate_limited', `Too many requests. Retry in ${limit.retryAfterSeconds}s.`, {
			retry_after_seconds: limit.retryAfterSeconds
		});
	}

	let body: { backupCode: string; challengeId: string; attestation: unknown };
	try {
		body = await request.json();
	} catch {
		return jsonError(400, 'invalid_request', 'Invalid JSON body');
	}

	if (!body.backupCode || !body.challengeId || !body.attestation) {
		return jsonError(400, 'invalid_request', 'Missing backupCode, challengeId, or attestation');
	}

	// Normalize backup code: remove dashes, uppercase
	const normalizedCode = body.backupCode.replace(/-/g, '').toUpperCase();

	// Find credential with matching backup code
	const credentials = await db
		.prepare('SELECT id, user_id, backup_key_hash FROM passkey_credentials WHERE backup_key_hash IS NOT NULL')
		.all<{ id: string; user_id: string; backup_key_hash: string }>();

	let matchedCredential: { id: string; user_id: string; backup_key_hash: string } | null = null;
	for (const cred of credentials.results) {
		if (await verifyBackupCode(normalizedCode, cred.backup_key_hash)) {
			matchedCredential = cred;
			break;
		}
	}

	if (!matchedCredential) {
		return jsonError(400, 'invalid_backup_code', 'Backup code is invalid or has already been used');
	}

	// Consume challenge atomically
	const challengeRow = await db
		.prepare('DELETE FROM challenges WHERE id = ? AND purpose = ? AND ip_address = ? AND expires_at > unixepoch() RETURNING challenge')
		.bind(body.challengeId, 'registration', ip)
		.first<{ challenge: string }>();

	if (!challengeRow) {
		return jsonError(400, 'invalid_challenge', 'Challenge expired, already used, or IP mismatch');
	}

	// Verify new passkey registration
	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response: body.attestation as Parameters<typeof verifyRegistrationResponse>[0]['response'],
			expectedChallenge: challengeRow.challenge,
			expectedOrigin: `https://${rpId}`,
			expectedRPID: rpId,
			requireUserVerification: true
		});
	} catch (e) {
		return jsonError(400, 'verification_failed', `Registration verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
	}

	if (!verification.verified || !verification.registrationInfo) {
		return jsonError(400, 'verification_failed', 'Registration verification failed');
	}

	const { credential } = verification.registrationInfo;
	const newCredentialId = credential.id;
	const newBackupCode = generateBackupCode();
	const newBackupCodeHash = await hashBackupCode(newBackupCode);

	// Replace old credential with new one
	await db.batch([
		db.prepare('DELETE FROM passkey_credentials WHERE id = ?').bind(matchedCredential.id),
		db
			.prepare(
				'INSERT INTO passkey_credentials (id, user_id, public_key, counter, transports, backup_key_hash) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.bind(
				newCredentialId,
				matchedCredential.user_id,
				[...credential.publicKey],
				credential.counter,
				JSON.stringify(credential.transports || []),
				newBackupCodeHash
			)
	]);

	// Get user info
	const user = await db
		.prepare('SELECT id, username FROM users WHERE id = ?')
		.bind(matchedCredential.user_id)
		.first<{ id: string; username: string }>();

	if (!user) {
		return jsonError(500, 'user_not_found', 'User record not found');
	}

	const token = await signToken(user.id, user.username, platform!.env.JWT_SECRET);

	return json({
		token,
		userId: user.id,
		username: user.username,
		backupCode: newBackupCode,
		message: 'Account recovered! Save your NEW backup code — it will never be shown again.'
	});
};
