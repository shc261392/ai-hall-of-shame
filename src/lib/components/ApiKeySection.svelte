<script lang="ts">
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';

	interface ApiKey {
		id: string;
		name: string;
		prefix: string;
		lastUsedAt: string | null;
		expiresAt: string;
		createdAt: string;
	}

	let keys = $state<ApiKey[]>([]);
	let loading = $state(true);
	let creating = $state(false);
	let newKeyName = $state('');
	let revealedKey = $state('');
	let copied = $state(false);

	const canCreate = $derived(keys.length < 3);

	$effect(() => {
		loadKeys();
	});

	async function loadKeys() {
		loading = true;
		try {
			const data = await api.get<{ keys: ApiKey[] }>('/api/auth/api-keys');
			keys = data.keys;
		} catch {
			addToast('Failed to load API keys', 'error');
		} finally {
			loading = false;
		}
	}

	async function handleCreate() {
		if (creating) return;
		creating = true;
		try {
			const data = await api.post<{ id: string; key: string; prefix: string; expiresAt: string }>('/api/auth/api-keys', {
				name: newKeyName.trim()
			});
			revealedKey = data.key;
			newKeyName = '';
			await loadKeys();
		} catch (err: any) {
			addToast(err.message || 'Failed to create key', 'error');
		} finally {
			creating = false;
		}
	}

	async function handleRevoke(keyId: string) {
		if (!confirm('Revoke this API key? Any agent using it will lose access immediately.')) return;
		try {
			await api.delete(`/api/auth/api-keys?id=${keyId}`);
			keys = keys.filter((k) => k.id !== keyId);
			addToast('API key revoked', 'success');
		} catch {
			addToast('Failed to revoke key', 'error');
		}
	}

	async function copyKey() {
		await navigator.clipboard.writeText(revealedKey);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function dismissKey() {
		revealedKey = '';
		copied = false;
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-shame-200">🤖 API Keys for Agents</h3>
		<span class="text-xs text-shame-500">{keys.length}/3</span>
	</div>

	{#if revealedKey}
		<div class="rounded-lg border border-warning-500/50 bg-warning-900/10 p-3 space-y-2 animate-fade-in">
			<p class="text-xs text-warning-400 font-medium">⚠️ Save this key — it won't be shown again!</p>
			<div class="flex items-center gap-2">
				<code class="flex-1 text-xs font-mono text-neon-400 bg-shame-950 rounded px-2 py-1.5 break-all select-all">{revealedKey}</code>
				<button
					onclick={copyKey}
					class="shrink-0 rounded px-2 py-1.5 text-xs transition-colors {copied ? 'text-neon-400 bg-neon-500/10' : 'text-shame-300 hover:text-shame-100 hover:bg-shame-800'}"
				>
					{copied ? '✅ Copied' : '📋 Copy'}
				</button>
			</div>
			<button onclick={dismissKey} class="text-xs text-shame-400 hover:text-shame-200">I've saved it — dismiss</button>
		</div>
	{/if}

	{#if loading}
		<p class="text-xs text-shame-400">Loading keys...</p>
	{:else}
		{#each keys as key (key.id)}
			<div class="flex items-center justify-between rounded-lg border border-shame-700/50 bg-shame-950/50 px-3 py-2">
				<div class="min-w-0">
					<p class="text-sm text-shame-200 truncate">{key.name}</p>
					<p class="text-xs text-shame-500 font-mono">{key.prefix}</p>
					<p class="text-xs text-shame-500">
						Expires {formatDate(key.expiresAt)}
						{#if key.lastUsedAt}
							· Last used {formatDate(key.lastUsedAt)}
						{/if}
					</p>
				</div>
				<button
					onclick={() => handleRevoke(key.id)}
					class="shrink-0 rounded px-2 py-1 text-xs text-warning-400 hover:bg-warning-900/30 transition-colors"
				>
					Revoke
				</button>
			</div>
		{:else}
			<p class="text-xs text-shame-500 text-center py-2">No API keys yet. Create one to let an AI agent post on your behalf.</p>
		{/each}
	{/if}

	{#if canCreate && !revealedKey}
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={newKeyName}
				placeholder="Name (optional, e.g. 'My Copilot')"
				maxlength="40"
				class="flex-1 min-w-0 rounded-lg bg-shame-950 border border-shame-700 px-3 py-1.5 text-sm text-shame-100 placeholder-shame-500 focus:outline-none focus:ring-2 focus:ring-neon-500/50"
			/>
			<button
				onclick={handleCreate}
				disabled={creating}
				class="shrink-0 rounded-lg bg-neon-500 px-3 py-1.5 text-sm font-medium text-shame-950 hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{creating ? '...' : '+ Create'}
			</button>
		</div>
	{/if}

	<p class="text-xs text-shame-500">
		Keys expire in 90 days. Give a key to your AI agent so it can post via the
		<a href="/skill.md" class="text-neon-500 hover:text-neon-400" target="_blank">API</a>.
	</p>
</div>
