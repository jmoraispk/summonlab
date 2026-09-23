import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	gate2bContractSchema,
	materializeGate2BCandidate,
	parseGate2BCliArgs,
	preflightGate2B,
	rasterizeSourceMasks,
	resolveGate2BPaths,
	validateGate2BCandidate,
	type AshaSpineGate2BContract
} from './asha-spine-gate2b-lib.js';

const workspaces: string[] = [];

afterEach(async () => {
	await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function rgbaPng(
	width = 768,
	height = 768,
	background: { r: number; g: number; b: number; alpha: number } = {
		r: 31,
		g: 47,
		b: 63,
		alpha: 1
	}
): Promise<Buffer> {
	return sharp({ create: { width, height, channels: 4, background } })
		.png()
		.toBuffer();
}

async function rgbPng(width = 1024, height = 1024): Promise<Buffer> {
	return sharp({
		create: { width, height, channels: 3, background: { r: 0, g: 255, b: 0 } }
	})
		.png()
		.toBuffer();
}

type Fixture = Awaited<ReturnType<typeof workspaceFixture>>;

function contractFixture(fixture: {
	cutout: Buffer;
	v1Result: Buffer;
	v1Board: Buffer;
}): AshaSpineGate2BContract {
	return {
		schemaVersion: 'asha-spine-gate2b-v1',
		status: 'owner-approved',
		version: 2,
		approval: {
			date: '2026-09-22',
			statement:
				'Approve Gate 2B: deterministic source masks plus one chroma-key body-reconstruction attempt.'
		},
		originalBrief: 'authority/brief.json',
		acceptedCutout: 'authority/cutout.png',
		acceptedCutoutSha256: sha256(fixture.cutout),
		v1Failure: {
			result: 'authority/result-v1.json',
			resultSha256: sha256(fixture.v1Result),
			board: 'authority/board-v1.png',
			boardSha256: sha256(fixture.v1Board)
		},
		sourceCanvas: { width: 768, height: 768 },
		feetAnchor: { x: 384, y: 738 },
		protectedFeet: { left: 218, top: 554, width: 359, height: 214 },
		chromaKey: '#00ff00',
		masks: {
			nearArm: {
				polygons: [
					[
						[10, 10],
						[19, 10],
						[19, 19],
						[10, 19]
					]
				]
			},
			braid: {
				polygons: [
					[
						[30, 30],
						[39, 30],
						[39, 39],
						[30, 39]
					]
				]
			}
		},
		repairPrompt:
			'Edit only the concealed body regions on a perfectly flat #00ff00 chroma-key background.',
		outputs: { root: 'assets/canary' }
	};
}

async function workspaceFixture(): Promise<{
	workspace: string;
	cutout: Buffer;
	v1Result: Buffer;
	v1Board: Buffer;
	contract: AshaSpineGate2BContract;
}> {
	const workspace = await mkdtemp(join(tmpdir(), 'asha-gate2b-'));
	workspaces.push(workspace);
	const cutout = await rgbaPng();
	const v1Board = await rgbPng();
	const v1Result = Buffer.from(
		`${JSON.stringify({ schemaVersion: 'asha-spine-decomposition-result-v1', disposition: 'failed' })}\n`
	);
	await mkdir(join(workspace, 'authority'), { recursive: true });
	await writeFile(join(workspace, 'authority/cutout.png'), cutout);
	await writeFile(join(workspace, 'authority/board-v1.png'), v1Board);
	await writeFile(join(workspace, 'authority/result-v1.json'), v1Result);
	await writeFile(join(workspace, 'authority/brief.json'), '{}\n');
	const contract = contractFixture({ cutout, v1Result, v1Board });
	return { workspace, cutout, v1Result, v1Board, contract };
}

async function providerFixture(fixture: Fixture): Promise<{ raw: string; keyed: string }> {
	const raw = join(fixture.workspace, 'provider-return.png');
	const keyed = join(fixture.workspace, 'provider-keyed.png');
	await writeFile(raw, await rgbPng());
	const keyedPixels = Buffer.alloc(1024 * 1024 * 4);
	for (let y = 10; y < 100; y += 1) {
		for (let x = 10; x < 100; x += 1) {
			const offset = (y * 1024 + x) * 4;
			keyedPixels.set([212, 96, 41, 255], offset);
		}
	}
	await writeFile(
		keyed,
		await sharp(keyedPixels, { raw: { width: 1024, height: 1024, channels: 4 } })
			.png()
			.toBuffer()
	);
	return { raw, keyed };
}

describe('Asha Spine Gate 2B contract and preflight', () => {
	it('rejects unknown authority keys', async () => {
		const fixture = await workspaceFixture();
		expect(() => gate2bContractSchema.parse({ ...fixture.contract, surprise: true })).toThrow();
	});

	it('accepts only normalized absolute provider inputs', () => {
		expect(
			parseGate2BCliArgs([
				'materialize',
				'--provider-output',
				'/tmp/raw.png',
				'--keyed-output',
				'/tmp/keyed.png'
			])
		).toEqual({
			command: 'materialize',
			providerOutputPath: '/tmp/raw.png',
			keyedOutputPath: '/tmp/keyed.png'
		});
		expect(() =>
			parseGate2BCliArgs([
				'materialize',
				'--provider-output',
				'raw.png',
				'--keyed-output',
				'/tmp/keyed.png'
			])
		).toThrow('provider and keyed output paths must be absolute and normalized');
	});

	it('hash-locks the cutout and immutable v1 failure evidence', async () => {
		const fixture = await workspaceFixture();
		await expect(preflightGate2B(fixture.contract, fixture.workspace, 'write')).resolves.toEqual(
			resolveGate2BPaths(fixture.contract, fixture.workspace)
		);

		await writeFile(join(fixture.workspace, 'authority/result-v1.json'), 'changed\n');
		await expect(preflightGate2B(fixture.contract, fixture.workspace, 'write')).rejects.toThrow(
			'v1 failure result hash mismatch'
		);
	});

	it('refuses every occupied v2 output before production', async () => {
		const fixture = await workspaceFixture();
		const paths = resolveGate2BPaths(fixture.contract, fixture.workspace);
		await mkdir(join(fixture.workspace, 'assets/canary/provider'), { recursive: true });
		await writeFile(paths.rawProvider, 'occupied');
		await expect(preflightGate2B(fixture.contract, fixture.workspace, 'write')).rejects.toThrow(
			'owned Gate 2B output already exists'
		);
	});

	it('proves deterministic mask safety before provider access', async () => {
		const fixture = await workspaceFixture();
		const unsafe: AshaSpineGate2BContract = {
			...fixture.contract,
			masks: {
				...fixture.contract.masks,
				nearArm: {
					polygons: [
						[
							[300, 600],
							[320, 600],
							[320, 620],
							[300, 620]
						]
					]
				}
			}
		};
		await expect(preflightGate2B(unsafe, fixture.workspace, 'write')).rejects.toThrow(
			'near-arm mask intersects protected feet'
		);
	});
});

describe('Asha Spine Gate 2B deterministic masks', () => {
	it('rasterizes repeatable polygon masks clipped by source alpha', async () => {
		const fixture = await workspaceFixture();
		const pixels = Buffer.alloc(768 * 768 * 4, 255);
		pixels[(12 * 768 + 12) * 4 + 3] = 0;
		const cutout = await sharp(pixels, { raw: { width: 768, height: 768, channels: 4 } })
			.png()
			.toBuffer();
		const contract = {
			...fixture.contract,
			acceptedCutoutSha256: sha256(cutout)
		};
		const first = await rasterizeSourceMasks(contract, cutout);
		const second = await rasterizeSourceMasks(contract, cutout);
		expect(first.nearArmRaw.equals(second.nearArmRaw)).toBe(true);
		expect(first.nearArmRaw[11 * 768 + 11]).toBe(255);
		expect(first.nearArmRaw[12 * 768 + 12]).toBe(0);
		expect(first.nearArmRaw[25 * 768 + 25]).toBe(0);
	});

	it('rejects overlapping masks and protected-feet contact', async () => {
		const fixture = await workspaceFixture();
		const overlap = {
			...fixture.contract,
			masks: {
				...fixture.contract.masks,
				braid: fixture.contract.masks.nearArm
			}
		};
		await expect(rasterizeSourceMasks(overlap, fixture.cutout)).rejects.toThrow(
			'deterministic masks overlap'
		);

		const feet: AshaSpineGate2BContract = {
			...fixture.contract,
			masks: {
				...fixture.contract.masks,
				nearArm: {
					polygons: [
						[
							[300, 600],
							[320, 600],
							[320, 620],
							[300, 620]
						]
					]
				}
			}
		};
		await expect(rasterizeSourceMasks(feet, fixture.cutout)).rejects.toThrow(
			'near-arm mask intersects protected feet'
		);
	});
});

describe('Asha Spine Gate 2B materialization', () => {
	it('uses source-only parts and provider pixels only inside the mask union', async () => {
		const fixture = await workspaceFixture();
		const provider = await providerFixture(fixture);
		const result = await materializeGate2BCandidate({
			contract: fixture.contract,
			workspaceRoot: fixture.workspace,
			providerOutputPath: provider.raw,
			keyedOutputPath: provider.keyed
		});

		expect(result.disposition).toBe('candidate');
		expect(result.measurements).toMatchObject({
			visiblePartSourceMismatchPixels: 0,
			bodyOutsideMaskMismatchPixels: 0,
			recompositionOutsideRepairMismatchPixels: 0
		});
		const paths = resolveGate2BPaths(fixture.contract, fixture.workspace);
		const [source, arm, body] = await Promise.all([
			sharp(fixture.cutout).ensureAlpha().raw().toBuffer(),
			sharp(paths.nearArm).ensureAlpha().raw().toBuffer(),
			sharp(paths.bodyCore).ensureAlpha().raw().toBuffer()
		]);
		const inside = (11 * 768 + 11) * 4;
		const outside = (100 * 768 + 100) * 4;
		expect(arm.subarray(inside, inside + 4).equals(source.subarray(inside, inside + 4))).toBe(true);
		expect(body.subarray(outside, outside + 4).equals(source.subarray(outside, outside + 4))).toBe(
			true
		);
	});

	it('detects keyed-repair and materialized-output tampering', async () => {
		const fixture = await workspaceFixture();
		const provider = await providerFixture(fixture);
		await materializeGate2BCandidate({
			contract: fixture.contract,
			workspaceRoot: fixture.workspace,
			providerOutputPath: provider.raw,
			keyedOutputPath: provider.keyed
		});
		const paths = resolveGate2BPaths(fixture.contract, fixture.workspace);
		await writeFile(paths.keyedProvider, await rgbaPng(1024, 1024));
		await expect(validateGate2BCandidate(fixture.contract, fixture.workspace)).rejects.toThrow(
			'keyed provider hash mismatch'
		);

		await writeFile(paths.keyedProvider, await readFile(provider.keyed));
		await writeFile(paths.nearArm, await rgbaPng());
		await expect(validateGate2BCandidate(fixture.contract, fixture.workspace)).rejects.toThrow(
			'nearArm output hash mismatch'
		);
	});
});
