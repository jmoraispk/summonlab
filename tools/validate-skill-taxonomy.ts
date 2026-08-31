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
const martialPaths = [
	'docs/wiki/mechanics/skills/martial-blade.md',
	'docs/wiki/mechanics/skills/martial-polearm.md',
	'docs/wiki/mechanics/skills/martial-ranged.md',
	'docs/wiki/mechanics/skills/martial-shield.md',
	'docs/wiki/mechanics/skills/martial-body.md'
];
const martialFiles: SkillMarkdownFile[] = await Promise.all(
	martialPaths.map(async (sourcePath) => ({
		sourcePath,
		source: await readFile(path.resolve(sourcePath), 'utf8')
	}))
);
const martialRows = parseTargetSkillRows(martialFiles);
const martialLedger = {
	...ledger,
	records: ledger.records.filter(
		(record) => record.target?.domain === 'Martial' || record.disposition === 'merge'
	)
};
const errors = [
	...validateMigrationLedger(ledger, inventory),
	...validateTargetTaxonomy(martialRows, martialLedger)
];

if (errors.length > 0) {
	process.stderr.write(`${errors.join('\n')}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(
		`${ledger.records.length} mapped legacy skill rows\n${martialRows.length} Martial target skill rows reconciled\n`
	);
}
