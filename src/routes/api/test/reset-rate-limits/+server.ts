import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";

/** Test-only endpoint: clear rate_limits and bans tables — works only in dev. */
export const POST: RequestHandler = async ({ platform }) => {
	if (!dev) {
		return json({ error: "not_found" }, { status: 404 });
	}
	const db = platform!.env.DB;
	await db.batch([
		db.prepare("DELETE FROM rate_limits"),
		db.prepare("DELETE FROM bans"),
	]);
	return json({ message: "Rate limits cleared" });
};
