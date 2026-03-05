<script lang="ts">
	import type { SortOption } from '$lib/types';

	interface Props {
		active: SortOption;
		onchange: (sort: SortOption) => void;
	}

	let { active, onchange }: Props = $props();

	const tabs: { value: SortOption; label: string }[] = [
		{ value: 'trending', label: '🔥 Trending' },
		{ value: 'top', label: '🏆 Hall of Fame' },
		{ value: 'latest', label: '🆕 Fresh Fails' }
	];
</script>

<div class="flex gap-1 rounded-lg bg-shame-800/50 p-1" role="tablist">
	{#each tabs as tab}
		<button
			role="tab"
			aria-selected={active === tab.value}
			onclick={() => onchange(tab.value)}
			class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
				{active === tab.value
					? 'bg-shame-700 text-neon-400 shadow-sm'
					: 'text-shame-300 hover:text-shame-100 hover:bg-shame-800'}"
		>
			{tab.label}
		</button>
	{/each}
</div>
