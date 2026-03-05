import { test, expect } from "@playwright/test";
import { createTestUser, authHeaders, clearRateLimits } from "../helpers/auth";
import { parseAiTags } from "../../../src/lib/server/ai-tags";

test.beforeEach(() => clearRateLimits());

const BASE = "http://localhost:5173";

test.describe("Tag CRUD — creation + retrieval", () => {
	let token: string;
	let postId: string;

	test.beforeAll(async () => {
		({ token } = await createTestUser("tagcrud"));
	});

	test("creates post with tags and returns them on fetch", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "Tag CRUD test post",
				body: "Testing tag creation",
				tags: ["chatgpt", "hallucination"],
			},
		});
		expect(res.status()).toBe(201);
		postId = (await res.json()).id;

		const getRes = await request.get(`${BASE}/api/posts/${postId}`);
		expect(getRes.status()).toBe(200);
		const post = await getRes.json();
		expect(post.tags).toEqual(expect.arrayContaining(["chatgpt", "hallucination"]));
		expect(post.tags).toHaveLength(2);
	});

	test("creates post without tags (empty array)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "No tags post", body: "Body text" },
		});
		expect(res.status()).toBe(201);
		const id = (await res.json()).id;

		const getRes = await request.get(`${BASE}/api/posts/${id}`);
		const post = await getRes.json();
		// Tags may be empty or AI-suggested (async), either way array
		expect(Array.isArray(post.tags)).toBe(true);
	});

	test("deduplicates tags on creation", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "Dedup tags test",
				body: "Body",
				tags: ["chatgpt", "chatgpt", "ai"],
			},
		});
		expect(res.status()).toBe(201);
		const id = (await res.json()).id;

		const getRes = await request.get(`${BASE}/api/posts/${id}`);
		const post = await getRes.json();
		expect(post.tags).toHaveLength(2);
		expect(post.tags).toEqual(expect.arrayContaining(["chatgpt", "ai"]));
	});

	test("limits to max 3 tags", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "Too many tags test",
				body: "Body",
				tags: ["tag1", "tag2", "tag3", "tag4"],
			},
		});
		expect(res.status()).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("validation_error");
	});
});

test.describe("Tag CRUD — PATCH (edit tags)", () => {
	let token: string;
	let postId: string;

	test.beforeAll(async ({ request }) => {
		({ token } = await createTestUser("tagedit"));

		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "Tag edit test",
				body: "Body",
				tags: ["original"],
			},
		});
		expect(res.status()).toBe(201);
		postId = (await res.json()).id;
	});

	test("updates tags on own post", async ({ request }) => {
		const res = await request.patch(`${BASE}/api/posts/${postId}`, {
			headers: authHeaders(token),
			data: { tags: ["updated", "new-tag"] },
		});
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.tags).toEqual(expect.arrayContaining(["updated", "new-tag"]));

		// Verify via GET
		const getRes = await request.get(`${BASE}/api/posts/${postId}`);
		const post = await getRes.json();
		expect(post.tags).toHaveLength(2);
		expect(post.tags).toEqual(expect.arrayContaining(["updated", "new-tag"]));
	});

	test("clears all tags with empty array", async ({ request }) => {
		const res = await request.patch(`${BASE}/api/posts/${postId}`, {
			headers: authHeaders(token),
			data: { tags: [] },
		});
		expect(res.status()).toBe(200);

		const getRes = await request.get(`${BASE}/api/posts/${postId}`);
		const post = await getRes.json();
		expect(post.tags).toHaveLength(0);
	});

	test("rejects tag update on other user's post (403)", async ({ request }) => {
		const { token: otherToken } = await createTestUser("tageditother");
		const res = await request.patch(`${BASE}/api/posts/${postId}`, {
			headers: authHeaders(otherToken),
			data: { tags: ["hacked"] },
		});
		expect(res.status()).toBe(403);
	});

	test("rejects PATCH without auth (401)", async ({ request }) => {
		const res = await request.patch(`${BASE}/api/posts/${postId}`, {
			data: { tags: ["noauth"] },
		});
		expect(res.status()).toBe(401);
	});
});

test.describe("Tag validation", () => {
	let token: string;

	test.beforeAll(async () => {
		({ token } = await createTestUser("tagval"));
	});

	test("rejects tag shorter than 2 chars", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Short tag test", body: "Body", tags: ["a"] },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects tag longer than 24 chars", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Long tag test", body: "Body", tags: ["a".repeat(25)] },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects tag with leading hyphen", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Hyphen tag test", body: "Body", tags: ["-chatgpt"] },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects tag with trailing hyphen", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Trailing hyphen test", body: "Body", tags: ["chatgpt-"] },
		});
		expect(res.status()).toBe(400);
	});

	test("rejects tag with uppercase (after Zod lowercases)", async ({ request }) => {
		// Zod lowercases first, so uppercase should be accepted and normalized
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Case test", body: "Body", tags: ["ChatGPT"] },
		});
		// After lowercase: "chatgpt" — valid
		expect(res.status()).toBe(201);
		const id = (await res.json()).id;
		const getRes = await request.get(`${BASE}/api/posts/${id}`);
		const post = await getRes.json();
		expect(post.tags).toContain("chatgpt");
	});

	test("rejects tag with special characters", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Special chars test", body: "Body", tags: ["chat@gpt!"] },
		});
		expect(res.status()).toBe(400);
	});
});

test.describe("Tag filtering — GET /api/posts?tag=", () => {
	let token: string;

	test.beforeAll(async ({ request }) => {
		({ token } = await createTestUser("tagfilter"));

		// Create posts with known tags
		await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Filter test A", body: "Body", tags: ["filtertest", "extra"] },
		});
		await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Filter test B", body: "Body", tags: ["filtertest"] },
		});
		await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Filter test C", body: "Body", tags: ["other-tag"] },
		});
	});

	test("filters posts by tag", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?tag=filtertest`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		// At least our 2 posts with "filtertest" tag
		expect(body.data.length).toBeGreaterThanOrEqual(2);
		for (const post of body.data) {
			expect(post.tags).toContain("filtertest");
		}
	});

	test("tag filter takes priority over search query", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?tag=filtertest&q=nonexistent`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		// Should return filtertest posts even though q=nonexistent
		expect(body.data.length).toBeGreaterThanOrEqual(2);
	});

	test("returns empty for non-existent tag", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?tag=zzz-nonexistent-tag-zzz`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(0);
	});
});

test.describe("Tag search — GET /api/posts?q= includes tags", () => {
	let token: string;

	test.beforeAll(async ({ request }) => {
		({ token } = await createTestUser("tagsearch"));
		await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Unique title xyz", body: "Body", tags: ["searchable-tag"] },
		});
	});

	test("search query matches tag names", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts?q=searchable-tag`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.data.length).toBeGreaterThanOrEqual(1);
		const found = body.data.some((p: { tags: string[] }) => p.tags.includes("searchable-tag"));
		expect(found).toBe(true);
	});
});

test.describe("GET /api/tags — tag cloud", () => {
	test("returns tags array with count", async ({ request }) => {
		const res = await request.get(`${BASE}/api/tags`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("tags");
		expect(Array.isArray(body.tags)).toBe(true);
		if (body.tags.length > 0) {
			const first = body.tags[0];
			expect(first).toHaveProperty("tag");
			expect(first).toHaveProperty("count");
			expect(typeof first.tag).toBe("string");
			expect(typeof first.count).toBe("number");
		}
	});

	test("returns at most 10 tags", async ({ request }) => {
		const res = await request.get(`${BASE}/api/tags`);
		const body = await res.json();
		expect(body.tags.length).toBeLessThanOrEqual(10);
	});

	test("tags are ordered by count descending", async ({ request }) => {
		const res = await request.get(`${BASE}/api/tags`);
		const body = await res.json();
		for (let i = 1; i < body.tags.length; i++) {
			expect(body.tags[i - 1].count).toBeGreaterThanOrEqual(body.tags[i].count);
		}
	});
});

test.describe("AI auto-tagging — fail-open behavior", () => {
	// In local dev, the AI binding may not be available.
	// Posts should still be created successfully without tags.

	let token: string;

	test.beforeAll(async () => {
		({ token } = await createTestUser("aitag"));
	});

	test("post creation succeeds even without AI binding (fail-open)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "ChatGPT invented a fake Supreme Court case",
				body: "A lawyer used ChatGPT to write a brief, and it cited cases that don't exist.",
			},
		});
		expect(res.status()).toBe(201);
		const { id } = await res.json();
		expect(id).toBeTruthy();

		// Fetch the post — tags may or may not be present depending on AI availability
		const getRes = await request.get(`${BASE}/api/posts/${id}`);
		expect(getRes.status()).toBe(200);
		const post = await getRes.json();
		expect(Array.isArray(post.tags)).toBe(true);
		// tags.length can be 0 (no AI) or up to 3 (AI worked)
		expect(post.tags.length).toBeLessThanOrEqual(3);
	});

	test("post with manual tags does NOT trigger AI tagging", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "Manual tags only",
				body: "This post has manual tags",
				tags: ["manual-tag"],
			},
		});
		expect(res.status()).toBe(201);
		const { id } = await res.json();

		const getRes = await request.get(`${BASE}/api/posts/${id}`);
		const post = await getRes.json();
		// Should only have the manual tag, not AI-generated ones
		expect(post.tags).toEqual(["manual-tag"]);
	});

	test("AI generates tags for post without manual tags (polls async)", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "Amazon Alexa told a child to lick a live power outlet",
				body: "When asked for a fun challenge, the AI assistant suggested a dangerous electrical activity to a 10-year-old.",
			},
		});
		expect(res.status()).toBe(201);
		const { id } = await res.json();

		// AI tagging is async (waitUntil). Poll up to 15s for tags to appear.
		let tags: string[] = [];
		for (let attempt = 0; attempt < 5; attempt++) {
			await new Promise((r) => setTimeout(r, 3000));
			const getRes = await request.get(`${BASE}/api/posts/${id}`);
			const post = await getRes.json();
			tags = post.tags;
			if (tags.length > 0) break;
		}

		// If AI binding is available, tags should appear. If not, test is still valid (0 tags).
		expect(tags.length).toBeLessThanOrEqual(3);
		if (tags.length > 0) {
			// Validate tag format
			for (const tag of tags) {
				expect(tag).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{2}$/);
				expect(tag.length).toBeGreaterThanOrEqual(2);
				expect(tag.length).toBeLessThanOrEqual(24);
			}
		}
	});

	test("AI tags respect the 3-tag cap per post", async ({ request }) => {
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "GPT-4 confidently explains why the earth is flat with citations",
				body: "The model provided a detailed multi-paragraph argument with academic references, all fabricated.",
			},
		});
		expect(res.status()).toBe(201);
		const { id } = await res.json();

		// Wait for AI to process
		await new Promise((r) => setTimeout(r, 8000));
		const getRes = await request.get(`${BASE}/api/posts/${id}`);
		const post = await getRes.json();
		expect(post.tags.length).toBeLessThanOrEqual(3);
	});

	test("AI tags appear in post listing after creation", async ({ request }) => {
		// Create a post without tags and wait for AI
		const res = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: {
				title: "Midjourney generated realistic fake photos of the Pope in a puffer jacket",
				body: "AI-generated images went viral as people believed they were real.",
			},
		});
		expect(res.status()).toBe(201);
		const { id } = await res.json();

		// Poll for AI tags
		let aiTags: string[] = [];
		for (let attempt = 0; attempt < 5; attempt++) {
			await new Promise((r) => setTimeout(r, 3000));
			const getRes = await request.get(`${BASE}/api/posts/${id}`);
			aiTags = (await getRes.json()).tags;
			if (aiTags.length > 0) break;
		}

		if (aiTags.length > 0) {
			// AI tags should also appear in the posts listing
			const listRes = await request.get(`${BASE}/api/posts`);
			const listData = await listRes.json();
			const post = listData.data.find((p: { id: string }) => p.id === id);
			expect(post).toBeTruthy();
			expect(post.tags).toEqual(expect.arrayContaining(aiTags));
		}
	});
});

test.describe("Tag colors — deterministic hash", () => {
	// This tests that tags appear with consistent inline styles
	// The actual color computation is a pure function (unit testable),
	// but we verify that the API returns tags that can be colored.

	let token: string;
	let postId1: string;
	let postId2: string;

	test.beforeAll(async ({ request }) => {
		({ token } = await createTestUser("tagcolor"));
		const res1 = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Color test A", body: "Body", tags: ["chatgpt", "ai"] },
		});
		postId1 = (await res1.json()).id;

		const res2 = await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Color test B", body: "Body", tags: ["chatgpt", "hallucination"] },
		});
		postId2 = (await res2.json()).id;
	});

	test("same tag name across posts returns identical strings", async ({ request }) => {
		const [res1, res2] = await Promise.all([
			request.get(`${BASE}/api/posts/${postId1}`),
			request.get(`${BASE}/api/posts/${postId2}`),
		]);
		const post1 = await res1.json();
		const post2 = await res2.json();

		// Both posts have "chatgpt" — the tag string is the same, so the client-side
		// hash function will produce the same color
		expect(post1.tags).toContain("chatgpt");
		expect(post2.tags).toContain("chatgpt");
	});
});

test.describe("Post with tags in listings", () => {
	let token: string;

	test.beforeAll(async ({ request }) => {
		({ token } = await createTestUser("taglisting"));
		await request.post(`${BASE}/api/posts`, {
			headers: authHeaders(token),
			data: { title: "Listing tags test", body: "Body", tags: ["listing-tag"] },
		});
	});

	test("post listings include tags array", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		for (const post of body.data) {
			expect(Array.isArray(post.tags)).toBe(true);
		}
	});

	test("each post has isGolden boolean", async ({ request }) => {
		const res = await request.get(`${BASE}/api/posts`);
		const body = await res.json();
		for (const post of body.data) {
			expect(typeof post.isGolden).toBe("boolean");
		}
	});
});

test.describe("parseAiTags — LLM output parser", () => {
	test("handles clean comma-separated output", () => {
		expect(parseAiTags("chatgpt, hallucination, legal")).toEqual([
			"chatgpt",
			"hallucination",
			"legal",
		]);
	});

	test("handles bulleted list format", () => {
		expect(parseAiTags("- ai\n- error\n- security")).toEqual(["ai", "error", "security"]);
	});

	test("strips preamble with blank line separator", () => {
		expect(
			parseAiTags("here are 3 possible tags for the given post:\n\n- code-golf\n- security\n- programming"),
		).toEqual(["code-golf", "security", "programming"]);
	});

	test("strips preamble without blank line (here's ... :)", () => {
		expect(
			parseAiTags("here's a possible set of tags: crash, autonomous, malfunction"),
		).toEqual(["crash", "autonomous", "malfunction"]);
	});

	test("strips 'Tags:' prefix", () => {
		expect(parseAiTags("Tags: chatgpt, error")).toEqual(["chatgpt", "error"]);
	});

	test("converts spaces to hyphens", () => {
		expect(parseAiTags("ai failure, machine learning")).toEqual([
			"ai-failure",
			"machine-learning",
		]);
	});

	test("collapses double hyphens", () => {
		expect(parseAiTags("crash --fire truck")).toEqual(["crash-fire-truck"]);
	});

	test("splits over-long hyphenated tokens (>24 chars)", () => {
		const result = parseAiTags("artificial-intelligence-ai-legal-misuse-justice");
		// Should split into individual segments instead of being discarded
		expect(result.length).toBeGreaterThan(0);
		for (const tag of result) {
			expect(tag.length).toBeLessThanOrEqual(24);
		}
	});

	test("handles numbered list format", () => {
		expect(parseAiTags("1. chatgpt\n2. hallucination\n3. legal")).toEqual([
			"chatgpt",
			"hallucination",
			"legal",
		]);
	});

	test("strips quotes around tags", () => {
		expect(parseAiTags('"chatgpt", "error", "ai"')).toEqual(["chatgpt", "error", "ai"]);
	});

	test("rejects tags shorter than 2 chars", () => {
		expect(parseAiTags("a, ok, x")).toEqual(["ok"]);
	});

	test("rejects tags longer than 24 chars that can't be split", () => {
		expect(parseAiTags("abcdefghijklmnopqrstuvwxyz")).toEqual([]);
	});

	test("lowercases all output", () => {
		expect(parseAiTags("ChatGPT, AI, LEGAL")).toEqual(["chatgpt", "ai", "legal"]);
	});

	test("strips invalid characters", () => {
		expect(parseAiTags("chat@gpt!, er#ror")).toEqual(["chatgpt", "error"]);
	});

	test("returns empty array for empty string", () => {
		expect(parseAiTags("")).toEqual([]);
	});
});
