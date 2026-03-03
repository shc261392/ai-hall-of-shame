import { get } from "svelte/store";
import { auth, logout } from "$lib/stores/auth";
import type { ApiError } from "$lib/types";

class ApiClient {
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
		return this.handle<T>(res);
	}

	async post<T>(path: string, body?: unknown): Promise<T> {
		const res = await fetch(path, {
			method: "POST",
			headers: this.getHeaders(),
			body: body ? JSON.stringify(body) : undefined,
		});
		return this.handle<T>(res);
	}

	async patch<T>(path: string, body: unknown): Promise<T> {
		const res = await fetch(path, {
			method: "PATCH",
			headers: this.getHeaders(),
			body: JSON.stringify(body),
		});
		return this.handle<T>(res);
	}

	private async handle<T>(res: Response): Promise<T> {
		if (res.status === 401) {
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
}

export const api = new ApiClient();
