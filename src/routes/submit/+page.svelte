<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';

	let title = $state('');
	let body = $state('');
	let submitting = $state(false);

	// Redirect if not logged in
	$effect(() => {
		if (!$auth.token) {
			goto('/');
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title.trim() || submitting) return;
		submitting = true;
		try {
			const result = await api.post<{ id: string }>('/api/posts', {
				title: title.trim(),
				body: body.trim() || undefined
			});
			addToast('Post submitted! 🎉', 'success');
			goto(`/post/${result.id}`);
		} catch (e: any) {
			addToast(e.message || 'Failed to submit post', 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Submit — AI Hall of Shame</title>
</svelte:head>

<div class="mx-auto max-w-lg">
	<h1 class="text-2xl font-bold text-shame-100 mb-6">
		📝 Submit an AI Fail
	</h1>

	<form onsubmit={handleSubmit} class="space-y-4">
		<div>
			<label for="title" class="block text-sm font-medium text-shame-200 mb-1">
				Title <span class="text-error-500">*</span>
			</label>
			<input
				id="title"
				type="text"
				bind:value={title}
				placeholder="ChatGPT told me to eat rocks for vitamins"
				maxlength="200"
				class="w-full rounded-lg border border-shame-700 bg-shame-800 px-3 py-2 text-sm text-shame-100 placeholder:text-shame-300/50 focus:border-neon-500 focus:outline-none"
			/>
			<span class="text-xs text-shame-300">{title.length}/200</span>
		</div>

		<div>
			<label for="body" class="block text-sm font-medium text-shame-200 mb-1">
				Details <span class="text-shame-300">(optional)</span>
			</label>
			<textarea
				id="body"
				bind:value={body}
				placeholder="Tell us the full story of this AI catastrophe..."
				rows="8"
				maxlength="5000"
				class="w-full rounded-lg border border-shame-700 bg-shame-800 px-3 py-2 text-sm text-shame-100 placeholder:text-shame-300/50 focus:border-neon-500 focus:outline-none resize-none"
			></textarea>
			<span class="text-xs text-shame-300">{body.length}/5000</span>
		</div>

		<div class="flex items-center justify-between pt-2">
			<a href="/" class="text-sm text-shame-300 hover:text-neon-400">Cancel</a>
			<button
				type="submit"
				disabled={!title.trim() || submitting}
				class="rounded-lg bg-neon-500 px-6 py-2 font-medium text-shame-950 hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{submitting ? 'Submitting...' : 'Submit Fail'}
			</button>
		</div>
	</form>
</div>
