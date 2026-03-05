import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			platformProxy: {
				configPath: 'wrangler.toml',
				experimentalJsonConfig: false,
				persist: { path: '.wrangler/state/v3' },
				// In CI there's no Cloudflare auth; use local-only bindings
				remoteBindings: !process.env.CI
			}
		}),
		alias: {
			$lib: './src/lib'
		}
	}
};

export default config;
