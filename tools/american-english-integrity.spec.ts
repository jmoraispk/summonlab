import { describe, expect, it } from 'vitest';

import { canonicalSha256 } from './equipment-rank-first-production-v3.js';
import { stableFamilyAffinityJson } from './family-affinity-production-lib.js';
import { canonicalJson as imageCanonicalJson, sha256Json } from './image-production-lib.js';
import {
	AMERICAN_ENGLISH_INTEGRITY_OWNERS,
	classifyIntegrityBindings,
	type AmericanEnglishIntegrityOwner,
	type IntegrityPlanningContext,
	type TrackedTreeSnapshot
} from './american-english-integrity.js';
import { equipmentIntegrityOwner } from './american-english-equipment-successors.js';
import { runtimeAndEngineIntegrityOwner } from './american-english-runtime-successors.js';
import { visualProductionIntegrityOwner } from './american-english-visual-successors.js';
import { canonicalJson as characterCanonicalJson } from '../packages/characters/src/index.js';
import {
	canonicalJson as engineCanonicalJson,
	hashCanonical
} from '../packages/engine/src/hash.js';

const HASH = 'a'.repeat(64);

interface BinaryFixture {
	readonly bytes: Uint8Array;
	readonly baselineBytes: Uint8Array;
	readonly binary: true;
}

function isBinaryFixture(value: unknown): value is BinaryFixture {
	return (
		value !== null && typeof value === 'object' && (value as { binary?: unknown }).binary === true
	);
}

function snapshot(entries: Readonly<Record<string, unknown | BinaryFixture>>): TrackedTreeSnapshot {
	return {
		entries: Object.entries(entries).map(([path, value]) =>
			isBinaryFixture(value)
				? { path, ...value }
				: { path, bytes: Buffer.from(`${JSON.stringify(value)}\n`), binary: false }
		)
	};
}

function proposed(paths: readonly string[]) {
	return {
		textEdits: paths.map((path) => ({ path, violationCount: 1 })),
		pathMoves: []
	};
}

function chain(root: string, serializer: IntegrityPlanningContext['nodes'][number]['serializer']) {
	return {
		nodes: [
			{
				path: `${root}/profile.json`,
				kind: 'canonical-json' as const,
				serializer,
				value: { schemaVersion: 'profile-v1', terminology: 'behavior' },
				dependsOn: []
			},
			{
				path: `${root}/target.json`,
				kind: 'canonical-json' as const,
				serializer,
				value: { targetId: 'armor-target', prompt: 'Use a gray border.', profileHash: HASH },
				dependsOn: [`${root}/profile.json`],
				dependencyBindings: [{ sourcePath: `${root}/profile.json`, jsonPointer: '/profileHash' }]
			},
			{
				path: `${root}/assignment.json`,
				kind: 'path-and-content' as const,
				serializer,
				value: { assignmentId: 'assignment-armor-target', targetHash: HASH },
				dependsOn: [`${root}/target.json`],
				dependencyBindings: [{ sourcePath: `${root}/target.json`, jsonPointer: '/targetHash' }]
			},
			{
				path: `${root}/result.json`,
				kind: 'canonical-json' as const,
				serializer,
				value: { assignmentHash: HASH, resultId: 'armor-target-result' },
				dependsOn: [`${root}/assignment.json`],
				dependencyBindings: [
					{ sourcePath: `${root}/assignment.json`, jsonPointer: '/assignmentHash' }
				]
			},
			{
				path: `${root}/review.json`,
				kind: 'generated-output' as const,
				serializer,
				value: { decision: 'accepted', resultHash: HASH },
				dependsOn: [`${root}/result.json`],
				dependencyBindings: [{ sourcePath: `${root}/result.json`, jsonPointer: '/resultHash' }]
			}
		]
	} satisfies IntegrityPlanningContext;
}

describe('canonical serializer characterization', () => {
	it('preserves the pre-migration hashes exposed by live equipment validators', () => {
		const fixture = { b: { c: 2 }, a: 1 };
		expect(canonicalSha256(fixture)).toBe(
			'007f2c1c104514608c3cdf42ec59d710d0888592c1d1f72437d9b075093617b8'
		);
	});

	it('preserves the pre-migration visual, character, and engine canonical forms', () => {
		const fixture = { b: { c: 2 }, a: 1 };
		expect(stableFamilyAffinityJson(fixture)).toBe('{"a":1,"b":{"c":2}}\n');
		expect(imageCanonicalJson(fixture)).toBe('{"a":1,"b":{"c":2}}');
		expect(sha256Json(fixture)).toBe(
			'007f2c1c104514608c3cdf42ec59d710d0888592c1d1f72437d9b075093617b8'
		);
		expect(characterCanonicalJson(fixture)).toBe('{"a":1,"b":{"c":2}}');
		expect(engineCanonicalJson(fixture)).toBe('{"a":1,"b":{"c":2}}');
		expect(hashCanonical(fixture)).toBe(
			'007f2c1c104514608c3cdf42ec59d710d0888592c1d1f72437d9b075093617b8'
		);
	});
});

describe('integrity owner successor planning', () => {
	it.each([
		['equipment', equipmentIntegrityOwner, 'assets/equipment/experiments/fixture', 'equipment-v1'],
		[
			'visual-production',
			visualProductionIntegrityOwner,
			'assets/heroes/experiments/fixture',
			'image-production'
		],
		[
			'runtime-and-engine',
			runtimeAndEngineIntegrityOwner,
			'packages/engine/fixtures/fixture',
			'engine'
		]
	] as const)(
		'reseals the %s lineage in dependency order with the live serializer',
		async (_id, owner, root, serializer) => {
			const successors = await owner.planSuccessors(chain(root, serializer));
			expect(successors.map(({ path }) => path)).toEqual([
				`${root}/profile.json`,
				`${root}/target.json`,
				`${root}/assignment.json`,
				`${root}/result.json`,
				`${root}/review.json`
			]);
			expect(successors.every(({ languageMigrationSuccessor }) => languageMigrationSuccessor)).toBe(
				true
			);
			expect(successors[0]?.digest).toBe(
				'dbaf4a2cad6afbecc056d092d77f4a9992b788532418dfa956f1b0c1ec069c6f'
			);
			const target = successors[1]?.value as { readonly profileHash: string };
			expect(target.profileHash).toBe(successors[0]?.digest);
		}
	);

	it('blocks dependency cycles and missing source nodes', async () => {
		await expect(
			equipmentIntegrityOwner.planSuccessors({
				nodes: [
					{
						path: 'assets/equipment/a.json',
						kind: 'canonical-json',
						serializer: 'equipment-v1',
						value: {},
						dependsOn: ['assets/equipment/b.json']
					},
					{
						path: 'assets/equipment/b.json',
						kind: 'canonical-json',
						serializer: 'equipment-v1',
						value: {},
						dependsOn: ['assets/equipment/a.json']
					}
				]
			})
		).rejects.toThrow(/cycle/i);
		await expect(
			equipmentIntegrityOwner.planSuccessors({
				nodes: [
					{
						path: 'assets/equipment/target.json',
						kind: 'canonical-json',
						serializer: 'equipment-v1',
						value: {},
						dependsOn: ['assets/equipment/missing.json']
					}
				]
			})
		).rejects.toThrow(/missing source node/i);
	});

	it('reports a successor whose digest no longer matches its live serializer', async () => {
		const context = chain('packages/engine/fixtures/verification', 'engine');
		const successors = await runtimeAndEngineIntegrityOwner.planSuccessors(context);
		const problems = await runtimeAndEngineIntegrityOwner.verify({
			nodes: context.nodes,
			successors: successors.map((successor, index) =>
				index === 2 ? { ...successor, digest: HASH } : successor
			)
		});
		expect(problems).toEqual([
			expect.objectContaining({
				code: 'digest-mismatch',
				path: 'packages/engine/fixtures/verification/assignment.json'
			})
		]);
	});

	it('uses the live family-affinity digest without hashing the persisted line feed', async () => {
		const successors = await visualProductionIntegrityOwner.planSuccessors({
			nodes: [
				{
					path: 'assets/enemies/experiments/family-affinity-v1/fixture.json',
					kind: 'canonical-json',
					serializer: 'family-affinity',
					value: { b: { c: 2 }, a: 1 },
					dependsOn: []
				}
			]
		});
		expect(successors[0]?.digest).toBe(
			'007f2c1c104514608c3cdf42ec59d710d0888592c1d1f72437d9b075093617b8'
		);
	});
});

describe('integrity binding classification', () => {
	it('keeps the three owner path registries explicit and mutually exclusive', () => {
		expect(equipmentIntegrityOwner.owns('assets/equipment/experiments/v3/manifest.json', '')).toBe(
			true
		);
		expect(equipmentIntegrityOwner.owns('assets/heroes/experiments/manifest.json', '')).toBe(false);
		expect(
			visualProductionIntegrityOwner.owns('tools/export-equipment-runtime-visuals.ts', '')
		).toBe(false);
		expect(
			visualProductionIntegrityOwner.owns(
				'assets/enemies/experiments/family-affinity-v1/manifest.json',
				''
			)
		).toBe(true);
		expect(runtimeAndEngineIntegrityOwner.owns('packages/engine/src/hash.ts', '')).toBe(true);
		expect(runtimeAndEngineIntegrityOwner.owns('unregistered/receipt.json', '')).toBe(false);
	});

	it('assigns representative real lineages to exactly one owner and one command pair', async () => {
		const paths = [
			'assets/equipment/experiments/material-equipment-v3/manifest.json',
			'assets/heroes/experiments/one-star-overnight-200-001/roster-plan.json',
			'packages/engine/src/story.spec.ts'
		];
		const report = await classifyIntegrityBindings(
			snapshot({
				[paths[0]!]: { manifestHash: HASH },
				[paths[1]!]: { rosterPlanSha256: HASH },
				[paths[2]!]: { stateHash: HASH }
			}),
			proposed(paths)
		);

		expect(report.problems).toEqual([]);
		expect(report.bindings.map(({ ownerId }) => ownerId)).toEqual([
			'equipment',
			'visual-production',
			'runtime-and-engine'
		]);
		expect(report.ownerPlans).toEqual(
			expect.arrayContaining(
				AMERICAN_ENGLISH_INTEGRITY_OWNERS.map((owner) =>
					expect.objectContaining({
						id: owner.id,
						writeCommand: expect.stringContaining('pnpm'),
						checkCommand: expect.stringContaining('pnpm')
					})
				)
			)
		);
		expect(equipmentIntegrityOwner.regeneration?.writeCommand).toBe(
			'pnpm export:equipment-runtime-visuals && pnpm export:equipment-integration-report'
		);
		expect(equipmentIntegrityOwner.regeneration?.checkCommand).toContain(
			'pnpm validate:repository-assets'
		);
		expect(equipmentIntegrityOwner.regeneration?.checkCommand).not.toContain(
			'export-equipment-image-profile'
		);
	});

	it('owns a changed generated artifact even when it has no digest field', async () => {
		const path = 'assets/wiki/skills/icon-production-v1/review/index.html';
		const report = await classifyIntegrityBindings(
			{
				entries: [{ path, bytes: Buffer.from('<main>American color review</main>'), binary: false }]
			},
			proposed([path])
		);
		expect(report.problems).toEqual([]);
		expect(report.bindings).toEqual([
			expect.objectContaining({ path, kind: 'generated-output', ownerId: 'visual-production' })
		]);
	});

	it('blocks an unknown digest field, ambiguous owner, changed binary, and absent node', async () => {
		const unknown = await classifyIntegrityBindings(
			snapshot({ 'assets/equipment/unknown.json': { unregisteredProof: HASH } }),
			proposed(['assets/equipment/unknown.json'])
		);
		expect(unknown.problems).toEqual([
			expect.objectContaining({ code: 'unknown-digest', jsonPointer: '/unregisteredProof' })
		]);

		const overlapping: AmericanEnglishIntegrityOwner[] = [
			{ ...equipmentIntegrityOwner, id: 'equipment' },
			{ ...equipmentIntegrityOwner, id: 'visual-production' }
		];
		const ambiguous = await classifyIntegrityBindings(
			snapshot({ 'assets/equipment/target.json': { contentHash: HASH } }),
			proposed(['assets/equipment/target.json']),
			overlapping
		);
		expect(ambiguous.problems).toEqual([expect.objectContaining({ code: 'ambiguous-owner' })]);

		const changedBinary = await classifyIntegrityBindings(
			snapshot({
				'assets/heroes/source.png': {
					bytes: Uint8Array.of(2),
					baselineBytes: Uint8Array.of(1),
					binary: true
				}
			}),
			proposed(['assets/heroes/source.png'])
		);
		expect(changedBinary.problems).toEqual([expect.objectContaining({ code: 'changed-binary' })]);

		const absent = await classifyIntegrityBindings(snapshot({}), proposed(['missing.json']));
		expect(absent.problems).toEqual([expect.objectContaining({ code: 'missing-node' })]);
	});

	it('blocks an owner without a registered regeneration command', async () => {
		const incompleteOwner: AmericanEnglishIntegrityOwner = {
			...runtimeAndEngineIntegrityOwner,
			regeneration: null
		};
		const report = await classifyIntegrityBindings(
			snapshot({ 'packages/engine/fixtures/release-receipt.json': { contentHash: HASH } }),
			proposed(['packages/engine/fixtures/release-receipt.json']),
			[incompleteOwner]
		);
		expect(report.problems).toEqual([expect.objectContaining({ code: 'missing-command' })]);
	});

	it('does not let the runtime owner absorb an unrelated integrity location', async () => {
		const report = await classifyIntegrityBindings(
			snapshot({ 'unregistered/receipt.json': { contentHash: HASH } }),
			proposed(['unregistered/receipt.json'])
		);
		expect(report.problems).toEqual([
			expect.objectContaining({ code: 'unowned-binding', path: 'unregistered/receipt.json' })
		]);
	});
});
