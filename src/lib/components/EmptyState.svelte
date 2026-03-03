<script lang="ts">
	interface Props {
		message?: string;
	}

	let { message = 'Nothing here yet.' }: Props = $props();
</script>

<div class="rounded-xl border border-dashed border-shame-700 py-12 text-center">
	<p class="text-3xl mb-2">🤷</p>
	<p class="text-sm text-shame-300">{message}</p>
</div>
