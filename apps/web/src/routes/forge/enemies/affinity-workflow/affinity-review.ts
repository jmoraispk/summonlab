import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { AffinityWorkflowReviewRecord } from '@summonlab/contracts';

export const AFFINITIES = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;
type Affinity = (typeof AFFINITIES)[number];
type Cohort = 'controlled' | 'breadth' | 'regression';
export type AffinityReviewScope = 'all' | 'controlled';

interface ReviewRowDefinition {
	id: string;
	speciesId: string;
	name: string;
	cohort: Cohort;
	targetIds?: Partial<Record<Affinity, string>>;
}

const ELEMENTAL_REGRESSION_V2_TARGETS = Object.fromEntries(
	AFFINITIES.map((affinity) => [affinity, `affinity-workflow-v1-elemental-${affinity}-v2`])
) as Record<Affinity, string>;

export const SPECIES: readonly ReviewRowDefinition[] = [
	{ id: 'death-knight', speciesId: 'death-knight', name: 'Death Knight', cohort: 'controlled' },
	{
		id: 'elemental',
		speciesId: 'elemental',
		name: 'Bound Vanguard Elemental · baseline',
		cohort: 'controlled'
	},
	{ id: 'grey-wolf', speciesId: 'grey-wolf', name: 'Grey Wolf', cohort: 'controlled' },
	{ id: 'cave-bear', speciesId: 'cave-bear', name: 'Cave Bear', cohort: 'controlled' },
	{ id: 'goblin', speciesId: 'goblin', name: 'Goblin', cohort: 'breadth' },
	{ id: 'tunnel-boar', speciesId: 'tunnel-boar', name: 'Tunnel Boar', cohort: 'breadth' },
	{ id: 'cave-drake', speciesId: 'cave-drake', name: 'Cave Drake', cohort: 'breadth' },
	{
		id: 'tower-basilisk',
		speciesId: 'tower-basilisk',
		name: 'Tower Basilisk',
		cohort: 'breadth'
	},
	{
		id: 'elemental-regression-v2',
		speciesId: 'elemental',
		name: 'Bound Vanguard Elemental · semantic v2',
		cohort: 'regression',
		targetIds: ELEMENTAL_REGRESSION_V2_TARGETS
	},
	{
		id: 'death-knight-correction-v2',
		speciesId: 'death-knight',
		name: 'Death Knight · metal correction v2',
		cohort: 'regression',
		targetIds: { metal: 'affinity-workflow-v1-death-knight-metal-v2' }
	},
	{
		id: 'death-knight-framing-v3',
		speciesId: 'death-knight',
		name: 'Death Knight · metal framing v3',
		cohort: 'regression',
		targetIds: { metal: 'affinity-workflow-v1-death-knight-metal-v3' }
	},
	{
		id: 'grey-wolf-correction-v2',
		speciesId: 'grey-wolf',
		name: 'Grey Wolf · fire correction v2',
		cohort: 'regression',
		targetIds: { fire: 'affinity-workflow-v1-grey-wolf-fire-v2' }
	},
	{
		id: 'cave-bear-correction-v2',
		speciesId: 'cave-bear',
		name: 'Cave Bear · framing corrections v2',
		cohort: 'regression',
		targetIds: {
			wood: 'affinity-workflow-v1-cave-bear-wood-v2',
			wind: 'affinity-workflow-v1-cave-bear-wind-v2'
		}
	},
	{
		id: 'elemental-correction-v3',
		speciesId: 'elemental',
		name: 'Bound Vanguard Elemental · fire framing v3',
		cohort: 'regression',
		targetIds: { fire: 'affinity-workflow-v1-elemental-fire-v3' }
	}
] as const;

const EXPERIMENT_ID = 'affinity-workflow-v1';

function findRepositoryRoot(start: string): string {
	let current = path.resolve(start);
	for (let depth = 0; depth < 10; depth += 1) {
		if (
			existsSync(path.join(current, 'pnpm-workspace.yaml')) &&
			existsSync(path.join(current, 'assets/enemies/experiments/affinity-workflow-v1'))
		) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return path.resolve(start);
}

const REPOSITORY_ROOT = findRepositoryRoot(process.cwd());
export const EXPERIMENT_ROOT = path.join(
	REPOSITORY_ROOT,
	'assets/enemies/experiments/affinity-workflow-v1'
);

type JsonRecord = Record<string, unknown>;
type CandidateState = 'candidate' | 'pending' | 'revise' | 'invalid';

interface TargetRecord extends JsonRecord {
	targetId: string;
	assetId: string;
	cohort: Cohort;
	speciesId: string;
	affinity: Affinity;
	references: Array<{ path: string; purpose: string; contentHash: string }>;
	output: { candidatePath: string; resultPath: string };
}

interface VerifiedCandidate {
	mediaId: string;
	mediaPath: string;
	metadata: {
		resultId: string;
		resultStatus: string;
		selectedAttemptId: string;
		attemptCount: number;
		attemptNumber: number;
		exactPrompt: string;
		promptHash: string;
		requestStartedAt: string;
		generationCompletedAt: string;
		inspectionCompletedAt: string;
		generationDurationMs: number;
		inspectionDurationMs: number;
		totalWallTimeMs: number;
		sourceOutputId: string;
		persistenceOperation: string;
		outputPath: string;
		width: number;
		height: number;
		mediaType: string;
		bytes: number;
		contentHash: string;
		references: Array<{ path: string; contentHash: string }>;
		findings: Array<{ outcome: string; category: string; observation: string }>;
	};
}

export interface VerifiedMediaBinding {
	path: string;
	targetId: string;
	contentHash: string;
	resultStatus: 'candidate' | 'revise';
}

interface BlindReviewState {
	count: number;
	latestAt: string | null;
}

interface LabeledReviewState extends BlindReviewState {
	latest: {
		reviewer: string;
		identifiedSpeciesId: string;
		identifiedAffinity: string;
		scores: AffinityWorkflowReviewRecord['scores'];
		verdict: AffinityWorkflowReviewRecord['verdict'];
		note: string;
		reviewedAt: string;
	} | null;
}

export interface AffinityReviewCell {
	id: string;
	columnLabel: string;
	status: CandidateState;
	statusLabel: string;
	mediaUrl: string | null;
	alt: string;
	labels: { species: string; affinity: string; targetId: string } | null;
	metadata: VerifiedCandidate['metadata'] | null;
	reviewState: BlindReviewState | LabeledReviewState;
}

export interface AffinityReviewRow {
	id: string;
	rowLabel: string;
	cohort: Cohort | null;
	cells: AffinityReviewCell[];
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function readJson(filePath: string): Promise<JsonRecord | null> {
	try {
		const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

async function listJsonFiles(directory: string): Promise<string[]> {
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		const nested = await Promise.all(
			entries.map(async (entry) => {
				const entryPath = path.join(directory, entry.name);
				if (entry.isDirectory()) return listJsonFiles(entryPath);
				return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
			})
		);
		return nested.flat();
	} catch {
		return [];
	}
}

function parseTarget(value: JsonRecord): TargetRecord | null {
	const output = isRecord(value.output) ? value.output : null;
	const references = Array.isArray(value.references) ? value.references : null;
	if (
		value.schemaVersion !== 'image-production-target-v1' ||
		value.experimentId !== EXPERIMENT_ID ||
		typeof value.targetId !== 'string' ||
		typeof value.assetId !== 'string' ||
		!['controlled', 'breadth', 'regression'].includes(String(value.cohort)) ||
		typeof value.speciesId !== 'string' ||
		!AFFINITIES.includes(value.affinity as Affinity) ||
		!output ||
		typeof output.candidatePath !== 'string' ||
		typeof output.resultPath !== 'string' ||
		!references
	) {
		return null;
	}
	const parsedReferences = references.flatMap((reference) => {
		if (!isRecord(reference)) return [];
		const referencePath = stringValue(reference.path);
		const purpose = stringValue(reference.purpose);
		const contentHash = stringValue(reference.contentHash);
		return referencePath && purpose && contentHash
			? [{ path: referencePath, purpose, contentHash }]
			: [];
	});
	return {
		...value,
		targetId: value.targetId,
		assetId: value.assetId,
		cohort: value.cohort as Cohort,
		speciesId: value.speciesId,
		affinity: value.affinity as Affinity,
		references: parsedReferences,
		output: { candidatePath: output.candidatePath, resultPath: output.resultPath }
	};
}

export function isPathWithin(parent: string, candidate: string): boolean {
	const relative = path.relative(path.resolve(parent), path.resolve(candidate));
	return (
		relative !== '' &&
		!relative.startsWith(`..${path.sep}`) &&
		relative !== '..' &&
		!path.isAbsolute(relative)
	);
}

export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
	if (
		bytes.length < 24 ||
		bytes[0] !== 0x89 ||
		bytes[1] !== 0x50 ||
		bytes[2] !== 0x4e ||
		bytes[3] !== 0x47
	) {
		return null;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function makeOpaqueId(contentHash: string): string {
	return createHash('sha256')
		.update(`${EXPERIMENT_ID}:media:${contentHash}`)
		.digest('hex')
		.slice(0, 24);
}

function deterministicScore(value: string): string {
	return createHash('sha256').update(`${EXPERIMENT_ID}:blind-order:${value}`).digest('hex');
}

export function buildBlindOrder<T extends { id: string }>(items: readonly T[], scope: string): T[] {
	return [...items].sort((left, right) =>
		deterministicScore(`${scope}:${left.id}`).localeCompare(
			deterministicScore(`${scope}:${right.id}`)
		)
	);
}

async function verifyCandidate(
	target: TargetRecord,
	result: JsonRecord
): Promise<VerifiedCandidate | null> {
	if (
		result.schemaVersion !== 'image-production-result-v1' ||
		result.targetId !== target.targetId ||
		(result.status !== 'candidate' && result.status !== 'revise') ||
		typeof result.resultId !== 'string' ||
		!Array.isArray(result.attempts)
	) {
		return null;
	}
	const attempts = result.attempts.filter(isRecord);
	const selectedAttempt =
		result.status === 'candidate'
			? attempts.find(
					(attempt) =>
						attempt.attemptId === result.selectedAttemptId &&
						attempt.conclusion === 'accepted-by-producer'
				)
			: [...attempts]
					.reverse()
					.find((attempt) => isRecord(attempt.output) && isRecord(attempt.persistence));
	if (
		!selectedAttempt ||
		!isRecord(selectedAttempt.output) ||
		!isRecord(selectedAttempt.persistence)
	) {
		return null;
	}
	const output = selectedAttempt.output;
	const retained = isRecord(selectedAttempt.persistence.retained)
		? selectedAttempt.persistence.retained
		: null;
	const outputPath = stringValue(output.path);
	const outputHash = stringValue(output.contentHash);
	const outputType = stringValue(output.mediaType);
	const outputWidth = numberValue(output.width);
	const outputHeight = numberValue(output.height);
	const outputBytes = numberValue(output.bytes);
	if (
		!retained ||
		!outputPath ||
		outputPath !== target.output.candidatePath ||
		outputPath !== retained.path ||
		!outputHash ||
		outputHash !== retained.contentHash ||
		outputType !== 'image/png' ||
		!outputWidth ||
		!outputHeight ||
		!outputBytes
	) {
		return null;
	}
	const absolutePath = path.resolve(REPOSITORY_ROOT, outputPath);
	if (!isPathWithin(EXPERIMENT_ROOT, absolutePath)) return null;
	try {
		const [bytes, fileStats] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
		const actualHash = createHash('sha256').update(bytes).digest('hex');
		const dimensions = readPngDimensions(bytes);
		if (
			actualHash !== outputHash ||
			fileStats.size !== outputBytes ||
			!dimensions ||
			dimensions.width !== outputWidth ||
			dimensions.height !== outputHeight
		) {
			return null;
		}
		const findings = Array.isArray(selectedAttempt.findings)
			? selectedAttempt.findings.flatMap((finding) => {
					if (!isRecord(finding)) return [];
					const outcome = stringValue(finding.outcome);
					const category = stringValue(finding.category);
					const observation = stringValue(finding.observation);
					return outcome && category && observation ? [{ outcome, category, observation }] : [];
				})
			: [];
		const referenceInputs = Array.isArray(selectedAttempt.referenceInputs)
			? selectedAttempt.referenceInputs.flatMap((reference) => {
					if (!isRecord(reference)) return [];
					const referencePath = stringValue(reference.path);
					const contentHash = stringValue(reference.contentHash);
					return referencePath && contentHash ? [{ path: referencePath, contentHash }] : [];
				})
			: [];
		const metadata = {
			resultId: result.resultId,
			resultStatus: result.status,
			selectedAttemptId: stringValue(selectedAttempt.attemptId) ?? '',
			attemptCount: attempts.length,
			attemptNumber: numberValue(selectedAttempt.attemptNumber) ?? attempts.length,
			exactPrompt: stringValue(selectedAttempt.exactPrompt) ?? '',
			promptHash: stringValue(selectedAttempt.promptHash) ?? '',
			requestStartedAt: stringValue(selectedAttempt.requestStartedAt) ?? '',
			generationCompletedAt: stringValue(selectedAttempt.generationCompletedAt) ?? '',
			inspectionCompletedAt: stringValue(selectedAttempt.inspectionCompletedAt) ?? '',
			generationDurationMs: numberValue(selectedAttempt.generationDurationMs) ?? 0,
			inspectionDurationMs: numberValue(selectedAttempt.inspectionDurationMs) ?? 0,
			totalWallTimeMs: numberValue(result.totalWallTimeMs) ?? 0,
			sourceOutputId: stringValue(selectedAttempt.sourceOutputId) ?? '',
			persistenceOperation: stringValue(selectedAttempt.persistence.operation) ?? '',
			outputPath,
			width: outputWidth,
			height: outputHeight,
			mediaType: outputType,
			bytes: outputBytes,
			contentHash: outputHash,
			references: referenceInputs,
			findings
		};
		return { mediaId: makeOpaqueId(outputHash), mediaPath: absolutePath, metadata };
	} catch {
		return null;
	}
}

async function loadTargets(): Promise<TargetRecord[]> {
	const files = await listJsonFiles(path.join(EXPERIMENT_ROOT, 'targets'));
	const values = await Promise.all(files.map(readJson));
	return values.flatMap((value) => {
		const parsed = value ? parseTarget(value) : null;
		return parsed ? [parsed] : [];
	});
}

async function loadResults(): Promise<Map<string, JsonRecord>> {
	const files = await listJsonFiles(path.join(EXPERIMENT_ROOT, 'results'));
	const values = await Promise.all(files.map(readJson));
	return new Map(
		values.flatMap((value) => {
			const targetId = value ? stringValue(value.targetId) : null;
			return value && targetId ? [[targetId, value] as const] : [];
		})
	);
}

async function summaryFile(name: string) {
	const value = await readJson(path.join(EXPERIMENT_ROOT, 'review', name));
	if (!value) return null;
	if (name === 'catalog.json') {
		return {
			schemaVersion: stringValue(value.schemaVersion),
			generatedAt: stringValue(value.generatedAt),
			status: stringValue(value.status),
			entryCount: Array.isArray(value.entries) ? value.entries.length : 0,
			controlled: null
		};
	}
	const controlled = isRecord(value.controlled) ? value.controlled : null;
	return {
		schemaVersion: stringValue(value.schemaVersion),
		generatedAt: stringValue(value.generatedAt),
		status: stringValue(value.status),
		recommendedSafeConcurrency: numberValue(value.recommendedSafeConcurrency),
		entryCount: 0,
		controlled: controlled
			? {
					firstAttemptCandidateCount: numberValue(controlled.firstAttemptCandidateCount) ?? 0,
					speciesCorrectCount: numberValue(controlled.speciesCorrectCount) ?? 0,
					affinityCorrectCount: numberValue(controlled.affinityCorrectCount) ?? 0,
					normalUnaffiliatedCount: numberValue(controlled.normalUnaffiliatedCount) ?? 0,
					acceptedMeaningfulAffinityCount:
						numberValue(controlled.acceptedMeaningfulAffinityCount) ?? 0
				}
			: null,
		completionNotes: Array.isArray(value.completionNotes)
			? value.completionNotes.filter((note): note is string => typeof note === 'string')
			: []
	};
}

function reviewsForCurrentCandidate(
	reviews: readonly AffinityWorkflowReviewRecord[],
	target: TargetRecord | undefined,
	candidate: VerifiedCandidate | null | undefined
): AffinityWorkflowReviewRecord[] {
	if (!target || !candidate) return [];
	return reviews
		.filter(
			(review) =>
				review.targetId === target.targetId &&
				review.candidateContentHash === candidate.metadata.contentHash
		)
		.sort(
			(left, right) =>
				Date.parse(left.reviewedAt) - Date.parse(right.reviewedAt) ||
				left.reviewId.localeCompare(right.reviewId)
		);
}

export function summarizeAffinityReviews(
	reviews: readonly AffinityWorkflowReviewRecord[],
	blind: boolean
): BlindReviewState | LabeledReviewState {
	const latest = reviews.at(-1) ?? null;
	const neutral = { count: reviews.length, latestAt: latest?.reviewedAt ?? null };
	if (blind) return neutral;
	return {
		...neutral,
		latest: latest
			? {
					reviewer: latest.reviewer,
					identifiedSpeciesId: latest.identifiedSpeciesId,
					identifiedAffinity: latest.identifiedAffinity,
					scores: latest.scores,
					verdict: latest.verdict,
					note: latest.note,
					reviewedAt: latest.reviewedAt
				}
			: null
	};
}

export async function loadAffinityReviewData(
	blind: boolean,
	reviews: readonly AffinityWorkflowReviewRecord[] = [],
	scope: AffinityReviewScope = 'all'
) {
	const [targets, results, catalog, evaluation] = await Promise.all([
		loadTargets(),
		loadResults(),
		summaryFile('catalog.json'),
		summaryFile('evaluation.json')
	]);
	const targetByCoordinate = new Map(
		targets.map((target) => [`${target.speciesId}:${target.cohort}:${target.affinity}`, target])
	);
	const targetById = new Map(targets.map((target) => [target.targetId, target]));
	const candidateByTarget = new Map<string, VerifiedCandidate | null>();
	await Promise.all(
		targets.map(async (target) => {
			const result = results.get(target.targetId);
			candidateByTarget.set(target.targetId, result ? await verifyCandidate(target, result) : null);
		})
	);

	const scopedSpecies =
		scope === 'controlled' ? SPECIES.filter((entry) => entry.cohort === 'controlled') : SPECIES;
	const species = blind ? buildBlindOrder(scopedSpecies, `species:${scope}`) : [...scopedSpecies];
	const reviewEvidence = blind
		? reviews.filter((review) => review.reviewMode === 'blind')
		: reviews;
	const rows: AffinityReviewRow[] = species.map((entry, rowIndex) => {
		const affinityItems = AFFINITIES.map((id) => ({ id }));
		const orderedAffinities = blind
			? buildBlindOrder(affinityItems, `affinity:${entry.id}`)
			: affinityItems;
		return {
			id: blind ? `specimen-${String(rowIndex + 1).padStart(2, '0')}` : entry.id,
			rowLabel: blind ? `Specimen ${String(rowIndex + 1).padStart(2, '0')}` : entry.name,
			cohort: blind ? null : entry.cohort,
			cells: orderedAffinities.map((affinityEntry, columnIndex) => {
				const explicitTargetId = entry.targetIds?.[affinityEntry.id];
				const target = entry.targetIds
					? explicitTargetId
						? targetById.get(explicitTargetId)
						: undefined
					: targetByCoordinate.get(`${entry.speciesId}:${entry.cohort}:${affinityEntry.id}`);
				const result = target ? results.get(target.targetId) : null;
				const candidate = target ? candidateByTarget.get(target.targetId) : null;
				const currentReviews = reviewsForCurrentCandidate(reviewEvidence, target, candidate);
				let status: CandidateState = 'pending';
				let statusLabel = 'Pending generation';
				if (result?.status === 'revise' || result?.status === 'failed') {
					status = 'revise';
					statusLabel = 'Revision required';
				} else if (candidate) {
					status = 'candidate';
					statusLabel = 'Unapproved candidate';
				} else if (result) {
					status = 'invalid';
					statusLabel = 'Withheld · verification failed';
				}
				const columnLabel = blind
					? `Sample ${String.fromCharCode(65 + columnIndex)}`
					: affinityEntry.id[0]!.toUpperCase() + affinityEntry.id.slice(1);
				return {
					id: blind
						? `${rowIndex + 1}-${columnIndex + 1}`
						: (target?.targetId ?? `${entry.id}-${affinityEntry.id}`),
					columnLabel,
					status,
					statusLabel,
					mediaUrl: candidate
						? `/forge/enemies/affinity-workflow/media/${candidate.mediaId}`
						: null,
					alt: blind
						? 'Unlabeled experiment candidate'
						: `${entry.name}, ${affinityEntry.id} affinity — unapproved experiment candidate`,
					labels:
						blind || !target
							? null
							: { species: entry.name, affinity: affinityEntry.id, targetId: target.targetId },
					metadata: blind ? null : (candidate?.metadata ?? null),
					reviewState: summarizeAffinityReviews(currentReviews, blind)
				};
			})
		};
	});
	const visibleCells = rows.flatMap((row) => row.cells);
	const scopedTargets =
		scope === 'controlled' ? targets.filter((target) => target.cohort === 'controlled') : targets;
	const controlledTargets = targets.filter((target) => target.cohort === 'controlled');
	const controlledCandidateTargets = controlledTargets.filter((target) => {
		const result = results.get(target.targetId);
		return result?.status === 'candidate' && candidateByTarget.get(target.targetId);
	});
	const controlledNonNormalCandidateTargets = controlledCandidateTargets.filter(
		(target) => target.affinity !== 'normal'
	);
	const firstAttemptCandidateCount = evaluation?.controlled?.firstAttemptCandidateCount ?? 0;
	const gateReadiness = {
		currentlySatisfied: false,
		attainableWithExistingControlledCohort:
			firstAttemptCandidateCount >= 20 &&
			controlledCandidateTargets.length >= 23 &&
			controlledNonNormalCandidateTargets.length >= 20,
		criteria: [
			{
				label: 'First-attempt candidates',
				current: firstAttemptCandidateCount,
				maximum: firstAttemptCandidateCount,
				threshold: 20
			},
			{
				label: 'Species review capacity',
				current: evaluation?.controlled?.speciesCorrectCount ?? 0,
				maximum: controlledCandidateTargets.length,
				threshold: 23
			},
			{
				label: 'Meaningful affinity acceptance capacity',
				current: evaluation?.controlled?.acceptedMeaningfulAffinityCount ?? 0,
				maximum: controlledNonNormalCandidateTargets.length,
				threshold: 20
			}
		]
	};

	return {
		experimentId: EXPERIMENT_ID,
		blind,
		scope,
		rows,
		targetCount: scopedTargets.length,
		resultCount: scopedTargets.filter((target) => results.has(target.targetId)).length,
		verifiedCandidateCount: scopedTargets.filter((target) => candidateByTarget.get(target.targetId))
			.length,
		reviewableCount: visibleCells.filter((cell) => cell.status === 'candidate').length,
		reviewedCandidateCount: visibleCells.filter(
			(cell) => cell.status === 'candidate' && cell.reviewState.count > 0
		).length,
		catalog,
		evaluation: blind && evaluation ? { ...evaluation, completionNotes: [] } : evaluation,
		gateReadiness
	};
}

export async function findVerifiedMediaByOpaqueId(opaqueId: string) {
	if (!/^[a-f0-9]{24}$/.test(opaqueId)) return null;
	const [targets, results] = await Promise.all([loadTargets(), loadResults()]);
	for (const target of targets) {
		const result = results.get(target.targetId);
		if (!result) continue;
		const candidate = await verifyCandidate(target, result);
		if (candidate?.mediaId === opaqueId) {
			return {
				path: candidate.mediaPath,
				targetId: target.targetId,
				contentHash: candidate.metadata.contentHash,
				resultStatus: candidate.metadata.resultStatus as 'candidate' | 'revise'
			} satisfies VerifiedMediaBinding;
		}
	}
	return null;
}
