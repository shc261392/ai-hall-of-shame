import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import type { RequestHandler } from "./$types";
import { getClientIp, jsonError } from "$lib/server/middleware";

export const GET: RequestHandler = async ({ request, platform, url }) => {
	const db = platform!.env.DB;
	const ip = getClientIp(request);
	const purpose = url.searchParams.get("purpose");

	if (purpose !== "registration" && purpose !== "authentication") {
		return jsonError(
			400,
			"invalid_request",
			'Query param "purpose" must be "registration" or "authentication"',
		);
	}

	// Generate challenge
	const challengeBytes = new Uint8Array(32);
	crypto.getRandomValues(challengeBytes);
	const challenge = btoa(String.fromCharCode(...challengeBytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	const challengeId = nanoid();

	// Clean up expired challenges opportunistically, then insert new one
	await db.batch([
		db.prepare("DELETE FROM challenges WHERE expires_at < unixepoch()"),
		db
			.prepare(
				"INSERT INTO challenges (id, challenge, ip_address, purpose) VALUES (?, ?, ?, ?)",
			)
			.bind(challengeId, challenge, ip, purpose),
	]);

	return json({ challengeId, challenge });
};
