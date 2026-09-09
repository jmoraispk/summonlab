import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH,
	loadSkillIconInnerFrameAcceptance,
	resolveAcceptedSkillIconComposite,
	syncSkillIconInnerFrameAcceptance
} from './skill-icon-inner-frame-acceptance.js';

const cleanupRoot = 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1';
const v10Path = `${cleanupRoot}/review/v10-inner-frame-audit/report.json`;
const v11Path = `${cleanupRoot}/review/v11-inner-frame-regeneration/report.json`;
const v12Path = `${cleanupRoot}/review/v12-inner-frame-regeneration-scale/report.json`;
const cleanupManifestPath = `${cleanupRoot}/manifest.json`;
const geometryPath = 'assets/wiki/skills/icon-production-v1/geometry-v2.json';
const backingPath =
	'assets/wiki/skills/icon-production-v1/candidates/references/charcoal-forged-stone-v6.png';
const framePath = `${cleanupRoot}/review/v9-complete-frame-rollout/frames/rarity-frame-e-v11-review.png`;
const approvedTargets = [
	'martial:blade:piercing-thrust',
	'martial:polearm:keep-away',
	'martial:polearm:piercing-line',
	'martial:polearm:wall-of-points',
	'martial:polearm:serpent-s-tongue',
	'martial:polearm:heaven-piercer',
	'martial:polearm:thousand-li-thrust',
	'martial:polearm:rend-armor',
	'martial:ranged:fletching',
	'martial:ranged:power-draw',
	'martial:ranged:piercing-shot',
	'martial:ranged:sky-piercer',
	'martial:body:sidestep',
	'martial:body:called-shot',
	'martial:body:the-road-has-no-end',
	'magical:elemental:torrent',
	'magical:elemental:the-deep',
	'magical:elemental:where-all-rivers-end',
	'magical:elemental:spike-field',
	'magical:enchantment:component-craft',
	'magical:mind:memory-edit',
	'craft:knowledge:languages',
	'craft:knowledge:research'
] as const;
const borderlineTargets = [
	'martial:blade:one-blade-one-world',
	'martial:blade:blade-throw',
	'martial:ranged:archery',
	'martial:ranged:quick-loose',
	'martial:ranged:world-s-edge-shot'
] as const;

const roots: string[] = [];

function sha256(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex');
}

async function writeRepositoryFile(root: string, repositoryPath: string, bytes: string | Buffer) {
	const destination = path.join(root, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await writeFile(destination, bytes);
}

function targetId(index: number): string {
	return `martial:blade:fixture-${String(index + 1).padStart(3, '0')}`;
}

function slug(target: string): string {
	return target.replaceAll(':', '-');
}

async function fixtureRepository(): Promise<{
	readonly root: string;
	readonly targets: readonly string[];
	readonly borderlines: readonly string[];
}> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-inner-frame-acceptance-'));
	roots.push(root);
	const targets = [
		...approvedTargets,
		...borderlineTargets,
		...Array.from({ length: 428 }, (_, index) => targetId(index))
	];
	const accepted = approvedTargets;
	const borderlines = borderlineTargets;
	const baselineByTarget = new Map<string, { path: string; hash: string }>();
	for (const target of targets) {
		const repositoryPath = `${cleanupRoot}/composites/${slug(target)}.png`;
		const bytes = Buffer.from(`baseline:${target}`);
		await writeRepositoryFile(root, repositoryPath, bytes);
		baselineByTarget.set(target, { path: repositoryPath, hash: sha256(bytes) });
	}

	const geometry = Buffer.from('{"canvas":{"width":1024,"height":1024}}\n');
	const backing = Buffer.from('fixture backing');
	await Promise.all([
		writeRepositoryFile(root, geometryPath, geometry),
		writeRepositoryFile(root, backingPath, backing),
		writeRepositoryFile(root, framePath, 'fixture canonical frame')
	]);

	const v10 = {
		schemaVersion: 'skill-icon-inner-frame-audit-review-v1',
		status: 'diagnostic-review-only-no-icons-modified',
		scope: { catalogSkills: 456, clear: 23, borderline: 5, totalCandidates: 28 },
		inputs: { geometry: { path: geometryPath, contentHash: sha256(geometry) } },
		records: [...accepted, ...borderlines].map((target, index) => ({
			targetId: target,
			currentPath: baselineByTarget.get(target)!.path,
			currentHash: baselineByTarget.get(target)!.hash,
			classification: index < 23 ? 'clear' : 'borderline'
		}))
	};
	const v11Records = [];
	const v12Records = [];
	for (const [index, target] of accepted.entries()) {
		const candidatePath = `${cleanupRoot}/review/v12-inner-frame-regeneration-scale/candidates/${slug(target)}.png`;
		const comparisonBaselinePath = `${cleanupRoot}/review/v11-inner-frame-regeneration/candidates/${slug(target)}.png`;
		const sourcePath = `${cleanupRoot}/provider-sources/${slug(target)}-v1-frameless-source.png`;
		const referenceTarget =
			target === 'martial:body:called-shot' ? 'martial:body:sidestep' : target;
		const comparisonBaseline = Buffer.from(`comparison:${target}`);
		const source = Buffer.from(`source:${target}`);
		const candidate = Buffer.from(`candidate:${target}`);
		await Promise.all([
			writeRepositoryFile(root, candidatePath, candidate),
			writeRepositoryFile(root, comparisonBaselinePath, comparisonBaseline),
			writeRepositoryFile(root, sourcePath, source)
		]);
		v11Records.push({
			targetId: target,
			candidatePath: comparisonBaselinePath,
			candidateHash: sha256(comparisonBaseline),
			sourcePath,
			source: { contentHash: sha256(source) },
			referencePath: baselineByTarget.get(referenceTarget)!.path,
			referenceHash: baselineByTarget.get(referenceTarget)!.hash,
			framePath,
			frameHash: sha256('fixture canonical frame')
		});
		v12Records.push({
			targetId: target,
			rank: 'E',
			currentPath: baselineByTarget.get(target)!.path,
			currentHash: baselineByTarget.get(target)!.hash,
			comparisonBaselinePath,
			comparisonBaselineHash: sha256(comparisonBaseline),
			sourceBinding: { v11Path: sourcePath, v11ContentHash: sha256(source), matches: true },
			referencePath: baselineByTarget.get(referenceTarget)!.path,
			referenceHash: baselineByTarget.get(referenceTarget)!.hash,
			sourcePath,
			source: { width: 1254, height: 1254, alphaMode: 'rgb', contentHash: sha256(source) },
			framePath,
			frameHash: sha256('fixture canonical frame'),
			candidatePath,
			candidateHash: sha256(candidate),
			apertureCoverage: { expectedPixels: 12, coveredPixels: 12, complete: true },
			inspection: {
				layerHashesMatch: true,
				exactComposite: true,
				protectedBandMatches: true,
				exteriorTransparent: true,
				backingOnlyComponents: []
			},
			sequence: index + 1
		});
	}
	const v11 = Buffer.from(
		`${JSON.stringify(
			{
				schemaVersion: 'skill-icon-inner-frame-regeneration-review-v1',
				status: 'owner-approved-regeneration-review-not-promoted',
				records: v11Records
			},
			null,
			'\t'
		)}\n`
	);
	const v12 = {
		schemaVersion: 'skill-icon-inner-frame-regeneration-review-v2',
		status: 'owner-approved-less-zoom-review-not-promoted',
		decision: 'center-accepted-frameless-art-at-90-percent-scale',
		scope: { regenerated: 23, borderlineUntouched: 5 },
		sequence: {
			mode: 'sequential',
			executionOrder: accepted.map((target, index) => ({
				step: index + 1,
				targetId: target,
				attempts: 1
			}))
		},
		assembly: {
			artworkTreatment: 'generated-frameless-source-centered-before-aperture-mask',
			artworkScale: 0.9,
			preparedSource: { width: 922, height: 922, left: 51, top: 51 },
			backing: { path: backingPath, contentHash: sha256(backing) },
			frameIsFinalLayer: true,
			compositionProfile: 'frame-opening-v3'
		},
		inputs: {
			geometry: { path: geometryPath, contentHash: sha256(geometry) },
			priorReview: { path: v11Path, contentHash: sha256(v11) }
		},
		records: v12Records
	};
	const cleanupManifest = {
		schemaVersion: 'skill-icon-quality-cleanup-manifest-v1',
		records: targets.map((target) => ({
			targetId: target,
			cleanupCompositePath: baselineByTarget.get(target)!.path
		}))
	};
	await Promise.all([
		writeRepositoryFile(root, v10Path, `${JSON.stringify(v10, null, '\t')}\n`),
		writeRepositoryFile(root, v11Path, v11),
		writeRepositoryFile(root, v12Path, `${JSON.stringify(v12, null, '\t')}\n`),
		writeRepositoryFile(
			root,
			cleanupManifestPath,
			`${JSON.stringify(cleanupManifest, null, '\t')}\n`
		)
	]);
	return { root, targets, borderlines };
}

async function readJson(root: string, repositoryPath: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(root, repositoryPath), 'utf8')) as Record<
		string,
		unknown
	>;
}

async function replaceJson(root: string, repositoryPath: string, value: unknown): Promise<void> {
	await writeRepositoryFile(root, repositoryPath, `${JSON.stringify(value, null, '\t')}\n`);
}

async function expectRejectedWithoutPublication(
	root: string,
	mutate: () => Promise<void>
): Promise<void> {
	await mutate();
	await expect(
		syncSkillIconInnerFrameAcceptance({ repositoryRoot: root, mode: 'write' })
	).rejects.toThrow();
	await expect(
		readFile(path.join(root, ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH))
	).rejects.toMatchObject({
		code: 'ENOENT'
	});
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('skill-icon inner-frame acceptance', () => {
	it('publishes byte-identical accepted candidates and resolves the 23 approved overrides', async () => {
		const fixture = await fixtureRepository();
		await syncSkillIconInnerFrameAcceptance({ repositoryRoot: fixture.root, mode: 'write' });
		await syncSkillIconInnerFrameAcceptance({ repositoryRoot: fixture.root, mode: 'check' });
		const acceptance = await loadSkillIconInnerFrameAcceptance({ repositoryRoot: fixture.root });

		expect(acceptance.records).toHaveLength(23);
		expect(acceptance.scope).toEqual({
			catalogSkills: 456,
			acceptedOverrides: 23,
			unchanged: 433,
			borderlineUntouched: 5
		});
		for (const record of acceptance.records)
			expect(await readFile(record.accepted.path)).toEqual(await readFile(record.candidate.path));

		const manifest = await readJson(fixture.root, cleanupManifestPath);
		const resolved = (manifest.records as { targetId: string; cleanupCompositePath: string }[]).map(
			(record) =>
				resolveAcceptedSkillIconComposite({
					targetId: record.targetId,
					baselinePath: record.cleanupCompositePath,
					baselineHash: sha256(`baseline:${record.targetId}`),
					acceptance
				})
		);
		expect(new Set(resolved.map(({ source }) => source))).toEqual(
			new Set(['baseline', 'inner-frame-v1'])
		);
		expect(resolved).toHaveLength(456);
		const borderlineResolved = fixture.borderlines.map((target) =>
			resolveAcceptedSkillIconComposite({
				targetId: target,
				baselinePath: `${cleanupRoot}/composites/${slug(target)}.png`,
				baselineHash: sha256(`baseline:${target}`),
				acceptance
			})
		);
		expect(borderlineResolved.every(({ source }) => source === 'baseline')).toBe(true);
		expect(() =>
			resolveAcceptedSkillIconComposite({
				targetId: acceptance.records[0]!.targetId,
				baselinePath: 'unbound.png',
				baselineHash: '0'.repeat(64),
				acceptance
			})
		).toThrow(/baseline binding/i);
	});

	it('rejects report, target, baseline, existing-output, and assembly drift before publication', async () => {
		const cases: readonly (readonly [string, (root: string) => Promise<void>])[] = [
			[
				'a mutated V12 candidate hash',
				async (root) => {
					const report = await readJson(root, v12Path);
					(report.records as Record<string, unknown>[])[0]!.candidateHash = '0'.repeat(64);
					await replaceJson(root, v12Path, report);
				}
			],
			...(
				[
					['frame', 'framePath'],
					['source', 'sourcePath'],
					['V11 source binding', 'sourceBinding.v11Path'],
					['V11 comparison baseline', 'comparisonBaselinePath'],
					['reference', 'referencePath']
				] as const
			).map(
				([label, binding]) =>
					[
						`a drifted V12 ${label} raster`,
						async (root: string) => {
							const report = await readJson(root, v12Path);
							const record = (report.records as Record<string, unknown>[])[0]!;
							const repositoryPath = binding.includes('.')
								? ((record.sourceBinding as Record<string, unknown>).v11Path as string)
								: (record[binding] as string);
							await writeRepositoryFile(root, repositoryPath, `drifted ${label} bytes`);
						}
					] as const
			),
			[
				'a mutated V12 frame hash',
				async (root) => {
					const report = await readJson(root, v12Path);
					(report.records as Record<string, unknown>[])[0]!.frameHash = '0'.repeat(64);
					await replaceJson(root, v12Path, report);
				}
			],
			[
				'a mutated V12 V11 source-binding hash',
				async (root) => {
					const report = await readJson(root, v12Path);
					(
						(report.records as Record<string, unknown>[])[0]!.sourceBinding as Record<
							string,
							unknown
						>
					).v11ContentHash = '0'.repeat(64);
					await replaceJson(root, v12Path, report);
				}
			],
			[
				'an added V12 target',
				async (root) => {
					const report = await readJson(root, v12Path);
					(report.records as unknown[]).push((report.records as unknown[])[0]);
					await replaceJson(root, v12Path, report);
				}
			],
			[
				'a deleted V12 target',
				async (root) => {
					const report = await readJson(root, v12Path);
					(report.records as unknown[]).pop();
					await replaceJson(root, v12Path, report);
				}
			],
			[
				'a substituted baseline hash',
				async (root) => {
					const report = await readJson(root, v10Path);
					(report.records as Record<string, unknown>[])[0]!.currentHash = 'f'.repeat(64);
					await replaceJson(root, v10Path, report);
				}
			],
			[
				'a preseeded different accepted copy',
				async (root) => {
					await writeRepositoryFile(
						root,
						`${path.dirname(ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH)}/composites/${slug(approvedTargets[0])}.png`,
						'different accepted bytes'
					);
				}
			],
			...(
				[
					'artworkTreatment',
					'artworkScale',
					'preparedSource',
					'backing',
					'frameIsFinalLayer',
					'compositionProfile'
				] as const
			).map(
				(gate) =>
					[
						`an altered ${gate} assembly gate`,
						async (root: string) => {
							const report = await readJson(root, v12Path);
							const assembly = report.assembly as Record<string, unknown>;
							assembly[gate] = gate === 'frameIsFinalLayer' ? false : `invalid-${gate}`;
							await replaceJson(root, v12Path, report);
						}
					] as const
			)
		];

		for (const [, mutate] of cases) {
			const fixture = await fixtureRepository();
			await expectRejectedWithoutPublication(fixture.root, () => mutate(fixture.root));
		}
	});
});
