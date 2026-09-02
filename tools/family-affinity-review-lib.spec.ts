import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	BlindReviewReceiptSchema,
	FamilyAffinityCandidateResultSchema,
	OrdinaryReviewReceiptSchema,
	buildFamilyAffinityReviewArtifacts,
	createReviewReceiptExclusive,
	evaluateFamilyAffinityReviewAttempt,
	reviewReceiptPath,
	validateReviewTransition
} from './family-affinity-review-lib.js';
import {
	FamilyAffinityTargetSchema,
	familyAffinitySha256,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';

const temporaryRoots: string[] = [];
const sha = (character: string) => character.repeat(64);

function target(tier: 'T1' | 'T3' | 'T5' = 'T1'): FamilyAffinityTarget {
	const formId = tier === 'T1' ? 'goblin-runt' : tier === 'T3' ? 'goblin-raider' : 'goblin-king';
	return FamilyAffinityTargetSchema.parse(
		JSON.parse(
			requireRead(
				join(
					process.cwd(),
					`assets/enemies/experiments/family-affinity-v1/targets/goblins/${formId}/normal/target-v1.json`
				)
			)
		)
	);
}

function requireRead(path: string): string {
	return process.getBuiltinModule('node:fs').readFileSync(path, 'utf8');
}

function resultFor(activeTarget: FamilyAffinityTarget, candidateBytes = Buffer.from('candidate')) {
	return FamilyAffinityCandidateResultSchema.parse({
		schemaVersion: 'family-affinity-candidate-result-v1',
		targetId: activeTarget.targetId,
		targetSha256: familyAffinitySha256(activeTarget),
		coordinateId: activeTarget.coordinateId,
		candidateVersion: activeTarget.version,
		producerId: 'producer-alpha',
		candidatePath: activeTarget.ownedPaths.candidate,
		candidateSha256: createHash('sha256').update(candidateBytes).digest('hex'),
		resultPath: activeTarget.ownedPaths.result,
		sourceSha256: activeTarget.sources.familyPacketSha256,
		promptSha256: sha('b'),
		state: 'candidate',
		runtimeCatalogMutationForbidden: true
	});
}

function ordinaryFor(
	activeTarget: FamilyAffinityTarget,
	result: ReturnType<typeof resultFor>,
	decision: 'approved-review' | 'rejected' | 'revise' = 'approved-review'
) {
	return OrdinaryReviewReceiptSchema.parse({
		schemaVersion: 'family-affinity-review-decision-v1',
		receiptType: 'ordinary',
		targetId: activeTarget.targetId,
		targetSha256: familyAffinitySha256(activeTarget),
		coordinateId: activeTarget.coordinateId,
		candidateVersion: 1,
		decisionVersion: 1,
		producerId: result.producerId,
		reviewerId: 'reviewer-beta',
		candidatePath: result.candidatePath,
		candidateSha256: result.candidateSha256,
		resultPath: result.resultPath,
		resultSha256: familyAffinitySha256(result),
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256,
		decision,
		rubric: Object.fromEntries(
			[
				'identity',
				'tier',
				'archetype',
				'anatomy',
				'affinity',
				'counterplay',
				'framing',
				'finish'
			].map((key) => [key, { verdict: 'pass', notes: `${key} reviewed independently` }])
		),
		runtimeCatalogMutationForbidden: true
	});
}

function blindFor(
	activeTarget: FamilyAffinityTarget,
	result: ReturnType<typeof resultFor>,
	decision: 'approved-review' | 'rejected' | 'revise' = 'approved-review'
) {
	return BlindReviewReceiptSchema.parse({
		...ordinaryFor(activeTarget, result, decision),
		schemaVersion: 'family-affinity-blind-review-v1',
		receiptType: 'blind',
		reviewerId: 'reviewer-gamma',
		blindToProducerIdentity: true,
		blindToOrdinaryDecision: true
	});
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('family-affinity review receipt contract', () => {
	it('derives collision-safe immutable ordinary and blind receipt paths', () => {
		expect(reviewReceiptPath('ordinary', 'goblins', 'goblin-raider', 'fire', 2, 3)).toBe(
			'assets/enemies/experiments/family-affinity-v1/review/decisions/goblins/goblin-raider/fire/candidate-v2-review-v3.json'
		);
		expect(reviewReceiptPath('blind', 'goblins', 'goblin-raider', 'fire', 2, 3)).toBe(
			'assets/enemies/experiments/family-affinity-v1/review/blind/goblins/goblin-raider/fire/candidate-v2-blind-v3.json'
		);
	});

	it('allows only planned to candidate to approved-review and rejects runtime', () => {
		expect(() => validateReviewTransition('planned', 'candidate')).not.toThrow();
		expect(() => validateReviewTransition('candidate', 'approved-review')).not.toThrow();
		expect(() => validateReviewTransition('planned', 'approved-review')).toThrow(/candidate/i);
		expect(() => validateReviewTransition('approved-review', 'runtime' as never)).toThrow(
			/runtime/i
		);
	});

	it('requires current candidate bytes, result receipt, and independent approval', () => {
		const activeTarget = target();
		const candidateBytes = Buffer.from('candidate');
		const result = resultFor(activeTarget, candidateBytes);
		const ordinary = ordinaryFor(activeTarget, result);
		expect(
			evaluateFamilyAffinityReviewAttempt({
				target: activeTarget,
				candidateBytes,
				result,
				resultBytes: Buffer.from(`${JSON.stringify(result)}\n`),
				ordinary
			})
		).toMatchObject({ state: 'approved-review', revisionRequired: false });

		expect(() => evaluateFamilyAffinityReviewAttempt({ target: activeTarget, ordinary })).toThrow(
			/result receipt/i
		);
		expect(() =>
			evaluateFamilyAffinityReviewAttempt({
				target: activeTarget,
				candidateBytes: Buffer.from('stale'),
				result,
				resultBytes: Buffer.from(`${JSON.stringify(result)}\n`),
				ordinary
			})
		).toThrow(/candidate hash/i);
		expect(() =>
			evaluateFamilyAffinityReviewAttempt({
				target: activeTarget,
				candidateBytes,
				result,
				resultBytes: Buffer.from(`${JSON.stringify(result)}\n`),
				ordinary: { ...ordinary, reviewerId: result.producerId }
			})
		).toThrow(/self-approval/i);
	});

	it('requires an independent agreeing blind receipt for every T3 and T5 candidate version', () => {
		for (const tier of ['T3', 'T5'] as const) {
			const activeTarget = target(tier);
			const candidateBytes = Buffer.from(`candidate-${tier}`);
			const result = resultFor(activeTarget, candidateBytes);
			const ordinary = ordinaryFor(activeTarget, result);
			expect(() =>
				evaluateFamilyAffinityReviewAttempt({
					target: activeTarget,
					candidateBytes,
					result,
					resultBytes: Buffer.from(`${JSON.stringify(result)}\n`),
					ordinary
				})
			).toThrow(/blind/i);
			expect(
				evaluateFamilyAffinityReviewAttempt({
					target: activeTarget,
					candidateBytes,
					result,
					resultBytes: Buffer.from(`${JSON.stringify(result)}\n`),
					ordinary,
					blind: blindFor(activeTarget, result)
				})
			).toMatchObject({ state: 'approved-review' });
			expect(() =>
				evaluateFamilyAffinityReviewAttempt({
					target: activeTarget,
					candidateBytes,
					result,
					resultBytes: Buffer.from(`${JSON.stringify(result)}\n`),
					ordinary,
					blind: { ...blindFor(activeTarget, result, 'revise'), reviewerId: 'reviewer-beta' }
				})
			).toThrow(/independent|disagree/i);
		}
	});

	it('keeps reject and revise decisions non-approved and requests controller allocation', () => {
		const activeTarget = target();
		const candidateBytes = Buffer.from('candidate');
		const result = resultFor(activeTarget, candidateBytes);
		for (const decision of ['rejected', 'revise'] as const) {
			expect(
				evaluateFamilyAffinityReviewAttempt({
					target: activeTarget,
					candidateBytes,
					result,
					resultBytes: Buffer.from(`${JSON.stringify(result)}\n`),
					ordinary: ordinaryFor(activeTarget, result, decision)
				})
			).toEqual({ state: decision, revisionRequired: true, approved: false });
		}
	});

	it('uses exclusive create and refuses receipt overwrites or non-review-owned paths', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-review-'));
		temporaryRoots.push(root);
		const activeTarget = target();
		const result = resultFor(activeTarget);
		const receipt = ordinaryFor(activeTarget, result);
		const path = reviewReceiptPath('ordinary', 'goblins', 'goblin-runt', 'normal', 1, 1);
		await createReviewReceiptExclusive(root, path, receipt);
		await expect(createReviewReceiptExclusive(root, path, receipt)).rejects.toThrow(/exists/i);
		await expect(
			createReviewReceiptExclusive(root, activeTarget.ownedPaths.result, receipt)
		).rejects.toThrow(/review receipt path/i);
	});
});

describe('initial family review evidence', () => {
	it('builds thirty deterministic 5x5 NOT GENERATED sheets and truthful zero counts', async () => {
		const first = await buildFamilyAffinityReviewArtifacts(process.cwd());
		const second = await buildFamilyAffinityReviewArtifacts(process.cwd());
		expect(first.catalog).toMatchObject({
			schemaVersion: 'family-affinity-review-catalog-v1',
			familyCount: 30,
			coordinateCount: 750,
			generatedCount: 0,
			approvedReviewCount: 0,
			runtimeCount: 0
		});
		expect(first.families).toHaveLength(30);
		expect(first.families.every(({ summary }) => summary.notGeneratedCount === 25)).toBe(true);
		expect(first.families.every(({ summary }) => summary.generatedCount === 0)).toBe(true);
		expect(first.families.every(({ summary }) => summary.cells.length === 25)).toBe(true);
		expect(
			first.families.every(({ summary }) =>
				summary.cells.every((cell) => cell.label === 'NOT GENERATED')
			)
		).toBe(true);
		expect(first.digest).toBe(second.digest);
		for (let index = 0; index < first.families.length; index += 1) {
			expect(first.families[index]!.contactSheet.equals(second.families[index]!.contactSheet)).toBe(
				true
			);
			expect(await sharp(first.families[index]!.contactSheet).metadata()).toMatchObject({
				format: 'png',
				width: 1600,
				height: 1200
			});
		}
	}, 15_000);

	it('fails closed when an owned candidate path traverses a symlinked directory', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-review-corpus-'));
		temporaryRoots.push(root);
		const source = join(process.cwd(), 'assets/enemies/experiments/family-affinity-v1');
		const destination = join(root, 'assets/enemies/experiments/family-affinity-v1');
		await cp(source, destination, {
			recursive: true,
			filter: (path) => !path.includes(`${join(source, 'review')}`)
		});
		const external = join(root, 'outside');
		await mkdir(join(destination, 'candidates'), { recursive: true });
		await mkdir(external);
		await symlink(external, join(destination, 'candidates/goblins'));
		await expect(buildFamilyAffinityReviewArtifacts(root)).rejects.toThrow(/symlink/i);
	});

	it('fails closed on malformed or extraneous files inside review-owned paths', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-review-corpus-'));
		temporaryRoots.push(root);
		const source = join(process.cwd(), 'assets/enemies/experiments/family-affinity-v1');
		const destination = join(root, 'assets/enemies/experiments/family-affinity-v1');
		await cp(source, destination, {
			recursive: true,
			filter: (path) => !path.includes(`${join(source, 'review')}`)
		});
		await mkdir(join(destination, 'review/decisions'), { recursive: true });
		await writeFile(join(destination, 'review/decisions/not-a-receipt.json'), '{}');
		await expect(buildFamilyAffinityReviewArtifacts(root)).rejects.toThrow(/extraneous/i);
	});
});
