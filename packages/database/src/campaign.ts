import {
	CampaignHeroSchema,
	CampaignHeroesSchema,
	CampaignRunSchema,
	type CampaignControlMode,
	type CampaignHero,
	type CampaignRun,
	type CampaignSummonRequest,
	type CharacterDraft,
	type Run
} from '@summonlab/contracts';
import postgres from 'postgres';

import { getEngineSnapshotInTransaction } from './engine.js';

interface CampaignRunRow {
	run_id: string;
	campaign_seed: string;
	control_mode: CampaignControlMode;
	lifecycle: CampaignRun['lifecycle'];
	onboarding_step: number;
	summoned_hero_count: number;
	restarted_from_run_id: string | null;
	heroes: unknown;
	created_at: Date | string;
	updated_at: Date | string;
	engine_status: Run['status'];
}

export interface RegisterCampaignRunInput {
	readonly runId: string;
	readonly campaignSeed: string;
	readonly controlMode: CampaignControlMode;
	readonly heroes: readonly [CharacterDraft, CharacterDraft, CharacterDraft];
	readonly restartedFromRunId?: string;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function campaignFromRow(row: CampaignRunRow): CampaignRun {
	return CampaignRunSchema.parse({
		runId: row.run_id,
		campaignSeed: row.campaign_seed,
		controlMode: row.control_mode,
		lifecycle: row.lifecycle,
		engineStatus: row.engine_status,
		onboardingStep: row.onboarding_step,
		summonedHeroCount: row.summoned_hero_count,
		restartedFromRunId: row.restarted_from_run_id,
		heroes: row.heroes,
		createdAt: iso(row.created_at),
		updatedAt: iso(row.updated_at)
	});
}

async function campaignRows(sql: postgres.Sql, runId?: string): Promise<CampaignRunRow[]> {
	return runId
		? sql<CampaignRunRow[]>`
			select campaign.*, engine.status as engine_status
			from summonlab_campaign_runs campaign
			join summonlab_engine_runs engine on engine.run_id = campaign.run_id
			where campaign.run_id = ${runId}
		`
		: sql<CampaignRunRow[]>`
			select campaign.*, engine.status as engine_status
			from summonlab_campaign_runs campaign
			join summonlab_engine_runs engine on engine.run_id = campaign.run_id
			where campaign.lifecycle = 'active'
			order by campaign.created_at desc, campaign.run_id desc
			limit 1
		`;
}

export async function getCampaignRun(
	databaseUrl: string,
	runId: string
): Promise<CampaignRun | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await campaignRows(sql, runId);
		return rows[0] ? campaignFromRow(rows[0]) : null;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getLatestActiveCampaignRun(databaseUrl: string): Promise<CampaignRun | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await campaignRows(sql);
		return rows[0] ? campaignFromRow(rows[0]) : null;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function registerCampaignRun(
	databaseUrl: string,
	input: RegisterCampaignRunInput
): Promise<CampaignRun> {
	const campaignSeed = input.campaignSeed.trim();
	if (!campaignSeed || campaignSeed.length > 128) throw new Error('Campaign seed is invalid');
	const heroes = input.heroes.map((draft, index) =>
		CampaignHeroSchema.parse({ ordinal: index + 1, draft })
	) as [CampaignHero, CampaignHero, CampaignHero];
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.begin(async (transaction) => {
			if (input.restartedFromRunId) {
				const previous = await transaction<{ lifecycle: CampaignRun['lifecycle'] }[]>`
					select lifecycle from summonlab_campaign_runs
					where run_id = ${input.restartedFromRunId} for update
				`;
				if (!previous[0]) throw new Error('Previous campaign run not found');
				if (previous[0].lifecycle !== 'active') {
					throw new Error('Previous campaign run was already superseded');
				}
				await transaction`
					update summonlab_campaign_runs
					set lifecycle = 'superseded', updated_at = now()
					where run_id = ${input.restartedFromRunId}
				`;
			}
			await transaction`
				insert into summonlab_campaign_runs (
					run_id, campaign_seed, control_mode, restarted_from_run_id, heroes
				) values (
					${input.runId}, ${campaignSeed}, ${input.controlMode},
					${input.restartedFromRunId ?? null}, ${transaction.json(heroes as never)}
				)
			`;
		});
		const campaign = await getCampaignRun(databaseUrl, input.runId);
		if (!campaign) throw new Error('Created campaign run could not be loaded');
		return campaign;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function advanceCampaignOnboarding(
	databaseUrl: string,
	runId: string,
	requestedStep: number
): Promise<CampaignRun> {
	if (!Number.isInteger(requestedStep) || requestedStep < 1 || requestedStep > 3) {
		throw new Error('Onboarding step is invalid');
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.begin(async (transaction) => {
			const rows = await transaction<
				{
					onboarding_step: number;
					summoned_hero_count: number;
					lifecycle: CampaignRun['lifecycle'];
					heroes: unknown;
				}[]
			>`
				select onboarding_step, summoned_hero_count, lifecycle, heroes
				from summonlab_campaign_runs where run_id = ${runId} for update
			`;
			const row = rows[0];
			if (!row) throw new Error('Campaign run not found');
			if (row.lifecycle !== 'active') throw new Error('Campaign run is no longer active');
			if (requestedStep <= row.onboarding_step) return;
			if (requestedStep === 2 && row.summoned_hero_count !== 3) {
				throw new Error('All three heroes must be summoned before onboarding can advance');
			}
			if (requestedStep !== row.onboarding_step + 1) {
				throw new Error('Onboarding steps must advance in order');
			}
			if (requestedStep === 3) {
				const heroes = CampaignHeroesSchema.parse(row.heroes);
				const snapshot = await getEngineSnapshotInTransaction(transaction, runId);
				if (!snapshot || snapshot.state.schemaVersion !== 13) {
					throw new Error('Campaign engine state is unavailable');
				}
				const heardHeroIds = new Set(
					Object.values(snapshot.state.society.conversationTurns).map((turn) => turn.heroId)
				);
				if (!heroes.every((hero) => heardHeroIds.has(hero.draft.manifest.characterId))) {
					throw new Error('Each summoned hero must answer before onboarding can finish');
				}
			}
			await transaction`
				update summonlab_campaign_runs
				set onboarding_step = ${requestedStep}, updated_at = now()
				where run_id = ${runId}
			`;
		});
		const campaign = await getCampaignRun(databaseUrl, runId);
		if (!campaign) throw new Error('Campaign run could not be reloaded');
		return campaign;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function summonNextCampaignHero(
	databaseUrl: string,
	runId: string,
	request: CampaignSummonRequest
): Promise<CampaignRun> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.begin(async (transaction) => {
			const rows = await transaction<
				{
					summoned_hero_count: number;
					lifecycle: CampaignRun['lifecycle'];
				}[]
			>`
				select summoned_hero_count, lifecycle
				from summonlab_campaign_runs where run_id = ${runId} for update
			`;
			const row = rows[0];
			if (!row) throw new Error('Campaign run not found');
			if (row.lifecycle !== 'active') throw new Error('Campaign run is no longer active');
			if (request.ordinal <= row.summoned_hero_count) return;

			const nextOrdinal = row.summoned_hero_count + 1;
			if (request.ordinal !== nextOrdinal) {
				throw new Error(`The next summon must be ordinal ${nextOrdinal}`);
			}
			if (request.expectedSummonedHeroCount !== row.summoned_hero_count) {
				throw new Error('Summon progress changed. Refresh the Village and try again');
			}

			const onboardingStep = request.ordinal === 3 ? 2 : 1;
			await transaction`
				update summonlab_campaign_runs
				set summoned_hero_count = ${request.ordinal},
					onboarding_step = greatest(onboarding_step, ${onboardingStep}),
					updated_at = now()
				where run_id = ${runId}
			`;
		});
		const campaign = await getCampaignRun(databaseUrl, runId);
		if (!campaign) throw new Error('Campaign run could not be reloaded');
		return campaign;
	} finally {
		await sql.end({ timeout: 5 });
	}
}
