import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	LaterPackRulesHumanDecisionCreateRequestSchema,
	LaterPackRulesHumanDecisionListSchema,
	type LaterPackRulesHumanDecisionCreateRequest,
	type LaterPackRulesHumanDecisionList
} from '@summonlab/contracts';
import { createLaterPackRuleDecision, listLaterPackRuleDecisions } from '@summonlab/database';

import { sha256Json } from '../../../../../tools/image-production-lib.js';
import {
	LATER_PACK_RULES_PROPOSAL_PATH,
	LaterPackVisualRulesProposalSchema,
	reportCurrentLaterPackRulesReadiness
} from '../../../../../tools/report-later-pack-visual-rules-readiness.js';

const EXPERIMENT_ID = 'affinity-workflow-v1' as const;
const ROUND_ID = 'final-controlled-v1' as const;

export class LaterPackRuleReviewRequestError extends Error {
	public constructor(
		public readonly status: 400 | 409,
		message: string
	) {
		super(message);
		this.name = 'LaterPackRuleReviewRequestError';
	}
}

type Readiness = Awaited<ReturnType<typeof reportCurrentLaterPackRulesReadiness>>;
type Proposal = ReturnType<typeof LaterPackVisualRulesProposalSchema.parse>;

export interface LaterPackRuleReviewDependencies {
	readonly loadReadiness: (workspaceRoot: string) => Promise<Readiness>;
	readonly loadProposal: (workspaceRoot: string) => Promise<Proposal>;
	readonly listDecisions: typeof listLaterPackRuleDecisions;
	readonly createDecision: typeof createLaterPackRuleDecision;
}

const defaultDependencies: LaterPackRuleReviewDependencies = {
	loadReadiness: reportCurrentLaterPackRulesReadiness,
	loadProposal: async (workspaceRoot) =>
		LaterPackVisualRulesProposalSchema.parse(
			JSON.parse(
				await readFile(path.resolve(workspaceRoot, LATER_PACK_RULES_PROPOSAL_PATH), 'utf8')
			) as unknown
		),
	listDecisions: listLaterPackRuleDecisions,
	createDecision: createLaterPackRuleDecision
};

export function findSummonlabRepositoryRoot(start = process.cwd()): string {
	let current = path.resolve(start);
	for (let depth = 0; depth < 10; depth += 1) {
		if (
			existsSync(path.join(current, 'pnpm-workspace.yaml')) &&
			existsSync(path.join(current, 'assets/enemies/experiments/affinity-workflow-v1'))
		)
			return current;
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	throw new Error('Could not locate the Summonlab repository root.');
}

export function parseLaterPackRuleActor(value: string | null | undefined): string {
	const actor = value?.trim() ?? '';
	const hasControlCharacter = [...actor].some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint < 32 || codePoint === 127;
	});
	if (!actor || actor.length > 80 || hasControlCharacter) {
		throw new LaterPackRuleReviewRequestError(
			400,
			'An explicit actor of at most 80 printable characters is required.'
		);
	}
	return actor;
}

function actorDecisionList(
	actor: string,
	decisionList: LaterPackRulesHumanDecisionList
): LaterPackRulesHumanDecisionList {
	return LaterPackRulesHumanDecisionListSchema.parse({
		experimentId: EXPERIMENT_ID,
		roundId: ROUND_ID,
		records: decisionList.records.filter((record) => record.actor === actor),
		latestByActor: decisionList.latestByActor.filter((record) => record.actor === actor)
	});
}

function verifyCurrentBindings(
	request: LaterPackRulesHumanDecisionCreateRequest,
	proposal: Proposal,
	readiness: Readiness
): void {
	if (!readiness.eligibleForHumanAcceptance || !readiness.bindings) {
		throw new LaterPackRuleReviewRequestError(
			409,
			'The final controlled evidence is not eligible for later-pack rule review.'
		);
	}
	if (
		sha256Json(proposal) !== readiness.bindings.proposalCanonicalSha256 ||
		request.proposalCanonicalSha256 !== readiness.bindings.proposalCanonicalSha256 ||
		request.sourceReadinessCanonicalSha256 !== readiness.bindings.sourceReadinessCanonicalSha256
	) {
		throw new LaterPackRuleReviewRequestError(
			409,
			'The proposal or review evidence changed. Reload before deciding.'
		);
	}
	if (
		request.decisions.some(
			(decision, index) => decision.textHash !== proposal.rules[index]?.textHash
		)
	) {
		throw new LaterPackRuleReviewRequestError(
			409,
			'The submitted rule text hashes do not match the current proposal.'
		);
	}
}

export async function loadLaterPackRuleReviewContext(input: {
	readonly workspaceRoot?: string;
	readonly dependencies?: LaterPackRuleReviewDependencies;
}) {
	const workspaceRoot = input.workspaceRoot ?? findSummonlabRepositoryRoot();
	const dependencies = input.dependencies ?? defaultDependencies;
	const [proposal, readiness] = await Promise.all([
		dependencies.loadProposal(workspaceRoot),
		dependencies.loadReadiness(workspaceRoot)
	]);
	return { proposal, readiness };
}

export async function listLaterPackRuleReviewForActor(input: {
	readonly databaseUrl: string;
	readonly actor: string;
	readonly workspaceRoot?: string;
	readonly dependencies?: LaterPackRuleReviewDependencies;
}) {
	const actor = parseLaterPackRuleActor(input.actor);
	const dependencies = input.dependencies ?? defaultDependencies;
	const context = await loadLaterPackRuleReviewContext({
		workspaceRoot: input.workspaceRoot,
		dependencies
	});
	const decisionList = LaterPackRulesHumanDecisionListSchema.parse(
		await dependencies.listDecisions(input.databaseUrl, EXPERIMENT_ID, ROUND_ID)
	);
	return { actor, ...context, decisions: actorDecisionList(actor, decisionList) };
}

export async function createLaterPackRuleReviewForActor(input: {
	readonly databaseUrl: string;
	readonly actor: string;
	readonly request: unknown;
	readonly workspaceRoot?: string;
	readonly dependencies?: LaterPackRuleReviewDependencies;
}) {
	const actor = parseLaterPackRuleActor(input.actor);
	const parsed = LaterPackRulesHumanDecisionCreateRequestSchema.safeParse(input.request);
	if (!parsed.success) {
		throw new LaterPackRuleReviewRequestError(
			400,
			`The later-pack rule decision is invalid: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`
		);
	}
	if (parsed.data.actor !== actor) {
		throw new LaterPackRuleReviewRequestError(
			400,
			'The decision actor must match the explicit reviewer session.'
		);
	}
	const dependencies = input.dependencies ?? defaultDependencies;
	const { proposal, readiness } = await loadLaterPackRuleReviewContext({
		workspaceRoot: input.workspaceRoot,
		dependencies
	});
	verifyCurrentBindings(parsed.data, proposal, readiness);
	return dependencies.createDecision(input.databaseUrl, parsed.data);
}
