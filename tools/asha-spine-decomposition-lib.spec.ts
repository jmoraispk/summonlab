import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	loadDecompositionBrief,
	materializeDecompositionCandidate,
	normalizeProviderBoard,
	parseDecompositionCliArgs,
	preflightDecomposition,
	resolveDecompositionPaths,
	validateDecompositionCandidate,
	type AshaSpineDecompositionBrief,
	type DecompositionVersion
} from './asha-spine-decomposition-lib.js';

const workspaces: string[] = [];

afterEach(async () => {
	await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function png(channels: 3 | 4 = 4): Promise<Buffer> {
	return sharp({
		create: {
			width: 768,
			height: 768,
			channels,
			background: channels === 4 ? { r: 12, g: 24, b: 36, alpha: 0.8 } : { r: 12, g: 24, b: 36 }
		}
	})
		.png()
		.toBuffer();
}

async function identityPortraitPng(): Promise<Buffer> {
	return sharp({
		create: {
			width: 1024,
			height: 1536,
			channels: 3,
			background: { r: 18, g: 32, b: 48 }
		}
	})
		.png()
		.toBuffer();
}

function setRectangle(
	pixels: Buffer,
	canvasWidth: number,
	rectangle: { left: number; top: number; width: number; height: number },
	color: readonly [number, number, number, number]
): void {
	for (let y = rectangle.top; y < rectangle.top + rectangle.height; y += 1) {
		for (let x = rectangle.left; x < rectangle.left + rectangle.width; x += 1) {
			const offset = (y * canvasWidth + x) * 4;
			pixels.set(color, offset);
		}
	}
}

async function providerBoard(
	options: {
		nearArm?: { left: number; top: number; width: number; height: number };
		braid?: { left: number; top: number; width: number; height: number };
	} = {}
): Promise<Buffer> {
	const panelSize = 768;
	const boardSize = panelSize * 2;
	const pixels = Buffer.alloc(boardSize * boardSize * 4);
	setRectangle(pixels, boardSize, { left: 0, top: 0, width: 768, height: 768 }, [220, 42, 36, 255]);
	const nearArm = options.nearArm ?? { left: 430, top: 300, width: 20, height: 30 };
	const braid = options.braid ?? { left: 170, top: 300, width: 20, height: 30 };
	setRectangle(
		pixels,
		boardSize,
		{
			left: panelSize + nearArm.left,
			top: nearArm.top,
			width: nearArm.width,
			height: nearArm.height
		},
		[255, 255, 255, 255]
	);
	setRectangle(
		pixels,
		boardSize,
		{ left: braid.left, top: panelSize + braid.top, width: braid.width, height: braid.height },
		[255, 255, 255, 255]
	);
	return sharp(pixels, { raw: { width: boardSize, height: boardSize, channels: 4 } })
		.png()
		.toBuffer();
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function briefFixture(identityBytes: Buffer, cutoutBytes: Buffer): AshaSpineDecompositionBrief {
	return {
		schemaVersion: 'asha-spine-decomposition-brief-v1',
		status: 'planned',
		acceptedCutout: 'input/cutout.png',
		acceptedCutoutSha256: sha256(cutoutBytes),
		identitySource: 'input/identity.png',
		identitySourceSha256: sha256(identityBytes),
		sourceCanvas: { width: 768, height: 768 },
		feetAnchor: { x: 384, y: 738 },
		direction: 'up-field',
		mirrored: false,
		defaultVisibleHeight: 84,
		attemptPolicy: { initial: 1, corrections: 1, maximumVersion: 2 },
		providerBoard: {
			layout: 'quadrants-v1',
			minimumSquareSize: 1024,
			panels: ['body-core-repair', 'near-arm-matte', 'braid-matte', 'setup-preview']
		},
		protectedRegions: {
			faceAndMarking: { left: 314, top: 91, width: 157, height: 181 },
			feetAndAnchor: { left: 218, top: 554, width: 359, height: 214 }
		},
		partEnvelopes: {
			nearArm: { left: 421, top: 183, width: 137, height: 306 },
			braid: { left: 156, top: 0, width: 305, height: 515 }
		},
		initialPrompt: 'A source-bound decomposition prompt long enough to be meaningful.',
		outputs: {
			root: 'assets/canary',
			reviewRoot: 'docs/evidence/canary'
		}
	};
}

async function workspaceFixture(options: { cutoutChannels?: 3 | 4 } = {}) {
	const workspace = await mkdtemp(join(tmpdir(), 'asha-decomposition-'));
	workspaces.push(workspace);
	const identityBytes = await png();
	const cutoutBytes = await png(options.cutoutChannels ?? 4);
	await mkdir(join(workspace, 'input'), { recursive: true });
	await writeFile(join(workspace, 'input/identity.png'), identityBytes);
	await writeFile(join(workspace, 'input/cutout.png'), cutoutBytes);
	return { workspace, identityBytes, cutoutBytes };
}

describe('Asha Spine decomposition preflight', () => {
	it('accepts pnpm separators after the subcommand', () => {
		expect(parseDecompositionCliArgs(['preflight', '--', '--version', '1'])).toEqual({
			command: 'preflight',
			version: 1
		});
	});

	it('requires an absolute provider output for materialization', () => {
		expect(
			parseDecompositionCliArgs([
				'materialize',
				'--version',
				'1',
				'--provider-output',
				'/tmp/provider-result.png'
			])
		).toEqual({
			command: 'materialize',
			version: 1,
			providerOutputPath: '/tmp/provider-result.png'
		});
		expect(() =>
			parseDecompositionCliArgs(['materialize', '--provider-output', 'provider-result.png'])
		).toThrow('provider output path must be absolute and normalized');
	});

	it('resolves every versioned output beneath the owned root', async () => {
		const fixture = await workspaceFixture();
		const paths = resolveDecompositionPaths(
			briefFixture(fixture.identityBytes, fixture.cutoutBytes),
			fixture.workspace,
			1
		);

		expect(paths).toEqual({
			providerBoard: join(fixture.workspace, 'assets/canary/provider/board-v1.png'),
			bodyCore: join(fixture.workspace, 'assets/canary/parts/v1/body-core.png'),
			nearArm: join(fixture.workspace, 'assets/canary/parts/v1/near-arm.png'),
			braid: join(fixture.workspace, 'assets/canary/parts/v1/braid.png'),
			recomposed: join(fixture.workspace, 'assets/canary/recomposed/asha-setup-v1.png'),
			result: join(fixture.workspace, 'assets/canary/results/result-v1.json')
		});
	});

	it('rejects changed authority before checking output ownership', async () => {
		const fixture = await workspaceFixture();
		const brief = {
			...briefFixture(fixture.identityBytes, fixture.cutoutBytes),
			acceptedCutoutSha256: '0'.repeat(64)
		};

		await expect(preflightDecomposition(brief, fixture.workspace, 'write', 1)).rejects.toThrow(
			'accepted cutout hash mismatch'
		);
	});

	it('rejects a symlinked authority source', async () => {
		const fixture = await workspaceFixture();
		await rm(join(fixture.workspace, 'input/identity.png'));
		await writeFile(join(fixture.workspace, 'input/identity-real.png'), fixture.identityBytes);
		await symlink('identity-real.png', join(fixture.workspace, 'input/identity.png'));

		await expect(
			preflightDecomposition(
				briefFixture(fixture.identityBytes, fixture.cutoutBytes),
				fixture.workspace,
				'write',
				1
			)
		).rejects.toThrow('identity source must not be a symbolic link');
	});

	it('requires the accepted cutout to be 768x768 RGBA', async () => {
		const fixture = await workspaceFixture({ cutoutChannels: 3 });

		await expect(
			preflightDecomposition(
				briefFixture(fixture.identityBytes, fixture.cutoutBytes),
				fixture.workspace,
				'write',
				1
			)
		).rejects.toThrow('accepted cutout must be 768x768 RGBA');
	});

	it('hash-locks the normal-proportion identity portrait without imposing cutout dimensions', async () => {
		const fixture = await workspaceFixture();
		const identityBytes = await identityPortraitPng();
		await writeFile(join(fixture.workspace, 'input/identity.png'), identityBytes);

		await expect(
			preflightDecomposition(
				briefFixture(identityBytes, fixture.cutoutBytes),
				fixture.workspace,
				'write',
				1
			)
		).resolves.toEqual(
			resolveDecompositionPaths(
				briefFixture(identityBytes, fixture.cutoutBytes),
				fixture.workspace,
				1
			)
		);
	});

	it('refuses an occupied output before production starts', async () => {
		const fixture = await workspaceFixture();
		const brief = briefFixture(fixture.identityBytes, fixture.cutoutBytes);
		const occupied = resolveDecompositionPaths(brief, fixture.workspace, 1).providerBoard;
		await mkdir(dirname(occupied), { recursive: true });
		await writeFile(occupied, 'occupied');

		await expect(preflightDecomposition(brief, fixture.workspace, 'write', 1)).rejects.toThrow(
			`owned output already exists: ${occupied}`
		);
	});

	it('requires every candidate output in check mode', async () => {
		const fixture = await workspaceFixture();
		const brief = briefFixture(fixture.identityBytes, fixture.cutoutBytes);

		await expect(preflightDecomposition(brief, fixture.workspace, 'check', 1)).rejects.toThrow(
			'owned output is missing'
		);
	});

	it('rejects unsupported candidate versions', async () => {
		const fixture = await workspaceFixture();

		expect(() =>
			resolveDecompositionPaths(
				briefFixture(fixture.identityBytes, fixture.cutoutBytes),
				fixture.workspace,
				3 as DecompositionVersion
			)
		).toThrow('decomposition version must be 1 or 2');
	});

	it('refuses correction output without a v1 revise receipt', async () => {
		const fixture = await workspaceFixture();

		await expect(
			preflightDecomposition(
				briefFixture(fixture.identityBytes, fixture.cutoutBytes),
				fixture.workspace,
				'write',
				2
			)
		).rejects.toThrow('v2 requires a v1 revise receipt');
	});

	it('rejects unknown brief fields', async () => {
		const fixture = await workspaceFixture();
		const path = join(fixture.workspace, 'brief.json');
		await writeFile(
			path,
			JSON.stringify({
				...briefFixture(fixture.identityBytes, fixture.cutoutBytes),
				unexpected: true
			})
		);

		await expect(loadDecompositionBrief(path)).rejects.toThrow('Unrecognized key');
	});
});

describe('Asha Spine decomposition materialization', () => {
	it('uses provider alpha for semantics and approved RGB for visible parts', async () => {
		const fixture = await workspaceFixture();
		const brief = briefFixture(fixture.identityBytes, fixture.cutoutBytes);
		const providerOutputPath = join(fixture.workspace, 'provider-return.png');
		await writeFile(providerOutputPath, await providerBoard());

		const result = await materializeDecompositionCandidate({
			brief,
			workspaceRoot: fixture.workspace,
			version: 1,
			providerOutputPath
		});
		if (result.disposition === 'failed') throw new Error(result.failure.reason);

		expect(result.measurements).toMatchObject({
			visiblePartSourceMismatchPixels: 0,
			bodyOutsideMatteMismatchPixels: 0,
			recompositionOutsideRepairMismatchPixels: 0,
			nearArmMattePixels: 600,
			braidMattePixels: 600
		});
		const nearArm = await sharp(join(fixture.workspace, result.outputs.nearArm.path))
			.ensureAlpha()
			.raw()
			.toBuffer();
		const source = await sharp(join(fixture.workspace, brief.acceptedCutout))
			.ensureAlpha()
			.raw()
			.toBuffer();
		const selectedOffset = (310 * 768 + 435) * 4;
		expect(nearArm.subarray(selectedOffset, selectedOffset + 4)).toEqual(
			source.subarray(selectedOffset, selectedOffset + 4)
		);
		expect(await validateDecompositionCandidate(brief, fixture.workspace, 1)).toEqual(result);
	});

	it('records a matte entering the protected face region as failed evidence', async () => {
		const fixture = await workspaceFixture();
		const brief = {
			...briefFixture(fixture.identityBytes, fixture.cutoutBytes),
			partEnvelopes: {
				nearArm: { left: 0, top: 0, width: 768, height: 768 },
				braid: { left: 156, top: 0, width: 305, height: 515 }
			}
		};
		const providerOutputPath = join(fixture.workspace, 'provider-return.png');
		await writeFile(
			providerOutputPath,
			await providerBoard({ nearArm: { left: 330, top: 120, width: 20, height: 20 } })
		);

		const result = await materializeDecompositionCandidate({
			brief,
			workspaceRoot: fixture.workspace,
			version: 1,
			providerOutputPath
		});
		expect(result).toMatchObject({
			disposition: 'failed',
			failure: {
				stage: 'decomposition',
				reason: 'near-arm matte intersects protected faceAndMarking region'
			}
		});
	});

	it('rejects a non-square provider board before creating outputs', async () => {
		const bytes = await sharp({
			create: {
				width: 1024,
				height: 1200,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 }
			}
		})
			.png()
			.toBuffer();

		await expect(normalizeProviderBoard(bytes, 1024)).rejects.toThrow(
			'provider board must be square RGBA'
		);
	});

	it('persists an invalid provider board as terminal evidence without part outputs', async () => {
		const fixture = await workspaceFixture();
		const brief = briefFixture(fixture.identityBytes, fixture.cutoutBytes);
		const providerOutputPath = join(fixture.workspace, 'invalid-provider-return.png');
		await writeFile(
			providerOutputPath,
			await sharp({
				create: {
					width: 1024,
					height: 1200,
					channels: 4,
					background: { r: 0, g: 0, b: 0, alpha: 0 }
				}
			})
				.png()
				.toBuffer()
		);

		const result = await materializeDecompositionCandidate({
			brief,
			workspaceRoot: fixture.workspace,
			version: 1,
			providerOutputPath
		});
		const paths = resolveDecompositionPaths(brief, fixture.workspace, 1);
		expect(result).toMatchObject({
			disposition: 'failed',
			failure: { stage: 'provider-board', reason: 'provider board must be square RGBA' },
			outputs: null,
			measurements: null
		});
		await expect(readFile(paths.providerBoard)).resolves.toEqual(
			await readFile(providerOutputPath)
		);
		await expect(readFile(paths.result, 'utf8')).resolves.toContain('provider-board');
		await expect(readFile(paths.bodyCore)).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await validateDecompositionCandidate(brief, fixture.workspace, 1)).toEqual(result);
	});

	it('detects a changed materialized output by its persisted hash', async () => {
		const fixture = await workspaceFixture();
		const brief = briefFixture(fixture.identityBytes, fixture.cutoutBytes);
		const providerOutputPath = join(fixture.workspace, 'provider-return.png');
		await writeFile(providerOutputPath, await providerBoard());
		const result = await materializeDecompositionCandidate({
			brief,
			workspaceRoot: fixture.workspace,
			version: 1,
			providerOutputPath
		});
		if (result.disposition === 'failed') throw new Error(result.failure.reason);
		const bodyCorePath = join(fixture.workspace, result.outputs.bodyCore.path);
		const changed = await readFile(bodyCorePath);
		changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
		await writeFile(bodyCorePath, changed);

		await expect(validateDecompositionCandidate(brief, fixture.workspace, 1)).rejects.toThrow(
			'bodyCore hash mismatch'
		);
	});
});
