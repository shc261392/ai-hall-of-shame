<script lang="ts">
	import HeroBanner from '$lib/components/HeroBanner.svelte';
	import FilterTabs from '$lib/components/FilterTabs.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';
	import type { Post, SortOption, PaginatedResponse } from '$lib/types';

	let sort = $state<SortOption>('trending');
	let posts = $state<Post[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(false);
	let page = $state(1);

	$effect(() => {
		// Re-fetch when sort changes
		fetchPosts(sort);
	});

	async function fetchPosts(currentSort: SortOption) {
		loading = true;
		try {
			const res = await api.get<PaginatedResponse<Post>>('/api/posts', {
				sort: currentSort,
				page: '1',
				limit: '20'
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
				limit: '20'
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
	<div class="space-y-3">
		{#each posts as post (post.id)}
			<PostCard {post} />
		{/each}
	</div>

	{#if hasMore}
		<div class="mt-6 text-center">
			<button
				onclick={loadMore}
				disabled={loadingMore}
				class="rounded-lg border border-shame-600 px-6 py-2 text-sm text-shame-200 hover:bg-shame-800 disabled:opacity-50 transition-colors"
			>
				{loadingMore ? 'Loading...' : 'Load More Fails'}
			</button>
		</div>
	{/if}
{/if}
