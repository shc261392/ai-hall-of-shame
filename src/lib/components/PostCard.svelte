<script lang="ts">
	import type { Post } from '$lib/types';
	import VoteButtons from './VoteButtons.svelte';
	import ReactionBar from './ReactionBar.svelte';
	import { timeAgo } from '$lib/utils/time';
	import { stripMarkdown } from '$lib/utils/strip-markdown';
	import { tagStyle } from '$lib/utils/tag-colors';
	import { goto } from '$app/navigation';

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();

	const displayName = $derived(post.displayName || post.username);
	const bodyPreview = $derived(stripMarkdown(post.body).substring(0, 150));

	function navigateToPost(e: MouseEvent | KeyboardEvent) {
		if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
		if (e instanceof KeyboardEvent && e.key === ' ') e.preventDefault();
		// Don't navigate if user clicked an interactive child (buttons, reactions, links)
		const target = e.target as HTMLElement;
		if (target.closest('button') || target.closest('a')) return;
		goto(`/post/${post.id}`);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="rounded-xl border p-4 transition-colors cursor-pointer
		{post.isGolden
			? 'border-golden bg-shame-900/50 golden-card hover:bg-shame-800/50'
			: 'border-shame-700 bg-shame-900/50 hover:border-shame-600 hover:bg-shame-800/50'}"
	role="link"
	tabindex="0"
	onclick={navigateToPost}
	onkeydown={navigateToPost}
>
	{#if post.isGolden}
		<div class="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-400">
			🏆 Golden Post
		</div>
	{/if}
	<div class="flex gap-3">
		<div class="flex-shrink-0">
			<VoteButtons
				targetId={post.id}
				targetType="post"
				upvotes={post.upvotes}
				downvotes={post.downvotes}
				userVote={post.userVote ?? null}
			/>
		</div>
		<div class="min-w-0 flex-1">
			<h3 class="text-shame-100 font-medium leading-snug line-clamp-2">
				<a href="/post/{post.id}" class="hover:text-neon-400 transition-colors">
					{post.title}
				</a>
			</h3>
			{#if post.body}
				<p class="mt-1 text-sm text-shame-300 line-clamp-2">
					{bodyPreview}
				</p>
			{/if}
			<div class="mt-2 flex items-center gap-3 text-xs text-shame-300">
				<span>{displayName}</span>
				<span>·</span>
				<span>{timeAgo(post.createdAt)}</span>
				<span>·</span>
				<span>💬 {post.commentCount}</span>
			</div>
			{#if post.tags && post.tags.length > 0}
				<div class="mt-2 flex flex-wrap gap-1">
					{#each post.tags as tag}
						<a href="/?tag={tag}" class="inline-block rounded-full border px-2 py-0.5 text-[10px] hover:brightness-125 transition-all" style={tagStyle(tag)}>
							#{tag}
						</a>
					{/each}
				</div>
			{/if}
			{#if post.reactions}
				<div class="mt-2">
					<ReactionBar postId={post.id} reactions={post.reactions} />
				</div>
			{/if}
		</div>
	</div>
</div>
