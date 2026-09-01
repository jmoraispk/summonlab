import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH,
	buildEquipmentMaterialProductionManifest,
	serializeEquipmentMaterialProductionManifest
} from './equipment-material-production-lib.js';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
if (args.some((argument) => argument !== '--check')) {
	throw new Error(`Unknown argument: ${args.find((argument) => argument !== '--check')}`);
}
if (args.filter((argument) => argument === '--check').length > 1) {
	throw new Error('--check may be supplied at most once');
}

const check = args.includes('--check');
const outputPath = path.resolve(process.cwd(), EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH);
const expected = serializeEquipmentMaterialProductionManifest();
const current = await readFile(outputPath, 'utf8').catch(() => null);

if (check) {
	if (current !== expected) {
		throw new Error(
			`Equipment material production manifest is missing or stale: ${EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH}`
		);
	}
} else {
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, expected, 'utf8');
}

const manifest = buildEquipmentMaterialProductionManifest();
process.stdout.write(
	`${JSON.stringify(
		{
			mode: check ? 'check' : 'write',
			path: EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH,
			materials: manifest.summary.materialCount,
			targets: manifest.summary.targetCount,
			isolatedItems: manifest.summary.isolatedItemImageCount,
			fullSetSources: manifest.summary.fullSetConsistencyImageCount
		},
		null,
		2
	)}\n`
);
