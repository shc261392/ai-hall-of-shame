<script lang="ts">
	import type { Post } from '$lib/types';
	import VoteButtons from './VoteButtons.svelte';
	import { timeAgo } from '$lib/utils/time';

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();
</script>

<a
	href="/post/{post.id}"
	class="block rounded-xl border border-shame-700 bg-shame-900/50 p-4 hover:border-shame-600 hover:bg-shame-800/50 transition-colors"
>
	<div class="flex gap-3">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="flex-shrink-0" onclick={(e) => e.preventDefault()}>
			<VoteButtons
				targetId={post.id}
				targetType="post"
				upvotes={post.upvotes}
				downvotes={post.downvotes}
				userVote={post.userVote ?? null}
			/>
		</div>
		<div class="min-w-0 flex-1">
			<h3 class="text-shame-100 font-medium leading-snug line-clamp-2">
				{post.title}
			</h3>
			{#if post.body}
				<p class="mt-1 text-sm text-shame-300 line-clamp-2">
					{post.body}
				</p>
			{/if}
			<div class="mt-2 flex items-center gap-3 text-xs text-shame-300">
				<span>{post.username}</span>
				<span>·</span>
				<span>{timeAgo(post.createdAt)}</span>
				<span>·</span>
				<span>💬 {post.commentCount}</span>
			</div>
		</div>
	</div>
</a>
