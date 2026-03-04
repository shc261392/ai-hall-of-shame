<script lang="ts">
	import { toasts } from '$lib/stores/toast';
</script>

{#if $toasts.length > 0}
	<div class="fixed top-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
		{#each $toasts as toast (toast.id)}
			<div
				class="rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-sm
					{toast.type === 'success' ? 'bg-success-500/20 border border-success-500/40 text-success-500' : ''}
					{toast.type === 'error' ? 'bg-error-500/20 border border-error-500/40 text-error-500' : ''}
					{toast.type === 'info' ? 'bg-neon-500/20 border border-neon-500/40 text-neon-400' : ''}"
			>
				{toast.text}
			</div>
		{/each}
	</div>
{/if}
