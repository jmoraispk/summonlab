import type {
	PlaytestAnalyticsEvent,
	PlaytestConsentGrantResponse,
	PlaytestConsentSummary,
	PlaytestWithdrawalResult
} from '@summonlab/contracts';

const PLAYTEST_CONSENT_NOTICE_VERSION = 'playtest-consent-v1' as const;
const PLAYTEST_ANALYTICS_VERSION = 'playtest-analytics-v1' as const;

export const PLAYTEST_CONSENT_STORAGE_KEY = 'summonlab.playtest-consent.v1';
export const PLAYTEST_CONSENT_EVENT = 'summonlab:playtest-consent';
const PLAYTEST_SESSION_STORAGE_KEY = 'summonlab.playtest-session.v1';

export type LocalPlaytestConsent =
	| { readonly decision: 'undecided' }
	| { readonly decision: 'declined' }
	| {
			readonly decision: 'granted';
			readonly withdrawalToken: string;
			readonly expiresAt: string;
	  };

type EventInput =
	| { eventType: 'route_viewed'; route: PlaytestAnalyticsEvent['route']; runId: string | null }
	| {
			eventType: 'campaign_started';
			route: 'title';
			runId: string;
			controlMode: 'wait' | 'countdown';
	  }
	| {
			eventType: 'onboarding_step_completed';
			route: 'onboarding';
			runId: string;
			step: number;
	  }
	| {
			eventType: 'hearth_entered';
			route: 'hearth';
			runId: string;
			destination: 'kitchen' | 'training-ground';
	  }
	| {
			eventType: 'pause_opened';
			route: 'onboarding' | 'hearth';
			runId: string;
			completedObjectiveCount: number;
	  }
	| {
			eventType: 'campaign_restarted';
			route: 'onboarding' | 'hearth';
			runId: string;
			seedMode: 'same' | 'new';
	  }
	| {
			eventType: 'reconnect_completed';
			route: 'hearth';
			runId: string;
			durationMs: number;
			missedEventCount: number;
	  };

export const DEFAULT_LOCAL_PLAYTEST_CONSENT: LocalPlaytestConsent = { decision: 'undecided' };

function validToken(value: unknown): value is string {
	return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

export function loadLocalPlaytestConsent(): LocalPlaytestConsent {
	if (typeof localStorage === 'undefined') return DEFAULT_LOCAL_PLAYTEST_CONSENT;
	try {
		const candidate = JSON.parse(
			localStorage.getItem(PLAYTEST_CONSENT_STORAGE_KEY) ?? 'null'
		) as Partial<LocalPlaytestConsent> | null;
		if (candidate?.decision === 'declined') return { decision: 'declined' };
		if (
			candidate?.decision === 'granted' &&
			validToken(candidate.withdrawalToken) &&
			typeof candidate.expiresAt === 'string' &&
			Date.parse(candidate.expiresAt) > Date.now()
		) {
			return {
				decision: 'granted',
				withdrawalToken: candidate.withdrawalToken,
				expiresAt: candidate.expiresAt
			};
		}
		return DEFAULT_LOCAL_PLAYTEST_CONSENT;
	} catch {
		return DEFAULT_LOCAL_PLAYTEST_CONSENT;
	}
}

function saveLocalPlaytestConsent(consent: LocalPlaytestConsent): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(PLAYTEST_CONSENT_STORAGE_KEY, JSON.stringify(consent));
	}
	if (typeof document !== 'undefined') {
		document.documentElement.dataset.playtestConsent = consent.decision;
	}
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent<LocalPlaytestConsent>(PLAYTEST_CONSENT_EVENT, { detail: consent })
		);
	}
}

export function declinePlaytestAnalytics(): LocalPlaytestConsent {
	const consent = { decision: 'declined' } as const;
	saveLocalPlaytestConsent(consent);
	return consent;
}

export async function grantPlaytestAnalytics(): Promise<LocalPlaytestConsent> {
	const response = await fetch('/api/playtest/consent', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			noticeVersion: PLAYTEST_CONSENT_NOTICE_VERSION,
			analyticsVersion: PLAYTEST_ANALYTICS_VERSION,
			ageConfirmed: true,
			voluntary: true
		})
	});
	const result = (await response.json()) as PlaytestConsentGrantResponse & { message?: string };
	if (!response.ok || !result.withdrawalToken || !result.consent) {
		throw new Error(result.message ?? 'Consent could not be saved.');
	}
	const consent = {
		decision: 'granted',
		withdrawalToken: result.withdrawalToken,
		expiresAt: result.consent.expiresAt
	} as const;
	saveLocalPlaytestConsent(consent);
	return consent;
}

export async function loadPlaytestConsentSummary(): Promise<PlaytestConsentSummary | null> {
	const consent = loadLocalPlaytestConsent();
	if (consent.decision !== 'granted') return null;
	const response = await fetch('/api/playtest/consent', {
		headers: { 'x-playtest-consent': consent.withdrawalToken }
	});
	if (!response.ok) return null;
	return (await response.json()) as PlaytestConsentSummary;
}

export async function withdrawPlaytestAnalytics(): Promise<PlaytestWithdrawalResult> {
	const consent = loadLocalPlaytestConsent();
	if (consent.decision !== 'granted') throw new Error('No active playtest consent was found.');
	const response = await fetch('/api/playtest/consent', {
		method: 'DELETE',
		headers: { 'x-playtest-consent': consent.withdrawalToken }
	});
	const result = (await response.json()) as PlaytestWithdrawalResult & { message?: string };
	if (!response.ok || !result.consent) {
		throw new Error(result.message ?? 'Stored playtest data could not be deleted.');
	}
	saveLocalPlaytestConsent({ decision: 'declined' });
	return result;
}

function sessionId(): string {
	if (typeof sessionStorage === 'undefined') return crypto.randomUUID();
	const existing = sessionStorage.getItem(PLAYTEST_SESSION_STORAGE_KEY);
	if (existing && /^[a-f0-9-]{36}$/u.test(existing)) return existing;
	const created = crypto.randomUUID();
	sessionStorage.setItem(PLAYTEST_SESSION_STORAGE_KEY, created);
	return created;
}

export async function trackPlaytestEvent(input: EventInput): Promise<boolean> {
	const consent = loadLocalPlaytestConsent();
	if (consent.decision !== 'granted') return false;
	const event = {
		...input,
		eventId: crypto.randomUUID(),
		sessionId: sessionId(),
		viewport: window.matchMedia('(max-width: 650px)').matches ? 'phone' : 'desktop',
		occurredAt: new Date().toISOString()
	} satisfies PlaytestAnalyticsEvent;
	try {
		const response = await fetch('/api/playtest/events', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-playtest-consent': consent.withdrawalToken
			},
			body: JSON.stringify(event),
			keepalive: true
		});
		return response.ok;
	} catch {
		return false;
	}
}
