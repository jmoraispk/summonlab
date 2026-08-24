import { createHash, randomUUID } from 'node:crypto';

import {
	ProofRunSnapshotSchema,
	type CharacterDraft,
	type FirstDestination,
	type ProofControlMode,
	type ProofEvent,
	type ProofRunSnapshot
} from '@summonlab/contracts';
import postgres from 'postgres';

interface ProofRunRow {
	run_id: string;
	story_envelope_id: 'first-ember-v1';
	control_mode: ProofControlMode;
	directive: string;
	recipe: unknown;
	manifest: unknown;
	mind: unknown;
	manifest_hash: string;
	first_observation: string;
	first_line: string | null;
	destination: FirstDestination | null;
	story_branch: string | null;
	arrived: boolean;
	created_at: Date | string;
}

interface ProofEventRow {
	event_id: string;
	sequence: number;
	event_type: string;
	summary: string;
	decision_source: ProofEvent['decisionSource'];
	payload: Record<string, unknown>;
	event_hash: string;
	created_at: Date | string;
}

export interface ResolvedFirstChoice {
	readonly destination: FirstDestination;
	readonly source: 'random' | 'scripted' | 'directed';
	readonly firstLine: string;
	readonly storyBranch: string;
	readonly score: Readonly<{ kitchen: number; trainingGround: number }>;
}

export interface CreateProofRunInput {
	readonly runId: string;
	readonly draft: CharacterDraft;
	readonly controlMode: ProofControlMode;
	readonly directive: string;
	readonly firstObservation: string;
	readonly choice: ResolvedFirstChoice | null;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function eventHash(
	runId: string,
	sequence: number,
	eventType: string,
	decisionSource: ProofEvent['decisionSource'],
	payload: Record<string, unknown>
): string {
	return createHash('sha256')
		.update(JSON.stringify({ runId, sequence, eventType, decisionSource, payload }))
		.digest('hex');
}

function eventValues(
	runId: string,
	sequence: number,
	eventType: string,
	summary: string,
	decisionSource: ProofEvent['decisionSource'],
	payload: Record<string, unknown>
) {
	return {
		eventId: randomUUID(),
		runId,
		sequence,
		eventType,
		summary,
		decisionSource,
		payload,
		eventHash: eventHash(runId, sequence, eventType, decisionSource, payload)
	};
}

async function insertEvent(
	sql: postgres.TransactionSql,
	event: ReturnType<typeof eventValues>
): Promise<void> {
	await sql`
		insert into summonlab_proof_events (
			event_id, run_id, sequence, event_type, summary, decision_source, payload, event_hash
		) values (
			${event.eventId}, ${event.runId}, ${event.sequence}, ${event.eventType}, ${event.summary},
			${event.decisionSource}, ${sql.json(event.payload as never)}, ${event.eventHash}
		)
	`;
}

async function loadWithSql(sql: postgres.Sql, runId: string): Promise<ProofRunSnapshot | null> {
	const runRows = await sql<ProofRunRow[]>`
		select * from summonlab_proof_runs where run_id = ${runId}
	`;
	const row = runRows[0];
	if (!row) return null;
	const eventRows = await sql<ProofEventRow[]>`
		select event_id, sequence, event_type, summary, decision_source, payload, event_hash, created_at
		from summonlab_proof_events
		where run_id = ${runId}
		order by sequence asc
	`;
	return ProofRunSnapshotSchema.parse({
		runId: row.run_id,
		storyEnvelopeId: row.story_envelope_id,
		controlMode: row.control_mode,
		directive: row.directive,
		recipe: row.recipe,
		manifest: row.manifest,
		mind: row.mind,
		manifestHash: row.manifest_hash,
		firstObservation: row.first_observation,
		firstLine: row.first_line,
		destination: row.destination,
		storyBranch: row.story_branch,
		arrived: row.arrived,
		events: eventRows.map((event) => ({
			eventId: event.event_id,
			sequence: event.sequence,
			eventType: event.event_type,
			summary: event.summary,
			decisionSource: event.decision_source,
			payload: event.payload,
			eventHash: event.event_hash,
			createdAt: iso(event.created_at)
		})),
		createdAt: iso(row.created_at)
	});
}

export async function createProofRun(
	databaseUrl: string,
	input: CreateProofRunInput
): Promise<ProofRunSnapshot> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.begin(async (transaction) => {
			await transaction`
				insert into summonlab_proof_runs (
					run_id, control_mode, directive, recipe, manifest, mind, manifest_hash,
					first_observation, first_line, destination, story_branch
				) values (
					${input.runId}, ${input.controlMode}, ${input.directive},
					${transaction.json(input.draft.recipe)}, ${transaction.json(input.draft.manifest)},
					${transaction.json(input.draft.mind)}, ${input.draft.manifestHash},
					${input.firstObservation}, ${input.choice?.firstLine ?? null},
					${input.choice?.destination ?? null}, ${input.choice?.storyBranch ?? null}
				)
			`;
			await insertEvent(
				transaction,
				eventValues(
					input.runId,
					1,
					'hero.summoned',
					`${input.draft.manifest.displayName} crossed the gate.`,
					'system',
					{
						characterId: input.draft.manifest.characterId,
						manifestHash: input.draft.manifestHash,
						rarityStars: input.draft.manifest.rarityStars
					}
				)
			);
			await insertEvent(
				transaction,
				eventValues(input.runId, 2, 'hero.observed', input.firstObservation, 'system', {
					observation: input.firstObservation
				})
			);
			if (input.choice)
				await appendChoiceEvents(transaction, input.runId, input.choice, input.directive, 3);
		});
		const snapshot = await loadWithSql(sql, input.runId);
		if (!snapshot) throw new Error('Created proof run could not be loaded');
		return snapshot;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

async function appendChoiceEvents(
	sql: postgres.TransactionSql,
	runId: string,
	choice: ResolvedFirstChoice,
	directive: string,
	startSequence: number
): Promise<void> {
	await insertEvent(
		sql,
		eventValues(
			runId,
			startSequence,
			'hero.destination.selected',
			`The hero chose the ${choice.destination === 'kitchen' ? 'kitchen' : 'training ground'}.`,
			choice.source,
			{
				destination: choice.destination,
				firstLine: choice.firstLine,
				directive,
				score: choice.score
			}
		)
	);
	await insertEvent(
		sql,
		eventValues(
			runId,
			startSequence + 1,
			'story.branch.opened',
			`The fixed First Ember envelope opened branch “${choice.storyBranch}”.`,
			choice.source,
			{ storyEnvelopeId: 'first-ember-v1', storyBranch: choice.storyBranch }
		)
	);
}

export async function resolveProofDecision(
	databaseUrl: string,
	runId: string,
	directive: string,
	choice: ResolvedFirstChoice
): Promise<ProofRunSnapshot | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.begin(async (transaction) => {
			const rows = await transaction<{ destination: FirstDestination | null }[]>`
				select destination from summonlab_proof_runs where run_id = ${runId} for update
			`;
			const row = rows[0];
			if (!row) return;
			if (row.destination) return;
			await transaction`
				update summonlab_proof_runs
				set directive = ${directive}, first_line = ${choice.firstLine},
					destination = ${choice.destination}, story_branch = ${choice.storyBranch}, updated_at = now()
				where run_id = ${runId}
			`;
			await appendChoiceEvents(transaction, runId, choice, directive, 3);
		});
		return await loadWithSql(sql, runId);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function markProofArrival(
	databaseUrl: string,
	runId: string
): Promise<ProofRunSnapshot | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.begin(async (transaction) => {
			const rows = await transaction<
				{
					arrived: boolean;
					destination: FirstDestination | null;
				}[]
			>`
				select arrived, destination from summonlab_proof_runs where run_id = ${runId} for update
			`;
			const row = rows[0];
			if (!row?.destination || row.arrived) return;
			await transaction`
				update summonlab_proof_runs set arrived = true, updated_at = now() where run_id = ${runId}
			`;
			await insertEvent(
				transaction,
				eventValues(
					runId,
					5,
					'hero.arrived',
					`The hero reached the ${row.destination === 'kitchen' ? 'kitchen' : 'training ground'}.`,
					'system',
					{ destination: row.destination }
				)
			);
		});
		return await loadWithSql(sql, runId);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getProofRun(
	databaseUrl: string,
	runId: string
): Promise<ProofRunSnapshot | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await loadWithSql(sql, runId);
	} finally {
		await sql.end({ timeout: 5 });
	}
}
