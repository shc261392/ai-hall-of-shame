import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false, // sequential to avoid rate-limit collisions
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [["list"], ["html", { open: "never" }]],
	timeout: 15_000,

	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
		// API tests use the request context directly
		extraHTTPHeaders: {
			Accept: "application/json",
		},
	},

	projects: [
		{
			name: "api",
			testMatch: "tests/e2e/api/**/*.test.ts",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "ui",
			testMatch: "tests/e2e/ui/**/*.test.ts",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Start vite dev server before running tests.
	// In CI the server is started explicitly by the workflow for better
	// diagnostic output; reuseExistingServer lets Playwright skip spawning
	// a duplicate when one is already listening.
	webServer: {
		command: "pnpm dev",
		url: BASE_URL,
		reuseExistingServer: true,
		timeout: 30_000,
	},
});
