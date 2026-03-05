<script lang="ts">

	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';

	interface Props {
		targetType: 'post' | 'comment';
		targetId: string;
		targetTitle?: string;
		showDelete?: boolean;
		deleting?: boolean;
		ondelete?: () => void;
	}

	let { targetType, targetId, targetTitle, showDelete = false, deleting = false, ondelete }: Props = $props();

	let _open = $state(false);
	let _reporting = $state(false);
	let _reported = $state(false);

	const GITHUB_REPO = 'shc261392/ai-hall-of-shame';

	function _buildGitHubIssueUrl() {
		const title = `[Abuse Report] ${targetType}: ${targetTitle || targetId}`;
		const body = `**Content Type:** ${targetType}\n**Content ID:** ${targetId}\n**Reported by:** Community user\n\n**Reason:**\n_Please describe why this content is abusive._`;
		const params = new URLSearchParams({ title, body, labels: 'abuse-report' });
		return `https://github.com/${GITHUB_REPO}/issues/new?${params}`;
	}

	async function _handleFlag() {
		if (!$auth.token) {
			addToast('Sign in to flag content', 'error');
			return;
		}
		_reporting = true;
		try {
			await api.post('/api/reports', { targetType, targetId, reason: '' });
			_reported = true;
			addToast('Flagged. Thank you for keeping A-HOS clean!', 'success');
		} catch (e: any) {
			if (e.error === 'already_reported') {
				_reported = true;
				addToast('You already flagged this', 'info');
			} else {
				addToast(e.message || 'Failed to flag', 'error');
			}
		} finally {
			_reporting = false;
			_open = false;
		}
	}

	function _handleDelete() {
		_open = false;
		ondelete?.();
	}

	function _closeOnClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.more-actions-menu')) {
			_open = false;
		}
	}
</script>

<svelte:document onclick={open ? closeOnClickOutside : undefined} />

<div class="relative more-actions-menu">
	<button
		onclick={() => (open = !open)}
		class="text-sm text-shame-300 hover:text-shame-100 transition-colors px-1.5 py-0.5 rounded hover:bg-shame-700/50"
		title="More actions"
		aria-label="More actions"
		aria-expanded={open}
	>
		•••
	</button>

	{#if open}
		<div class="absolute right-0 top-full mt-1 z-40 min-w-48 rounded-lg border border-shame-600 bg-shame-800 shadow-xl py-1 text-sm animate-fade-in">
			<button
				onclick={handleFlag}
				disabled={reporting || reported || !$auth.token}
				class="w-full text-left px-3 py-2 text-shame-200 hover:bg-shame-700 hover:text-shame-100 disabled:opacity-50 transition-colors flex items-center gap-2"
			>
				<span>{reported ? '✓' : '🚩'}</span>
				<span>{reported ? 'Already flagged' : 'Flag Abusive Behavior'}</span>
			</button>
			<a
				href={buildGitHubIssueUrl()}
				target="_blank"
				rel="noopener noreferrer"
				class="w-full text-left px-3 py-2 text-shame-200 hover:bg-shame-700 hover:text-shame-100 transition-colors flex items-center gap-2"
				onclick={() => (open = false)}
			>
				<span>📋</span>
				<span>Report on GitHub</span>
			</a>
			{#if showDelete}
				<div class="border-t border-shame-600 my-1"></div>
				<button
					onclick={handleDelete}
					disabled={deleting}
					class="w-full text-left px-3 py-2 text-error-400 hover:bg-shame-700 hover:text-error-300 disabled:opacity-50 transition-colors flex items-center gap-2"
				>
					<span>🗑️</span>
					<span>{deleting ? 'Deleting...' : 'Delete'}</span>
				</button>
			{/if}
		</div>
	{/if}
</div>
