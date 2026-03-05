import type { Handle } from "@sveltejs/kit";

const ALLOWED_ORIGIN = "https://hallofshame.cc";

// Edge cache TTLs in seconds — matched top-to-bottom
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

/** Normalize cache key to prevent cache pollution from random query params */
function getCacheKey(url: URL): string {
	const pathname = url.pathname;
	if (pathname === "/") {
		const sort = url.searchParams.get("sort") || "trending";
		return `${url.origin}/?sort=${sort}`;
	}
	// sitemap and post detail: path only, no query params
	return `${url.origin}${pathname}`;
}

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

	// Edge caching for SSR pages and sitemap (CF Cache API)
	if (event.request.method === "GET" && typeof caches !== "undefined") {
		const ttl = getCacheTTL(event.url.pathname);
		if (ttl !== null) {
			const cache = (caches as any).default as Cache;
			const cacheKey = new Request(getCacheKey(event.url), {
				method: "GET",
			});

			const cached = await cache.match(cacheKey);
			if (cached) return cached;

			const response = await resolve(event);

			if (response.ok) {
				const headers = new Headers(response.headers);
				headers.set("Cache-Control", `public, max-age=${ttl}`);

				const enhanced = new Response(response.clone().body, {
					status: response.status,
					statusText: response.statusText,
					headers,
				});

				event.platform?.context.waitUntil(
					cache.put(cacheKey, enhanced.clone()),
				);
				return enhanced;
			}

			return response;
		}
	}

	const response = await resolve(event);

	// Add CORS headers to all API responses
	if (event.url.pathname.startsWith("/api/")) {
		response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
	}

	return response;
};
