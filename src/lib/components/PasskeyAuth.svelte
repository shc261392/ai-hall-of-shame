<script lang="ts">
	import { register, authenticate, recoverWithBackupCode, browserSupportsWebAuthn } from '$lib/utils/passkey';
	import { addToast } from '$lib/stores/toast';
	import { trapFocus } from '$lib/utils/focus-trap';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let _mode: 'main' | 'recover' = $state('main');
	let _loading = $state(false);
	let _error = $state('');
	let backupCodeInput = $state('');
	let _newBackupCode = $state<string | null>(null);
	let _supported = $state(browserSupportsWebAuthn());
	let remember = $state(false);

	async function _handleRegister() {
		_loading = true;
		_error = '';
		try {
			const { backupCode } = await register(remember);
			_newBackupCode = backupCode;
			addToast('Account created! Save your backup code.', 'success');
		} catch (e: any) {
			_error = e.message || 'Registration failed';
		} finally {
			_loading = false;
		}
	}

	async function _handleAuthenticate() {
		_loading = true;
		_error = '';
		try {
			await authenticate(remember);
			addToast('Signed in!', 'success');
			onclose();
		} catch (e: any) {
			_error = e.message || 'Authentication failed';
		} finally {
			_loading = false;
		}
	}

	async function _handleRecover() {
		if (!backupCodeInput.trim()) return;
		_loading = true;
		_error = '';
		try {
			const { backupCode } = await recoverWithBackupCode(backupCodeInput.trim(), remember);
			_newBackupCode = backupCode;
			addToast('Account recovered! Save your new backup code.', 'success');
		} catch (e: any) {
			_error = e.message || 'Recovery failed';
		} finally {
			_loading = false;
		}
	}

	function _handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function _initFocusTrap(node: HTMLElement) {
		const cleanup = trapFocus(node);
		return { destroy: cleanup };
	}
</script>

{#if newBackupCode}
	<BackupCodeModal code={newBackupCode} onclose={onclose} />
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-shame-950/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="passkey-auth-title"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && onclose()}
		onclick={handleBackdropClick}
	>
		<div class="mx-4 w-full max-w-sm rounded-xl border border-shame-700 bg-shame-900 p-6 shadow-2xl" use:initFocusTrap>
			<div class="flex items-center justify-between mb-4">
				<h2 id="passkey-auth-title" class="text-lg font-bold text-shame-100">
					{mode === 'main' ? '🔐 Passkey Auth' : '🔑 Recover Account'}
				</h2>
				<button onclick={onclose} class="text-shame-300 hover:text-shame-100 text-xl" aria-label="Close">&times;</button>
			</div>

			{#if !supported}
				<p class="text-error-500 text-sm mb-4">
					Your browser doesn't support passkeys. Try a modern browser like Chrome, Safari, or Firefox.
				</p>
			{/if}

			{#if error}
				<div class="rounded-lg bg-error-500/10 border border-error-500/30 p-3 mb-4 text-sm text-error-500">
					{error}
				</div>
			{/if}

			{#if mode === 'main'}
				<div class="space-y-3">
					<label class="flex items-center gap-2 cursor-pointer text-sm text-shame-200">
						<input type="checkbox" bind:checked={remember} class="accent-neon-500 h-4 w-4 rounded" />
						Remember this device for 30 days
					</label>
					<button
						onclick={handleRegister}
						disabled={loading || !supported}
						class="w-full rounded-lg bg-neon-500 py-2.5 font-medium text-shame-950 hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? 'Working...' : '✨ Create Account'}
					</button>
					<button
						onclick={handleAuthenticate}
						disabled={loading || !supported}
						class="w-full rounded-lg border border-shame-600 py-2.5 font-medium text-shame-100 hover:bg-shame-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? 'Working...' : '👆 Sign In with Passkey'}
					</button>
					<button
						onclick={() => (mode = 'recover')}
						class="w-full text-center text-sm text-shame-300 hover:text-neon-400 transition-colors"
					>
						Lost your passkey? Recover account
					</button>
				</div>
			{:else}
				<div class="space-y-3">
					<p class="text-sm text-shame-200">
						Enter your backup code to register a new passkey.
					</p>
					<input
						type="text"
						bind:value={backupCodeInput}
						placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
						class="w-full rounded-lg border border-shame-600 bg-shame-800 px-3 py-2 text-sm text-shame-100 placeholder:text-shame-300/50 focus:border-neon-500 focus:outline-none"
					/>
					<label class="flex items-center gap-2 cursor-pointer text-sm text-shame-200">
						<input type="checkbox" bind:checked={remember} class="accent-neon-500 h-4 w-4 rounded" />
						Remember this device for 30 days
					</label>
					<button
						onclick={handleRecover}
						disabled={loading || !backupCodeInput.trim()}
						class="w-full rounded-lg bg-neon-500 py-2.5 font-medium text-shame-950 hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? 'Working...' : '🔑 Recover & Re-register'}
					</button>
					<button
						onclick={() => (mode = 'main')}
						class="w-full text-center text-sm text-shame-300 hover:text-neon-400 transition-colors"
					>
						← Back
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
