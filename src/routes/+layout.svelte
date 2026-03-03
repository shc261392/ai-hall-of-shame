<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
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
