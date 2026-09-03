import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	EQUIPMENT_V2_VISUAL_PROFILE_PATH,
	EQUIPMENT_V2_VISUAL_PROFILE_SCHEMA_PATH,
	serializeEquipmentVisualProfileSchemaV2,
	serializeEquipmentVisualProfileV2
} from './equipment-image-profile-v2.js';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
	throw new Error('Usage: tsx tools/export-equipment-image-profile-v2.ts [--check]');
}

const check = args[0] === '--check';
const artifacts = [
	{ path: EQUIPMENT_V2_VISUAL_PROFILE_PATH, contents: serializeEquipmentVisualProfileV2() },
	{
		path: EQUIPMENT_V2_VISUAL_PROFILE_SCHEMA_PATH,
		contents: serializeEquipmentVisualProfileSchemaV2()
	}
] as const;

for (const artifact of artifacts) {
	const outputPath = path.resolve(process.cwd(), artifact.path);
	const current = await readFile(outputPath, 'utf8').catch(() => null);
	if (check) {
		if (current !== artifact.contents) {
			throw new Error(`Equipment v2 profile artifact is missing or stale: ${artifact.path}`);
		}
	} else {
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, artifact.contents, 'utf8');
	}
}

process.stdout.write(
	`${JSON.stringify(
		{
			mode: check ? 'check' : 'write',
			profileStatus: 'approval-candidate',
			runnerCompatibility: 'planning-only-requires-v2-execution-contract',
			artifacts: artifacts.map(({ path: artifactPath }) => artifactPath)
		},
		null,
		2
	)}\n`
);
