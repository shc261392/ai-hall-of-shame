<script lang="ts">
	import { page } from '$app/stores';
	import { api } from '$lib/utils/api';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { addToast } from '$lib/stores/toast';
	import { timeAgo } from '$lib/utils/time';
	import VoteButtons from '$lib/components/VoteButtons.svelte';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import CommentSection from '$lib/components/CommentSection.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import type { Post } from '$lib/types';

	let post = $state<Post | null>(null);
	let loading = $state(true);
	let error = $state('');

	const postId = $derived($page.params.id);
	const displayName = $derived(post?.displayName || post?.username || 'unknown');
	const renderedBody = $derived(post?.body ? renderMarkdown(post.body) : '');

	$effect(() => {
		if (postId) loadPost(postId);
	});

	async function loadPost(id: string) {
		loading = true;
		error = '';
		try {
			post = await api.get<Post>(`/api/posts/${id}`);
		} catch (e: any) {
			error = e.message || 'Post not found';
			addToast('Failed to load post', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	{#if post}
		<title>{post.title} — AI Hall of Shame</title>
	{/if}
</svelte:head>

{#if loading}
	<LoadingSpinner />
{:else if error || !post}
	<div class="py-12 text-center">
		<p class="text-3xl mb-2">😵</p>
		<p class="text-shame-300">{error || 'Post not found'}</p>
		<a href="/" class="mt-4 inline-block text-sm text-neon-400 hover:text-neon-500">← Back to feed</a>
	</div>
{:else}
	<article class="rounded-xl border border-shame-700 bg-shame-900/50 p-5">
		<div class="flex gap-4">
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
				<h1 class="text-xl font-bold text-shame-100 leading-snug">
					{post.title}
				</h1>
				<div class="mt-1 flex items-center gap-2 text-xs text-shame-300">
					<span>{displayName}</span>
					<span>·</span>
					<span>{timeAgo(post.createdAt)}</span>
				</div>
			</div>
		</div>
		{#if post.body}
			<div class="mt-4 text-sm text-shame-200 leading-relaxed markdown-preview">
				{@html renderedBody}
			</div>
		{/if}
		{#if post.reactions}
			<div class="mt-4 pt-3 border-t border-shame-700/50">
				<ReactionBar postId={post.id} reactions={post.reactions} />
			</div>
		{/if}
	</article>

	<div class="mt-6">
		<CommentSection postId={post.id} />
	</div>

	<div class="mt-6">
		<a href="/" class="text-sm text-neon-400 hover:text-neon-500">← Back to feed</a>
	</div>
{/if}
