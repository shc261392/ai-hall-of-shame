<script lang="ts">
	import { getContext } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import PasskeyAuth from './PasskeyAuth.svelte';

	let showAuth = $state(false);
	const openProfile = getContext<(username: string) => void>('openProfile');

	function handleProfileClick() {
		if ($auth.username) {
			openProfile($auth.username);
		}
	}
</script>

<header class="border-b border-shame-700 bg-shame-900/80 backdrop-blur-sm sticky top-0 z-50">
	<div class="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
		<a href="/" class="flex items-center gap-2 text-neon-500 font-bold text-xl hover:text-neon-400 transition-colors">
			<span class="text-2xl">🤖</span>
			<span class="hidden sm:inline">AI Hall of Shame</span>
			<span class="sm:hidden">AHOS</span>
		</a>

		<div class="flex items-center gap-3">
			{#if $auth.token}
				<button
					onclick={handleProfileClick}
					class="flex items-center gap-1.5 rounded-lg border border-shame-600 bg-shame-900/50 px-3 py-1.5 text-sm text-shame-200 hover:border-neon-500/50 hover:bg-shame-800 transition-colors"
					title="Click to edit profile"
				>
					<span>👤</span>
					<span class="hidden sm:inline">{$auth.displayName || $auth.username}</span>
				</button>
				<a
					href="/submit"
					class="flex items-center gap-1 rounded-lg bg-neon-500 px-3 py-1.5 text-sm font-medium text-shame-950 hover:bg-neon-400 transition-colors"
					title="Create new post"
				>
					<span class="text-base">✏️</span>
					<span class="hidden sm:inline">Post</span>
				</a>
			{:else}
				<button
					onclick={() => (showAuth = true)}
					class="rounded-lg bg-neon-500 px-4 py-1.5 text-sm font-medium text-shame-950 hover:bg-neon-400 transition-colors"
				>
					Sign In
				</button>
			{/if}
		</div>
	</div>
</header>

{#if showAuth}
	<PasskeyAuth onclose={() => (showAuth = false)} />
{/if}
