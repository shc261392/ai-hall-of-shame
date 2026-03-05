<script lang="ts">
	import type { Comment } from '$lib/types';
	import VoteButtons from './VoteButtons.svelte';
	import MoreActions from './MoreActions.svelte';
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
	// Memoize: only re-parse markdown when comment.body actually changes
	let cachedBody = $state('');
	let cachedHtml = $state('');
	const renderedBody = $derived.by(() => {
		const body = comment.body;
		if (body !== cachedBody) {
			cachedBody = body;
			cachedHtml = renderMarkdown(body);
		}
		return cachedHtml;
	});
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
				<MoreActions
					targetType="comment"
					targetId={comment.id}
					showDelete={isOwner}
					{deleting}
					ondelete={deleteComment}
				/>
			</div>
		</div>
	</div>
</div>
