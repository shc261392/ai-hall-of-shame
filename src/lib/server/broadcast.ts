/**
 * Broadcast a real-time event by inserting into the `live_events` D1 table.
 * Clients poll this table for updates — no Durable Objects needed.
 * Fire-and-forget: never blocks or throws. CRUD operations are unaffected
 * whether the insert succeeds or fails.
 */
export function broadcast(
	platform: App.Platform | undefined,
	channel: string,
	event: string,
	data: Record<string, unknown>,
) {
	const db = platform?.env.DB;
	if (!db) return;

	platform!.context.waitUntil(
		db
			.prepare("INSERT INTO live_events (channel, event, data) VALUES (?, ?, ?)")
			.bind(channel, event, JSON.stringify(data))
			.run()
			.catch(() => {
				// DB error — silently ignore.
				// Real-time is additive; CRUD already succeeded before this call.
			}),
	);
}
