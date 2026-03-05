/**
 * Post-build script: patches the SvelteKit-generated _worker.js to
 * re-export the LiveRoom Durable Object class.
 *
 * Cloudflare Workers requires DO classes to be exported from the `main`
 * entry point. The SvelteKit adapter only exports a default fetch handler,
 * so we append the LiveRoom re-export after the build.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const WORKER_PATH = '.svelte-kit/cloudflare/_worker.js';

let content = readFileSync(WORKER_PATH, 'utf-8');

if (!content.includes('LiveRoom')) {
	const exportLine = '\nexport { LiveRoom } from "../../src/lib/server/live-room.ts";\n';
	content += exportLine;
	writeFileSync(WORKER_PATH, content);
	console.log('  ✔ Patched _worker.js with LiveRoom export');
} else {
	console.log('  ✔ LiveRoom already exported in _worker.js');
}
