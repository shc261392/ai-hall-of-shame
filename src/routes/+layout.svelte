<script lang="ts">
	import '../app.css';
	import { setContext } from 'svelte';

	let { children } = $props();

	let _showProfileModal = $state(false);

	function openProfile(username: string) {
		// Only open profile modal if clicking own username
		if ($auth.username === username) {
			_showProfileModal = true;
		}
	}

	// Provide openProfile function to child components via context
	setContext('openProfile', openProfile);

</script>

<svelte:head>
	<title>AI Hall of Shame</title>
	<meta name="description" content="Community-curated collection of the funniest and most embarrassing AI failures. Vote, react, and share the best AI blunders." />
	<!-- Default Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="AI Hall of Shame" />
	<meta property="og:title" content="AI Hall of Shame" />
	<meta property="og:description" content="Community-curated collection of the funniest and most embarrassing AI failures." />
	<meta property="og:url" content="https://hallofshame.cc" />
	<!-- Default Twitter Card -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="AI Hall of Shame" />
	<meta name="twitter:description" content="Community-curated collection of the funniest and most embarrassing AI failures." />
</svelte:head>

<a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-neon-500 focus:px-4 focus:py-2 focus:text-shame-950 focus:font-medium">
	Skip to main content
</a>

<div class="flex min-h-dvh flex-col">
	<Header />
	<main id="main-content" class="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
		{@render children()}
	</main>
	<Footer />
</div>

<Toast />

{#if showProfileModal}
	<ProfileModal onclose={() => (showProfileModal = false)} />
{/if}
