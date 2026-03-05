<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';
	import { untrack } from 'svelte';
	import { REACTION_EMOJIS, REACTION_LABELS, type ReactionCount, type ReactionEmoji } from '$lib/types';

	interface Props {
		postId: string;
		reactions: ReactionCount[];
	}

	let { postId, reactions }: Props = $props();

	let localReactions = $state<ReactionCount[]>(untrack(() => [...reactions]));
	let showPicker = $state(false);
	let busy = $state(false);

	$effect(() => {
		if (!busy) {
			localReactions = reactions;
		}
	});

	const allDefs = REACTION_EMOJIS.map((emoji) => ({ emoji, label: REACTION_LABELS[emoji] }));

	// Only show reactions with count > 0
	let visibleReactions = $derived(localReactions.filter((r) => r.count > 0));

	function clickOutside(node: HTMLElement, handler: () => void) {
		// Only listen while picker is open — added/removed via $effect
		const handle = (e: MouseEvent) => {
			if (!node.contains(e.target as Node)) handler();
		};
		return {
			start() { document.addEventListener('mousedown', handle, true); },
			stop() { document.removeEventListener('mousedown', handle, true); },
			destroy() { document.removeEventListener('mousedown', handle, true); }
		};
	}

	let pickerNode: HTMLDivElement | undefined = $state();
	let clickOutsideHandle: ReturnType<typeof clickOutside> | null = null;

	$effect(() => {
		if (showPicker && pickerNode) {
			clickOutsideHandle = clickOutside(pickerNode, () => (showPicker = false));
			clickOutsideHandle.start();
			return () => clickOutsideHandle?.stop();
		}
	});

	async function toggle(emoji: ReactionEmoji) {
		if (!$auth.token) {
			addToast('Sign in to react', 'info');
			showPicker = false;
			return;
		}
		if (busy) return;
		busy = true;

		// Optimistic update
		const prev = localReactions;
		const existing = localReactions.find((r) => r.emoji === emoji);
		if (existing) {
			localReactions = localReactions.map((r) =>
				r.emoji === emoji
					? { ...r, count: r.count + (r.userReacted ? -1 : 1), userReacted: !r.userReacted }
					: r
			);
		} else {
			localReactions = [
				...localReactions,
				{ emoji, label: REACTION_LABELS[emoji], count: 1, userReacted: true }
			];
		}

		showPicker = false;

		try {
			const result = await api.post<{ reactions: ReactionCount[] }>('/api/reactions', {
				postId,
				emoji
			});
			localReactions = result.reactions;
		} catch {
			localReactions = prev;
			addToast('Reaction failed', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-wrap items-center gap-1.5">
	<!-- Active reactions (count > 0) -->
	{#each visibleReactions as reaction (reaction.emoji)}
		<button
			onclick={() => toggle(reaction.emoji)}
			title="{reaction.label} — click to {reaction.userReacted ? 'remove' : 'add'} your reaction"
			class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors {reaction.userReacted
				? 'border border-neon-500/60 bg-neon-500/15 text-neon-400 hover:bg-neon-500/25'
				: 'border border-shame-700 bg-shame-800 text-shame-300 hover:border-shame-600 hover:text-shame-200'}"
		>
			<span>{reaction.emoji}</span>
			<span class="max-w-[6rem] truncate">{reaction.label}</span>
			<span class="font-mono font-medium tabular-nums">{reaction.count}</span>
		</button>
	{/each}

	<!-- Add reaction picker -->
	<div
		class="relative"
		bind:this={pickerNode}
	>
		<button
			onclick={() => (showPicker = !showPicker)}
			title="Add a reaction"
			class="flex items-center gap-0.5 rounded-full border border-shame-700 bg-shame-800 px-2 py-0.5 text-xs text-shame-400 transition-colors hover:border-shame-600 hover:text-shame-200"
		>
			<span class="text-sm leading-none">+</span>
		</button>

		{#if showPicker}
			<div class="absolute bottom-full left-0 z-20 mb-1.5 flex gap-1 rounded-xl border border-shame-700 bg-shame-900 p-2 shadow-xl shadow-black/40">
				{#each allDefs as def (def.emoji)}
					<button
						onclick={() => toggle(def.emoji)}
						title={def.label}
						class="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-center transition-colors hover:bg-shame-800 {localReactions.find(
							(r) => r.emoji === def.emoji && r.userReacted
						)
							? 'bg-neon-500/10 ring-1 ring-neon-500/30'
							: ''}"
					>
						<span class="text-xl leading-none">{def.emoji}</span>
						<span class="text-[0.6rem] leading-tight text-shame-400">{def.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
