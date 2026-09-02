import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	EQUIPMENT_VISUAL_PROFILE_PATH,
	createEquipmentSchemaArtifacts,
	serializeEquipmentVisualProfile
} from './equipment-image-profile.js';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
	throw new Error('Usage: tsx tools/export-equipment-image-profile.ts [--check]');
}

const check = args[0] === '--check';
const artifacts = [
	{
		path: EQUIPMENT_VISUAL_PROFILE_PATH,
		contents: serializeEquipmentVisualProfile()
	},
	...createEquipmentSchemaArtifacts()
];

for (const artifact of artifacts) {
	const outputPath = path.resolve(process.cwd(), artifact.path);
	if (check) {
		const current = await readFile(outputPath, 'utf8').catch(() => null);
		if (current !== artifact.contents) {
			throw new Error(`Equipment visual-profile artifact is missing or stale: ${artifact.path}`);
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
			profilePath: EQUIPMENT_VISUAL_PROFILE_PATH,
			schemaCount: artifacts.length - 1,
			artifacts: artifacts.map((artifact) => artifact.path)
		},
		null,
		2
	)}\n`
);
