<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';

	interface Props {
		targetId: string;
		targetType: 'post' | 'comment';
		upvotes: number;
		downvotes: number;
		userVote: number | null;
	}

	let { targetId, targetType, upvotes, downvotes, userVote }: Props = $props();

	let localUpvotes = $state(0);
	let localDownvotes = $state(0);
	let localUserVote = $state<number | null>(null);
	let voting = $state(false);

	$effect(() => {
		if (!voting) {
			localUpvotes = upvotes;
			localDownvotes = downvotes;
			localUserVote = userVote;
		}
	});

	async function vote(value: 1 | -1) {
		if (!$auth.token) {
			addToast('Sign in to vote', 'info');
			return;
		}
		if (voting) return;
		voting = true;

		// Optimistic update
		const prevUp = localUpvotes;
		const prevDown = localDownvotes;
		const prevVote = localUserVote;

		if (localUserVote === value) {
			// Toggle off
			if (value === 1) localUpvotes--;
			else localDownvotes--;
			localUserVote = null;
		} else {
			// New or flip
			if (localUserVote === 1) localUpvotes--;
			if (localUserVote === -1) localDownvotes--;
			if (value === 1) localUpvotes++;
			else localDownvotes++;
			localUserVote = value;
		}

		try {
			const result = await api.post<{ vote: number | null }>('/api/votes', {
				targetId,
				targetType,
				value
			});
			localUserVote = result.vote;
		} catch {
			// Rollback
			localUpvotes = prevUp;
			localDownvotes = prevDown;
			localUserVote = prevVote;
			addToast('Vote failed', 'error');
		} finally {
			voting = false;
		}
	}

	let score = $derived(localUpvotes - localDownvotes);
	let bumping = $state(false);
	let prevScore: number | undefined;

	$effect(() => {
		if (prevScore !== undefined && score !== prevScore) {
			bumping = true;
			setTimeout(() => (bumping = false), 300);
		}
		prevScore = score;
	});
</script>

<div class="flex items-center gap-1">
	<button
		onclick={() => vote(1)}
		class="rounded p-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center {localUserVote === 1
			? 'text-flame-500'
			: 'text-shame-300 hover:text-flame-400'}"
		aria-label="Upvote"
		title="Upvote — this post is funny, educational, or a well-documented AI fail"
	>
		<svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
			<path d="M10 3l7 7h-4v7H7v-7H3l7-7z" />
		</svg>
	</button>
	<span class="min-w-[2ch] text-center text-sm font-medium {bumping ? 'animate-bump' : ''} {score > 0 ? 'text-flame-400' : score < 0 ? 'text-ice-400' : 'text-shame-300'}">
		{score}
	</span>
	<button
		onclick={() => vote(-1)}
		class="rounded p-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center {localUserVote === -1
			? 'text-ice-500'
			: 'text-shame-300 hover:text-ice-400'}"
		aria-label="Downvote"
		title="Downvote — this post is low-effort, off-topic, or not actually an AI fail"
	>
		<svg class="w-5 h-5 rotate-180" viewBox="0 0 20 20" fill="currentColor">
			<path d="M10 3l7 7h-4v7H7v-7H3l7-7z" />
		</svg>
	</button>
</div>
