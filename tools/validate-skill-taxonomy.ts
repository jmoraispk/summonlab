import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { exportSkillTaxonomyMigration } from './export-skill-taxonomy-migration.js';

import {
	parseTargetSkillRows,
	findForbiddenSkillReferencesInAuthoredSources,
	validateMigrationLedger,
	validateNetNewSkillProvenance,
	validateTargetTaxonomy,
	type LegacySkillRow,
	type NetNewSkillLedger,
	type SkillMigrationLedger,
	type SkillMarkdownFile
} from './skill-taxonomy-lib.js';

async function authoredSourcePaths(root: string, extensions: readonly string[]): Promise<string[]> {
	const entries = await readdir(path.resolve(root), { recursive: true });
	return entries
		.filter((entry) => extensions.some((extension) => entry.endsWith(extension)))
		.map((entry) => path.join(root, entry));
}

const exportReport = await exportSkillTaxonomyMigration({ mode: 'check' });
if (!exportReport.inSync) throw new Error('Skill taxonomy migration ledger is not in sync');

const ledgerPath = path.resolve('docs/wiki/mechanics/skills/migration-v2.json');
const inventoryPath = path.resolve('docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json');
const netNewPath = path.resolve('docs/wiki/mechanics/skills/net-new-v1.json');
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8')) as SkillMigrationLedger;
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as LegacySkillRow[];
const netNewLedger = JSON.parse(await readFile(netNewPath, 'utf8')) as NetNewSkillLedger;
const targetPaths = [
	'docs/wiki/mechanics/skills/martial-blade.md',
	'docs/wiki/mechanics/skills/martial-polearm.md',
	'docs/wiki/mechanics/skills/martial-ranged.md',
	'docs/wiki/mechanics/skills/martial-shield.md',
	'docs/wiki/mechanics/skills/martial-body.md',
	'docs/wiki/mechanics/skills/magical-elemental.md',
	'docs/wiki/mechanics/skills/magical-disciplines.md',
	'docs/wiki/mechanics/skills/craft-and-life.md'
];
const targetFiles: SkillMarkdownFile[] = await Promise.all(
	targetPaths.map(async (sourcePath) => ({
		sourcePath,
		source: await readFile(path.resolve(sourcePath), 'utf8')
	}))
);
const targetRows = parseTargetSkillRows(targetFiles);
const staleReferencePaths = [
	...(await authoredSourcePaths('docs/wiki', ['.md'])),
	...(await authoredSourcePaths('docs/decisions', ['.md'])),
	...(await authoredSourcePaths('docs/evidence', ['.md'])),
	'apps/web/src/lib/components/wiki/SkillTree.svelte',
	'apps/web/src/lib/components/wiki/skill-tree-data.ts'
];
const staleReferenceFiles: SkillMarkdownFile[] = await Promise.all(
	staleReferencePaths.map(async (sourcePath) => ({
		sourcePath,
		source: await readFile(path.resolve(sourcePath), 'utf8')
	}))
);
const errors = [
	...validateMigrationLedger(ledger, inventory),
	...validateTargetTaxonomy(targetRows, ledger, netNewLedger),
	...validateNetNewSkillProvenance(targetRows, ledger, netNewLedger),
	...findForbiddenSkillReferencesInAuthoredSources(staleReferenceFiles)
];

if (errors.length > 0) {
	process.stderr.write(`${errors.join('\n')}\n`);
	process.exitCode = 1;
} else {
	const domainCounts = ['Martial', 'Magical', 'Craft'].map(
		(domain) => `${targetRows.filter((row) => row.domain === domain).length} ${domain}`
	);
	process.stdout.write(
		`${ledger.records.length} mapped legacy skill rows and ${netNewLedger.records.length} net-new skill rows\n${targetRows.length} target skill rows reconciled (${domainCounts.join(', ')})\n`
	);
}
