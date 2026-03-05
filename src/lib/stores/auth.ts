import { writable } from "svelte/store";

interface AuthState {
	token: string | null;
	refreshToken: string | null;
	username: string | null;
	userId: string | null;
	displayName?: string | null;
	expiresAt: number | null; // unix ms when access token expires
	remember: boolean;
}

const STORAGE_KEY = "ahos_auth";

function getStorage(remember: boolean): Storage | null {
	if (typeof window === "undefined") return null;
	return remember ? localStorage : sessionStorage;
}

function loadFromStorage(): AuthState {
	const empty: AuthState = {
		token: null,
		refreshToken: null,
		username: null,
		userId: null,
		displayName: null,
		expiresAt: null,
		remember: false,
	};
	if (typeof window === "undefined") return empty;
	try {
		// Check localStorage first (remember me), then sessionStorage
		const rawLocal = localStorage.getItem(STORAGE_KEY);
		const rawSession = sessionStorage.getItem(STORAGE_KEY);
		const raw = rawLocal || rawSession;
		if (!raw) return empty;
		const parsed = JSON.parse(raw);
		return { ...empty, ...parsed, remember: !!rawLocal };
	} catch {
		return empty;
	}
}

function saveToStorage(state: AuthState) {
	if (typeof window === "undefined") return;
	// Clear both storages first
	localStorage.removeItem(STORAGE_KEY);
	sessionStorage.removeItem(STORAGE_KEY);
	if (state.token) {
		const storage = getStorage(state.remember);
		if (storage) {
			storage.setItem(STORAGE_KEY, JSON.stringify(state));
		}
	}
}

const initial = loadFromStorage();
export const auth = writable<AuthState>(initial);

auth.subscribe(saveToStorage);

export function login(
	token: string,
	refreshToken: string,
	expiresIn: number,
	username: string,
	userId: string,
	displayName?: string,
	remember = false,
) {
	auth.set({
		token,
		refreshToken,
		username,
		userId,
		displayName: displayName ?? null,
		expiresAt: Date.now() + expiresIn * 1000,
		remember,
	});
	scheduleRefresh(expiresIn);
}

export function logout() {
	cancelRefresh();
	auth.set({
		token: null,
		refreshToken: null,
		username: null,
		userId: null,
		displayName: null,
		expiresAt: null,
		remember: false,
	});
}

export function updateUsername(username: string, token?: string) {
	auth.update((s) => ({
		...s,
		username,
		token: token ?? s.token,
	}));
}

export function updateDisplayName(displayName: string) {
	auth.update((s) => ({
		...s,
		displayName,
	}));
}

// ── Token refresh scheduling ──

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function cancelRefresh() {
	if (refreshTimer) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
}

function scheduleRefresh(expiresInSeconds: number) {
	cancelRefresh();
	// Refresh 60 seconds before expiry (minimum 5s)
	const delayMs = Math.max(5_000, (expiresInSeconds - 60) * 1000);
	refreshTimer = setTimeout(doRefresh, delayMs);
}

async function doRefresh() {
	let currentState: AuthState | null = null;
	const unsubscribe = auth.subscribe((s) => (currentState = s));
	unsubscribe();

	if (!currentState || !(currentState as AuthState).refreshToken) return;
	const state = currentState as AuthState;

	try {
		const res = await fetch("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: state.refreshToken }),
		});

		if (!res.ok) {
			logout();
			return;
		}

		const data = (await res.json()) as {
			token: string;
			refreshToken: string;
			expiresIn: number;
			userId: string;
			username: string;
		};

		auth.update((s) => ({
			...s,
			token: data.token,
			refreshToken: data.refreshToken,
			expiresAt: Date.now() + data.expiresIn * 1000,
			username: data.username,
			userId: data.userId,
		}));

		scheduleRefresh(data.expiresIn);
	} catch {
		// Network error — will retry on next API call via interceptor
	}
}

/** Attempt to refresh the token. Returns the new access token or null. */
export async function tryRefresh(): Promise<string | null> {
	let currentState: AuthState | null = null;
	const unsubscribe = auth.subscribe((s) => (currentState = s));
	unsubscribe();

	if (!currentState || !(currentState as AuthState).refreshToken) return null;
	const state = currentState as AuthState;

	try {
		const res = await fetch("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: state.refreshToken }),
		});

		if (!res.ok) {
			logout();
			return null;
		}

		const data = (await res.json()) as {
			token: string;
			refreshToken: string;
			expiresIn: number;
			userId: string;
			username: string;
		};

		auth.update((s) => ({
			...s,
			token: data.token,
			refreshToken: data.refreshToken,
			expiresAt: Date.now() + data.expiresIn * 1000,
			username: data.username,
			userId: data.userId,
		}));

		scheduleRefresh(data.expiresIn);
		return data.token;
	} catch {
		return null;
	}
}

// On load, schedule refresh if we have a token (client-only)
if (typeof window !== "undefined" && initial.token && initial.expiresAt) {
	const remaining = Math.max(0, (initial.expiresAt - Date.now()) / 1000);
	if (remaining > 0) {
		scheduleRefresh(remaining);
	} else if (initial.refreshToken) {
		// Token expired but refresh token might be valid
		doRefresh();
	}
}
