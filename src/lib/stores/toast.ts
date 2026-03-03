import { writable } from "svelte/store";

export interface ToastMessage {
	id: number;
	text: string;
	type: "success" | "error" | "info";
}

let nextId = 0;

export const toasts = writable<ToastMessage[]>([]);

export function addToast(
	text: string,
	type: ToastMessage["type"] = "info",
	duration = 4000,
) {
	const id = nextId++;
	toasts.update((t) => [...t, { id, text, type }]);
	setTimeout(() => {
		toasts.update((t) => t.filter((m) => m.id !== id));
	}, duration);
}
