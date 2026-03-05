import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getEnv, guardGet } from "$lib/server/middleware";

/** Return top 10 tags by post count. */
export const GET: RequestHandler = async (event) => {
	const guard = await guardGet(event);
	if ("error" in guard && guard.error) return guard.error;

	const db = getEnv(event.platform).DB;

	const { results } = await db
		.prepare(
			`SELECT pt.tag, COUNT(*) as count
			FROM post_tags pt
			JOIN posts p ON pt.post_id = p.id
			WHERE p.deleted_at IS NULL
			GROUP BY pt.tag
			ORDER BY count DESC
			LIMIT 10`,
		)
		.all<{ tag: string; count: number }>();

	return json(
		{ tags: results },
		{
			headers: {
				"Cache-Control": "public, s-maxage=300, max-age=0",
			},
		},
	);
};
