import {
	startRegistration,
	startAuthentication,
	browserSupportsWebAuthn
} from '@simplewebauthn/browser';
import { api } from './api';
import { login } from '$lib/stores/auth';
import type { AuthPayload } from '$lib/types';

export { browserSupportsWebAuthn };

export async function register(): Promise<{ backupCode: string }> {
	const { challengeId, challenge } = await api.get<{ challengeId: string; challenge: string }>(
		'/api/auth/challenge',
		{ purpose: 'registration' }
	);

	const attestation = await startRegistration({
		optionsJSON: {
			challenge,
			rp: { name: 'AI Hall of Shame', id: window.location.hostname },
			user: {
				id: crypto.randomUUID(),
				name: 'passkey-user',
				displayName: 'Passkey User'
			},
			pubKeyCredParams: [
				{ alg: -7, type: 'public-key' },
				{ alg: -257, type: 'public-key' }
			],
			timeout: 60000,
			authenticatorSelection: {
				residentKey: 'preferred',
				userVerification: 'required'
			},
			attestation: 'none'
		}
	});

	const result = await api.post<AuthPayload>('/api/auth/register', {
		challengeId,
		attestation
	});

	login(result.token, result.username, result.userId);
	return { backupCode: result.backupCode! };
}

export async function authenticate(): Promise<void> {
	const { challengeId, challenge } = await api.get<{ challengeId: string; challenge: string }>(
		'/api/auth/challenge',
		{ purpose: 'authentication' }
	);

	const assertion = await startAuthentication({
		optionsJSON: {
			challenge,
			rpId: window.location.hostname,
			timeout: 60000,
			userVerification: 'required',
			allowCredentials: []
		}
	});

	const result = await api.post<AuthPayload>('/api/auth/authenticate', {
		challengeId,
		assertion
	});

	login(result.token, result.username, result.userId);
}

export async function recoverWithBackupCode(
	backupCode: string
): Promise<{ backupCode: string }> {
	const { challengeId, challenge } = await api.get<{ challengeId: string; challenge: string }>(
		'/api/auth/challenge',
		{ purpose: 'registration' }
	);

	const attestation = await startRegistration({
		optionsJSON: {
			challenge,
			rp: { name: 'AI Hall of Shame', id: window.location.hostname },
			user: {
				id: crypto.randomUUID(),
				name: 'recovery-user',
				displayName: 'Recovery User'
			},
			pubKeyCredParams: [
				{ alg: -7, type: 'public-key' },
				{ alg: -257, type: 'public-key' }
			],
			timeout: 60000,
			authenticatorSelection: {
				residentKey: 'preferred',
				userVerification: 'required'
			},
			attestation: 'none'
		}
	});

	const result = await api.post<AuthPayload>('/api/auth/recover', {
		backupCode,
		challengeId,
		attestation
	});

	login(result.token, result.username, result.userId);
	return { backupCode: result.backupCode! };
}
