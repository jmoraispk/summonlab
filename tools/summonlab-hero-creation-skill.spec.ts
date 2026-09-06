import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, '..');
const skillRoot = resolve(repositoryRoot, '.agents/skills/summonlab-hero-creation');
const temporaryDirectories: string[] = [];

async function readSkillFile(path: string): Promise<string> {
	return readFile(resolve(skillRoot, path), 'utf8');
}

async function makeTemporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(resolve(tmpdir(), 'summonlab-hero-cutout-'));
	temporaryDirectories.push(directory);
	return directory;
}

function sha256(bytes: Buffer | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
	);
});

describe('summonlab-hero-creation skill', () => {
	it('ships a discoverable skill package whose local references resolve', async () => {
		const skill = await readSkillFile('SKILL.md');
		const agentConfig = await readSkillFile('agents/openai.yaml');

		expect(skill).toMatch(/^---\nname: summonlab-hero-creation\n/);
		expect(skill).toContain('description: Use when');
		expect(agentConfig).toContain('$summonlab-hero-creation');

		const referenceLinks = [...skill.matchAll(/\]\((references\/[^)]+\.md)\)/g)].map(
			(match) => match[1]
		);
		expect(referenceLinks.length).toBeGreaterThanOrEqual(2);
		await Promise.all(referenceLinks.map((path) => access(resolve(skillRoot, path))));
	});

	it('makes the portrait, combat chibi, and Village cutout one visual identity unit', async () => {
		const documentation = [
			await readSkillFile('SKILL.md'),
			await readSkillFile('references/artifact-contract.md'),
			await readSkillFile('references/visual-contract.md'),
			await readSkillFile('agents/openai.yaml')
		].join('\n');

		for (const requiredTerm of [
			'visual trio',
			'village-cutout',
			'villageCutoutResultPath',
			'transparent',
			'normal proportions',
			'candidate',
			'identity-pixel-authority'
		]) {
			expect(documentation).toContain(requiredTerm);
		}
	});

	it('accepts a transparent normal-character cutout and rejects an opaque portrait plate', async () => {
		const directory = await makeTemporaryDirectory();
		const validPath = resolve(directory, 'valid.png');
		const opaquePath = resolve(directory, 'opaque.png');
		const validatorPath = resolve(skillRoot, 'scripts/validate_village_cutout.py');

		await sharp({
			create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
		})
			.composite([
				{
					input: await sharp({
						create: {
							width: 420,
							height: 1120,
							channels: 4,
							background: { r: 128, g: 80, b: 52, alpha: 1 }
						}
					})
						.png()
						.toBuffer(),
					left: 302,
					top: 208
				}
			])
			.png()
			.toFile(validPath);

		await sharp({
			create: { width: 1024, height: 1536, channels: 3, background: { r: 128, g: 80, b: 52 } }
		})
			.png()
			.toFile(opaquePath);

		await expect(
			execFileAsync('python3', [validatorPath, '--source', validPath])
		).resolves.toMatchObject({
			stdout: expect.stringContaining('"status": "valid"')
		});
		await expect(
			execFileAsync('python3', [validatorPath, '--source', opaquePath])
		).rejects.toMatchObject({
			stderr: expect.stringContaining('true alpha')
		});
	});

	it('validates a complete provenance-bound visual-trio batch', async () => {
		const workspace = await makeTemporaryDirectory();
		const batchId = 'hero-creation-20260906-test-001';
		const batchRoot = `assets/heroes/experiments/${batchId}`;
		const heroRoot = `${batchRoot}/trios/test-hero`;
		const summonPrompt = 'One original test hero.';
		const summonBytes = await sharp({
			create: { width: 1024, height: 1536, channels: 3, background: { r: 128, g: 80, b: 52 } }
		})
			.png()
			.toBuffer();
		const cutoutBytes = await sharp({
			create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
		})
			.composite([
				{
					input: await sharp({
						create: {
							width: 420,
							height: 1120,
							channels: 4,
							background: { r: 128, g: 80, b: 52, alpha: 1 }
						}
					})
						.png()
						.toBuffer(),
					left: 302,
					top: 208
				}
			])
			.png()
			.toBuffer();

		await Promise.all(
			['summon', 'chibi', 'village-cutout'].map((kind) =>
				mkdir(resolve(workspace, heroRoot, kind), { recursive: true })
			)
		);

		const summonSourcePath = `${heroRoot}/summon/provider-source-v1.png`;
		const summonHash = sha256(summonBytes);
		for (const [kind, bytes] of [
			['summon', summonBytes],
			['chibi', summonBytes],
			['village-cutout', cutoutBytes]
		] as const) {
			const providerSourcePath = `${heroRoot}/${kind}/provider-source-v1.png`;
			const candidatePath = `${heroRoot}/${kind}/candidate-v1.png`;
			const prompt = kind === 'summon' ? summonPrompt : `Create the ${kind}.`;
			const digest = sha256(bytes);
			const role = kind === 'chibi' ? 'identity-anatomy-authority' : 'identity-pixel-authority';
			await Promise.all([
				writeFile(resolve(workspace, providerSourcePath), bytes),
				writeFile(resolve(workspace, candidatePath), bytes),
				writeFile(
					resolve(workspace, `${heroRoot}/${kind}/result-v1.json`),
					JSON.stringify({
						schemaVersion: 'summonlab-hero-image-result-v1',
						batchId,
						heroId: 'test-hero',
						imageKind: kind,
						version: 1,
						status: 'candidate',
						width: 1024,
						height: 1536,
						prompt,
						promptSha256: sha256(prompt),
						references:
							kind === 'summon' ? [] : [{ role, path: summonSourcePath, sha256: summonHash }],
						providerSourcePath,
						providerSourceSha256: digest,
						candidatePath,
						candidateSha256: digest
					})
				)
			]);
		}

		await writeFile(
			resolve(workspace, `${heroRoot}/brief.json`),
			JSON.stringify({
				schemaVersion: 'summonlab-hero-visual-brief-v1',
				heroId: 'test-hero',
				displayName: 'Test Hero',
				nativeStars: 1,
				currentStars: 1,
				affinity: 'neutral',
				identity: { adult: true },
				physique: { build: 'ordinary' },
				hair: { silhouette: 'short' },
				wardrobe: { silhouette: 'tunic' },
				personalDetails: { mark: 'none' },
				characterKernel: { trait: 'steady' },
				summonPrompt,
				summonPromptSha256: sha256(summonPrompt),
				lifecycle: 'candidate',
				exclusions: ['weapon']
			})
		);
		await writeFile(
			resolve(workspace, `${batchRoot}/manifest.json`),
			JSON.stringify({
				schemaVersion: 'summonlab-hero-visual-trio-batch-v2',
				batchId,
				status: 'candidate',
				count: 1,
				heroes: [
					{
						heroId: 'test-hero',
						displayName: 'Test Hero',
						briefPath: `${heroRoot}/brief.json`,
						summonResultPath: `${heroRoot}/summon/result-v1.json`,
						chibiResultPath: `${heroRoot}/chibi/result-v1.json`,
						villageCutoutResultPath: `${heroRoot}/village-cutout/result-v1.json`
					}
				]
			})
		);

		await expect(
			execFileAsync('python3', [
				resolve(skillRoot, 'scripts/validate_batch.py'),
				'--workspace-root',
				workspace,
				'--batch-root',
				batchRoot
			])
		).resolves.toMatchObject({ stdout: expect.stringContaining('"trios": 1') });
	});
});
