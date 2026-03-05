<script lang="ts">
	import { tagStyle } from '$lib/utils/tag-colors';

	interface Props {
		tags: string[];
		onchange: (tags: string[]) => void;
		max?: number;
		inputId?: string;
	}

	let { tags = [], onchange, max = 3, inputId }: Props = $props();

	let input = $state('');

	function addTag() {
		const tag = input.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 24);
		if (!tag || tag.length < 2 || tags.length >= max || tags.includes(tag)) {
			input = '';
			return;
		}
		onchange([...tags, tag]);
		input = '';
	}

	function removeTag(tag: string) {
		onchange(tags.filter((t) => t !== tag));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag();
		} else if (e.key === 'Backspace' && !input && tags.length > 0) {
			onchange(tags.slice(0, -1));
		}
	}
</script>

<div>
	<div class="flex flex-wrap gap-1.5 mb-2">
		{#each tags as tag}
			<span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs" style={tagStyle(tag)}>
				#{tag}
				<button
					type="button"
					onclick={() => removeTag(tag)}
					class="opacity-60 hover:opacity-100 transition-opacity p-1 -m-0.5"
					aria-label="Remove tag {tag}"
				>✕</button>
			</span>
		{/each}
	</div>
	{#if tags.length < max}
		<div class="flex gap-2">
			<input
				type="text"
				id={inputId}
				bind:value={input}
				onkeydown={handleKeydown}
				placeholder="Add tag (press Enter)"
				aria-label="Add a tag"
				maxlength="24"
				class="flex-1 rounded-lg border border-shame-700 bg-shame-800 px-3 py-1.5 text-sm text-shame-100 placeholder:text-shame-300/50 focus:border-neon-500 focus:outline-none"
			/>
			<button
				type="button"
				onclick={addTag}
				disabled={!input.trim() || input.trim().length < 2}
				class="rounded-lg bg-shame-700 px-3 py-1.5 text-xs text-shame-200 hover:bg-shame-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
			>
				Add
			</button>
		</div>
		<p class="mt-1 text-xs text-shame-300">{tags.length}/{max} tags · 2-24 chars · lowercase letters, numbers, hyphens</p>
	{/if}
</div>
