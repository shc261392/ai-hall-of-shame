<script lang="ts">
	import { trapFocus } from '$lib/utils/focus-trap';

	interface Props {
		code: string;
		onclose: () => void;
	}

	let { code, onclose }: Props = $props();
	let confirmed = $state(false);

	async function copyCode() {
		await navigator.clipboard.writeText(code);
	}

	function initFocusTrap(node: HTMLElement) {
		const cleanup = trapFocus(node);
		return { destroy: cleanup };
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-shame-950/80 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="backup-code-title"
	tabindex="-1"
	onkeydown={(e) => e.key === 'Escape' && confirmed && onclose()}
>
	<div class="mx-4 w-full max-w-sm rounded-xl border border-warning-500/50 bg-shame-900 p-6 shadow-2xl" use:initFocusTrap>
		<div class="mb-4 text-center">
			<span class="text-3xl" aria-hidden="true">⚠️</span>
			<h2 id="backup-code-title" class="mt-2 text-lg font-bold text-warning-500">Save Your Backup Code</h2>
			<p class="mt-1 text-sm text-shame-200">
				This is the <strong>only way</strong> to recover your account if you lose your passkey.
				It will not be shown again.
			</p>
		</div>

		<div class="flex items-center gap-2 my-4">
			<div class="flex-1 rounded-lg bg-shame-950 border border-shame-700 p-4">
				<code class="block text-center text-sm font-mono text-neon-400 break-all select-all">
					{code}
				</code>
			</div>
			<button
				onclick={copyCode}
				title="Copy backup code"
				class="rounded-lg p-3 text-lg text-shame-300 hover:text-shame-100 hover:bg-shame-800 transition-colors"
			>
				📋
			</button>
		</div>

		<label class="flex items-start gap-2 mb-4 cursor-pointer">
			<input
				type="checkbox"
				bind:checked={confirmed}
				class="mt-0.5 accent-neon-500"
			/>
			<span class="text-sm text-shame-200">
				I have saved this backup code in a secure location
			</span>
		</label>

		<button
			onclick={onclose}
			disabled={!confirmed}
			class="w-full rounded-lg bg-neon-500 py-2.5 font-medium text-shame-950 hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
		>
			Continue
		</button>
	</div>
</div>
