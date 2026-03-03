import { json } from "@sveltejs/kit";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { RequestHandler } from "./$types";
import { signToken } from "$lib/server/auth";
import { getClientIp, jsonError } from "$lib/server/middleware";
import { checkBan, checkRateLimit } from "$lib/server/ratelimit";

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform!.env.DB;
	const ip = getClientIp(request);
	const rpId = platform!.env.WEBAUTHN_RP_ID;

	// Rate limit by IP
	const ban = await checkBan(db, `ip:${ip}`);
	if (ban.banned) {
		return jsonError(
			403,
			"banned",
			`IP suspended. Ban expires: ${ban.expiresAt}`,
			{ expires_at: ban.expiresAt },
		);
	}
	const limit = await checkRateLimit(db, `ip:${ip}`, true);
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

	let body: { challengeId: string; assertion: unknown };
	try {
		body = await request.json();
	} catch {
		return jsonError(400, "invalid_request", "Invalid JSON body");
	}

	if (!body.challengeId || !body.assertion) {
		return jsonError(
			400,
			"invalid_request",
			"Missing challengeId or assertion",
		);
	}

	// Consume challenge atomically
	const challengeRow = await db
		.prepare(
			"DELETE FROM challenges WHERE id = ? AND purpose = ? AND ip_address = ? AND expires_at > unixepoch() RETURNING challenge",
		)
		.bind(body.challengeId, "authentication", ip)
		.first<{ challenge: string }>();

	if (!challengeRow) {
		return jsonError(
			400,
			"invalid_challenge",
			"Challenge expired, already used, or IP mismatch",
		);
	}

	// Look up credential
	const assertion = body.assertion as { id?: string; rawId?: string };
	const credentialIdBase64 = assertion.id || assertion.rawId || "";
	const credential = await db
		.prepare(
			"SELECT id, user_id, public_key, counter, transports FROM passkey_credentials WHERE id = ?",
		)
		.bind(credentialIdBase64)
		.first<{
			id: string;
			user_id: string;
			public_key: string;
			counter: number;
			transports: string;
		}>();

	if (!credential) {
		return jsonError(
			400,
			"credential_not_found",
			"No passkey found for this credential",
		);
	}

	// Parse stored public key - it's stored as a comma-separated byte array
	const publicKeyBytes = new Uint8Array(
		credential.public_key.split(",").map(Number),
	);

	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response: body.assertion as Parameters<
				typeof verifyAuthenticationResponse
			>[0]["response"],
			expectedChallenge: challengeRow.challenge,
			expectedOrigin: `https://${rpId}`,
			expectedRPID: rpId,
			requireUserVerification: true,
			credential: {
				id: credential.id,
				publicKey: publicKeyBytes,
				counter: credential.counter,
				transports: JSON.parse(credential.transports || "[]"),
			},
		});
	} catch (e) {
		return jsonError(
			400,
			"verification_failed",
			`Authentication verification failed: ${e instanceof Error ? e.message : "Unknown error"}`,
		);
	}

	if (!verification.verified) {
		return jsonError(
			400,
			"verification_failed",
			"Authentication verification failed",
		);
	}

	// Update counter
	await db
		.prepare("UPDATE passkey_credentials SET counter = ? WHERE id = ?")
		.bind(verification.authenticationInfo.newCounter, credential.id)
		.run();

	// Get user
	const user = await db
		.prepare("SELECT id, username FROM users WHERE id = ?")
		.bind(credential.user_id)
		.first<{ id: string; username: string }>();

	if (!user) {
		return jsonError(500, "user_not_found", "User record not found");
	}

	const token = await signToken(
		user.id,
		user.username,
		platform!.env.JWT_SECRET,
	);

	return json({
		token,
		userId: user.id,
		username: user.username,
	});
};
