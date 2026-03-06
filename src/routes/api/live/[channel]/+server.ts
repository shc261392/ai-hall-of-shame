import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/** How long to keep events before cleanup (5 minutes). */
const EVENT_TTL_MS = 5 * 60 * 1_000;
/** Probability of triggering cleanup on each poll (1%). */
const CLEANUP_CHANCE = 0.01;

export const GET: RequestHandler = async (event) => {
	const { channel } = event.params;
	const db = event.platform?.env.DB;

	// Channel validation: "feed" or "post:{nanoid}"
	if (channel !== "feed" && !/^post:[A-Za-z0-9_-]{21}$/.test(channel)) {
		return new Response("Invalid channel", { status: 400 });
	}

	if (!db) {
		return json({ events: [], serverTime: new Date().toISOString() });
	}

	const since = event.url.searchParams.get("since") || new Date(Date.now() - 60_000).toISOString();

	const result = await db
		.prepare(
			"SELECT event, data, created_at FROM live_events WHERE channel = ? AND created_at > ? ORDER BY id ASC LIMIT 50",
		)
		.bind(channel, since)
		.all();

	// Probabilistic cleanup of expired events
	if (Math.random() < CLEANUP_CHANCE) {
		const cutoff = new Date(Date.now() - EVENT_TTL_MS).toISOString();
		event.platform?.context.waitUntil(
			db
				.prepare("DELETE FROM live_events WHERE created_at < ?")
				.bind(cutoff)
				.run()
				.catch(() => {}),
		);
	}

	return json({
		events: result.results.map((r) => ({
			event: r.event as string,
			data: JSON.parse(r.data as string),
		})),
		serverTime: new Date().toISOString(),
	});
};
