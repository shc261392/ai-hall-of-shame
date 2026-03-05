import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	const { channel } = event.params;
	const liveRoom = event.platform?.env.LIVE_ROOM;

	// Channel validation: "feed" or "post:{nanoid}"
	if (channel !== "feed" && !/^post:[A-Za-z0-9_-]{21}$/.test(channel)) {
		return new Response("Invalid channel", { status: 400 });
	}

	if (!liveRoom) {
		return new Response("Real-time not available", { status: 404 });
	}

	try {
		const id = liveRoom.idFromName(channel);
		const stub = liveRoom.get(id);

		// Proxy the SSE subscribe request to the Durable Object
		const response = await stub.fetch("https://do/subscribe", {
			method: "GET",
			headers: event.request.headers,
		});

		// If DO returned an error (e.g. 429 quota exceeded, 503 overloaded),
		// pass it through so the client circuit breaker can track failures.
		if (!response.ok) {
			return new Response("Real-time not available", {
				status: response.status,
			});
		}

		return response;
	} catch {
		// DO binding exists but unreachable (quota exhausted, internal error)
		return new Response("Real-time not available", { status: 503 });
	}
};
