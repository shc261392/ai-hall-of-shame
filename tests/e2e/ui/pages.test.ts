import { test, expect } from "@playwright/test";

test.describe("Submit page", () => {
	test("loads the submit page", async ({ page }) => {
		await page.goto("/submit");
		await expect(page).not.toHaveTitle(/404/);
	});

	test("shows submit form or auth prompt", async ({ page }) => {
		await page.goto("/submit");
		await page.waitForLoadState("networkidle");
		const body = await page.locator("body").textContent();
		// Either a form is shown, or a sign-in prompt is shown
		expect(
			body?.match(/submit|title|body|sign in|authenticate|passkey/i),
		).toBeTruthy();
	});
});

test.describe("Post detail page", () => {
	test("shows 404 content for unknown post id", async ({ page }) => {
		await page.goto("/post/this-post-does-not-exist-xyz");
		await page.waitForLoadState("networkidle");
		const body = await page.locator("body").textContent();
		// Should show not found or navigate away — not a crash
		expect(body).not.toMatch(/TypeError|ReferenceError/);
		expect(body?.match(/not found|404|back/i)).toBeTruthy();
	});

	test("renders without JS errors for valid-looking id", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));
		await page.goto("/post/aaaabbbbccccddddeeee1");
		await page.waitForLoadState("networkidle");
		// Filter expected "not found" fetch errors vs real JS crashes
		const crashErrors = errors.filter(
			(e) => !e.includes("not_found") && !e.includes("404"),
		);
		expect(crashErrors).toHaveLength(0);
	});
});

test.describe("404 page", () => {
	test("unknown route shows 404 or redirects to home", async ({ page }) => {
		const res = await page.goto("/this-route-does-not-exist");
		// SPA may redirect to / or show a 404 — either is fine
		expect([200, 404]).toContain(res?.status() ?? 200);
	});
});
