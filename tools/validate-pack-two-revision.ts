import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import {
	PACK_TWO_ATTIRE_OPTIONS,
	PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION
} from '../packages/characters/src/index.js';
import { PACK_TWO_MONSTER_GRADE_VERSION } from '../packages/content/src/index.js';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(workspaceRoot, 'assets/heroes/visuals/forge-v2/revisions/catalog.json');

const RevisionCatalogSchema = z
	.object({
		packId: z.literal('character-pack-2'),
		catalogVersion: z.literal('pack-two-revision-visual-catalog-v1'),
		status: z.literal('approval-candidate'),
		humanGenerationVersion: z.literal(PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION),
		monsterGradeVersion: z.literal(PACK_TWO_MONSTER_GRADE_VERSION),
		promptRecord: z.string().min(1),
		assets: z
			.array(
				z
					.object({
						assetKey: z.string().regex(/^[a-z0-9-]+$/u),
						kind: z.enum([
							'human-face-attire-lineup',
							'human-face-grammar',
							'monster-grade-escalation'
						]),
						file: z.string().regex(/^assets\/[a-z0-9./-]+\.png$/u),
						width: z.literal(1536),
						height: z.literal(1024),
						bytes: z.number().int().positive(),
						contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
						elapsedMs: z.number().int().positive(),
						sourceOutput: z.string().regex(/^exec-[a-z0-9-]+\.png$/u),
						humanStatus: z.literal('candidate'),
						authoringInspection: z.enum(['pass', 'concern']),
						generationMode: z.literal('built-in-imagegen'),
						promptHeading: z.string().min(1),
						createdAt: z.string().datetime(),
						reviewFocus: z.string().min(20)
					})
					.strict()
			)
			.length(3)
	})
	.strict();

const catalog = RevisionCatalogSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));
const promptRecord = await readFile(resolve(workspaceRoot, catalog.promptRecord), 'utf8');
if (new Set(catalog.assets.map((asset) => asset.assetKey)).size !== catalog.assets.length) {
	throw new Error('Pack 2 revision asset keys are not unique');
}
if (new Set(catalog.assets.map((asset) => asset.kind)).size !== 3) {
	throw new Error('Pack 2 revision catalog must contain all three proof kinds');
}
for (const options of Object.values(PACK_TWO_ATTIRE_OPTIONS)) {
	if (options.length !== 10) throw new Error('A human-v5 attire slot lost its ten-option contract');
}

let verifiedBytes = 0;
for (const asset of catalog.assets) {
	const absolutePath = resolve(workspaceRoot, asset.file);
	if (!absolutePath.startsWith(workspaceRoot)) {
		throw new Error(`${asset.assetKey} escaped the workspace`);
	}
	const [buffer, file, metadata] = await Promise.all([
		readFile(absolutePath),
		stat(absolutePath),
		sharp(absolutePath).metadata()
	]);
	if (file.size !== asset.bytes) throw new Error(`${asset.assetKey} byte count changed`);
	if (metadata.width !== asset.width || metadata.height !== asset.height) {
		throw new Error(`${asset.assetKey} dimensions changed`);
	}
	if (createHash('sha256').update(buffer).digest('hex') !== asset.contentHash) {
		throw new Error(`${asset.assetKey} content hash changed`);
	}
	if (!promptRecord.includes(`## ${asset.promptHeading}`)) {
		throw new Error(`${asset.assetKey} exact prompt heading is missing`);
	}
	verifiedBytes += file.size;
}

process.stdout.write(
	JSON.stringify(
		{
			catalogVersion: catalog.catalogVersion,
			humanGenerationVersion: catalog.humanGenerationVersion,
			monsterGradeVersion: catalog.monsterGradeVersion,
			assets: catalog.assets.length,
			verifiedBytes,
			humanStatus: 'candidate'
		},
		null,
		2
	) + '\n'
);
