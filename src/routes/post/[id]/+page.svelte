<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { api } from '$lib/utils/api';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { addToast } from '$lib/stores/toast';
	import { auth } from '$lib/stores/auth';
	import { timeAgo } from '$lib/utils/time';
	import { LiveConnection } from '$lib/utils/live';
	import { computeIsGolden } from '$lib/types';
	import VoteButtons from '$lib/components/VoteButtons.svelte';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import CommentSection from '$lib/components/CommentSection.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import MoreActions from '$lib/components/MoreActions.svelte';
	import TagInput from '$lib/components/TagInput.svelte';
	import { tagStyle } from '$lib/utils/tag-colors';
	import type { Post } from '$lib/types';
	import type { PostPageData } from './+page.server';

	let { data }: { data: PostPageData } = $props();

	let post = $state<Post | null>(untrack(() => data.post ?? null));
	let loading = $state(untrack(() => !data.post));
	let error = $state('');
	let deleting = $state(false);

	const postId = $derived($page.params.id);
	const displayName = $derived(post?.displayName || post?.username || 'unknown');
	// Track body separately to avoid re-parsing markdown on vote/reaction live events
	// Plain variables (not $state) so mutation inside $derived doesn't trigger state_unsafe_mutation
	let cachedBody = '';
	let cachedHtml = '';
	const renderedBody = $derived.by(() => {
		const body = post?.body ?? '';
		if (body !== cachedBody) {
			cachedBody = body;
			cachedHtml = body ? renderMarkdown(body) : '';
		}
		return cachedHtml;
	});
	const isOwner = $derived(post && $auth.userId === post.userId);

	// Real-time connection for this post
	let live: LiveConnection | null = null;
	let unsub: (() => void) | null = null;

	// Track if initial SSR data was used (to skip first client fetch)
	let initialPostId = untrack(() => data.post ? postId : '');

	$effect(() => {
		const id = postId;
		if (id) {
			// Clean up previous connection without tracking these reads
			untrack(() => {
				unsub?.();
				live?.close();
			});
			// Skip fetch if SSR provided the initial data
			if (browser && id === initialPostId) {
				initialPostId = '';
			} else {
				loadPost(id);
			}
			// Set up live connection for this post
			const conn = new LiveConnection(`post:${id}`);
			const off = conn.on((evt) => {
				if (!post) return;
				if (evt.event === 'vote' && evt.data.targetId === id && evt.data.targetType === 'post') {
					post = { ...post, upvotes: evt.data.upvotes as number, downvotes: evt.data.downvotes as number };
				} else if (evt.event === 'reaction' && evt.data.postId === id && post.reactions) {
					const counts = evt.data.reactions as Record<string, number>;
					post = {
						...post,
						reactions: post.reactions.map((r) => ({
							...r,
							count: counts[r.emoji] ?? r.count,
						})),
					};
				} else if (evt.event === 'new_comment' && evt.data.postId === id) {
					post = { ...post, commentCount: (post.commentCount ?? 0) + 1 };
				} else if (evt.event === 'delete' && evt.data.type === 'post' && evt.data.id === id) {
					addToast('This post has been deleted', 'info');
					goto('/');
				}
			});
			live = conn;
			unsub = off;
		}
	});

	onDestroy(() => {
		unsub?.();
		live?.close();
	});

	async function loadPost(id: string) {
		loading = true;
		error = '';
		try {
			post = await api.get<Post>(`/api/posts/${id}`);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Post not found';
			addToast('Failed to load post', 'error');
		} finally {
			loading = false;
		}
	}

	async function deletePost() {
		if (!post || deleting) return;
		if (!confirm('Delete this post? This cannot be undone.')) return;
		deleting = true;
		try {
			await api.delete(`/api/posts/${post.id}`);
			addToast('Post deleted', 'success');
			goto('/');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to delete post', 'error');
		} finally {
			deleting = false;
		}
	}

	let editingTags = $state(false);
	let savingTags = $state(false);

	async function handleTagUpdate(newTags: string[]) {
		if (!post || savingTags) return;
		savingTags = true;
		try {
			await api.patch(`/api/posts/${post.id}`, { tags: newTags });
			post = { ...post, tags: newTags, isGolden: computeIsGolden(post.reactions, post.upvotes, post.downvotes) };
			addToast('Tags updated', 'success');
			editingTags = false;
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to update tags', 'error');
		} finally {
			savingTags = false;
		}
	}
</script>

<svelte:head>
	{#if post}
		<title>{post.title} — AI Hall of Shame</title>
		<meta name="description" content={data.ogDescription || 'An AI fail story on AI Hall of Shame'} />
		<!-- Open Graph -->
		<meta property="og:type" content="article" />
		<meta property="og:title" content={post.title} />
		<meta property="og:description" content={data.ogDescription || 'An AI fail story on AI Hall of Shame'} />
		<meta property="og:site_name" content="AI Hall of Shame" />
		<meta property="og:url" content={`https://hallofshame.cc/post/${post.id}`} />
		<!-- Twitter Card -->
		<meta name="twitter:card" content="summary" />
		<meta name="twitter:title" content={post.title} />
		<meta name="twitter:description" content={data.ogDescription || 'An AI fail story on AI Hall of Shame'} />
	{:else}
		<title>Post not found — AI Hall of Shame</title>
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
	<article class="rounded-xl border p-5
		{post.isGolden
			? 'border-golden bg-shame-900/50 golden-card'
			: 'border-shame-700 bg-shame-900/50'}">
		{#if post.isGolden}
			<div class="mb-3 inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-sm font-bold text-amber-400">
				🏆 Golden Post
			</div>
		{/if}
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
		<!-- Tags display/edit -->
		<div class="mt-4">
			{#if editingTags && isOwner}
				<TagInput tags={post.tags ?? []} onchange={handleTagUpdate} />
				<button
					onclick={() => (editingTags = false)}
					class="mt-1 text-xs text-shame-300 hover:text-shame-100 transition-colors"
				>Cancel</button>
			{:else}
				<div class="flex items-center gap-2 flex-wrap">
					{#if post.tags && post.tags.length > 0}
						{#each post.tags as tag}
							<a
								href="/?tag={tag}"
							class="inline-block rounded-full border px-2.5 py-0.5 text-xs hover:brightness-125 transition-all"
							style={tagStyle(tag)}
							>#{tag}</a>
						{/each}
					{/if}
					{#if isOwner}
						<button
							onclick={() => (editingTags = true)}
							class="text-xs text-shame-300/60 hover:text-neon-400 transition-colors"
						>{post.tags?.length ? '✏️' : '+ Add tags'}</button>
					{/if}
				</div>
			{/if}
		</div>
		{#if post.reactions}
			<div class="mt-4 pt-3 border-t border-shame-700/50">
				<ReactionBar postId={post.id} reactions={post.reactions} />
			</div>
		{/if}
		<div class="mt-3 pt-3 border-t border-shame-700/50 flex items-center justify-end">
			<MoreActions
				targetType="post"
				targetId={post.id}
				targetTitle={post.title}
				showDelete={!!isOwner}
				{deleting}
				ondelete={deletePost}
			/>
		</div>
	</article>

	<div class="mt-6">
		<CommentSection postId={post.id} />
	</div>

	<div class="mt-6">
		<a href="/" class="text-sm text-neon-400 hover:text-neon-500">← Back to feed</a>
	</div>
{/if}
