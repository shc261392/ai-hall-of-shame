import { writable } from "svelte/store";

interface AuthState {
	token: string | null;
	username: string | null;
	userId: string | null;
}

const STORAGE_KEY = "ahos_auth";

function loadFromStorage(): AuthState {
	if (typeof sessionStorage === "undefined")
		return { token: null, username: null, userId: null };
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return { token: null, username: null, userId: null };
		return JSON.parse(raw);
	} catch {
		return { token: null, username: null, userId: null };
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

export function login(token: string, username: string, userId: string) {
	auth.set({ token, username, userId });
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
