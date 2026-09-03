import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	EQUIPMENT_V2_ALLOCATION_PLAN_PATH,
	EQUIPMENT_V2_MANIFEST_PATH,
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2,
	serializeEquipmentMaterialAllocationPlanV2,
	serializeEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
	throw new Error('Usage: tsx tools/export-equipment-material-production-v2.ts [--check]');
}

const check = args[0] === '--check';
const artifacts = [
	{ path: EQUIPMENT_V2_MANIFEST_PATH, contents: serializeEquipmentMaterialProductionManifestV2() },
	{
		path: EQUIPMENT_V2_ALLOCATION_PLAN_PATH,
		contents: serializeEquipmentMaterialAllocationPlanV2()
	}
] as const;

for (const artifact of artifacts) {
	const outputPath = path.resolve(process.cwd(), artifact.path);
	const current = await readFile(outputPath, 'utf8').catch(() => null);
	if (check) {
		if (current !== artifact.contents) {
			throw new Error(`Equipment v2 planning artifact is missing or stale: ${artifact.path}`);
		}
	} else {
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, artifact.contents, 'utf8');
	}
}

const manifest = buildEquipmentMaterialProductionManifestV2();
const allocation = buildEquipmentMaterialAllocationPlanV2();
process.stdout.write(
	`${JSON.stringify(
		{
			mode: check ? 'check' : 'write',
			artifacts: artifacts.map(({ path: artifactPath }) => artifactPath),
			materials: manifest.summary.materialCount,
			targets: manifest.summary.targetCount,
			initiallyReadyJobs: allocation.summary.initiallyReadyJobCount,
			armourPieceJobs: allocation.summary.armourPieceJobCount,
			currentRunnerCompatible: allocation.activation.currentRunnerCompatible,
			activationIncluded: allocation.activation.includedInTemplate
		},
		null,
		2
	)}\n`
);
