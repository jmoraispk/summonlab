import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	validateMigrationLedger,
	type LegacySkillRow,
	type SkillMigrationLedger
} from './skill-taxonomy-lib.js';

const ledgerPath = path.resolve('docs/wiki/mechanics/skills/migration-v2.json');
const inventoryPath = path.resolve('docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json');
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8')) as SkillMigrationLedger;
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as LegacySkillRow[];
const errors = validateMigrationLedger(ledger, inventory);

if (errors.length > 0) {
	process.stderr.write(`${errors.join('\n')}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(`${ledger.records.length} mapped legacy skill rows\n`);
}
