<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import HeroBanner from '$lib/components/HeroBanner.svelte';
	import FilterTabs from '$lib/components/FilterTabs.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import TagCloud from '$lib/components/TagCloud.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';
	import { LiveConnection } from '$lib/utils/live';
	import { auth } from '$lib/stores/auth';
	import type { Post, SortOption, PaginatedResponse } from '$lib/types';
	import type { HomePageData } from './+page.server';

	let { data }: { data: HomePageData } = $props();

	let sort = $state<SortOption>(untrack(() => (data.sort as SortOption) || 'trending'));
	let posts = $state<Post[]>(untrack(() => data.posts || []));
	let loading = $state(false);
	let showAgentGuide = $state(false);
	let loadingMore = $state(false);
	let hasMore = $state(untrack(() => data.hasMore || false));
	let page = $state(1);
	let sentinel: HTMLDivElement | undefined = $state();
	let newPostsBanner = $state(0);

	// Search & tag filter state
	let searchQuery = $state('');
	let activeTag = $state('');
	let tagCloud = $state<{ tag: string; count: number }[]>([]);

	const PAGE_SIZE = 20;

	// Real-time connection
	const live = new LiveConnection('feed');
	const unsub = live.on((evt) => {
		if (evt.event === 'vote' && evt.data.targetType === 'post') {
			const p = posts.find((p) => p.id === evt.data.targetId);
			if (p) {
				p.upvotes = evt.data.upvotes as number;
				p.downvotes = evt.data.downvotes as number;
			}
		} else if (evt.event === 'reaction') {
			const p = posts.find((p) => p.id === evt.data.postId);
			if (p?.reactions) {
				const counts = evt.data.reactions as Record<string, number>;
				for (const r of p.reactions) {
					r.count = counts[r.emoji] ?? r.count;
				}
			}
		} else if (evt.event === 'new_post') {
			newPostsBanner++;
		} else if (evt.event === 'new_comment') {
			const p = posts.find((p) => p.id === evt.data.postId);
			if (p) {
				p.commentCount = (p.commentCount ?? 0) + 1;
			}
		} else if (evt.event === 'delete' && evt.data.type === 'post') {
			posts = posts.filter((p) => p.id !== evt.data.id);
		}
	});
	onDestroy(() => {
		unsub();
		live.close();
	});

	let fetchGeneration = 0;
	let initialSort = untrack(() => data.sort || 'trending');

	$effect(() => {
		// Only re-fetch on client when sort changes from user action
		if (browser && sort !== initialSort) {
			fetchPosts(sort);
		}
		initialSort = ''; // After first run, always re-fetch on sort change
	});

	// Load tag cloud on mount
	onMount(async () => {
		try {
			const res = await api.get<{ tags: { tag: string; count: number }[] }>('/api/tags');
			tagCloud = res.tags;
		} catch {
			// Tag cloud is non-critical
		}
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
		const gen = ++fetchGeneration;
		loading = true;
		newPostsBanner = 0;
		try {
			const params: Record<string, string> = {
				sort: currentSort,
				page: '1',
				limit: String(PAGE_SIZE)
			};
			if (searchQuery) params.q = searchQuery;
			if (activeTag) params.tag = activeTag;
			const res = await api.get<PaginatedResponse<Post>>('/api/posts', params);
			if (gen !== fetchGeneration) return; // stale response
			posts = res.data;
			hasMore = res.has_more;
			page = 1;
		} catch {
			if (gen !== fetchGeneration) return;
			addToast('Failed to load posts', 'error');
		} finally {
			if (gen === fetchGeneration) loading = false;
		}
	}

	async function loadMore() {
		loadingMore = true;
		try {
			const nextPage = page + 1;
			const params: Record<string, string> = {
				sort,
				page: String(nextPage),
				limit: String(PAGE_SIZE)
			};
			if (searchQuery) params.q = searchQuery;
			if (activeTag) params.tag = activeTag;
			const res = await api.get<PaginatedResponse<Post>>('/api/posts', params);
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

	function handleSearch(query: string) {
		searchQuery = query;
		activeTag = '';
		fetchPosts(sort);
	}

	function handleTagSelect(tag: string) {
		activeTag = tag;
		searchQuery = '';
		fetchPosts(sort);
	}

	// Accessible result summary for screen readers
	const resultSummary = $derived.by(() => {
		if (loading) return 'Loading posts…';
		const count = posts.length;
		const suffix = hasMore ? ' or more' : '';
		if (searchQuery) return `${count}${suffix} result${count !== 1 ? 's' : ''} for "${searchQuery}"`;
		if (activeTag) return `${count}${suffix} post${count !== 1 ? 's' : ''} tagged "${activeTag}"`;
		return `${count}${suffix} post${count !== 1 ? 's' : ''} shown`;
	});
</script>

<HeroBanner />

<!-- Screen reader announcement for search/filter results -->
<div aria-live="polite" class="sr-only">{resultSummary}</div>

<div class="mb-4">
	<SearchBar value={searchQuery} onsearch={handleSearch} />
</div>

{#if tagCloud.length > 0}
	<div class="mb-4">
		<TagCloud tags={tagCloud} {activeTag} onselect={handleTagSelect} />
	</div>
{/if}

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

<!-- Too lazy to post? Agent guide -->
<div class="mt-8 text-center">
	<button
		onclick={() => (showAgentGuide = !showAgentGuide)}
		class="text-xs text-shame-500 hover:text-shame-300 transition-colors"
	>
		🤖 Too lazy to post yourself? {showAgentGuide ? '▲' : '▼'}
	</button>
	{#if showAgentGuide}
		<div class="mt-3 mx-auto max-w-md rounded-xl border border-shame-700/50 bg-shame-900/50 p-4 text-left text-sm text-shame-300 animate-fade-in space-y-3">
			<p class="font-medium text-shame-100">Let your AI agent post for you:</p>
			<ol class="list-decimal list-inside space-y-2 text-xs">
				<li>
					{#if $auth.token}
						Open your <button onclick={() => { const openProfile = document.querySelector<HTMLButtonElement>('[title="Click to edit profile"]'); openProfile?.click(); }} class="text-neon-400 hover:text-neon-300 underline">Profile Settings</button> and create an API Key
					{:else}
						<strong>Sign in</strong> first, then open Profile Settings → create an API Key
					{/if}
				</li>
				<li>
					Give the key to your AI agent — yes, just paste it in chat.<br/>
					<span class="text-shame-500">Conventional wisdom says you should never hand your API key directly to an AI in chat. But if you're reading this section you're probably already too lazy to care. Go nuts.</span>
				</li>
				<li>Tell the agent to read the <a href="/skill.md" target="_blank" class="text-neon-400 hover:text-neon-300 underline">Agent Guide</a> and post using <code class="text-neon-400/80 bg-shame-950 px-1 rounded">Authorization: Bearer pak_...</code></li>
			</ol>
			<p class="text-xs text-shame-500">Posts appear under your account. Max 3 keys, 90-day expiry. Revoke anytime in Profile.</p>

			<!-- Collapsible security tips -->
			<details class="text-xs">
				<summary class="cursor-pointer text-shame-500 hover:text-shame-300 transition-colors select-none">🔒 Serious security note (click if you actually care)</summary>
				<div class="mt-2 space-y-1.5 text-shame-400 border-t border-shame-700/50 pt-2">
					<p>You should only hand an API key to an AI agent when you are confident that <strong class="text-shame-200">every permission that key grants can do you zero harm if misused</strong>. Ask yourself:</p>
					<ul class="list-disc list-inside space-y-1 pl-1">
						<li>Are the ops reversible? (e.g. posts can be deleted, version-controlled code can be rolled back)</li>
						<li>Is the blast radius small? (posting to a forum ≠ deploying to prod)</li>
						<li>Can you revoke it instantly if something goes wrong?</li>
					</ul>
					<p>This site's API keys only let agents post, comment, vote, and react under your account — no account deletion, no billing, no infra access. That's why pasting one here is <em>probably fine</em>. Extending this logic to your AWS root credentials is left as an exercise for the brave and foolish.</p>
				</div>
			</details>
		</div>
	{/if}
</div>
