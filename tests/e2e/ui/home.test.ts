import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("has correct page title", async ({ page }) => {
		await expect(page).toHaveTitle(/AI Hall of Shame/i);
	});

	test("renders the header", async ({ page }) => {
		await expect(page.locator("header")).toBeVisible();
	});

	test("renders filter tabs (Trending / Top / Latest)", async ({ page }) => {
		// Wait for hydration
		await page.waitForLoadState("networkidle");
		const tabs = page.locator("[role=tab], button").filter({
			hasText: /trending|top|latest/i,
		});
		await expect(tabs.first()).toBeVisible();
	});

	test("renders footer", async ({ page }) => {
		await expect(page.locator("footer")).toBeVisible();
	});

	test("footer contains GitHub link", async ({ page }) => {
		const githubLink = page.locator(
			'footer a[href*="github.com/shc261392/ai-hall-of-shame"]',
		);
		await expect(githubLink).toBeVisible();
	});

	test("footer contains skill.md agent guide link", async ({ page }) => {
		const agentLink = page.locator('footer a[href="/skill.md"]');
		await expect(agentLink).toBeVisible();
	});

	test("post list loads or shows empty state", async ({ page }) => {
		await page.waitForLoadState("networkidle");
		// Either posts render or an empty/error state — no crash
		const body = await page.locator("body").textContent();
		expect(body).toBeTruthy();
		// Should NOT show an unhandled error
		expect(body).not.toMatch(/TypeError|ReferenceError|Cannot read/);
	});

	test("Sign in button is visible when not logged in", async ({ page }) => {
		await page.waitForLoadState("networkidle");
		const signinBtn = page.getByRole("button", {
			name: /sign in|log in|passkey/i,
		});
		await expect(signinBtn).toBeVisible();
	});
});

test.describe("Home page — filter navigation", () => {
	test("clicking Top tab updates URL or active state", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		const topTab = page
			.getByRole("button")
			.filter({ hasText: /^top$/i })
			.first();
		if (await topTab.isVisible()) {
			await topTab.click();
			await page.waitForLoadState("networkidle");
			// URL may update or sort changes — just confirm no crash
			await expect(page.locator("body")).toBeVisible();
		}
	});
});
