<script lang="ts">


	const _statusCode = $derived($page.status);
	const _errorMessage = $derived($page.error?.message || 'Something went wrong');
</script>

<svelte:head>
	<title>Error {statusCode} — AI Hall of Shame</title>
</svelte:head>

<div class="flex flex-col items-center justify-center py-20 text-center">
	<p class="text-6xl mb-4">💀</p>
	<h1 class="text-2xl font-bold text-shame-100 mb-2">Error {statusCode}</h1>
	<p class="text-shame-300 mb-6">{errorMessage}</p>
	<a
		href="/"
		class="rounded-lg bg-neon-500 px-6 py-2.5 font-medium text-shame-950 hover:bg-neon-400 transition-colors"
	>
		← Back to feed
	</a>
</div>
