/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
	interface Platform {
		env: {
			DB: D1Database;
			AI?: Ai;
			JWT_SECRET: string;
			WEBAUTHN_RP_ID: string;
			WEBAUTHN_RP_NAME: string;
			WEBAUTHN_ORIGIN?: string;
			ENVIRONMENT?: string;
			LIVE_ROOM?: DurableObjectNamespace;
		};
		context: ExecutionContext;
	}
}
