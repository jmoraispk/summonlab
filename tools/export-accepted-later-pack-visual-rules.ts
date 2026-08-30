import { link, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getConfig } from '../packages/config/src/index.js';
import {
	LaterPackRulesHumanDecisionListSchema,
	LaterPackRulesHumanDecisionRecordSchema,
	type LaterPackRulesHumanDecisionList
} from '../packages/contracts/src/index.js';
import { listLaterPackRuleDecisions } from '../packages/database/src/index.js';

import { canonicalJson, sha256Json } from './image-production-lib.js';
import {
	ACCEPTED_LATER_PACK_RULES_PATH,
	AcceptedLaterPackVisualRulesV2Schema,
	reportCurrentLaterPackRulesReadiness
} from './report-later-pack-visual-rules-readiness.js';

export type AcceptedRulesExportMode = 'check' | 'write';

interface CurrentReadiness {
	readonly eligibleForHumanAcceptance: boolean;
	readonly blockers: readonly { code: string; detail: string }[];
	readonly bindings?: {
		readonly proposalCanonicalSha256: string;
		readonly planCanonicalSha256: string;
		readonly activationReceiptCanonicalSha256: string;
		readonly catalogCanonicalSha256: string;
		readonly blindReviewCollectionCanonicalSha256: string;
		readonly executionSnapshotCanonicalSha256: string;
		readonly gateEvidenceCanonicalSha256: string;
		readonly sourceReadinessCanonicalSha256: string;
		readonly eligibleBlindReviews: readonly {
			readonly reviewId: string;
			readonly targetId: string;
			readonly candidateHash: string;
			readonly reviewHash: string;
		}[];
	};
}

export type LaterPackDecisionLoader = (
	databaseUrl: string,
	experimentId: 'affinity-workflow-v1',
	roundId: 'final-controlled-v1'
) => Promise<LaterPackRulesHumanDecisionList>;

export type LaterPackReadinessLoader = (workspaceRoot: string) => Promise<CurrentReadiness>;

export interface AcceptedRulesExportReport {
	readonly mode: AcceptedRulesExportMode;
	readonly actor: string;
	readonly decisionId: string;
	readonly outputPath: typeof ACCEPTED_LATER_PACK_RULES_PATH;
	readonly written: boolean;
	readonly inSync: boolean;
	readonly artifactCanonicalSha256: string;
}

function jsonText(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

function sourceBindings(readiness: CurrentReadiness) {
	const bindings = readiness.bindings;
	if (!bindings) throw new Error('Current later-pack readiness did not expose canonical bindings.');
	return {
		proposalCanonicalSha256: bindings.proposalCanonicalSha256,
		planCanonicalSha256: bindings.planCanonicalSha256,
		activationReceiptCanonicalSha256: bindings.activationReceiptCanonicalSha256,
		catalogCanonicalSha256: bindings.catalogCanonicalSha256,
		blindReviewCollectionCanonicalSha256: bindings.blindReviewCollectionCanonicalSha256,
		executionSnapshotCanonicalSha256: bindings.executionSnapshotCanonicalSha256,
		gateEvidenceCanonicalSha256: bindings.gateEvidenceCanonicalSha256
	};
}

export function buildAcceptedLaterPackVisualRulesArtifact(input: {
	readonly actor: string;
	readonly decisionList: unknown;
	readonly readiness: CurrentReadiness;
}) {
	const actor = input.actor.trim();
	if (!actor || actor.length > 80)
		throw new Error('An explicit actor of at most 80 characters is required.');
	if (!input.readiness.eligibleForHumanAcceptance) {
		throw new Error(
			`Current evidence is not eligible for human acceptance: ${input.readiness.blockers.map((blocker) => blocker.code).join(', ')}`
		);
	}
	const list = LaterPackRulesHumanDecisionListSchema.parse(input.decisionList);
	const decision = list.latestByActor.find((record) => record.actor === actor);
	if (!decision)
		throw new Error(`No latest human-interactive later-pack decision exists for ${actor}.`);
	LaterPackRulesHumanDecisionRecordSchema.parse(decision);
	const bindings = input.readiness.bindings!;
	if (
		decision.proposalCanonicalSha256 !== bindings.proposalCanonicalSha256 ||
		decision.sourceReadinessCanonicalSha256 !== bindings.sourceReadinessCanonicalSha256
	) {
		throw new Error('The actor’s latest decision is stale for the current proposal or readiness.');
	}
	if (decision.decisions.some((item) => item.decision !== 'accepted')) {
		throw new Error('All eight plan-owned later-pack rules must be explicitly accepted.');
	}
	return AcceptedLaterPackVisualRulesV2Schema.parse({
		schemaVersion: 'affinity-accepted-later-pack-visual-rules-v2',
		experimentId: 'affinity-workflow-v1',
		status: 'accepted',
		acceptanceId: decision.decisionId,
		acceptedBy: decision.actor,
		acceptedAt: decision.decidedAt,
		acceptanceMode: 'human-interactive-db-export',
		humanDecisionRecord: {
			decisionId: decision.decisionId,
			contentHash: sha256Json(decision)
		},
		sources: sourceBindings(input.readiness),
		eligibleBlindReviews: bindings.eligibleBlindReviews,
		rules: decision.decisions
	});
}

async function readExistingArtifact(file: string): Promise<unknown | null> {
	return readFile(file, 'utf8').then(
		(text) => JSON.parse(text) as unknown,
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		}
	);
}

async function exclusivePublish(destination: string, text: string): Promise<void> {
	const temporary = `${destination}.accepted-rules-${process.pid}.tmp`;
	try {
		await writeFile(temporary, text, { encoding: 'utf8', flag: 'wx' });
		await link(temporary, destination);
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
}

export async function exportAcceptedLaterPackVisualRules(input: {
	readonly workspaceRoot?: string;
	readonly databaseUrl: string;
	readonly actor: string;
	readonly mode: AcceptedRulesExportMode;
	readonly loadDecisions?: LaterPackDecisionLoader;
	readonly loadReadiness?: LaterPackReadinessLoader;
}): Promise<AcceptedRulesExportReport> {
	const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
	const loadReadiness = input.loadReadiness ?? reportCurrentLaterPackRulesReadiness;
	const readiness = await loadReadiness(workspaceRoot);
	if (!readiness.eligibleForHumanAcceptance)
		throw new Error(
			`Current evidence is not eligible for rule acceptance: ${readiness.blockers.map((blocker) => blocker.code).join(', ')}`
		);
	const loadDecisions = input.loadDecisions ?? listLaterPackRuleDecisions;
	const decisionList = await loadDecisions(
		input.databaseUrl,
		'affinity-workflow-v1',
		'final-controlled-v1'
	);
	const artifact = buildAcceptedLaterPackVisualRulesArtifact({
		actor: input.actor,
		decisionList,
		readiness
	});
	const destination = path.resolve(workspaceRoot, ACCEPTED_LATER_PACK_RULES_PATH);
	const existing = await readExistingArtifact(destination);
	if (existing !== null) {
		const parsed = AcceptedLaterPackVisualRulesV2Schema.safeParse(existing);
		if (!parsed.success || canonicalJson(parsed.data) !== canonicalJson(artifact)) {
			throw new Error(
				`${ACCEPTED_LATER_PACK_RULES_PATH} already exists with different evidence; refusing to overwrite it.`
			);
		}
		return {
			mode: input.mode,
			actor: artifact.acceptedBy,
			decisionId: artifact.humanDecisionRecord.decisionId,
			outputPath: ACCEPTED_LATER_PACK_RULES_PATH,
			written: false,
			inSync: true,
			artifactCanonicalSha256: sha256Json(artifact)
		};
	}
	if (input.mode === 'write') {
		let published = false;
		try {
			await exclusivePublish(destination, jsonText(artifact));
			published = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			const raced = await readExistingArtifact(destination);
			const parsed = AcceptedLaterPackVisualRulesV2Schema.safeParse(raced);
			if (!parsed.success || canonicalJson(parsed.data) !== canonicalJson(artifact))
				throw new Error('A conflicting accepted-rules artifact won exclusive publication.', {
					cause: error
				});
		}
		return {
			mode: input.mode,
			actor: artifact.acceptedBy,
			decisionId: artifact.humanDecisionRecord.decisionId,
			outputPath: ACCEPTED_LATER_PACK_RULES_PATH,
			written: published,
			inSync: true,
			artifactCanonicalSha256: sha256Json(artifact)
		};
	}
	return {
		mode: input.mode,
		actor: artifact.acceptedBy,
		decisionId: artifact.humanDecisionRecord.decisionId,
		outputPath: ACCEPTED_LATER_PACK_RULES_PATH,
		written: false,
		inSync: false,
		artifactCanonicalSha256: sha256Json(artifact)
	};
}

export function parseAcceptedRulesExportArgs(args: readonly string[]): {
	mode: AcceptedRulesExportMode;
	actor: string;
} {
	let mode: AcceptedRulesExportMode | undefined;
	let actor: string | undefined;
	let separatorSeen = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === '--') {
			if (separatorSeen) throw new Error('Specify at most one -- argument separator.');
			separatorSeen = true;
		} else if (argument === '--check' || argument === '--write') {
			if (mode) throw new Error('Specify exactly one of --check or --write.');
			mode = argument.slice(2) as AcceptedRulesExportMode;
		} else if (argument === '--actor') {
			if (actor !== undefined) throw new Error('Specify --actor exactly once.');
			actor = args[++index]?.trim();
			if (!actor || actor.startsWith('--')) throw new Error('Specify --actor <name>.');
		} else throw new Error(`Unknown argument: ${argument ?? ''}`);
	}
	if (!mode || !actor) throw new Error('Usage: --check|--write --actor <name>');
	return { mode, actor };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const options = parseAcceptedRulesExportArgs(process.argv.slice(2));
		const report = await exportAcceptedLaterPackVisualRules({
			databaseUrl: getConfig().databaseUrl,
			...options
		});
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		if (!report.inSync) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
