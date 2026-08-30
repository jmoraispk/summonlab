import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	LaterPackRulesHumanDecisionListSchema,
	type LaterPackRulesHumanDecisionList,
	type LaterPackRulesHumanDecisionRecord
} from '../packages/contracts/src/index.js';
import { listLaterPackRuleDecisions } from '../packages/database/src/index.js';

import { sha256Json } from './image-production-lib.js';
import {
	ACCEPTED_LATER_PACK_RULES_PATH,
	AcceptedLaterPackVisualRulesV2Schema,
	reportCurrentLaterPackRulesReadiness
} from './report-later-pack-visual-rules-readiness.js';

const EXPERIMENT_ID = 'affinity-workflow-v1' as const;
const ROUND_ID = 'final-controlled-v1' as const;

export type AcceptedRulesCompletionFailure =
	| 'artifact-invalid'
	| 'actor-required'
	| 'actor-mismatch'
	| 'database-unavailable'
	| 'decision-list-invalid'
	| 'latest-decision-missing'
	| 'latest-decision-mismatch'
	| 'decision-not-fully-accepted'
	| 'artifact-decision-hash-mismatch'
	| 'full-readiness-validation-failed';

export interface AcceptedRulesArtifactLoad {
	readonly present: boolean;
	readonly artifact?: unknown;
}

export type AcceptedRulesArtifactLoader = (
	workspaceRoot: string
) => Promise<AcceptedRulesArtifactLoad>;
export type AcceptedRulesDecisionLoader = (
	databaseUrl: string,
	experimentId: typeof EXPERIMENT_ID,
	roundId: typeof ROUND_ID
) => Promise<LaterPackRulesHumanDecisionList>;
export type AcceptedRulesReadinessValidator = (
	workspaceRoot: string,
	acceptance: {
		readonly acceptedArtifact: unknown;
		readonly humanDecisionRecord: LaterPackRulesHumanDecisionRecord;
	}
) => Promise<{
	readonly eligibleForHumanAcceptance: boolean;
	readonly acceptedArtifactValid: boolean;
}>;

export interface AcceptedRulesCompletionVerification {
	readonly artifactPresent: boolean;
	readonly acceptedArtifactValid: boolean;
	readonly sourceBlindReviewCount: number;
	readonly actor: string | null;
	readonly decisionId: string | null;
	readonly failure: AcceptedRulesCompletionFailure | null;
}

async function loadAcceptedArtifact(workspaceRoot: string): Promise<AcceptedRulesArtifactLoad> {
	return readFile(path.resolve(workspaceRoot, ACCEPTED_LATER_PACK_RULES_PATH), 'utf8').then(
		(text) => ({ present: true, artifact: JSON.parse(text) as unknown }),
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return { present: false };
			throw error;
		}
	);
}

function invalid(
	artifactPresent: boolean,
	failure: AcceptedRulesCompletionFailure,
	input: { sourceBlindReviewCount?: number; actor?: string | null; decisionId?: string | null } = {}
): AcceptedRulesCompletionVerification {
	return {
		artifactPresent,
		acceptedArtifactValid: false,
		sourceBlindReviewCount: input.sourceBlindReviewCount ?? 0,
		actor: input.actor ?? null,
		decisionId: input.decisionId ?? null,
		failure
	};
}

export async function verifyAcceptedLaterPackRulesForCompletion(input: {
	readonly workspaceRoot?: string;
	readonly databaseUrl?: string;
	readonly loadDatabaseUrl?: () => string;
	readonly actor?: string | null;
	readonly loadArtifact?: AcceptedRulesArtifactLoader;
	readonly loadDecisions?: AcceptedRulesDecisionLoader;
	readonly validateReadiness?: AcceptedRulesReadinessValidator;
}): Promise<AcceptedRulesCompletionVerification> {
	const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
	const artifactLoad = await (input.loadArtifact ?? loadAcceptedArtifact)(workspaceRoot).catch(
		() => ({ present: true, artifact: null })
	);
	if (!artifactLoad.present) {
		return {
			artifactPresent: false,
			acceptedArtifactValid: false,
			sourceBlindReviewCount: 0,
			actor: null,
			decisionId: null,
			failure: null
		};
	}
	const parsed = AcceptedLaterPackVisualRulesV2Schema.safeParse(artifactLoad.artifact);
	if (!parsed.success) return invalid(true, 'artifact-invalid');
	const artifact = parsed.data;
	const sourceBlindReviewCount = artifact.eligibleBlindReviews.length;
	const actor = input.actor?.trim() ?? '';
	const actorHasControlCharacter = [...actor].some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint < 32 || codePoint === 127;
	});
	if (!actor || actor.length > 80 || actorHasControlCharacter)
		return invalid(true, 'actor-required', { sourceBlindReviewCount });
	if (actor !== artifact.acceptedBy) {
		return invalid(true, 'actor-mismatch', {
			sourceBlindReviewCount,
			actor,
			decisionId: artifact.humanDecisionRecord.decisionId
		});
	}
	let databaseUrl = input.databaseUrl;
	try {
		databaseUrl ??= input.loadDatabaseUrl?.();
	} catch {
		return invalid(true, 'database-unavailable', {
			sourceBlindReviewCount,
			actor,
			decisionId: artifact.humanDecisionRecord.decisionId
		});
	}
	if (!databaseUrl) {
		return invalid(true, 'database-unavailable', {
			sourceBlindReviewCount,
			actor,
			decisionId: artifact.humanDecisionRecord.decisionId
		});
	}
	let decisionListInput: unknown;
	try {
		decisionListInput = await (input.loadDecisions ?? listLaterPackRuleDecisions)(
			databaseUrl,
			EXPERIMENT_ID,
			ROUND_ID
		);
	} catch {
		return invalid(true, 'database-unavailable', {
			sourceBlindReviewCount,
			actor,
			decisionId: artifact.humanDecisionRecord.decisionId
		});
	}
	const decisionList = LaterPackRulesHumanDecisionListSchema.safeParse(decisionListInput);
	if (!decisionList.success) {
		return invalid(true, 'decision-list-invalid', {
			sourceBlindReviewCount,
			actor,
			decisionId: artifact.humanDecisionRecord.decisionId
		});
	}
	const latest = decisionList.data.latestByActor.find((record) => record.actor === actor);
	if (!latest) {
		return invalid(true, 'latest-decision-missing', {
			sourceBlindReviewCount,
			actor,
			decisionId: artifact.humanDecisionRecord.decisionId
		});
	}
	if (latest.decisionId !== artifact.humanDecisionRecord.decisionId) {
		return invalid(true, 'latest-decision-mismatch', {
			sourceBlindReviewCount,
			actor,
			decisionId: latest.decisionId
		});
	}
	if (latest.decisions.some((decision) => decision.decision !== 'accepted')) {
		return invalid(true, 'decision-not-fully-accepted', {
			sourceBlindReviewCount,
			actor,
			decisionId: latest.decisionId
		});
	}
	if (artifact.humanDecisionRecord.contentHash !== sha256Json(latest)) {
		return invalid(true, 'artifact-decision-hash-mismatch', {
			sourceBlindReviewCount,
			actor,
			decisionId: latest.decisionId
		});
	}
	let readiness: {
		readonly eligibleForHumanAcceptance: boolean;
		readonly acceptedArtifactValid: boolean;
	};
	try {
		readiness = await (input.validateReadiness ?? reportCurrentLaterPackRulesReadiness)(
			workspaceRoot,
			{ acceptedArtifact: artifact, humanDecisionRecord: latest }
		);
	} catch {
		return invalid(true, 'full-readiness-validation-failed', {
			sourceBlindReviewCount,
			actor,
			decisionId: latest.decisionId
		});
	}
	if (!readiness.eligibleForHumanAcceptance || !readiness.acceptedArtifactValid) {
		return invalid(true, 'full-readiness-validation-failed', {
			sourceBlindReviewCount,
			actor,
			decisionId: latest.decisionId
		});
	}
	return {
		artifactPresent: true,
		acceptedArtifactValid: true,
		sourceBlindReviewCount,
		actor,
		decisionId: latest.decisionId,
		failure: null
	};
}
