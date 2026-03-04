<script lang="ts">
	import type { Comment } from '$lib/types';
	import VoteButtons from './VoteButtons.svelte';
	import ReportButton from './ReportButton.svelte';
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';
	import { timeAgo } from '$lib/utils/time';
	import { renderMarkdown } from '$lib/utils/markdown';

	interface Props {
		comment: Comment;
		postId: string;
		ondeleted?: () => void;
	}

	let { comment, postId, ondeleted }: Props = $props();

	let deleting = $state(false);

	const displayName = $derived(comment.displayName || comment.username);
	const renderedBody = $derived(renderMarkdown(comment.body));
	const isOwner = $derived($auth.userId === comment.userId);

	async function deleteComment() {
		if (deleting) return;
		if (!confirm('Delete this comment?')) return;
		deleting = true;
		try {
			await api.delete(`/api/posts/${postId}/comments?commentId=${comment.id}`);
			addToast('Comment deleted', 'success');
			ondeleted?.();
		} catch (e: any) {
			addToast(e.message || 'Failed to delete', 'error');
		} finally {
			deleting = false;
		}
	}
</script>

<div class="rounded-lg border border-shame-700/50 bg-shame-900/30 p-3">
	<div class="flex gap-3">
		<div class="flex-shrink-0">
			<VoteButtons
				targetId={comment.id}
				targetType="comment"
				upvotes={comment.upvotes}
				downvotes={comment.downvotes}
				userVote={comment.userVote ?? null}
			/>
		</div>
		<div class="min-w-0 flex-1">
			<div class="prose prose-sm prose-invert max-w-none markdown-preview">
				{@html renderedBody}
			</div>
			<div class="mt-2 flex items-center justify-between">
				<div class="flex items-center gap-2 text-xs text-shame-300">
					<span>{displayName}</span>
					<span>·</span>
					<span>{timeAgo(comment.createdAt)}</span>
				</div>
				<div class="flex items-center gap-2">
					<ReportButton targetType="comment" targetId={comment.id} />
					{#if isOwner}
						<button
							onclick={deleteComment}
							disabled={deleting}
							class="text-xs text-shame-300 hover:text-error-500 disabled:opacity-50 transition-colors"
						>
							{deleting ? '...' : '🗑️'}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
