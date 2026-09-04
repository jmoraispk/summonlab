import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	EQUIPMENT_MATERIAL_ALLOCATION_PLAN_PATH,
	EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH,
	buildEquipmentMaterialAllocationPlan,
	buildEquipmentMaterialProductionManifest,
	serializeEquipmentMaterialAllocationPlan,
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
const artifacts = [
	{
		path: EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH,
		contents: serializeEquipmentMaterialProductionManifest()
	},
	{
		path: EQUIPMENT_MATERIAL_ALLOCATION_PLAN_PATH,
		contents: serializeEquipmentMaterialAllocationPlan()
	}
] as const;

for (const artifact of artifacts) {
	const outputPath = path.resolve(process.cwd(), artifact.path);
	const current = await readFile(outputPath, 'utf8').catch(() => null);
	if (check) {
		if (current !== artifact.contents) {
			throw new Error(`Equipment production artifact is missing or stale: ${artifact.path}`);
		}
	} else {
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, artifact.contents, 'utf8');
	}
}

const manifest = buildEquipmentMaterialProductionManifest();
const allocationPlan = buildEquipmentMaterialAllocationPlan();
process.stdout.write(
	`${JSON.stringify(
		{
			mode: check ? 'check' : 'write',
			artifacts: artifacts.map((artifact) => artifact.path),
			materials: manifest.summary.materialCount,
			targets: manifest.summary.targetCount,
			isolatedItems: manifest.summary.isolatedItemImageCount,
			fullSetSources: manifest.summary.fullSetConsistencyImageCount,
			initiallyReadyJobs: allocationPlan.summary.initiallyReadyJobCount,
			armourPieceJobs: allocationPlan.summary.armourPieceJobCount,
			artifactRole: allocationPlan.artifactRole,
			activationIncluded: allocationPlan.activation.includedInTemplate
		},
		null,
		2
	)}\n`
);
