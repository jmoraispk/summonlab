import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
	SKILL_ICON_REPROCESS_SOURCE_MODE,
	SKILL_ICON_REPROCESS_TOOL_VERSION,
	SkillIconReprocessAssignmentSchema,
	SkillIconReprocessResultSchema,
	SkillIconReprocessTargetSchema,
	type SkillIconGeometryV2
} from '../packages/contracts/src/index.js';
import {
	parseReprocessSkillIconProviderSourceCliRequest,
	reprocessSkillIconProviderSource,
	skillIconReprocessAttemptIntentPath
} from './reprocess-skill-icon-provider-source.js';
import {
	acquireSkillIconReprocessAttemptIntent,
	persistSkillIconReprocessTransaction,
	readSkillIconReprocessAuthority,
	readSkillIconReprocessTargetInventory
} from './persist-skill-icon-output.js';

const roots: string[] = [];
const execFileAsync = promisify(execFile);
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

function hash(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function crc32(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(typeText: string, data: Buffer): Buffer {
	const type = Buffer.from(typeText, 'ascii');
	const chunk = Buffer.alloc(data.length + 12);
	chunk.writeUInt32BE(data.length, 0);
	type.copy(chunk, 4);
	data.copy(chunk, 8);
	chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8);
	return chunk;
}

function declareCabx(png: Buffer): Buffer {
	const chunks: Buffer[] = [png.subarray(0, 8)];
	let offset = 8;
	let inserted = false;
	while (offset < png.length) {
		const length = png.readUInt32BE(offset);
		const end = offset + length + 12;
		const type = png.toString('ascii', offset + 4, offset + 8);
		if (type !== 'sRGB' && type !== 'pHYs') {
			chunks.push(png.subarray(offset, end));
			if (!inserted && type === 'IHDR') {
				const data = Buffer.alloc(24);
				data.writeUInt32BE(24, 0);
				data.write('jumb', 4, 'ascii');
				Buffer.from('reprocess-source', 'ascii').copy(data, 8);
				chunks.push(pngChunk('caBX', data));
				inserted = true;
			}
		}
		offset = end;
	}
	return Buffer.concat(chunks);
}

async function providerSource(extra = ''): Promise<Buffer> {
	const geometry = JSON.parse(
		(await readFile(SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH)).toString('utf8')
	) as SkillIconGeometryV2;
	const points = (values: readonly (readonly [number, number])[]) =>
		values.map(([x, y]) => [x * 1254, y * 1254] as const);
	const outer = points(geometry.outerEnvelopePoints);
	const aperture = points(geometry.aperturePoints).map(
		([x, y]) =>
			[
				627 + (x - 627) * geometry.innerApertureScale,
				627 + (y - 627) * geometry.innerApertureScale
			] as const
	);
	const pathData = (values: readonly (readonly [number, number])[]) =>
		`${values.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')} Z`;
	const svg = Buffer.from(
		`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><path d="${pathData(outer)} ${pathData(aperture)}" fill="#3a3a42" fill-rule="evenodd"/><rect x="520" y="0" width="214" height="250" rx="35" fill="#3a3a42"/>${extra}</svg>`
	);
	return declareCabx(
		await sharp({ create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' } })
			.composite([{ input: svg }])
			.removeAlpha()
			.png({ progressive: false, palette: false })
			.toBuffer()
	);
}

async function write(root: string, relative: string, bytes: Buffer | string): Promise<void> {
	const destination = path.join(root, relative);
	await mkdir(path.dirname(destination), { recursive: true });
	await writeFile(destination, bytes);
}

async function fixture(extraSource = '') {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-reprocess-'));
	roots.push(root);
	const source = await providerSource(extraSource);
	const sourcePath = path.join(root, 'provider.png');
	await writeFile(sourcePath, source);
	for (const relative of [
		SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
		SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH
	])
		await write(root, relative, await readFile(relative));
	const originJob = 'rarity-frame-f-v3';
	const originPaths = {
		target: `assets/wiki/skills/icon-production-v1/targets/references/${originJob}.json`,
		assignment: `assets/wiki/skills/icon-production-v1/assignments/references/${originJob}.json`,
		result: `assets/wiki/skills/icon-production-v1/results/references/${originJob}.json`
	};
	const originTargetBytes = await readFile(originPaths.target);
	const originAssignmentBytes = await readFile(originPaths.assignment);
	const originResult = JSON.parse((await readFile(originPaths.result)).toString('utf8')) as {
		normalization: {
			providerSource: {
				mediaType: string;
				width: number;
				height: number;
				bytes: number;
				alphaMode: string;
				contentHash: string;
			};
			sourceContentHash: string;
		};
	};
	originResult.normalization.providerSource = {
		mediaType: 'image/png',
		width: 1254,
		height: 1254,
		bytes: source.length,
		alphaMode: 'rgb',
		contentHash: hash(source)
	};
	originResult.normalization.sourceContentHash = hash(source);
	const originResultBytes = Buffer.from(`${JSON.stringify(originResult, null, 2)}\n`);
	await write(root, originPaths.target, originTargetBytes);
	await write(root, originPaths.assignment, originAssignmentBytes);
	await write(root, originPaths.result, originResultBytes);
	const jobId = 'rarity-frame-f-v5';
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`;
	const output = {
		candidatePath: `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`,
		resultPath: `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`
	};
	const target = SkillIconReprocessTargetSchema.parse({
		schemaVersion: 'skill-icon-reprocess-target-v1',
		jobId,
		logicalIdentity: 'rarity-frame-f',
		revision: 5,
		role: 'rarity-frame',
		rarity: 'F',
		sourceMode: SKILL_ICON_REPROCESS_SOURCE_MODE,
		originAuthority: {
			target: { path: originPaths.target, contentHash: hash(originTargetBytes) },
			assignment: { path: originPaths.assignment, contentHash: hash(originAssignmentBytes) },
			result: { path: originPaths.result, contentHash: hash(originResultBytes) },
			providerSourceHash: hash(source)
		},
		processingAuthority: {
			profile: 'skill-icon-green-key-role-mask-v3',
			geometry: {
				path: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
			},
			guide: {
				path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
				contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
				purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE
			}
		},
		output
	});
	const targetBytes = Buffer.from(`${JSON.stringify(target, null, 2)}\n`);
	const assignment = SkillIconReprocessAssignmentSchema.parse({
		schemaVersion: 'skill-icon-reprocess-assignment-v1',
		assignmentId: `assignment-${jobId}`,
		jobId,
		logicalIdentity: target.logicalIdentity,
		revision: 5,
		role: target.role,
		rarity: target.rarity,
		targetPath,
		targetContentHash: hash(targetBytes),
		assignmentPath,
		toolVersion: SKILL_ICON_REPROCESS_TOOL_VERSION,
		sourceMode: SKILL_ICON_REPROCESS_SOURCE_MODE,
		generationAttemptLimit: 0,
		normalizationTransactionLimit: 1,
		permittedOutputs: output,
		completionContract: {
			coordinatorOnly: true,
			structuredResultRequired: true,
			sharedFilesMustRemainUntouched: true,
			selfPromotionForbidden: true
		}
	});
	await write(root, targetPath, targetBytes);
	await write(root, assignmentPath, Buffer.from(`${JSON.stringify(assignment, null, 2)}\n`));
	const request = {
		sourcePath,
		sourceHash: hash(source),
		originTargetPath: originPaths.target,
		originAssignmentPath: originPaths.assignment,
		originResultPath: originPaths.result,
		targetPath,
		assignmentPath,
		fullSizeOutcome: 'pass' as const,
		fullSizeObservation: 'Full-size frame review passed.',
		recognitionOutcome: 'pass' as const,
		recognitionObservation: 'Frame remains legible at 96 pixels.'
	};
	return { root, source, request, target, assignment };
}

async function preparedPersistenceFixture(attemptKey?: string) {
	const input = await fixture();
	const produced = await reprocessSkillIconProviderSource(input.request, input.root);
	if (produced.status !== 'candidate') throw new Error('Expected candidate fixture');
	const candidateBytes = await readFile(path.join(input.root, input.target.output.candidatePath));
	const resultBytes = await readFile(path.join(input.root, input.target.output.resultPath));
	const result = SkillIconReprocessResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
	await rm(path.join(input.root, input.target.output.candidatePath));
	await rm(path.join(input.root, input.target.output.resultPath));
	const inventory = await readSkillIconReprocessTargetInventory(input.root);
	const sourceKey = attemptKey ?? input.request.sourceHash;
	const attempt = await acquireSkillIconReprocessAttemptIntent(input.root, sourceKey, {
		schemaVersion: 'skill-icon-reprocess-attempt-v1',
		jobId: input.target.jobId,
		targetPath: input.request.targetPath,
		targetContentHash: result.targetContentHash,
		assignmentPath: input.request.assignmentPath,
		assignmentContentHash: result.assignmentContentHash,
		originAuthority: input.target.originAuthority,
		processingAuthority: input.target.processingAuthority,
		providerSourceHash: input.request.sourceHash,
		targetInventoryHash: inventory.contentHash,
		terminalPlan: {
			status: 'candidate',
			resultContentHash: hash(resultBytes),
			candidateContentHash: hash(candidateBytes)
		},
		startedAt: result.startedAt
	});
	const authorityPaths = [
		[input.request.targetPath, 'Reprocess target'],
		[input.request.assignmentPath, 'Reprocess assignment'],
		[input.request.originTargetPath, 'Origin target'],
		[input.request.originAssignmentPath, 'Origin assignment'],
		[input.request.originResultPath, 'Origin result'],
		[input.target.processingAuthority.geometry.path, 'Reprocess geometry authority'],
		[input.target.processingAuthority.guide.path, 'Reprocess guide authority']
	] as const;
	const authorityInputs: Array<{ path: string; description: string; contentHash: string }> =
		await Promise.all(
			authorityPaths.map(async ([authorityPath, description]) => ({
				path: authorityPath,
				description,
				contentHash: (await readSkillIconReprocessAuthority(input.root, authorityPath, description))
					.contentHash
			}))
		);
	authorityInputs.push({
		path: attempt.path,
		description: 'Reprocess attempt reservation',
		contentHash: hash(attempt.bytes)
	});
	return {
		input,
		options: {
			root: input.root,
			jobId: input.target.jobId,
			candidatePath: input.target.output.candidatePath,
			requiredAbsentCandidatePath: input.target.originAuthority.result.path
				.replace('/results/', '/candidates/')
				.replace(/\.json$/u, '.png'),
			candidateBytes,
			resultPath: input.target.output.resultPath,
			resultBytes,
			authorityInputs,
			targetInventory: inventory
		}
	};
}

describe('skill-icon provider-source reprocess coordinator', () => {
	it('parses only the exact path/hash authority CLI', () => {
		const args = [
			'--source',
			'/tmp/source.png',
			'--source-hash',
			'a'.repeat(64),
			'--origin-target',
			'assets/wiki/skills/icon-production-v1/targets/references/rarity-frame-f-v3.json',
			'--origin-assignment',
			'assets/wiki/skills/icon-production-v1/assignments/references/rarity-frame-f-v3.json',
			'--origin-result',
			'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-f-v3.json',
			'--target',
			'assets/wiki/skills/icon-production-v1/targets/references/rarity-frame-f-v5.json',
			'--assignment',
			'assets/wiki/skills/icon-production-v1/assignments/references/rarity-frame-f-v5.json',
			'--full-size-outcome',
			'pass',
			'--full-size-observation',
			'Reviewed full size.',
			'--recognition-outcome',
			'pass',
			'--recognition-observation',
			'Legible at 96 pixels.'
		];
		expect(parseReprocessSkillIconProviderSourceCliRequest(args)).toMatchObject({
			sourcePath: '/tmp/source.png'
		});
		expect(() =>
			parseReprocessSkillIconProviderSourceCliRequest([
				...args,
				'--completed-at',
				new Date().toISOString()
			])
		).toThrow(/unknown/iu);
	});

	it('normalizes once and atomically publishes a pathless candidate result', async () => {
		const input = await fixture();
		const times = [new Date('2026-09-03T12:00:00.000Z'), new Date('2026-09-03T12:00:00.250Z')];
		const result = await reprocessSkillIconProviderSource(input.request, input.root, {
			now: () => times.shift()!
		});
		expect(result, JSON.stringify(result.inspections)).toMatchObject({
			status: 'candidate',
			generationAttemptCount: 0,
			normalizationTransactionCount: 1
		});
		expect(JSON.stringify(result)).not.toContain(input.request.sourcePath);
		await expect(
			access(path.join(input.root, input.target.output.candidatePath))
		).resolves.toBeUndefined();
		await expect(
			access(path.join(input.root, skillIconReprocessAttemptIntentPath(input.request.sourceHash)))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rejects noncanonical, symlinked, mutated, and hash-mismatched source before reserving', async () => {
		const input = await fixture();
		await expect(
			reprocessSkillIconProviderSource({ ...input.request, sourceHash: '0'.repeat(64) }, input.root)
		).rejects.toThrow(/source|hash/iu);
		const linkPath = path.join(input.root, 'source-link.png');
		await symlink(input.request.sourcePath, linkPath);
		await expect(
			reprocessSkillIconProviderSource({ ...input.request, sourcePath: linkPath }, input.root)
		).rejects.toThrow(/symbolic/iu);
		await expect(
			reprocessSkillIconProviderSource(input.request, input.root, {
				afterSourceRead: () =>
					writeFile(input.request.sourcePath, Buffer.from(input.source).fill(1, 20, 21))
			})
		).rejects.toThrow(/changed/iu);
	});

	it('persists an honest result-only normalization failure', async () => {
		const input = await fixture('<circle cx="10" cy="10" r="8" fill="#111"/>');
		const result = await reprocessSkillIconProviderSource(input.request, input.root);
		expect(result).toMatchObject({
			status: 'failed',
			normalization: { outcome: 'failed' },
			writtenOutputPaths: [input.target.output.resultPath]
		});
		await expect(
			access(path.join(input.root, input.target.output.candidatePath))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('turns a safely rolled-back candidate publication error into one persistence failure result', async () => {
		const input = await fixture();
		const result = await reprocessSkillIconProviderSource(input.request, input.root, {
			persistenceTestHooks: {
				afterOutputStagesComplete: () => {
					throw new Error('injected persistence failure');
				}
			}
		});
		expect(result).toMatchObject({
			status: 'failed',
			failureReason: { kind: 'persistence' },
			inspections: [{ outcome: 'pass' }, { outcome: 'pass' }]
		});
	});

	it('durably blocks a second normalization after reservation and detects authority/output races', async () => {
		const input = await fixture();
		await expect(
			reprocessSkillIconProviderSource(input.request, input.root, {
				afterAttemptReserved: () => {
					throw new Error('crash boundary');
				}
			})
		).rejects.toThrow(/crash boundary/u);
		await expect(reprocessSkillIconProviderSource(input.request, input.root)).rejects.toThrow(
			/durably reserved/iu
		);
		const second = await fixture();
		await expect(
			reprocessSkillIconProviderSource(second.request, second.root, {
				afterPreflight: () =>
					writeFile(path.join(second.root, second.target.output.resultPath), 'foreign')
			})
		).rejects.toThrow();
	});

	it('keeps the source transaction reserved when inventory replaces the target revision', async () => {
		const input = await fixture();
		await expect(
			reprocessSkillIconProviderSource(input.request, input.root, {
				afterAttemptReserved: () => {
					throw new Error('crash boundary');
				}
			})
		).rejects.toThrow(/crash boundary/u);
		await rm(path.join(input.root, input.request.targetPath));
		await rm(path.join(input.root, input.request.assignmentPath));
		const jobId = 'rarity-frame-f-v6';
		const targetPath = `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`;
		const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`;
		const output = {
			candidatePath: `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`,
			resultPath: `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`
		};
		const target = SkillIconReprocessTargetSchema.parse({
			...input.target,
			jobId,
			revision: 6,
			output
		});
		const targetBytes = Buffer.from(`${JSON.stringify(target, null, 2)}\n`);
		const assignment = SkillIconReprocessAssignmentSchema.parse({
			...input.assignment,
			assignmentId: `assignment-${jobId}`,
			jobId,
			revision: 6,
			targetPath,
			targetContentHash: hash(targetBytes),
			assignmentPath,
			permittedOutputs: output
		});
		await write(input.root, targetPath, targetBytes);
		await write(
			input.root,
			assignmentPath,
			Buffer.from(`${JSON.stringify(assignment, null, 2)}\n`)
		);
		await expect(
			reprocessSkillIconProviderSource(
				{ ...input.request, targetPath, assignmentPath },
				input.root,
				{
					afterSourceRead: () => {
						throw new Error('provider source must not be read for a second transaction');
					}
				}
			)
		).rejects.toThrow(/attempt does not match/iu);
	});

	it('recovers an exact terminal result after a crash before attempt-intent cleanup', async () => {
		const input = await fixture();
		await expect(
			reprocessSkillIconProviderSource(input.request, input.root, {
				persistenceTestHooks: {
					afterJournalRemoval: () => {
						throw new Error('crash after terminal commit');
					}
				}
			})
		).rejects.toThrow();
		const recovered = await reprocessSkillIconProviderSource(input.request, input.root, {
			afterSourceRead: () => {
				throw new Error('terminal recovery must not read or normalize the provider source');
			}
		});
		expect(recovered.status).toBe('candidate');
		await expect(
			access(path.join(input.root, skillIconReprocessAttemptIntentPath(input.request.sourceHash)))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('terminalizes exact signed outputs left by a dead v2 journal without reprocessing', async () => {
		const input = await fixture();
		const requestPath = path.join(input.root, 'request.json');
		const runnerPath = path.join(input.root, 'kill-after-result.mts');
		await writeFile(requestPath, JSON.stringify(input.request));
		const moduleUrl = pathToFileURL(
			path.resolve('tools/reprocess-skill-icon-provider-source.ts')
		).href;
		await writeFile(
			runnerPath,
			`import { readFile } from 'node:fs/promises';\n` +
				`import { reprocessSkillIconProviderSource } from ${JSON.stringify(moduleUrl)};\n` +
				`void (async () => {\n` +
				`  const request = JSON.parse(await readFile(${JSON.stringify(requestPath)}, 'utf8'));\n` +
				`  await reprocessSkillIconProviderSource(request, ${JSON.stringify(input.root)}, { persistenceTestHooks: { afterResultInstall: () => process.kill(process.pid, 'SIGKILL') } });\n` +
				`})();\n`
		);
		const tsx = path.resolve('node_modules/.bin/tsx');
		const childFailure = await execFileAsync(tsx, [runnerPath], { cwd: input.root }).catch(
			(error: unknown) => error as { code: number; signal: string | null; stderr: string }
		);
		expect(childFailure, JSON.stringify(childFailure)).toMatchObject({ code: 137 });
		for (const authorityPath of [
			'assets/wiki/skills/icon-production-v1/.persistence-recovery-token.json',
			'assets/wiki/skills/icon-production-v1/.persistence.lock',
			'assets/wiki/skills/icon-production-v1/.persistence-transaction.json'
		])
			await expect(access(path.join(input.root, authorityPath))).resolves.toBeUndefined();
		const recovered = await reprocessSkillIconProviderSource(input.request, input.root, {
			afterSourceRead: () => {
				throw new Error('dead-journal recovery must not reprocess the provider source');
			}
		});
		expect(recovered.status).toBe('candidate');
		await expect(
			access(path.join(input.root, input.target.output.candidatePath))
		).resolves.toBeUndefined();
		for (const authorityPath of [
			'assets/wiki/skills/icon-production-v1/.persistence-recovery-token.json',
			'assets/wiki/skills/icon-production-v1/.persistence.lock',
			'assets/wiki/skills/icon-production-v1/.persistence-transaction.json'
		])
			await expect(access(path.join(input.root, authorityPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
	});

	it('rejects adversarial direct calls at the exported persistence boundary', async () => {
		const mismatched = await preparedPersistenceFixture();
		await expect(
			persistSkillIconReprocessTransaction({
				...mismatched.options,
				jobId: 'rarity-frame-f-v99'
			})
		).rejects.toThrow(/identity|job|path/iu);

		const wrongReservation = await preparedPersistenceFixture('1'.repeat(64));
		await expect(persistSkillIconReprocessTransaction(wrongReservation.options)).rejects.toThrow(
			/keyed by provider-source hash/iu
		);

		const junkCandidate = await preparedPersistenceFixture();
		await expect(
			persistSkillIconReprocessTransaction({
				...junkCandidate.options,
				candidateBytes: Buffer.from('not a png')
			})
		).rejects.toThrow(/candidate bytes|validation/iu);
	});

	it('allows exactly one same-source coordinator transaction across a simultaneous race', async () => {
		const input = await fixture();
		let preflightArrivals = 0;
		let releasePreflight!: () => void;
		const bothAtPreflight = new Promise<void>((resolve) => {
			releasePreflight = resolve;
		});
		let reservations = 0;
		const dependencies = {
			afterPreflight: async () => {
				preflightArrivals += 1;
				if (preflightArrivals === 2) releasePreflight();
				await bothAtPreflight;
			},
			afterAttemptReserved: () => {
				reservations += 1;
			}
		};
		const outcomes = await Promise.allSettled([
			reprocessSkillIconProviderSource(input.request, input.root, dependencies),
			reprocessSkillIconProviderSource(input.request, input.root, dependencies)
		]);
		expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
		expect(reservations).toBe(1);
		const rejected = outcomes.find(({ status }) => status === 'rejected');
		expect(String(rejected && rejected.status === 'rejected' ? rejected.reason : '')).toMatch(
			/already reserved/iu
		);
	});

	it('rejects FIFO sources without blocking', async () => {
		const input = await fixture();
		const fifo = path.join(input.root, 'provider.fifo');
		await execFileAsync('mkfifo', [fifo]);
		await expect(
			reprocessSkillIconProviderSource({ ...input.request, sourcePath: fifo }, input.root)
		).rejects.toThrow(/regular file/iu);
	});
});
