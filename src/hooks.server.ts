import type { Handle } from "@sveltejs/kit";

const ALLOWED_ORIGIN = "https://hallofshame.cc";

/**
 * Cache-Control TTLs for SSR pages.
 * Set as response headers — Cloudflare's edge cache respects these natively.
 *
 * We intentionally do NOT use the Workers Cache API (`caches.default`) because:
 * 1. It creates a double-cache layer with CF's outer CDN cache, risking cache
 *    poisoning (e.g. SvelteKit __data.json responses cached and served as HTML).
 * 2. It doesn't distinguish between HTML and data requests on the same URL.
 * 3. Cache-Control headers give us the same edge caching with zero risk.
 */
const SSR_CACHE_RULES: [RegExp, number][] = [
	[/^\/sitemap\.xml$/, 3600], // 1 hour
	[/^\/$/, 60], // 60 seconds
	[/^\/post\/[^/]+$/, 300], // 5 minutes
];

function getCacheTTL(pathname: string): number | null {
	for (const [pattern, ttl] of SSR_CACHE_RULES) {
		if (pattern.test(pathname)) return ttl;
	}
	return null;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Handle OPTIONS preflight requests without hitting route logic
	if (event.request.method === "OPTIONS" && event.url.pathname.startsWith("/api/")) {
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

	// Add CORS headers to all API responses (clone to handle immutable headers from DO SSE)
	if (event.url.pathname.startsWith("/api/")) {
		const headers = new Headers(response.headers);
		headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	// Set Cache-Control on SSR HTML pages — only for actual HTML (not __data.json)
	if (
		event.request.method === "GET" &&
		response.ok &&
		response.headers.get("content-type")?.includes("text/html")
	) {
		const ttl = getCacheTTL(event.url.pathname);
		if (ttl !== null) {
			const headers = new Headers(response.headers);
			headers.set("Cache-Control", `public, s-maxage=${ttl}, max-age=0`);
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		}
	}

	return response;
};
