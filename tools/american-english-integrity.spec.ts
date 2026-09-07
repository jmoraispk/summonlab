import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { canonicalSha256 } from './equipment-rank-first-production-v3.js';
import {
	familyAffinitySha256,
	stableFamilyAffinityJson
} from './family-affinity-production-lib.js';
import { canonicalJson as imageCanonicalJson, sha256Json } from './image-production-lib.js';
import {
	AMERICAN_ENGLISH_INTEGRITY_OWNERS,
	classifyIntegrityBindings,
	validateIntegrityOwnerCommandContracts,
	type AmericanEnglishIntegrityOwner,
	type IntegrityPlanningContext,
	type IntegritySuccessor,
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
	it('selects each live serializer from an explicit path and record contract', () => {
		const select = (owner: AmericanEnglishIntegrityOwner, path: string, kind: string) =>
			(
				owner as unknown as { serializerFor(path: string, kind: string): string | null }
			).serializerFor(path, kind);
		expect(
			select(
				equipmentIntegrityOwner,
				'assets/equipment/experiments/material-equipment-v1/manifest.json',
				'canonical-json'
			)
		).toBe('equipment-v1');
		expect(
			select(
				equipmentIntegrityOwner,
				'assets/equipment/experiments/material-equipment-v2/manifest.json',
				'canonical-json'
			)
		).toBe('equipment-v2');
		expect(
			select(
				equipmentIntegrityOwner,
				'assets/equipment/experiments/material-equipment-v3/manifest.json',
				'canonical-json'
			)
		).toBe('equipment-v3');
		expect(
			select(
				visualProductionIntegrityOwner,
				'assets/enemies/experiments/family-affinity-v1/manifest.json',
				'canonical-json'
			)
		).toBe('family-affinity');
		expect(
			select(
				visualProductionIntegrityOwner,
				'assets/heroes/experiments/fixture/result.json',
				'canonical-json'
			)
		).toBe('image-production');
		expect(
			select(
				visualProductionIntegrityOwner,
				'packages/characters/src/manifest.json',
				'canonical-json'
			)
		).toBe('character-manifest');
		expect(
			select(visualProductionIntegrityOwner, 'packages/characters/src/index.ts', 'utf8-string')
		).toBe('utf8-string');
		expect(
			select(runtimeAndEngineIntegrityOwner, 'packages/engine/src/fixture.json', 'canonical-json')
		).toBe('engine');
		expect(select(visualProductionIntegrityOwner, 'assets/heroes/source.png', 'raw-file')).toBe(
			'raw-file'
		);
		expect(
			select(runtimeAndEngineIntegrityOwner, 'packages/engine/unknown.bin', 'raw-file')
		).toBeNull();
	});

	it.each([
		[
			'equipment-v1',
			equipmentIntegrityOwner,
			'assets/equipment/experiments/material-equipment-v1/manifest.json',
			'canonical-json',
			{ b: 2, a: 1 },
			canonicalJsonSha256({ b: 2, a: 1 })
		],
		[
			'equipment-v2',
			equipmentIntegrityOwner,
			'assets/equipment/experiments/material-equipment-v2/manifest.json',
			'canonical-json',
			{ b: 2, a: 1 },
			canonicalJsonSha256V2({ b: 2, a: 1 })
		],
		[
			'equipment-v3',
			equipmentIntegrityOwner,
			'assets/equipment/experiments/material-equipment-v3/manifest.json',
			'canonical-json',
			{ b: 2, a: 1 },
			canonicalSha256({ b: 2, a: 1 })
		],
		[
			'family-affinity',
			visualProductionIntegrityOwner,
			'assets/enemies/experiments/family-affinity-v1/manifest.json',
			'canonical-json',
			{ b: 2, a: 1 },
			familyAffinitySha256({ b: 2, a: 1 })
		],
		[
			'image-production',
			visualProductionIntegrityOwner,
			'assets/heroes/experiments/fixture/result.json',
			'canonical-json',
			{ b: 2, a: 1 },
			sha256Json({ b: 2, a: 1 })
		],
		[
			'character-manifest',
			visualProductionIntegrityOwner,
			'packages/characters/src/manifest.json',
			'canonical-json',
			{ b: 2, a: 1 },
			createHash('sha256')
				.update(characterCanonicalJson({ b: 2, a: 1 }))
				.digest('hex')
		],
		[
			'engine',
			runtimeAndEngineIntegrityOwner,
			'packages/engine/src/fixture.json',
			'canonical-json',
			{ b: 2, a: 1 },
			hashCanonical({ b: 2, a: 1 })
		],
		[
			'raw-file',
			visualProductionIntegrityOwner,
			'assets/heroes/source.png',
			'raw-file',
			new Uint8Array([0, 1, 2, 255]),
			createHash('sha256')
				.update(new Uint8Array([0, 1, 2, 255]))
				.digest('hex')
		],
		[
			'utf8-string',
			runtimeAndEngineIntegrityOwner,
			'packages/engine/src/story.ts',
			'utf8-string',
			'export const color = "gray";\n',
			createHash('sha256').update('export const color = "gray";\n', 'utf8').digest('hex')
		]
	] as const)(
		'computes the %s digest with the selected live serializer',
		async (serializer, owner, path, kind, value, expectedDigest) => {
			expect(owner.serializerFor(path, kind)).toBe(serializer);
			const [successor] = await owner.planSuccessors({
				nodes: [{ path, kind, serializer, value, dependsOn: [] }]
			});
			expect(successor?.digest).toBe(expectedDigest);
		}
	);

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

	it('rejects a successor whose path no longer links to its source node', async () => {
		const context = chain('packages/engine/fixtures/path-link', 'engine');
		const successors = await runtimeAndEngineIntegrityOwner.planSuccessors(context);
		const tampered = successors.map((successor, index) =>
			index === 1 ? { ...successor, path: `${successor.path}.forged` } : successor
		);
		const problems = await runtimeAndEngineIntegrityOwner.verify({
			nodes: context.nodes,
			successors: tampered
		});
		expect(problems).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'digest-mismatch',
					path: 'packages/engine/fixtures/path-link/target.json'
				}),
				expect.objectContaining({
					code: 'missing-node',
					path: 'packages/engine/fixtures/path-link/target.json.forged'
				})
			])
		);
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

	it.each([
		['value', (successor: IntegritySuccessor) => ({ ...successor, value: { forged: true } })],
		['kind', (successor: IntegritySuccessor) => ({ ...successor, kind: 'raw-file' as const })],
		['dependencies', (successor: IntegritySuccessor) => ({ ...successor, dependencies: [] })]
	] as const)(
		'rejects a successor with tampered %s even when its digest is copied',
		async (_field, tamper) => {
			const context = chain('packages/engine/fixtures/adversarial', 'engine');
			const baseSuccessors = await runtimeAndEngineIntegrityOwner.planSuccessors(context);
			const successors = baseSuccessors.map((successor, index) =>
				index === 1 ? tamper(successor) : successor
			);
			const problems = await runtimeAndEngineIntegrityOwner.verify({
				nodes: context.nodes,
				successors
			});
			expect(problems).toEqual([
				expect.objectContaining({
					code: 'digest-mismatch',
					path: 'packages/engine/fixtures/adversarial/target.json'
				})
			]);
		}
	);

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
	it('can import every owner adapter directly in a fresh runtime', () => {
		for (const modulePath of [
			'tools/american-english-equipment-successors.ts',
			'tools/american-english-visual-successors.ts',
			'tools/american-english-runtime-successors.ts'
		]) {
			const result = spawnSync(
				process.execPath,
				[
					path.resolve('node_modules/tsx/dist/cli.mjs'),
					'--eval',
					`import(${JSON.stringify(pathToFileURL(path.resolve(modulePath)).href)})`
				],
				{ encoding: 'utf8' }
			);
			expect(result.status, `${modulePath}: ${result.stderr}`).toBe(0);
		}
	});

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
		expect(runtimeAndEngineIntegrityOwner.ownsPath('packages/engine/src/hash.ts')).toBe(true);
		expect(runtimeAndEngineIntegrityOwner.owns('packages/engine/src/story.ts', '')).toBe(true);
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

	it('does not classify a plain file merely because it is below an owner subtree', async () => {
		const paths = [
			'assets/heroes/plain-not-an-integrity-record.md',
			'packages/characters/plain-not-integrity.txt',
			'packages/engine/plain-not-integrity.txt',
			'packages/evaluation/plain-not-integrity.txt',
			'packages/policies/plain-not-integrity.txt'
		];
		const report = await classifyIntegrityBindings(
			{
				entries: paths.map((path) => ({ path, bytes: Buffer.from('Gray prose.\n'), binary: false }))
			},
			proposed(paths)
		);
		expect(report.problems).toEqual([]);
		expect(report.bindings).toEqual([]);
		expect(report.ownerPlans).toEqual([]);
	});

	it('keeps exact known non-JSON package integrity sources registered', async () => {
		const paths = [
			'packages/characters/src/index.ts',
			'packages/engine/src/domains/settlement/equipment.spec.ts',
			'packages/engine/src/story.ts',
			'packages/evaluation/src/story-patch.ts',
			'packages/policies/src/openai.ts'
		];
		const report = await classifyIntegrityBindings(
			{
				entries: paths.map((path) => ({
					path,
					bytes: readFileSync(path),
					binary: false
				}))
			},
			proposed(paths)
		);
		expect(report.problems).toEqual([]);
		expect(report.bindings.map(({ path }) => path)).toEqual(paths);
	});

	it('does not manufacture package bindings from a recognized extension', async () => {
		const entries = [
			{
				path: 'packages/engine/plain.ts',
				bytes: Buffer.from('export const color = "gray";\n'),
				binary: false as const
			},
			{
				path: 'packages/evaluation/plain.json',
				bytes: Buffer.from('{"color":"gray"}\n'),
				binary: false as const
			},
			{
				path: 'packages/policies/plain.ts',
				bytes: Buffer.from('export const behavior = true;\n'),
				binary: false as const
			},
			{
				path: 'packages/characters/src/plain.json',
				bytes: Buffer.from('{"color":"gray"}\n'),
				binary: false as const
			}
		];
		const report = await classifyIntegrityBindings(
			{ entries },
			proposed(entries.map(({ path }) => path))
		);
		expect(report.problems).toEqual([]);
		expect(report.bindings).toEqual([]);
		expect(report.ownerPlans).toEqual([]);
	});

	it('hashes the real projected value and path instead of a synthetic descriptor', async () => {
		const path = 'packages/engine/src/fixture.json';
		const classify = (contentHash: string) =>
			classifyIntegrityBindings(
				{
					entries: [
						{
							path,
							bytes: Buffer.from(JSON.stringify({ contentHash: HASH })),
							projectedPath: 'packages/engine/src/fixture-successor.json',
							projectedBytes: Buffer.from(JSON.stringify({ contentHash })),
							binary: false
						}
					]
				},
				proposed([path])
			);
		const first = await classify('b'.repeat(64));
		const second = await classify('c'.repeat(64));
		const firstIntent = first.ownerPlans[0]!.successorIntents[0]!;
		const secondIntent = second.ownerPlans[0]!.successorIntents[0]!;
		expect(firstIntent.path).toBe('packages/engine/src/fixture-successor.json');
		expect(firstIntent.projectedValueDigest).toBe(hashCanonical({ contentHash: 'b'.repeat(64) }));
		expect(firstIntent.projectedValueDigest).not.toBe(secondIntent.projectedValueDigest);
	});

	it('derives real target to assignment to result dependency edges', async () => {
		const targetPath = 'assets/heroes/experiments/fixture/target.json';
		const assignmentPath = 'assets/heroes/experiments/fixture/assignment.json';
		const resultPath = 'assets/heroes/experiments/fixture/result.json';
		const target = { prompt: 'old' };
		const assignment = { targetSha256: sha256Json(target) };
		const result = { assignmentSha256: sha256Json(assignment) };
		const report = await classifyIntegrityBindings(
			{
				entries: [
					{
						path: targetPath,
						bytes: Buffer.from(JSON.stringify(target)),
						projectedBytes: Buffer.from(JSON.stringify({ prompt: 'new' })),
						binary: false
					},
					{ path: assignmentPath, bytes: Buffer.from(JSON.stringify(assignment)), binary: false },
					{ path: resultPath, bytes: Buffer.from(JSON.stringify(result)), binary: false }
				]
			},
			proposed([targetPath, assignmentPath, resultPath])
		);
		expect(report.problems).toEqual([]);
		const intents = report.ownerPlans[0]!.successorIntents;
		expect(intents.map(({ path }) => path)).toEqual([targetPath, assignmentPath, resultPath]);
		expect(intents[1]!.dependencies).toEqual([
			expect.objectContaining({ path: targetPath, digest: intents[0]!.projectedValueDigest })
		]);
		expect(intents[2]!.dependencies).toEqual([
			expect.objectContaining({ path: assignmentPath, digest: intents[1]!.projectedValueDigest })
		]);
	});

	it('preserves a duplicate digest as explicitly ambiguous instead of choosing a source', async () => {
		const firstPath = 'assets/heroes/experiments/fixture/a/target.json';
		const secondPath = 'assets/heroes/experiments/fixture/b/target.json';
		const assignmentPath = 'assets/heroes/experiments/fixture/assignment.json';
		const target = { prompt: 'same canonical target' };
		const targetSha256 = sha256Json(target);
		const report = await classifyIntegrityBindings(
			{
				entries: [
					{ path: firstPath, bytes: Buffer.from(JSON.stringify(target)), binary: false },
					{ path: secondPath, bytes: Buffer.from(JSON.stringify(target)), binary: false },
					{
						path: assignmentPath,
						bytes: Buffer.from(JSON.stringify({ targetSha256 })),
						binary: false
					}
				]
			},
			proposed([firstPath, secondPath, assignmentPath])
		);
		const assignment = report.ownerPlans[0]!.successorIntents.find(
			({ path }) => path === assignmentPath
		)!;
		expect(assignment.dependencies).toEqual([]);
		expect(assignment.externalDependencies).toEqual([
			{
				jsonPointer: '/targetSha256',
				value: targetSha256,
				candidatePaths: [firstPath, secondPath]
			}
		]);
	});

	it('uses a registered exact path reference to disambiguate and project a duplicate digest', async () => {
		const firstPath = 'assets/heroes/experiments/fixture/a/target.json';
		const firstSuccessorPath = 'assets/heroes/experiments/fixture/a/gray-target.json';
		const secondPath = 'assets/heroes/experiments/fixture/b/target.json';
		const assignmentPath = 'assets/heroes/experiments/fixture/assignment.json';
		const target = { prompt: 'same canonical target' };
		const targetSha256 = sha256Json(target);
		const report = await classifyIntegrityBindings(
			{
				entries: [
					{
						path: firstPath,
						projectedPath: firstSuccessorPath,
						bytes: Buffer.from(JSON.stringify(target)),
						binary: false
					},
					{ path: secondPath, bytes: Buffer.from(JSON.stringify(target)), binary: false },
					{
						path: assignmentPath,
						bytes: Buffer.from(JSON.stringify({ targetPath: firstPath, targetSha256 })),
						binary: false
					}
				]
			},
			proposed([firstPath, secondPath, assignmentPath])
		);
		const intents = report.ownerPlans[0]!.successorIntents;
		const first = intents.find(({ sourcePath }) => sourcePath === firstPath)!;
		const assignment = intents.find(({ path }) => path === assignmentPath)!;
		expect(assignment.dependencies).toEqual([
			{ path: firstSuccessorPath, digest: first.projectedValueDigest }
		]);
		expect(assignment.externalDependencies).toEqual([]);
		expect(assignment.projectedValueDigest).toBe(
			sha256Json({ targetPath: firstSuccessorPath, targetSha256: first.projectedValueDigest })
		);
	});

	it('produces the same explicit duplicate-digest result regardless of entry order', async () => {
		const firstPath = 'assets/heroes/experiments/fixture/a/target.json';
		const secondPath = 'assets/heroes/experiments/fixture/b/target.json';
		const assignmentPath = 'assets/heroes/experiments/fixture/assignment.json';
		const target = { prompt: 'same canonical target' };
		const targetSha256 = sha256Json(target);
		const entries = [
			{ path: firstPath, bytes: Buffer.from(JSON.stringify(target)), binary: false as const },
			{ path: secondPath, bytes: Buffer.from(JSON.stringify(target)), binary: false as const },
			{
				path: assignmentPath,
				bytes: Buffer.from(JSON.stringify({ targetSha256 })),
				binary: false as const
			}
		];
		const classify = async (orderedEntries: typeof entries) => {
			const report = await classifyIntegrityBindings(
				{ entries: orderedEntries },
				proposed([firstPath, secondPath, assignmentPath])
			);
			return report.ownerPlans[0]!.successorIntents.find(({ path }) => path === assignmentPath);
		};
		expect(await classify(entries)).toEqual(await classify([...entries].reverse()));
		expect((await classify(entries))?.dependencies).toEqual([]);
	});

	it('requires a registered path and exact pointer for every digest', async () => {
		const path = 'assets/equipment/experiments/material-equipment-v3/manifest.json';
		const known = await classifyIntegrityBindings(
			snapshot({ [path]: { contentHash: HASH } }),
			proposed([path])
		);
		expect(known.problems).toEqual([]);

		const nested = await classifyIntegrityBindings(
			snapshot({ [path]: { nested: { contentHash: HASH } } }),
			proposed([path])
		);
		expect(nested.problems).toEqual([
			expect.objectContaining({ code: 'unknown-digest', jsonPointer: '/nested/contentHash' })
		]);

		const intermediate = await classifyIntegrityBindings(
			snapshot({
				'assets/heroes/experiments/fixture/manifest.json': {
					intermediateHashes: {
						'progression-nera-voss': HASH,
						rogue: HASH
					}
				}
			}),
			proposed(['assets/heroes/experiments/fixture/manifest.json'])
		);
		expect(intermediate.problems).toEqual([
			expect.objectContaining({
				code: 'unknown-digest',
				jsonPointer: '/intermediateHashes/rogue'
			})
		]);

		const visualPath = 'assets/heroes/experiments/fixture/result.json';
		const boundedArray = await classifyIntegrityBindings(
			snapshot({ [visualPath]: { references: [{ sha256: HASH }] } }),
			proposed([visualPath])
		);
		expect(boundedArray.problems).toEqual([]);
		const unboundedMap = await classifyIntegrityBindings(
			snapshot({ [visualPath]: { references: { arbitrary: { sha256: HASH } } } }),
			proposed([visualPath])
		);
		expect(unboundedMap.problems).toEqual([
			expect.objectContaining({
				code: 'unknown-digest',
				jsonPointer: '/references/arbitrary/sha256'
			})
		]);
	});

	it('blocks every selected binary move without exactly one raw-file owner', async () => {
		const path = 'unregistered/gray.png';
		const report = await classifyIntegrityBindings(
			{
				entries: [
					{
						path,
						bytes: Uint8Array.of(1, 2, 3),
						baselineBytes: Uint8Array.of(1, 2, 3),
						binary: true
					}
				]
			},
			{ textEdits: [], pathMoves: [{ source: path }] }
		);
		expect(report.problems).toEqual([expect.objectContaining({ code: 'unowned-binding', path })]);
	});

	it('includes adapter-produced and verified successor intent for real bindings', async () => {
		const path = 'packages/engine/src/story.ts';
		const report = await classifyIntegrityBindings(
			{
				entries: [
					{ path, bytes: Buffer.from(`export const contentHash = '${HASH}';`), binary: false }
				]
			},
			proposed([path])
		);
		expect(report.problems).toEqual([]);
		expect(report.ownerPlans[0]).toEqual(
			expect.objectContaining({
				id: 'runtime-and-engine',
				successorIntents: [expect.objectContaining({ path, languageMigrationSuccessor: true })]
			})
		);
	});

	it('blocks classification when an owner adapter rejects its successor intent', async () => {
		const rejectingOwner: AmericanEnglishIntegrityOwner = {
			...runtimeAndEngineIntegrityOwner,
			verify: async () => [
				{
					path: 'packages/engine/src/story.ts',
					jsonPointer: '',
					code: 'digest-mismatch',
					message: 'Injected adapter verification failure'
				}
			]
		};
		const path = 'packages/engine/src/story.ts';
		const report = await classifyIntegrityBindings(
			{
				entries: [
					{ path, bytes: Buffer.from(`export const contentHash = '${HASH}';`), binary: false }
				]
			},
			proposed([path]),
			[rejectingOwner]
		);
		expect(report.problems).toEqual([expect.objectContaining({ code: 'digest-mismatch', path })]);
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
			{ textEdits: [], pathMoves: [{ source: 'assets/heroes/source.png' }] }
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

	it('emits the required private-release acknowledgment in the runtime write command', () => {
		expect(runtimeAndEngineIntegrityOwner.regeneration?.writeCommand).toContain(
			'pnpm package:playtest -- --acknowledge-private-release'
		);
	});

	it('validates that every owner command references live tools, scripts, and required flags', async () => {
		expect(
			await validateIntegrityOwnerCommandContracts(process.cwd(), AMERICAN_ENGLISH_INTEGRITY_OWNERS)
		).toEqual([]);

		const invalidOwner: AmericanEnglishIntegrityOwner = {
			...runtimeAndEngineIntegrityOwner,
			regeneration: {
				writeCommand: 'pnpm tsx tools/not-a-tool.ts && pnpm package:not-a-script',
				checkCommand: 'pnpm package:playtest'
			}
		};
		expect(await validateIntegrityOwnerCommandContracts(process.cwd(), [invalidOwner])).toEqual(
			expect.arrayContaining([
				expect.stringMatching(/not-a-tool/u),
				expect.stringMatching(/not-a-script/u),
				expect.stringMatching(/acknowledge-private-release/u)
			])
		);
	});
});
