/**
 * LiveRoom Durable Object — DEPRECATED.
 *
 * Real-time updates now use D1 polling (see broadcast.ts + /api/live).
 * This class is kept as a minimal stub because the wrangler migration
 * (v1 new_sqlite_classes) references it. It can be fully removed once
 * a `deleted_classes` migration is deployed.
 */
export class LiveRoom implements DurableObject {
	constructor(
		private state: DurableObjectState,
		private env: unknown,
	) {}

	async fetch(_request: Request): Promise<Response> {
		return new Response("Deprecated — use polling", { status: 410 });
	}
}
