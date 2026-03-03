<script lang="ts">
	import type { Comment } from '$lib/types';
	import VoteButtons from './VoteButtons.svelte';
	import { timeAgo } from '$lib/utils/time';

	interface Props {
		comment: Comment;
	}

	let { comment }: Props = $props();
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
			<p class="text-sm text-shame-100 whitespace-pre-wrap break-words">{comment.body}</p>
			<div class="mt-2 flex items-center gap-2 text-xs text-shame-300">
				<span>{comment.username}</span>
				<span>·</span>
				<span>{timeAgo(comment.createdAt)}</span>
			</div>
		</div>
	</div>
</div>
