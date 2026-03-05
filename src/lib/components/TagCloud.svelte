<script lang="ts">
	import { tagStyle } from '$lib/utils/tag-colors';

	interface TagCount {
		tag: string;
		count: number;
	}

	interface Props {
		tags: TagCount[];
		activeTag: string;
		onselect: (tag: string) => void;
	}

	let { tags, activeTag = '', onselect }: Props = $props();
</script>

{#if tags.length > 0}
	<div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
		{#each tags as { tag, count }}
			<button
				onclick={() => onselect(activeTag === tag ? '' : tag)}
				aria-pressed={activeTag === tag}
				class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border focus-visible:ring-2 focus-visible:ring-neon-500 focus-visible:ring-offset-1 focus-visible:ring-offset-shame-950 focus-visible:outline-none
					{activeTag === tag
						? 'bg-neon-500/20 text-neon-400 border-neon-500/40'
						: 'hover:brightness-125'}"
				style={activeTag === tag ? undefined : tagStyle(tag)}
			>
				#{tag}
				<span class="text-[10px] opacity-70">{count}</span>
			</button>
		{/each}
	</div>
{/if}
