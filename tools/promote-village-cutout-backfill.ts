import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SummonableHeroCatalogSchema } from '../packages/contracts/src/index.js';
import { format } from 'prettier';

import {
	VILLAGE_CUTOUT_BACKFILL_APPROVAL_PATH,
	VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH,
	VILLAGE_CUTOUT_BACKFILL_MANIFEST_SHA256,
	VillageCutoutBackfillApprovalSchema,
	VillageCutoutBackfillManifestSchema,
	promoteVillageCutouts,
	villageCutoutSha256
} from './village-cutout-backfill-lib.js';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(
	workspaceRoot,
	'assets/heroes/approved/summonable-roster-v1/catalog.json'
);
const manifestPath = resolve(workspaceRoot, VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH);
const approvalPath = resolve(workspaceRoot, VILLAGE_CUTOUT_BACKFILL_APPROVAL_PATH);

const [catalogBytes, manifestBytes, approvalBytes] = await Promise.all([
	readFile(catalogPath),
	readFile(manifestPath),
	readFile(approvalPath)
]);
const catalog = SummonableHeroCatalogSchema.parse(JSON.parse(catalogBytes.toString('utf8')));
const manifest = VillageCutoutBackfillManifestSchema.parse(
	JSON.parse(manifestBytes.toString('utf8'))
);
const approval = VillageCutoutBackfillApprovalSchema.parse(
	JSON.parse(approvalBytes.toString('utf8'))
);

const manifestSha256 = villageCutoutSha256(manifestBytes);
if (
	manifestSha256 !== VILLAGE_CUTOUT_BACKFILL_MANIFEST_SHA256 ||
	manifestSha256 !== approval.manifestSha256
) {
	throw new Error(
		'Village cutout manifest raw hash does not match the approved immutable manifest'
	);
}

for (const [index, hero] of manifest.heroes.entries()) {
	const accepted = approval.acceptedCandidates[index];
	const [summonBytes, providerBytes, candidateBytes] = await Promise.all([
		readFile(resolve(workspaceRoot, hero.summon.path)),
		readFile(resolve(workspaceRoot, hero.providerSource.path)),
		readFile(resolve(workspaceRoot, hero.candidate.path))
	]);
	if (villageCutoutSha256(summonBytes) !== hero.summon.sha256) {
		throw new Error(`Approved summon source bytes drifted for ${hero.heroId}`);
	}
	if (
		accepted.heroId !== hero.heroId ||
		accepted.file !== hero.candidate.path ||
		candidateBytes.byteLength !== accepted.bytes ||
		villageCutoutSha256(candidateBytes) !== accepted.contentHash ||
		!candidateBytes.equals(providerBytes) ||
		villageCutoutSha256(providerBytes) !== hero.providerSource.sha256
	) {
		throw new Error(`Approved candidate bytes drifted for ${hero.heroId}`);
	}
}

const promoted = promoteVillageCutouts(catalog, manifest, approval);
const formatted = await format(JSON.stringify(promoted), {
	parser: 'json',
	useTabs: true,
	printWidth: 100
});
const mode = process.argv.includes('--write')
	? 'write'
	: process.argv.includes('--check')
		? 'check'
		: null;
if (
	mode === null ||
	process.argv.filter((argument) => /^--(?:write|check)$/u.test(argument)).length !== 1
) {
	throw new Error('Usage: pnpm tsx tools/promote-village-cutout-backfill.ts --write|--check');
}
if (mode === 'write') await writeFile(catalogPath, formatted);
else if (formatted !== catalogBytes.toString('utf8')) {
	throw new Error('Approved summonable hero catalog drifted; run promotion with --write');
}

process.stdout.write(
	`${JSON.stringify({
		mode,
		approvalId: approval.approvalId,
		manifestSha256,
		heroIds: approval.acceptedHeroIds,
		candidateHashes: approval.acceptedCandidates.map((candidate) => candidate.contentHash)
	})}\n`
);
