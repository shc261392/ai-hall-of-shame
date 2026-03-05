<script lang="ts">
	import { onDestroy } from 'svelte';
	import HeroBanner from '$lib/components/HeroBanner.svelte';
	import FilterTabs from '$lib/components/FilterTabs.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';
	import { LiveConnection } from '$lib/utils/live';
	import type { Post, SortOption, PaginatedResponse } from '$lib/types';

	let sort = $state<SortOption>('trending');
	let posts = $state<Post[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(false);
	let page = $state(1);
	let sentinel: HTMLDivElement | undefined = $state();
	let newPostsBanner = $state(0);

	const PAGE_SIZE = 50;

	// Real-time connection
	const live = new LiveConnection('feed');
	const unsub = live.on((evt) => {
		if (evt.event === 'vote' && evt.data.targetType === 'post') {
			posts = posts.map((p) =>
				p.id === evt.data.targetId
					? { ...p, upvotes: evt.data.upvotes as number, downvotes: evt.data.downvotes as number }
					: p,
			);
		} else if (evt.event === 'reaction') {
			posts = posts.map((p) => {
				if (p.id !== evt.data.postId || !p.reactions) return p;
				const counts = evt.data.reactions as Record<string, number>;
				return {
					...p,
					reactions: p.reactions.map((r) => ({
						...r,
						count: counts[r.emoji] ?? r.count,
					})),
				};
			});
		} else if (evt.event === 'new_post') {
			newPostsBanner++;
		} else if (evt.event === 'new_comment') {
			posts = posts.map((p) =>
				p.id === evt.data.postId
					? { ...p, commentCount: (p.commentCount ?? 0) + 1 }
					: p,
			);
		} else if (evt.event === 'delete' && evt.data.type === 'post') {
			posts = posts.filter((p) => p.id !== evt.data.id);
		}
	});
	onDestroy(() => {
		unsub();
		live.close();
	});

	$effect(() => {
		// Re-fetch when sort changes
		fetchPosts(sort);
	});

	// IntersectionObserver for infinite scroll
	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
					loadMore();
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	async function fetchPosts(currentSort: SortOption) {
		loading = true;
		newPostsBanner = 0;
		try {
			const res = await api.get<PaginatedResponse<Post>>('/api/posts', {
				sort: currentSort,
				page: '1',
				limit: String(PAGE_SIZE)
			});
			posts = res.data;
			hasMore = res.has_more;
			page = 1;
		} catch {
			addToast('Failed to load posts', 'error');
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		loadingMore = true;
		try {
			const nextPage = page + 1;
			const res = await api.get<PaginatedResponse<Post>>('/api/posts', {
				sort,
				page: String(nextPage),
				limit: String(PAGE_SIZE)
			});
			posts = [...posts, ...res.data];
			hasMore = res.has_more;
			page = nextPage;
		} catch {
			addToast('Failed to load more posts', 'error');
		} finally {
			loadingMore = false;
		}
	}

	function changeSort(newSort: SortOption) {
		sort = newSort;
	}
</script>

<HeroBanner />

<div class="mb-6">
	<FilterTabs active={sort} onchange={changeSort} />
</div>

{#if loading}
	<LoadingSpinner />
{:else if posts.length === 0}
	<EmptyState message="No AI fails yet. Be the first to share one!" actionHref="/submit" actionLabel="✨ Submit an AI Fail" />
{:else}
	{#if newPostsBanner > 0}
		<button
			onclick={() => fetchPosts(sort)}
			class="mb-3 w-full rounded-lg bg-neon-500/10 border border-neon-500/30 py-2 text-sm text-neon-400 hover:bg-neon-500/20 transition-colors animate-fade-in"
		>
			🆕 {newPostsBanner} new {newPostsBanner === 1 ? 'post' : 'posts'} — click to refresh
		</button>
	{/if}
	<div class="space-y-3">
		{#each posts as post (post.id)}
			<PostCard {post} />
		{/each}
	</div>

	{#if hasMore}
		<div bind:this={sentinel} class="mt-6 flex justify-center py-4">
			{#if loadingMore}
				<LoadingSpinner />
			{:else}
				<span class="text-sm text-shame-400">Scroll for more</span>
			{/if}
		</div>
	{/if}
{/if}
