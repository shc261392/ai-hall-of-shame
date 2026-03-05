import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { nanoid } from "nanoid";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RequestHandler } from "./$types";
import {
	createTokenPair,
	hashBackupCode,
	generateBackupCode,
	normalizeBackupCode,
} from "$lib/server/auth";
import { generateUniqueUsername } from "$lib/server/username";
import { getClientIp, jsonError } from "$lib/server/middleware";
import { checkBan, checkRateLimit } from "$lib/server/ratelimit";

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform!.env.DB;
	const ip = getClientIp(request);
	const rpId = platform!.env.WEBAUTHN_RP_ID;
	const rpName = platform!.env.WEBAUTHN_RP_NAME;
	const expectedOrigin =
		platform!.env.WEBAUTHN_ORIGIN ?? (dev ? "http://localhost:5173" : `https://${rpId}`);

	// Rate limit registration by IP
	const ban = await checkBan(db, `ip:${ip}`);
	if (ban.banned) {
		return jsonError(403, "banned", `IP suspended. Ban expires: ${ban.expiresAt}`, {
			expires_at: ban.expiresAt,
		});
	}
	const limit = await checkRateLimit(db, `ip:${ip}`, "heavy");
	if (!limit.allowed) {
		return jsonError(
			429,
			"rate_limited",
			`Too many requests. Retry in ${limit.retryAfterSeconds}s.`,
			{
				retry_after_seconds: limit.retryAfterSeconds,
			},
		);
	}

	let body: { challengeId: string; attestation: unknown };
	try {
		body = await request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	if (!body.challengeId || !body.attestation) {
		return jsonError(400, "invalid_request", "Missing challengeId or attestation");
	}

	// Consume challenge atomically
	const challengeRow = await db
		.prepare(
			"DELETE FROM challenges WHERE id = ? AND purpose = ? AND ip_address = ? AND expires_at > unixepoch() RETURNING challenge",
		)
		.bind(body.challengeId, "registration", ip)
		.first<{ challenge: string }>();

	if (!challengeRow) {
		return jsonError(400, "invalid_challenge", "Challenge expired, already used, or IP mismatch");
	}

	let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
	try {
		verification = await verifyRegistrationResponse({
			response: body.attestation as Parameters<typeof verifyRegistrationResponse>[0]["response"],
			expectedChallenge: challengeRow.challenge,
			expectedOrigin,
			expectedRPID: rpId,
			requireUserVerification: true,
		});
	} catch (e) {
		return jsonError(
			400,
			"verification_failed",
			`Registration verification failed: ${e instanceof Error ? e.message : "Unknown error"}`,
		);
	}

	if (!verification.verified || !verification.registrationInfo) {
		return jsonError(400, "verification_failed", "Registration verification failed");
	}

	const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

	// Create user
	const userId = nanoid();
	const credentialIdBase64 = credential.id;
	const username = await generateUniqueUsername(credentialIdBase64, db);
	const backupCode = generateBackupCode();
	const backupCodeHash = await hashBackupCode(backupCode);

	await db.batch([
		db.prepare("INSERT INTO users (id, username) VALUES (?, ?)").bind(userId, username),
		db
			.prepare(
				"INSERT INTO passkey_credentials (id, user_id, public_key, counter, transports, backup_key_hash) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind(
				credentialIdBase64,
				userId,
				[...credential.publicKey],
				credential.counter,
				JSON.stringify(credential.transports || []),
				backupCodeHash,
			),
	]);

	const remember = !!(body as { remember?: boolean }).remember;
	const pair = await createTokenPair(userId, username, platform!.env.JWT_SECRET, db, remember);

	return json({
		token: pair.token,
		refreshToken: pair.refreshToken,
		expiresIn: pair.expiresIn,
		userId,
		username,
		backupCode,
		message: "Account created! Save your backup code — it will never be shown again.",
	});
};
