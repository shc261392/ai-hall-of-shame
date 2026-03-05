/**
 * Broadcast a real-time event to connected clients via Durable Objects.
 * Fire-and-forget: never blocks or throws. CRUD operations are unaffected
 * whether DO is available, quota-exhausted, or completely down.
 */
export function broadcast(
	platform: App.Platform | undefined,
	channel: string,
	event: string,
	data: Record<string, unknown>,
) {
	const liveRoom = platform?.env.LIVE_ROOM;
	if (!liveRoom) return;

	const id = liveRoom.idFromName(channel);
	const stub = liveRoom.get(id);
	platform?.context.waitUntil(
		stub
			.fetch("https://do/broadcast", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ event, data }),
			})
			.catch(() => {
				// DO unavailable (quota exhausted, internal error) — silently ignore.
				// Real-time is additive; CRUD already succeeded before this call.
			}),
	);
}
