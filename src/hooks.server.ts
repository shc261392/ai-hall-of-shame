import type { Handle } from "@sveltejs/kit";

const ALLOWED_ORIGIN = "https://hallofshame.cc";

export const handle: Handle = async ({ event, resolve }) => {
	// Handle OPTIONS preflight requests without hitting route logic
	if (
		event.request.method === "OPTIONS" &&
		event.url.pathname.startsWith("/api/")
	) {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": ALLOWED_ORIGIN,
				"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400",
			},
		});
	}

	const response = await resolve(event);

	// Add CORS headers to all API responses
	if (event.url.pathname.startsWith("/api/")) {
		response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
	}

	return response;
};
