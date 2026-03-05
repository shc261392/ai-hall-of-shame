<script lang="ts">

	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';
	import type { Comment, PaginatedResponse } from '$lib/types';

	interface Props {
		postId: string;
	}

	let { postId }: Props = $props();

	let comments = $state<Comment[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(false);
	let page = $state(1);
	let body = $state('');
	let submitting = $state(false);
	let sentinel: HTMLDivElement | undefined = $state();

	const PAGE_SIZE = 50;

	$effect(() => {
		postId;
		loadComments();
	});

	// IntersectionObserver for infinite scroll
	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
					loadMoreComments();
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	async function loadComments() {
		loading = true;
		try {
			const res = await api.get<PaginatedResponse<Comment>>(`/api/posts/${postId}/comments`, {
				page: '1',
				limit: String(PAGE_SIZE)
			});
			comments = res.data;
			hasMore = res.has_more;
			page = 1;
		} catch {
			addToast('Failed to load comments', 'error');
		} finally {
			loading = false;
		}
	}

	async function loadMoreComments() {
		loadingMore = true;
		try {
			const nextPage = page + 1;
			const res = await api.get<PaginatedResponse<Comment>>(`/api/posts/${postId}/comments`, {
				page: String(nextPage),
				limit: String(PAGE_SIZE)
			});
			comments = [...comments, ...res.data];
			hasMore = res.has_more;
			page = nextPage;
		} catch {
			addToast('Failed to load more comments', 'error');
		} finally {
			loadingMore = false;
		}
	}

	async function _submitComment() {
		if (!body.trim() || submitting) return;
		submitting = true;
		try {
			await api.post(`/api/posts/${postId}/comments`, { body: body.trim() });
			body = '';
			addToast('Comment posted!', 'success');
			await loadComments();
		} catch (e: any) {
			addToast(e.message || 'Failed to post comment', 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<section>
	<h2 class="text-lg font-bold text-shame-100 mb-4">
		💬 Comments
	</h2>

	{#if $auth.token}
		<div class="mb-6">
			<MarkdownEditor
				bind:value={body}
				onchange={(val) => (body = val)}
				label="Add a comment"
				placeholder="Share your thoughts on this AI disaster... (Markdown supported)"
				maxlength={5000}
				rows={6}
			/>
			<div class="mt-3 flex justify-end">
				<button
					onclick={submitComment}
					disabled={!body.trim() || submitting}
					class="rounded-lg bg-neon-500 px-6 py-2 font-medium text-shame-950 hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{submitting ? 'Posting...' : 'Post Comment'}
				</button>
			</div>
		</div>
	{/if}

	{#if loading}
		<LoadingSpinner />
	{:else if comments.length === 0}
		<EmptyState message="No comments yet. Be the first to roast this AI fail!" />
	{:else}
		<div class="space-y-3">
			{#each comments as comment (comment.id)}
				<CommentItem {comment} {postId} ondeleted={loadComments} />
			{/each}
		</div>

		{#if hasMore}
			<div bind:this={sentinel} class="mt-4 flex justify-center py-3">
				{#if loadingMore}
					<LoadingSpinner />
				{:else}
					<span class="text-sm text-shame-400">Scroll for more comments</span>
				{/if}
			</div>
		{/if}
	{/if}
</section>
