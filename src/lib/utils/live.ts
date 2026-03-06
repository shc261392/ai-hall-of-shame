/**
 * Real-time connection manager using lightweight polling.
 *
 * Polls /api/live/:channel for recent events stored in D1.
 * Pauses when the tab is hidden; resumes immediately on focus.
 * No Durable Objects — stays well within Cloudflare free tier.
 */

export type LiveEvent = {
	event: string;
	data: Record<string, unknown>;
};

type LiveHandler = (evt: LiveEvent) => void;

const POLL_INTERVAL_MS = 30_000;

export class LiveConnection {
	private handlers = new Set<LiveHandler>();
	private channel: string;
	private closed = false;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private lastTs: string;
	private polling = false;

	constructor(channel: string) {
		this.channel = channel;
		this.lastTs = new Date().toISOString();
		if (typeof window !== "undefined") {
			this.startPolling();
			document.addEventListener("visibilitychange", this.onVisibility);
		}
	}

	on(handler: LiveHandler) {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	close() {
		this.closed = true;
		this.stopPolling();
		if (typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", this.onVisibility);
		}
		this.handlers.clear();
	}

	private onVisibility = () => {
		if (document.hidden) {
			this.stopPolling();
		} else {
			this.poll();
			this.startPolling();
		}
	};

	private startPolling() {
		if (this.closed || this.pollTimer) return;
		this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
	}

	private stopPolling() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	private async poll() {
		if (this.closed || this.polling) return;
		this.polling = true;
		try {
			const res = await fetch(`/api/live/${this.channel}?since=${encodeURIComponent(this.lastTs)}`);
			if (!res.ok) return;
			const body = (await res.json()) as {
				events: LiveEvent[];
				serverTime: string;
			};
			this.lastTs = body.serverTime;
			for (const evt of body.events) {
				this.emit(evt);
			}
		} catch {
			// Network error — will retry on next interval
		} finally {
			this.polling = false;
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
