<script lang="ts">
	import { renderMarkdown } from "$lib/utils/markdown";

	interface Props {
		value: string;
		onchange: (value: string) => void;
		placeholder?: string;
		maxlength?: number;
		rows?: number;
		label?: string;
		required?: boolean;
		disabled?: boolean;
	}

	let {
		value = $bindable(""),
		onchange,
		placeholder = "Write your markdown here...",
		maxlength = 10000,
		rows = 8,
		label,
		required = false,
		disabled = false,
	}: Props = $props();

	let mode = $state<"write" | "preview">("write");

	const _renderedHtml = $derived(mode === "preview" ? renderMarkdown(value) : "");
	const _editorId = `markdown-editor-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="markdown-editor-container">
	{#if label}
		<label for={editorId} class="block text-sm font-medium text-shame-200 mb-2">
			{label}
			{#if required}
				<span class="text-warning-500">*</span>
			{/if}
		</label>
	{/if}

	<!-- Tabs -->
	<div class="flex border-b border-shame-700 bg-shame-900 rounded-t-lg">
		<button
			type="button"
			onclick={() => (mode = "write")}
			class="px-4 py-2 text-sm font-medium transition-colors {mode === 'write'
				? 'text-neon-400 border-b-2 border-neon-400'
				: 'text-shame-400 hover:text-shame-200'}"
		>
			Write
		</button>
		<button
			type="button"
			onclick={() => (mode = "preview")}
			class="px-4 py-2 text-sm font-medium transition-colors {mode === 'preview'
				? 'text-neon-400 border-b-2 border-neon-400'
				: 'text-shame-400 hover:text-shame-200'}"
		>
			Preview
		</button>
		<div class="ml-auto px-4 py-2 text-xs text-shame-500">
			{value.length} / {maxlength}
		</div>
	</div>

	<!-- Content Area -->
	<div class="border border-t-0 border-shame-700 rounded-b-lg bg-shame-950">
		{#if mode === "write"}
			<textarea
				id={editorId}
				bind:value
				oninput={(e) => onchange(e.currentTarget.value)}
				{placeholder}
				{maxlength}
				{rows}
				{required}
				{disabled}
				class="w-full p-4 bg-transparent text-shame-100 placeholder-shame-500 resize-y focus:outline-none focus:ring-2 focus:ring-neon-500/50 rounded-b-lg"
			></textarea>
		{:else}
			<div
				class="prose prose-invert prose-neon max-w-none p-4 markdown-preview"
				style="min-height: {rows * 1.5}rem"
			>
				{#if value.trim()}
					{@html renderedHtml}
				{:else}
					<p class="text-shame-500 italic">Nothing to preview</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Markdown Help -->
	<div class="mt-1 text-xs text-shame-500">
		Markdown supported: **bold**, *italic*, `code`, [links](url), lists, quotes, etc.
	</div>
</div>

<style>
	/* Markdown preview styling */
	:global(.markdown-preview) {
		font-size: 0.875rem;
		line-height: 1.6;
	}

	:global(.markdown-preview h1) {
		font-size: 1.5rem;
		font-weight: 700;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: var(--color-neon-400);
	}

	:global(.markdown-preview h2) {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: var(--color-neon-400);
	}

	:global(.markdown-preview h3) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 0.75rem;
		margin-bottom: 0.5rem;
		color: var(--color-neon-400);
	}

	:global(.markdown-preview p) {
		margin-bottom: 1rem;
	}

	:global(.markdown-preview code) {
		background-color: rgba(0, 0, 0, 0.4);
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
		color: var(--color-neon-300);
	}

	:global(.markdown-preview pre) {
		background-color: rgba(0, 0, 0, 0.4);
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin-bottom: 1rem;
	}

	:global(.markdown-preview pre code) {
		background: none;
		padding: 0;
		color: var(--color-neon-300);
	}

	:global(.markdown-preview a) {
		color: var(--color-neon-400);
		text-decoration: underline;
	}

	:global(.markdown-preview a:hover) {
		color: var(--color-neon-300);
	}

	:global(.markdown-preview ul, .markdown-preview ol) {
		margin-left: 1.5rem;
		margin-bottom: 1rem;
	}

	:global(.markdown-preview li) {
		margin-bottom: 0.25rem;
	}

	:global(.markdown-preview blockquote) {
		border-left: 4px solid var(--color-shame-700);
		padding-left: 1rem;
		margin-left: 0;
		margin-bottom: 1rem;
		color: var(--color-shame-400);
	}

	:global(.markdown-preview hr) {
		border: none;
		border-top: 1px solid var(--color-shame-700);
		margin: 1.5rem 0;
	}

	:global(.markdown-preview strong) {
		font-weight: 600;
		color: var(--color-neon-300);
	}

	:global(.markdown-preview em) {
		font-style: italic;
	}
</style>
