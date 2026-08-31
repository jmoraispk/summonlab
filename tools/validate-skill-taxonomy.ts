import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { validateMigrationLedger, type SkillMigrationLedger } from './skill-taxonomy-lib.js';

const ledgerPath = path.resolve('docs/wiki/mechanics/skills/migration-v2.json');
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8')) as SkillMigrationLedger;
const errors = validateMigrationLedger(ledger);

if (errors.length > 0) {
	process.stderr.write(`${errors.join('\n')}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(`${ledger.records.length} mapped legacy skill rows\n`);
}
