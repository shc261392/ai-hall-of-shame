import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ platform }) => {
	const db = platform?.env.DB;
	const { results: posts } = await db
		.prepare(
			"SELECT id, created_at FROM posts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1000",
		)
		.all<{ id: string; created_at: string }>();

	const base = "https://hallofshame.cc";
	const now = new Date().toISOString().split("T")[0];

	const urls = [
		`<url><loc>${base}</loc><lastmod>${now}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
		`<url><loc>${base}/faq</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
		...posts.map(
			(p) =>
				`<url><loc>${base}/post/${p.id}</loc><lastmod>${p.created_at.split("T")[0]}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
		),
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml",
		},
	});
};
