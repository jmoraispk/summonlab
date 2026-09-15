import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const inventoryPath = path.join(root, 'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json');
const libraryPath = path.join(root, 'tools/skill-taxonomy-lib.ts');
const specificationPath = path.join(root, 'tools/export-skill-taxonomy-migration.spec.ts');
const migrationPath = path.join(root, 'docs/wiki/mechanics/skills/migration-v2.json');
const projected = createHash('sha256')
	.update(await readFile(inventoryPath))
	.digest('hex');
const library = await readFile(libraryPath, 'utf8');
const match = library.match(/LEGACY_SKILL_INVENTORY_V1_SHA256\s*=\s*\n\s*'([0-9a-f]{64})'/u);
if (match?.[1] === undefined) throw new Error('Legacy skill inventory expectation is absent');
const previous = match[1];
for (const filePath of [libraryPath, specificationPath, migrationPath]) {
	const source = await readFile(filePath, 'utf8');
	if (!source.includes(previous)) throw new Error('Legacy inventory binding is absent');
	await writeFile(filePath, source.replaceAll(previous, projected), 'utf8');
}
