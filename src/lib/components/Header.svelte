<script lang="ts">
	import { auth, logout } from '$lib/stores/auth';
	import PasskeyAuth from './PasskeyAuth.svelte';

	let showAuth = $state(false);
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
				<span class="text-shame-200 text-sm hidden sm:inline">
					{$auth.username}
				</span>
				<a
					href="/submit"
					class="rounded-lg bg-neon-500 px-3 py-1.5 text-sm font-medium text-shame-950 hover:bg-neon-400 transition-colors"
				>
					+ Post
				</a>
				<button
					onclick={() => logout()}
					class="rounded-lg border border-shame-600 px-3 py-1.5 text-sm text-shame-200 hover:bg-shame-800 transition-colors"
				>
					Sign Out
				</button>
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
