import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
	PLAYTEST_ANALYTICS_VERSION,
	PLAYTEST_CONSENT_NOTICE_VERSION,
	PLAYTEST_CONSENT_RETENTION_DAYS,
	PlaytestAnalyticsEventSchema,
	PlaytestAnalyticsReportSchema,
	PlaytestConsentGrantRequestSchema,
	PlaytestConsentGrantResponseSchema,
	PlaytestConsentRecordSchema,
	PlaytestConsentSummarySchema,
	PlaytestEventReceiptSchema,
	PlaytestEventTypeSchema,
	PlaytestWithdrawalResultSchema,
	type PlaytestAnalyticsEvent,
	type PlaytestAnalyticsReport,
	type PlaytestConsentGrantRequest,
	type PlaytestConsentGrantResponse,
	type PlaytestConsentRecord,
	type PlaytestConsentSummary,
	type PlaytestEventType,
	type PlaytestWithdrawalResult
} from '@summonlab/contracts';
import postgres from 'postgres';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/u;

interface ConsentRow {
	consent_id: string;
	notice_version: string;
	analytics_version: string;
	status: PlaytestConsentRecord['status'];
	accepted_at: Date | string;
	expires_at: Date | string;
	withdrawn_at: Date | string | null;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function consentFromRow(row: ConsentRow): PlaytestConsentRecord {
	return PlaytestConsentRecordSchema.parse({
		consentId: row.consent_id,
		noticeVersion: row.notice_version,
		analyticsVersion: row.analytics_version,
		status: row.status,
		acceptedAt: iso(row.accepted_at),
		expiresAt: iso(row.expires_at),
		withdrawnAt: row.withdrawn_at ? iso(row.withdrawn_at) : null
	});
}

function hashToken(token: string): string {
	if (!TOKEN_PATTERN.test(token)) throw new Error('Playtest consent capability is invalid');
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function expireConsents(
	sql: postgres.Sql | postgres.TransactionSql,
	now: Date
): Promise<void> {
	const expired = await sql<{ consent_id: string }[]>`
		select consent_id from summonlab_playtest_consents
		where status = 'granted' and expires_at <= ${now}
	`;
	if (expired.length === 0) return;
	const ids = expired.map((row) => row.consent_id);
	await sql`delete from summonlab_playtest_sessions where consent_id in ${sql(ids)}`;
	await sql`
		update summonlab_playtest_consents
		set status = 'expired', withdrawal_token_hash = null, withdrawn_at = ${now}
		where consent_id in ${sql(ids)}
	`;
}

export async function grantPlaytestConsent(
	databaseUrl: string,
	input: PlaytestConsentGrantRequest,
	now = new Date()
): Promise<PlaytestConsentGrantResponse> {
	const request = PlaytestConsentGrantRequestSchema.parse(input);
	const consentId = randomUUID();
	const withdrawalToken = randomBytes(32).toString('hex');
	const tokenHash = hashToken(withdrawalToken);
	const expiresAt = new Date(
		now.getTime() + PLAYTEST_CONSENT_RETENTION_DAYS * 24 * 60 * 60 * 1_000
	);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await sql<ConsentRow[]>`
			insert into summonlab_playtest_consents (
				consent_id, notice_version, analytics_version, status,
				withdrawal_token_hash, accepted_at, expires_at
			) values (
				${consentId}, ${request.noticeVersion}, ${request.analyticsVersion}, 'granted',
				${tokenHash}, ${now}, ${expiresAt}
			)
			returning consent_id, notice_version, analytics_version, status,
				accepted_at, expires_at, withdrawn_at
		`;
		const row = rows[0];
		if (!row) throw new Error('Playtest consent could not be persisted');
		return PlaytestConsentGrantResponseSchema.parse({
			consent: consentFromRow(row),
			withdrawalToken
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getPlaytestConsentSummary(
	databaseUrl: string,
	withdrawalToken: string,
	now = new Date()
): Promise<PlaytestConsentSummary | null> {
	const tokenHash = hashToken(withdrawalToken);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const rows = await transaction<ConsentRow[]>`
				select consent_id, notice_version, analytics_version, status,
					accepted_at, expires_at, withdrawn_at
				from summonlab_playtest_consents
				where withdrawal_token_hash = ${tokenHash}
				for update
			`;
			const row = rows[0];
			if (!row) return null;
			if (row.status === 'granted' && new Date(row.expires_at).getTime() <= now.getTime()) {
				await transaction`
					delete from summonlab_playtest_sessions where consent_id = ${row.consent_id}
				`;
				const updated = await transaction<ConsentRow[]>`
					update summonlab_playtest_consents
					set status = 'expired', withdrawal_token_hash = null, withdrawn_at = ${now}
					where consent_id = ${row.consent_id}
					returning consent_id, notice_version, analytics_version, status,
						accepted_at, expires_at, withdrawn_at
				`;
				return PlaytestConsentSummarySchema.parse({
					consent: consentFromRow(updated[0]!),
					retainedSessionCount: 0,
					retainedEventCount: 0
				});
			}
			const counts = await transaction<{ sessions: number; events: number }[]>`
				select
					(select count(*)::int from summonlab_playtest_sessions where consent_id = ${row.consent_id}) as sessions,
					(select count(*)::int from summonlab_playtest_events where consent_id = ${row.consent_id}) as events
			`;
			return PlaytestConsentSummarySchema.parse({
				consent: consentFromRow(row),
				retainedSessionCount: counts[0]?.sessions ?? 0,
				retainedEventCount: counts[0]?.events ?? 0
			});
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function recordPlaytestEvent(
	databaseUrl: string,
	withdrawalToken: string,
	input: PlaytestAnalyticsEvent,
	now = new Date()
) {
	const event = PlaytestAnalyticsEventSchema.parse(input);
	const tokenHash = hashToken(withdrawalToken);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const rows = await transaction<{ consent_id: string; expires_at: Date | string }[]>`
				select consent_id, expires_at from summonlab_playtest_consents
				where withdrawal_token_hash = ${tokenHash} and status = 'granted'
				for update
			`;
			const consent = rows[0];
			if (!consent) throw new Error('Playtest consent is unavailable');
			if (new Date(consent.expires_at).getTime() <= now.getTime()) {
				await transaction`
					delete from summonlab_playtest_sessions where consent_id = ${consent.consent_id}
				`;
				await transaction`
					update summonlab_playtest_consents
					set status = 'expired', withdrawal_token_hash = null, withdrawn_at = ${now}
					where consent_id = ${consent.consent_id}
				`;
				throw new Error('Playtest consent expired');
			}

			const sessionRows = await transaction<{ consent_id: string }[]>`
				insert into summonlab_playtest_sessions (
					session_id, consent_id, started_at, last_event_at
				) values (
					${event.sessionId}, ${consent.consent_id}, ${event.occurredAt}, ${event.occurredAt}
				)
				on conflict (session_id) do update
				set last_event_at = greatest(
					summonlab_playtest_sessions.last_event_at,
					excluded.last_event_at
				)
				where summonlab_playtest_sessions.consent_id = excluded.consent_id
				returning consent_id
			`;
			if (sessionRows[0]?.consent_id !== consent.consent_id) {
				throw new Error('Playtest session belongs to another consent');
			}

			const inserted = await transaction<{ event_id: string }[]>`
				insert into summonlab_playtest_events (
					event_id, consent_id, session_id, run_id, event_type, route, occurred_at, payload
				) values (
					${event.eventId}, ${consent.consent_id}, ${event.sessionId}, ${event.runId},
					${event.eventType}, ${event.route}, ${event.occurredAt}, ${transaction.json(event as never)}
				)
				on conflict (event_id) do nothing
				returning event_id
			`;
			return PlaytestEventReceiptSchema.parse({
				accepted: inserted.length === 1,
				eventId: event.eventId
			});
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function withdrawPlaytestConsent(
	databaseUrl: string,
	withdrawalToken: string,
	now = new Date()
): Promise<PlaytestWithdrawalResult | null> {
	const tokenHash = hashToken(withdrawalToken);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const rows = await transaction<ConsentRow[]>`
				select consent_id, notice_version, analytics_version, status,
					accepted_at, expires_at, withdrawn_at
				from summonlab_playtest_consents
				where withdrawal_token_hash = ${tokenHash} and status = 'granted'
				for update
			`;
			const row = rows[0];
			if (!row) return null;
			const counts = await transaction<{ sessions: number; events: number }[]>`
				select
					(select count(*)::int from summonlab_playtest_sessions where consent_id = ${row.consent_id}) as sessions,
					(select count(*)::int from summonlab_playtest_events where consent_id = ${row.consent_id}) as events
			`;
			await transaction`
				delete from summonlab_playtest_sessions where consent_id = ${row.consent_id}
			`;
			const updated = await transaction<ConsentRow[]>`
				update summonlab_playtest_consents
				set status = 'withdrawn', withdrawal_token_hash = null, withdrawn_at = ${now}
				where consent_id = ${row.consent_id}
				returning consent_id, notice_version, analytics_version, status,
					accepted_at, expires_at, withdrawn_at
			`;
			return PlaytestWithdrawalResultSchema.parse({
				consent: consentFromRow(updated[0]!),
				deletedSessionCount: counts[0]?.sessions ?? 0,
				deletedEventCount: counts[0]?.events ?? 0
			});
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getPlaytestAnalyticsReport(
	databaseUrl: string,
	now = new Date()
): Promise<PlaytestAnalyticsReport> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.begin((transaction) => expireConsents(transaction, now));
		const [consentRows, totalRows, typeRows, funnelRows] = await Promise.all([
			sql<{ status: PlaytestConsentRecord['status']; count: number }[]>`
				select status, count(*)::int as count
				from summonlab_playtest_consents group by status
			`,
			sql<{ sessions: number; events: number }[]>`
				select
					(select count(*)::int from summonlab_playtest_sessions) as sessions,
					(select count(*)::int from summonlab_playtest_events) as events
			`,
			sql<{ event_type: PlaytestEventType; count: number }[]>`
				select event_type, count(*)::int as count
				from summonlab_playtest_events group by event_type
			`,
			sql<
				{
					title: number;
					campaign: number;
					onboarding: number;
					hearth: number;
				}[]
			>`
				with session_stages as (
					select
						session_id,
						bool_or(event_type = 'route_viewed' and route = 'title') as saw_title,
						bool_or(event_type = 'campaign_started') as started_campaign,
						bool_or(
							event_type = 'onboarding_step_completed' and (payload ->> 'step')::int = 3
						) as completed_onboarding,
						bool_or(event_type = 'hearth_entered') as entered_hearth
					from summonlab_playtest_events
					group by session_id
				)
				select
					count(*) filter (where saw_title)::int as title,
					count(*) filter (where saw_title and started_campaign)::int as campaign,
					count(*) filter (
						where saw_title and started_campaign and completed_onboarding
					)::int as onboarding,
					count(*) filter (
						where saw_title and started_campaign and completed_onboarding and entered_hearth
					)::int as hearth
				from session_stages
			`
		]);
		const consents = { granted: 0, withdrawn: 0, expired: 0 };
		for (const row of consentRows) consents[row.status] = row.count;
		const eventCounts = Object.fromEntries(
			PlaytestEventTypeSchema.options.map((eventType) => [eventType, 0])
		) as Record<PlaytestEventType, number>;
		for (const row of typeRows) eventCounts[row.event_type] = row.count;
		const funnel = funnelRows[0] ?? { title: 0, campaign: 0, onboarding: 0, hearth: 0 };
		return PlaytestAnalyticsReportSchema.parse({
			schemaVersion: PLAYTEST_ANALYTICS_VERSION,
			generatedAt: now.toISOString(),
			privacy: {
				noticeVersion: PLAYTEST_CONSENT_NOTICE_VERSION,
				retentionDays: PLAYTEST_CONSENT_RETENTION_DAYS,
				storesRawText: false,
				storesIpAddress: false,
				storesUserAgent: false,
				withdrawalDeletesEvents: true,
				reportIsAggregateOnly: true
			},
			consents,
			retainedSessionCount: totalRows[0]?.sessions ?? 0,
			retainedEventCount: totalRows[0]?.events ?? 0,
			eventCounts,
			funnel: {
				titleViewedSessions: funnel.title,
				campaignStartedSessions: funnel.campaign,
				onboardingCompletedSessions: funnel.onboarding,
				hearthEnteredSessions: funnel.hearth
			}
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}
