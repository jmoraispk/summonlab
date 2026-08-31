import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	parseTargetSkillRows,
	validateMigrationLedger,
	validateTargetTaxonomy,
	type LegacySkillRow,
	type SkillMigrationLedger,
	type SkillMarkdownFile
} from './skill-taxonomy-lib.js';

const ledgerPath = path.resolve('docs/wiki/mechanics/skills/migration-v2.json');
const inventoryPath = path.resolve('docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json');
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8')) as SkillMigrationLedger;
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as LegacySkillRow[];
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
const errors = [
	...validateMigrationLedger(ledger, inventory),
	...validateTargetTaxonomy(targetRows, ledger)
];

if (errors.length > 0) {
	process.stderr.write(`${errors.join('\n')}\n`);
	process.exitCode = 1;
} else {
	const domainCounts = ['Martial', 'Magical', 'Craft'].map(
		(domain) => `${targetRows.filter((row) => row.domain === domain).length} ${domain}`
	);
	process.stdout.write(
		`${ledger.records.length} mapped legacy skill rows\n${targetRows.length} target skill rows reconciled (${domainCounts.join(', ')})\n`
	);
}
