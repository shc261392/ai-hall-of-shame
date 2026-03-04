<script lang="ts">
	import { auth, updateDisplayName, logout } from "$lib/stores/auth";
	import { api } from "$lib/utils/api";

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let displayName = $state($auth.displayName || "");
	let loading = $state(false);
	let loadingUser = $state(false);
	let error = $state("");
	let success = $state(false);

	// Fetch current user data if displayName not in auth store
	$effect(() => {
		if (!$auth.displayName && $auth.token) {
			fetchUserData();
		}
	});

	async function fetchUserData() {
		loadingUser = true;
		try {
			const data = await api.get<{ displayName?: string }>("/api/auth/me");
			if (data.displayName) {
				updateDisplayName(data.displayName);
				displayName = data.displayName;
			}
		} catch (err) {
			console.error("Failed to fetch user data:", err);
		} finally {
			loadingUser = false;
		}
	}

	const isValid = $derived(
		displayName.trim().length > 0 &&
			displayName.length <= 20 &&
			/^[a-zA-Z0-9_]+$/.test(displayName),
	);

	async function handleSave() {
		if (!isValid) return;

		loading = true;
		error = "";
		success = false;

		try {
			const data = await api.patch<{ displayName: string }>("/api/auth/me", {
				displayName: displayName.trim(),
			});

			updateDisplayName(data.displayName);
			success = true;
			setTimeout(() => onclose(), 1500);
		} catch (err: any) {
			if (err.error === "display_name_taken") {
				error = "This display name is already taken";
			} else {
				error = err.message || "Failed to update display name";
			}
		} finally {
			loading = false;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleSignOut() {
		logout();
		onclose();
	}
</script>

<div
	role="dialog"
	tabindex="-1"
	aria-modal="true"
	aria-labelledby="profile-modal-title"
	class="fixed inset-0 z-50 flex items-center justify-center bg-shame-950/80 backdrop-blur-sm"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onclose()}
>
	<div class="mx-4 w-full max-w-md rounded-xl border border-shame-700 bg-shame-900 p-6 shadow-2xl">
		<div class="mb-6 flex items-center justify-between">
			<h2 id="profile-modal-title" class="text-xl font-bold text-neon-400">Profile Settings</h2>
			<button
				onclick={onclose}
				class="text-shame-400 hover:text-shame-100 transition-colors"
				aria-label="Close modal"
			>
				✕
			</button>
		</div>

		<!-- Username (immutable) -->
		<div class="mb-4">
			<span class="block text-sm font-medium text-shame-400 mb-1">Username (system)</span>
			<div class="rounded-lg bg-shame-950 border border-shame-700 px-4 py-2 text-shame-500">
				@{$auth.username || "unknown"}
			</div>
			<p class="mt-1 text-xs text-shame-500">Your unique system identifier (cannot be changed)</p>
		</div>

		<!-- Display Name (editable) -->
		<div class="mb-6">
			<label for="display-name-input" class="block text-sm font-medium text-shame-200 mb-2">
				Display Name
			</label>
			<input
				id="display-name-input"
				type="text"
				bind:value={displayName}
				maxlength="20"
				placeholder="Enter display name"
				disabled={loading || success || loadingUser}
				class="w-full rounded-lg bg-shame-950 border border-shame-700 px-4 py-2 text-shame-100 placeholder-shame-500 focus:outline-none focus:ring-2 focus:ring-neon-500/50 disabled:opacity-50"
			/>
			<div class="mt-1 flex items-start justify-between gap-2">
				<p class="text-xs text-shame-500">
					1-20 characters, letters, numbers, and underscores only
				</p>
				<span
					class="text-xs {displayName.length > 20
						? 'text-warning-500'
						: 'text-shame-500'} whitespace-nowrap"
				>
					{displayName.length}/20
				</span>
			</div>

			{#if error}
				<p class="mt-2 text-sm text-warning-500">{error}</p>
			{/if}

			{#if success}
				<p class="mt-2 text-sm text-neon-400">✓ Display name updated!</p>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex flex-col gap-3">
			<div class="flex gap-3">
				<button
					onclick={onclose}
					disabled={loading}
					class="flex-1 rounded-lg border border-shame-700 bg-shame-950 py-2.5 font-medium text-shame-200 hover:bg-shame-800 disabled:opacity-50 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={!isValid || loading || success}
					class="flex-1 rounded-lg bg-neon-500 py-2.5 font-medium text-shame-950 hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if loading}
						Saving...
					{:else if success}
						Saved!
					{:else}
						Save Changes
					{/if}
				</button>
			</div>
			<button
				onclick={handleSignOut}
				class="w-full rounded-lg border border-warning-500/30 bg-warning-900/20 py-2.5 font-medium text-warning-400 hover:bg-warning-900/40 hover:border-warning-500/50 transition-colors"
			>
				Sign Out
			</button>
		</div>
	</div>
</div>
