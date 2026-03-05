<script lang="ts">
	interface Props {
		value: string;
		onsearch: (query: string) => void;
	}

	let { value = '', onsearch }: Props = $props();

	let input = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	// Sync input when parent resets value (e.g. clearing search on tag select)
	$effect(() => {
		input = value;
	});

	function handleInput() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			onsearch(input.trim());
		}, 300);
	}

	function clear() {
		input = '';
		onsearch('');
	}
</script>

<div class="relative">
	<input
		type="search"
		bind:value={input}
		oninput={handleInput}
		placeholder="Search AI fails..."
		aria-label="Search posts"
		class="w-full rounded-lg border border-shame-700 bg-shame-800 pl-9 pr-8 py-2 text-sm text-shame-100 placeholder:text-shame-300/50 focus:border-neon-500 focus:outline-none transition-colors"
	/>
	<svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-shame-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
	</svg>
	{#if input}
		<button
			onclick={clear}
			class="absolute right-0 top-0 bottom-0 flex items-center justify-center w-10 text-shame-300 hover:text-shame-100 transition-colors"
			aria-label="Clear search"
		>
			✕
		</button>
	{/if}
</div>
