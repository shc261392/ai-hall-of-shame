import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async () => {
	const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /submit

Sitemap: https://hallofshame.cc/sitemap.xml`;

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
