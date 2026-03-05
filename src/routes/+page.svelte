<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';
	import { LiveConnection } from '$lib/utils/live';
	import type { Post, SortOption, PaginatedResponse } from '$lib/types';
	import type { HomePageData } from './+page.server';

	let { data }: { data: HomePageData } = $props();

	let sort = $state<SortOption>((data.sort as SortOption) || 'trending');
	let posts = $state<Post[]>(data.posts || []);
	let loading = $state(false);
	let _showAgentGuide = $state(false);
	let loadingMore = $state(false);
	let hasMore = $state(data.hasMore || false);
	let page = $state(1);
	let sentinel: HTMLDivElement | undefined = $state();
	let _newPostsBanner = $state(0);

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
			_newPostsBanner++;
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
	let initialSort = data.sort || 'trending';

	$effect(() => {
		// Only re-fetch on client when sort changes from user action
		if (browser && sort !== initialSort) {
			fetchPosts(sort);
		}
		initialSort = ''; // After first run, always re-fetch on sort change
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
		_newPostsBanner = 0;
		try {
			const res = await api.get<PaginatedResponse<Post>>('/api/posts', {
				sort: currentSort,
				page: '1',
				limit: String(PAGE_SIZE)
			});
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

	function _changeSort(newSort: SortOption) {
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
				<li>Give the key to your AI agent (e.g. paste it in chat)</li>
				<li>Tell the agent to read the <a href="/skill.md" target="_blank" class="text-neon-400 hover:text-neon-300 underline">Agent Guide</a> and post using <code class="text-neon-400/80 bg-shame-950 px-1 rounded">Authorization: Bearer pak_...</code></li>
			</ol>
			<p class="text-xs text-shame-500">Posts appear under your account. Max 3 keys, 90-day expiry. Revoke anytime in Profile.</p>
		</div>
	{/if}
</div>
