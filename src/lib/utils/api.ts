import { get } from "svelte/store";
import { auth, logout, tryRefresh } from "$lib/stores/auth";
import type { ApiError } from "$lib/types";

class ApiClient {
	private refreshPromise: Promise<string | null> | null = null;

	private getHeaders(): HeadersInit {
		const headers: HeadersInit = { "Content-Type": "application/json" };
		const state = get(auth);
		if (state.token) {
			headers["Authorization"] = `Bearer ${state.token}`;
		}
		return headers;
	}

	async get<T>(path: string, params?: Record<string, string>): Promise<T> {
		const url = new URL(path, window.location.origin);
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				url.searchParams.set(k, v);
			}
		}
		const res = await fetch(url.toString(), { headers: this.getHeaders() });
		return this.handle<T>(res, () => this.get<T>(path, params));
	}

	async post<T>(path: string, body?: unknown): Promise<T> {
		const res = await fetch(path, {
			method: "POST",
			headers: this.getHeaders(),
			body: body ? JSON.stringify(body) : undefined,
		});
		return this.handle<T>(res, () => this.post<T>(path, body));
	}

	async patch<T>(path: string, body: unknown): Promise<T> {
		const res = await fetch(path, {
			method: "PATCH",
			headers: this.getHeaders(),
			body: JSON.stringify(body),
		});
		return this.handle<T>(res, () => this.patch<T>(path, body));
	}

	async delete<T>(path: string): Promise<T> {
		const res = await fetch(path, {
			method: "DELETE",
			headers: this.getHeaders(),
		});
		return this.handle<T>(res, () => this.delete<T>(path));
	}

	private async handle<T>(res: Response, retry?: () => Promise<T>): Promise<T> {
		if (res.status === 401 && retry) {
			// Try refreshing the token
			const state = get(auth);
			if (state.refreshToken) {
				const newToken = await this.doRefresh();
				if (newToken) {
					return retry();
				}
			}
			logout();
		}
		if (!res.ok) {
			const err = (await res.json().catch(() => ({
				error: "unknown",
				message: `Request failed with status ${res.status}`,
			}))) as ApiError;
			throw err;
		}
		return res.json();
	}

	/** Dedup concurrent refresh attempts. */
	private doRefresh(): Promise<string | null> {
		if (!this.refreshPromise) {
			this.refreshPromise = tryRefresh().finally(() => {
				this.refreshPromise = null;
			});
		}
		return this.refreshPromise;
	}
}

export const api = new ApiClient();
