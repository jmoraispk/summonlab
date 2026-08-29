import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import { generateCharacterDraft } from '../packages/characters/src/index.js';
import { CharacterGenerationRecipeSchema } from '../packages/contracts/src/index.js';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(workspaceRoot, 'assets/heroes/visuals/forge-v2/catalog.json');

const AttemptSchema = z
	.object({
		elapsedMs: z.number().int().positive(),
		result: z.enum(['candidate', 'revise']),
		note: z.string().min(1).optional()
	})
	.strict();

const PackTwoVisualCatalogSchema = z
	.object({
		packId: z.literal('character-pack-2'),
		catalogVersion: z.literal('visual-catalog-v2'),
		profileVersion: z.literal('visual-profile-v2'),
		status: z.literal('approval-candidate'),
		generationVersion: z.literal('human-v4'),
		promptRecord: z.string().min(1),
		humans: z
			.array(
				z
					.object({
						cohortStage: z.enum(['pilot', 'expansion']),
						recipe: CharacterGenerationRecipeSchema,
						characterId: z.string().uuid(),
						displayName: z.string().min(1),
						manifestHash: z.string().regex(/^[a-f0-9]{64}$/u),
						summonEligibility: z.enum(['awaiting-human-approval', 'eligible']),
						assetKeys: z.array(z.string().min(1)).min(2)
					})
					.strict()
			)
			.min(6),
		assets: z
			.array(
				z
					.object({
						assetKey: z.string().regex(/^[a-z0-9-]+$/u),
						role: z.enum(['full-body-anchor', 'continuity-sheet']),
						humanStatus: z.enum(['candidate', 'revise', 'approved', 'rejected']),
						authoringInspection: z.enum(['pass', 'concern']),
						characterId: z.string().uuid(),
						manifestHash: z.string().regex(/^[a-f0-9]{64}$/u),
						file: z.string().regex(/^assets\/heroes\/visuals\/forge-v2\/[a-z0-9./-]+\.png$/u),
						width: z.number().int().positive(),
						height: z.number().int().positive(),
						bytes: z.number().int().positive(),
						contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
						createdAt: z.string().datetime(),
						generationMode: z.literal('built-in-imagegen'),
						taxonomy: z.literal('stylized-concept'),
						starState: z.literal('initial'),
						equipmentState: z.literal('initial-medieval'),
						referenceRoles: z.array(z.string().min(1)).min(1),
						promptRecord: z.string().min(1),
						attempts: z.array(AttemptSchema).min(1),
						productionNote: z.string().min(1)
					})
					.strict()
			)
			.min(12)
	})
	.strict();

const catalog = PackTwoVisualCatalogSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));
const promptRecord = await readFile(resolve(workspaceRoot, catalog.promptRecord), 'utf8');
const assetKeys = new Set(catalog.assets.map((asset) => asset.assetKey));
const characters = await Promise.all(
	catalog.humans.map(async (human) => {
		const draft = await generateCharacterDraft(human.recipe);
		if (
			draft.manifestHash !== human.manifestHash ||
			draft.manifest.characterId !== human.characterId ||
			draft.manifest.displayName !== human.displayName
		) {
			throw new Error(`Manifest binding changed for ${human.displayName}`);
		}
		if (human.assetKeys.some((assetKey) => !assetKeys.has(assetKey))) {
			throw new Error(`Unknown asset key on ${human.displayName}`);
		}
		for (const role of ['anchor', 'continuity']) {
			if (!promptRecord.includes(`## ${human.displayName} ${role}`)) {
				throw new Error(`Missing exact ${role} prompt record for ${human.displayName}`);
			}
		}
		return draft.manifest;
	})
);

for (const asset of catalog.assets) {
	const absolutePath = resolve(workspaceRoot, asset.file);
	if (!absolutePath.startsWith(resolve(workspaceRoot, 'assets/heroes/visuals/forge-v2'))) {
		throw new Error(`Pack 2 asset escaped its root: ${asset.file}`);
	}
	const [buffer, file, metadata] = await Promise.all([
		readFile(absolutePath),
		stat(absolutePath),
		sharp(absolutePath).metadata()
	]);
	const hash = createHash('sha256').update(buffer).digest('hex');
	if (file.size !== asset.bytes) throw new Error(`${asset.assetKey} byte count changed`);
	if (metadata.width !== asset.width || metadata.height !== asset.height) {
		throw new Error(`${asset.assetKey} dimensions changed`);
	}
	if (hash !== asset.contentHash) throw new Error(`${asset.assetKey} content hash changed`);
	if (asset.attempts.at(-1)?.result !== 'candidate') {
		throw new Error(`${asset.assetKey} has no terminal candidate attempt`);
	}
	if (asset.humanStatus !== 'candidate') {
		throw new Error(`${asset.assetKey} cannot claim human approval in this production run`);
	}
}

const presentations = characters.map((manifest) => manifest.genderPresentation).sort();
const heightBands = characters.map((manifest) => manifest.physiology?.heightBand).sort();
if (
	JSON.stringify(presentations) !==
	JSON.stringify(['androgynous', 'androgynous', 'feminine', 'feminine', 'masculine', 'masculine'])
) {
	throw new Error('Pilot presentation matrix changed');
}
if (
	JSON.stringify(heightBands) !==
	JSON.stringify(['medium', 'medium', 'short', 'short', 'tall', 'tall'])
) {
	throw new Error('Pilot height matrix changed');
}
if (new Set(characters.map((manifest) => manifest.bodyBuild)).size < 4) {
	throw new Error('Pilot lost build diversity');
}
if (new Set(characters.map((manifest) => manifest.phenotype.hairSilhouette)).size !== 6) {
	throw new Error('Pilot lost hair-silhouette diversity');
}

const attempts = catalog.assets.flatMap((asset) => asset.attempts);
process.stdout.write(
	JSON.stringify(
		{
			catalogVersion: catalog.catalogVersion,
			characters: catalog.humans.length,
			assets: catalog.assets.length,
			generationAttempts: attempts.length,
			revisions: attempts.filter((attempt) => attempt.result === 'revise').length,
			verifiedBytes: catalog.assets.reduce((total, asset) => total + asset.bytes, 0),
			humanStatus: 'candidate'
		},
		null,
		2
	) + '\n'
);
