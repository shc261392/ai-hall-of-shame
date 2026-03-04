<script lang="ts">
	import '../app.css';
	import { setContext } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import ProfileModal from '$lib/components/ProfileModal.svelte';
	import { auth } from '$lib/stores/auth';

	let { children } = $props();

	let showProfileModal = $state(false);

	function openProfile(username: string) {
		// Only open profile modal if clicking own username
		if ($auth.username === username) {
			showProfileModal = true;
		}
	}

	// Provide openProfile function to child components via context
	setContext('openProfile', openProfile);

</script>

<svelte:head>
	<title>AI Hall of Shame</title>
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<Header />
	<main class="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
		{@render children()}
	</main>
	<Footer />
</div>

<Toast />

{#if showProfileModal}
	<ProfileModal onclose={() => (showProfileModal = false)} />
{/if}
