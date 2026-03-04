<script lang="ts">
	interface Props {
		message?: string;
		actionHref?: string;
		actionLabel?: string;
	}

	let { message = 'Nothing here yet.', actionHref, actionLabel }: Props = $props();
</script>

<div class="rounded-xl border border-dashed border-shame-700 py-12 text-center">
	<p class="text-3xl mb-2">🤷</p>
	<p class="text-sm text-shame-300">{message}</p>
	{#if actionHref && actionLabel}
		<a
			href={actionHref}
			class="mt-4 inline-block rounded-lg bg-neon-500 px-5 py-2 text-sm font-medium text-shame-950 hover:bg-neon-400 transition-colors"
		>
			{actionLabel}
		</a>
	{/if}
</div>
