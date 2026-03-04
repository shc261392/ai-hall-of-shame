import { writable } from "svelte/store";

interface AuthState {
	token: string | null;
	username: string | null;
	userId: string | null;
	displayName?: string | null;
}

const STORAGE_KEY = "ahos_auth";

function loadFromStorage(): AuthState {
	if (typeof sessionStorage === "undefined")
		return { token: null, username: null, userId: null, displayName: null };
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw)
			return { token: null, username: null, userId: null, displayName: null };
		return JSON.parse(raw);
	} catch {
		return { token: null, username: null, userId: null, displayName: null };
	}
}

function saveToStorage(state: AuthState) {
	if (typeof sessionStorage === "undefined") return;
	if (state.token) {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} else {
		sessionStorage.removeItem(STORAGE_KEY);
	}
}

const initial = loadFromStorage();
export const auth = writable<AuthState>(initial);

auth.subscribe(saveToStorage);

export function login(
	token: string,
	username: string,
	userId: string,
	displayName?: string,
) {
	auth.set({ token, username, userId, displayName: displayName ?? null });
}

export function logout() {
	auth.set({ token: null, username: null, userId: null });
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
