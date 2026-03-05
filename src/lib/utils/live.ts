/**
 * Real-time connection manager with circuit breaker.
 *
 * Uses SSE (EventSource) for real-time updates via Durable Objects.
 * Implements exponential backoff with jitter on connection failures.
 * Circuit breaker: if DO fails repeatedly (5 times in 5 minutes),
 * marks DO as out-of-service for the entire page session.
 * Only retries on full page reload.
 */

export type LiveEvent = {
	event: string;
	data: Record<string, unknown>;
};

type LiveHandler = (evt: LiveEvent) => void;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const CIRCUIT_BREAKER_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes
const CIRCUIT_BREAKER_THRESHOLD = 5;

/** Session-scoped circuit breaker state (shared across all LiveConnections). */
const circuitBreaker = {
	failures: [] as number[],
	open: false,

	recordFailure() {
		const now = Date.now();
		this.failures.push(now);
		// Prune failures outside the window
		this.failures = this.failures.filter(
			(t) => now - t < CIRCUIT_BREAKER_WINDOW_MS,
		);
		if (this.failures.length >= CIRCUIT_BREAKER_THRESHOLD) {
			this.open = true;
		}
	},

	recordSuccess() {
		// A successful connection resets failure tracking
		this.failures = [];
		// Note: does NOT reset open state — that persists until page reload
	},

	isOpen() {
		return this.open;
	},
};

function delayWithJitter(attempt: number): number {
	const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
	// Full jitter: random value in [0, exp]
	return Math.random() * exp;
}

export class LiveConnection {
	private es: EventSource | null = null;
	private handlers = new Set<LiveHandler>();
	private channel: string;
	private retries = 0;
	private closed = false;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(channel: string) {
		this.channel = channel;
		this.connect();
	}

	on(handler: LiveHandler) {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	close() {
		this.closed = true;
		if (this.retryTimer !== null) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
		this.es?.close();
		this.es = null;
		this.handlers.clear();
	}

	private connect() {
		if (this.closed) return;
		if (circuitBreaker.isOpen()) return;

		try {
			const es = new EventSource(`/api/live/${this.channel}`);

			es.onopen = () => {
				this.retries = 0;
				circuitBreaker.recordSuccess();
			};

			es.onerror = () => {
				es.close();
				this.es = null;
				circuitBreaker.recordFailure();

				if (circuitBreaker.isOpen()) return;

				this.retries++;
				if (this.retries < MAX_RETRIES) {
					const delay = delayWithJitter(this.retries);
					this.retryTimer = setTimeout(() => {
						this.retryTimer = null;
						this.connect();
					}, delay);
				}
				// After max retries, stop — no real-time until page reload
			};

			for (const eventType of [
				"vote",
				"reaction",
				"new_post",
				"new_comment",
				"delete",
			]) {
				es.addEventListener(eventType, (e: MessageEvent) => {
					try {
						const data = JSON.parse(e.data);
						this.emit({ event: eventType, data });
					} catch {
						// Ignore malformed events
					}
				});
			}

			this.es = es;
		} catch {
			// EventSource constructor failed — no real-time updates
			circuitBreaker.recordFailure();
		}
	}

	private emit(evt: LiveEvent) {
		for (const handler of this.handlers) {
			try {
				handler(evt);
			} catch {
				// Don't let a bad handler break others
			}
		}
	}
}
