<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';
	import type { Comment } from '$lib/types';
	import CommentItem from './CommentItem.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import EmptyState from './EmptyState.svelte';
	import MarkdownEditor from './MarkdownEditor.svelte';

	interface Props {
		postId: string;
	}

	let { postId }: Props = $props();

	let comments = $state<Comment[]>([]);
	let loading = $state(true);
	let body = $state('');
	let submitting = $state(false);

	$effect(() => {
		postId;
		loadComments();
	});

	async function loadComments() {
		loading = true;
		try {
			const res = await api.get<{ data: Comment[] }>(`/api/posts/${postId}/comments`);
			comments = res.data;
		} catch {
			addToast('Failed to load comments', 'error');
		} finally {
			loading = false;
		}
	}

	async function submitComment() {
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
	{/if}
</section>
