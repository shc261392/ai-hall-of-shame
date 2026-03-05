<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast';

	interface Props {
		targetType: 'post' | 'comment';
		targetId: string;
		targetTitle?: string;
	}

	let { targetType, targetId, targetTitle }: Props = $props();

	let reporting = $state(false);
	let reported = $state(false);

	const GITHUB_REPO = 'shc261392/ai-hall-of-shame';

	function buildGitHubIssueUrl() {
		const title = `[Abuse Report] ${targetType}: ${targetTitle || targetId}`;
		const body = `**Content Type:** ${targetType}\n**Content ID:** ${targetId}\n**Reported by:** Community user\n\n**Reason:**\n_Please describe why this content is abusive._`;
		const params = new URLSearchParams({ title, body, labels: 'abuse-report' });
		return `https://github.com/${GITHUB_REPO}/issues/new?${params}`;
	}

	async function handleReport() {
		if (!$auth.token) {
			addToast('Sign in to report content', 'error');
			return;
		}
		reporting = true;
		try {
			await api.post('/api/reports', { targetType, targetId, reason: '' });
			reported = true;
			addToast('Report submitted. Thank you!', 'success');
		} catch (e: any) {
			if (e.error === 'already_reported') {
				reported = true;
				addToast('You already reported this', 'info');
			} else {
				addToast(e.message || 'Failed to report', 'error');
			}
		} finally {
			reporting = false;
		}
	}
</script>

<div class="flex items-center gap-2">
	<button
		onclick={handleReport}
		disabled={reporting || reported || !$auth.token}
		class="text-xs text-shame-300 hover:text-error-500 disabled:opacity-50 transition-colors"
		title={reported ? 'Already reported' : 'Report this content to moderators'}
	>
		{reported ? '✓ Reported' : '🚩 Report'}
	</button>
	<a
		href={buildGitHubIssueUrl()}
		target="_blank"
		rel="noopener noreferrer"
		class="text-xs text-shame-300 hover:text-warning-500 transition-colors"
		title="Report on GitHub (opens new issue)"
	>
		📋 Report on GitHub
	</a>
</div>
