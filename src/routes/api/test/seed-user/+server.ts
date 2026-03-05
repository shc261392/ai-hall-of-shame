import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";

/** Test-only endpoint: seed a user into the DB — works only in dev. */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!dev) {
		return json({ error: "not_found" }, { status: 404 });
	}
	const { userId, username } = (await request.json()) as {
		userId: string;
		username: string;
	};
	const db = platform!.env.DB;
	await db
		.prepare("INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)")
		.bind(userId, username)
		.run();
	return json({ message: "User seeded" });
};
