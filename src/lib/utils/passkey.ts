import {
	startRegistration,
	startAuthentication,
	browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { api } from "./api";
import { login } from "$lib/stores/auth";
import type { AuthPayload } from "$lib/types";

export { browserSupportsWebAuthn };

export async function register(
	remember = false,
): Promise<{ backupCode: string }> {
	const { challengeId, challenge } = await api.get<{
		challengeId: string;
		challenge: string;
	}>("/api/auth/challenge", { purpose: "registration" });

	const attestation = await startRegistration({
		optionsJSON: {
			challenge,
			rp: { name: "AI Hall of Shame", id: window.location.hostname },
			user: {
				id: crypto.randomUUID(),
				name: "passkey-user",
				displayName: "Passkey User",
			},
			pubKeyCredParams: [
				{ alg: -7, type: "public-key" },
				{ alg: -257, type: "public-key" },
			],
			timeout: 60000,
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "required",
			},
			attestation: "none",
		},
	});

	const result = await api.post<AuthPayload>("/api/auth/register", {
		challengeId,
		attestation,
		remember,
	});

	login(
		result.token,
		result.refreshToken,
		result.expiresIn,
		result.username,
		result.userId,
		undefined,
		remember,
	);
	return { backupCode: result.backupCode! };
}

export async function authenticate(remember = false): Promise<void> {
	const { challengeId, challenge } = await api.get<{
		challengeId: string;
		challenge: string;
	}>("/api/auth/challenge", { purpose: "authentication" });

	const assertion = await startAuthentication({
		optionsJSON: {
			challenge,
			rpId: window.location.hostname,
			timeout: 60000,
			userVerification: "required",
			allowCredentials: [],
		},
	});

	const result = await api.post<AuthPayload>("/api/auth/authenticate", {
		challengeId,
		assertion,
		remember,
	});

	login(
		result.token,
		result.refreshToken,
		result.expiresIn,
		result.username,
		result.userId,
		undefined,
		remember,
	);
}

export async function recoverWithBackupCode(
	backupCode: string,
	remember = false,
): Promise<{ backupCode: string }> {
	const { challengeId, challenge } = await api.get<{
		challengeId: string;
		challenge: string;
	}>("/api/auth/challenge", { purpose: "registration" });

	const attestation = await startRegistration({
		optionsJSON: {
			challenge,
			rp: { name: "AI Hall of Shame", id: window.location.hostname },
			user: {
				id: crypto.randomUUID(),
				name: "recovery-user",
				displayName: "Recovery User",
			},
			pubKeyCredParams: [
				{ alg: -7, type: "public-key" },
				{ alg: -257, type: "public-key" },
			],
			timeout: 60000,
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "required",
			},
			attestation: "none",
		},
	});

	const result = await api.post<AuthPayload>("/api/auth/recover", {
		backupCode,
		challengeId,
		attestation,
		remember,
	});

	login(
		result.token,
		result.refreshToken,
		result.expiresIn,
		result.username,
		result.userId,
		undefined,
		remember,
	);
	return { backupCode: result.backupCode! };
}
