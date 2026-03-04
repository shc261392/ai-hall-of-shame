/**
 * Simple focus trap for modal dialogs.
 * Returns a cleanup function to remove the event listener.
 */
export function trapFocus(container: HTMLElement): () => void {
	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== "Tab") return;

		const focusable = container.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
		);
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	container.addEventListener("keydown", handleKeydown);
	// Auto-focus the first focusable element
	requestAnimationFrame(() => {
		const first = container.querySelector<HTMLElement>(
			'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
		);
		first?.focus();
	});

	return () => container.removeEventListener("keydown", handleKeydown);
}
