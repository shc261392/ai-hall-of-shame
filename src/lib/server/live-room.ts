/**
 * LiveRoom Durable Object — manages SSE subscriptions for real-time updates.
 *
 * Channels: "feed" (home page) or "post:{id}" (post detail page).
 * Clients connect via GET /api/live/:channel which proxies to this DO.
 * Mutations notify via POST /broadcast on the DO stub.
 */

interface BroadcastMessage {
	event: string;
	data: Record<string, unknown>;
}

export class LiveRoom implements DurableObject {
	private subscribers = new Set<ReadableStreamDefaultController>();
	private keepaliveInterval: ReturnType<typeof setInterval> | null = null;

	private static readonly MAX_SUBSCRIBERS = 1000;
	private static readonly KEEPALIVE_MS = 30_000;

	constructor(_state: DurableObjectState,_env: unknown,
	) {}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "POST" && url.pathname === "/broadcast") {
			const msg = (await request.json()) as BroadcastMessage;
			this.broadcast(msg.event, msg.data);
			return new Response("ok", { status: 200 });
		}

		if (request.method === "GET" && url.pathname === "/subscribe") {
			if (this.subscribers.size >= LiveRoom.MAX_SUBSCRIBERS) {
				return new Response("Too many connections", { status: 503 });
			}
			return this.handleSubscribe();
		}

		return new Response("Not found", { status: 404 });
	}

	private startKeepalive() {
		if (this.keepaliveInterval) return;
		this.keepaliveInterval = setInterval(() => {
			const encoder = new TextEncoder();
			const ping = encoder.encode(":ping\n\n");
			for (const controller of this.subscribers) {
				try {
					controller.enqueue(ping);
				} catch {
					this.subscribers.delete(controller);
				}
			}
			if (this.subscribers.size === 0) {
				clearInterval(this.keepaliveInterval!);
				this.keepaliveInterval = null;
			}
		}, LiveRoom.KEEPALIVE_MS);
	}

	private handleSubscribe(): Response {
		let controller: ReadableStreamDefaultController;

		const stream = new ReadableStream({
			start: (ctrl) => {
				controller = ctrl;
				this.subscribers.add(controller);
				this.startKeepalive();

				// Send initial heartbeat
				const encoder = new TextEncoder();
				controller.enqueue(encoder.encode(":ok\n\n"));
			},
			cancel: () => {
				this.subscribers.delete(controller);
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"Access-Control-Allow-Origin": "https://hallofshame.cc",
			},
		});
	}

	private broadcast(event: string, data: Record<string, unknown>) {
		const encoder = new TextEncoder();
		const payload = encoder.encode(
			`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
		);

		for (const controller of this.subscribers) {
			try {
				controller.enqueue(payload);
			} catch {
				// Client disconnected
				this.subscribers.delete(controller);
			}
		}
	}
}
