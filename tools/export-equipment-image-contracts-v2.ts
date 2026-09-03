import { z } from 'zod';

import { EQUIPMENT_V2_PACKET_SCHEMA_DEFINITIONS } from './equipment-image-production-contract-v2.js';
import {
	EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
	EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH,
	prepareEquipmentV2ProfileAcceptance,
	persistEquipmentV2ProfileAcceptance
} from './equipment-image-profile-acceptance-v2.js';
import { EQUIPMENT_V2_PRODUCTION_ROOT } from './equipment-material-production-v2.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryFile
} from './equipment-repository-io.js';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
if (args.length !== 1 || !['--accept-profile', '--write-schemas', '--check'].includes(args[0]!)) {
	throw new Error(
		'Usage: tsx tools/export-equipment-image-contracts-v2.ts (--accept-profile|--write-schemas|--check)'
	);
}

const check = args[0] === '--check';
const acceptProfile = args[0] === '--accept-profile';
const schemaArtifacts = EQUIPMENT_V2_PACKET_SCHEMA_DEFINITIONS.map(([filename, schema]) => ({
	path: `${EQUIPMENT_V2_PRODUCTION_ROOT}/schemas/${filename}`,
	contents: `${JSON.stringify(
		{
			...z.toJSONSchema(schema, { target: 'draft-2020-12' }),
			$id: `https://summonlab.local/schemas/equipment/v2/${filename}`,
			$comment:
				'Structural interchange validation only. Equipment v2 acceptance and packet processing must also run the corresponding Zod semantic schema.'
		},
		null,
		'\t'
	)}\n`
}));

const workspaceRoot = process.cwd();
if (acceptProfile) {
	await prepareEquipmentV2ProfileAcceptance({
		workspaceRoot,
		acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
	});
	if (
		(await equipmentRepositoryPathState(workspaceRoot, EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH)) !==
		'absent'
	) {
		throw new Error('The v2 profile acceptance path already exists');
	}
}

const missingSchemaArtifacts = [];
for (const artifact of schemaArtifacts) {
	const state = await equipmentRepositoryPathState(workspaceRoot, artifact.path);
	if (state === 'absent') {
		if (check) throw new Error(`Equipment v2 contract schema is missing: ${artifact.path}`);
		missingSchemaArtifacts.push(artifact);
		continue;
	}
	if (state !== 'file')
		throw new Error(`Equipment v2 contract schema is not a file: ${artifact.path}`);
	const current = (await readEquipmentRepositoryFile(workspaceRoot, artifact.path)).toString(
		'utf8'
	);
	if (current !== artifact.contents) {
		throw new Error(`Equipment v2 contract schema is stale: ${artifact.path}`);
	}
}
for (const artifact of missingSchemaArtifacts) {
	await exclusiveCreateEquipmentRepositoryFile(workspaceRoot, artifact.path, artifact.contents);
}

const acceptance =
	args[0] === '--write-schemas'
		? { mode: 'untouched', writesPerformed: 0 as const }
		: await persistEquipmentV2ProfileAcceptance({
				workspaceRoot,
				acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
				check
			});

process.stdout.write(
	`${JSON.stringify(
		{
			mode: check ? 'check' : acceptProfile ? 'accept-profile' : 'write-schemas',
			acceptance,
			profileCanonicalSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
			contractSchemaCount: schemaArtifacts.length,
			contractSchemaWrites: missingSchemaArtifacts.length,
			packetMaterializationIncluded: false,
			runActivationIncluded: false,
			imageGenerationAuthorized: false
		},
		null,
		2
	)}\n`
);
