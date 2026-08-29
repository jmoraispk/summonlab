import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import {
	PACK_TWO_MONSTER_ARCHETYPES,
	PACK_TWO_MONSTER_FAMILIES,
	PACK_TWO_MONSTER_ROSTER_VERSION
} from '../packages/content/src/index.js';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(workspaceRoot, 'assets/enemies/review/pack-2/catalog.json');
const CatalogSchema = z
	.object({
		packId: z.literal('character-pack-2'),
		catalogVersion: z.literal('monster-visual-catalog-v2'),
		rosterVersion: z.literal(PACK_TWO_MONSTER_ROSTER_VERSION),
		status: z.literal('approval-candidate'),
		promptRecord: z.string().min(1),
		plates: z
			.array(
				z
					.object({
						familyId: z.string().min(1),
						assetKey: z.string().regex(/^[a-z0-9-]+$/u),
						file: z.string().regex(/^assets\/enemies\/review\/pack-2\/[a-z0-9-]+\.png$/u),
						width: z.literal(1536),
						height: z.literal(1024),
						bytes: z.number().int().positive(),
						contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
						elapsedMs: z.number().int().positive(),
						attempts: z
							.array(
								z
									.object({
										elapsedMs: z.number().int().positive(),
										result: z.enum(['candidate', 'revise'])
									})
									.strict()
							)
							.min(1),
						humanStatus: z.literal('candidate'),
						authoringInspection: z.enum(['pass', 'concern']),
						generationMode: z.literal('built-in-imagegen'),
						promptHeading: z.string().min(1)
					})
					.strict()
			)
			.length(6)
	})
	.strict();

const catalog = CatalogSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));
const promptRecord = await readFile(resolve(workspaceRoot, catalog.promptRecord), 'utf8');
const familyIds = PACK_TWO_MONSTER_FAMILIES.map((family) => family.id).sort();
if (
	JSON.stringify(catalog.plates.map((plate) => plate.familyId).sort()) !== JSON.stringify(familyIds)
) {
	throw new Error('Monster visual catalog does not cover the six Pack 2 families exactly once');
}

for (const family of PACK_TWO_MONSTER_FAMILIES) {
	if (family.monsterIds.length !== 4) throw new Error(`${family.id} lost its four-member plate`);
	if (!catalog.plates.some((plate) => plate.familyId === family.id)) {
		throw new Error(`${family.id} has no visual plate`);
	}
}
if (new Set(PACK_TWO_MONSTER_ARCHETYPES.map((monster) => monster.duty)).size !== 24) {
	throw new Error('Monster battlefield duties are no longer distinct');
}

let verifiedBytes = 0;
for (const plate of catalog.plates) {
	const absolutePath = resolve(workspaceRoot, plate.file);
	const [buffer, file, metadata] = await Promise.all([
		readFile(absolutePath),
		stat(absolutePath),
		sharp(absolutePath).metadata()
	]);
	if (file.size !== plate.bytes) throw new Error(`${plate.assetKey} byte count changed`);
	if (metadata.width !== plate.width || metadata.height !== plate.height) {
		throw new Error(`${plate.assetKey} dimensions changed`);
	}
	if (createHash('sha256').update(buffer).digest('hex') !== plate.contentHash) {
		throw new Error(`${plate.assetKey} content hash changed`);
	}
	if (!promptRecord.includes(`## ${plate.promptHeading}`)) {
		throw new Error(`${plate.assetKey} exact prompt is missing`);
	}
	if (
		plate.attempts.at(-1)?.result !== 'candidate' ||
		plate.attempts.at(-1)?.elapsedMs !== plate.elapsedMs
	) {
		throw new Error(`${plate.assetKey} final attempt does not match the retained candidate`);
	}
	verifiedBytes += file.size;
}

process.stdout.write(
	JSON.stringify(
		{
			rosterVersion: catalog.rosterVersion,
			families: catalog.plates.length,
			archetypes: PACK_TWO_MONSTER_ARCHETYPES.length,
			generationAttempts: catalog.plates.reduce((total, plate) => total + plate.attempts.length, 0),
			verifiedBytes,
			humanStatus: 'candidate'
		},
		null,
		2
	) + '\n'
);
