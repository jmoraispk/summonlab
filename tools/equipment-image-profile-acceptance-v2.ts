import { createHash } from 'node:crypto';

import {
	EquipmentV2ProfileAcceptanceSchema,
	type EquipmentV2ProfileAcceptance
} from './equipment-image-production-contract-v2.js';
import {
	EQUIPMENT_V2_VISUAL_PROFILE_PATH,
	EquipmentVisualProfileV2Schema,
	buildEquipmentVisualProfileV2
} from './equipment-image-profile-v2.js';
import { EQUIPMENT_V2_PRODUCTION_ROOT } from './equipment-material-production-v2.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

export const EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH =
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/visual-profile/acceptance.json` as const;
export const EQUIPMENT_V2_ACCEPTED_AT = '2026-09-02T20:28:24.000Z' as const;
export const EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256 =
	'a7f2703b3fe513fc80ebf46f7e1b173bb90c35466eb2e45d0d23932d319e55c8' as const;

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
		.join(',')}}`;
}

export function canonicalJsonSha256V2(value: unknown): string {
	return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function byteSha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function buildEquipmentV2ProfileAcceptance(input: {
	readonly profile: unknown;
	readonly acknowledgedProfileSha256: string;
	readonly acceptedAt?: string;
}): EquipmentV2ProfileAcceptance {
	const profile = EquipmentVisualProfileV2Schema.parse(input.profile);
	const profileCanonicalSha256 = canonicalJsonSha256V2(profile);
	if (
		input.acknowledgedProfileSha256 !== EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256 ||
		profileCanonicalSha256 !== EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
	) {
		throw new Error(
			`The acknowledged v2 profile hash does not match the owner-accepted canonical SHA-256: expected ${EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256}`
		);
	}
	return EquipmentV2ProfileAcceptanceSchema.parse({
		schemaVersion: 'equipment-visual-profile-acceptance-v2',
		acceptanceId: 'equipment-material-visual-profile-v2-acceptance',
		productionId: 'material-equipment-v2',
		profileId: profile.profileId,
		profileSchemaVersion: profile.schemaVersion,
		profilePath: EQUIPMENT_V2_VISUAL_PROFILE_PATH,
		profileCanonicalSha256,
		decision: 'accepted',
		reviewer: 'owner',
		acceptedAt: input.acceptedAt ?? EQUIPMENT_V2_ACCEPTED_AT,
		authorizationScope: 'visual-profile-only'
	});
}

export async function prepareEquipmentV2ProfileAcceptance(input: {
	readonly workspaceRoot: string;
	readonly acknowledgedProfileSha256: string;
	readonly acceptedAt?: string;
}): Promise<{ readonly acceptance: EquipmentV2ProfileAcceptance; readonly contents: string }> {
	const profileValue = await readEquipmentRepositoryJson(
		input.workspaceRoot,
		EQUIPMENT_V2_VISUAL_PROFILE_PATH
	);
	const profile = EquipmentVisualProfileV2Schema.parse(profileValue);
	if (canonicalJsonSha256V2(profile) !== canonicalJsonSha256V2(buildEquipmentVisualProfileV2())) {
		throw new Error('The v2 profile does not match its deterministic semantic exporter');
	}
	for (const reference of profile.references) {
		const bytes = await readEquipmentRepositoryFile(input.workspaceRoot, reference.path);
		if (byteSha256(bytes) !== reference.contentHash) {
			throw new Error(`V2 profile reference byte hash mismatch: ${reference.path}`);
		}
	}
	const acceptance = buildEquipmentV2ProfileAcceptance({
		profile,
		acknowledgedProfileSha256: input.acknowledgedProfileSha256,
		...(input.acceptedAt === undefined ? {} : { acceptedAt: input.acceptedAt })
	});
	const contents = `${JSON.stringify(acceptance, null, '\t')}\n`;
	return { acceptance, contents };
}

export async function persistEquipmentV2ProfileAcceptance(input: {
	readonly workspaceRoot: string;
	readonly acknowledgedProfileSha256: string;
	readonly acceptedAt?: string;
	readonly check?: boolean;
}): Promise<{ readonly mode: 'write' | 'check'; readonly writesPerformed: 0 | 1 }> {
	const { contents } = await prepareEquipmentV2ProfileAcceptance(input);
	const state = await equipmentRepositoryPathState(
		input.workspaceRoot,
		EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH
	);
	if (input.check) {
		const current =
			state === 'file'
				? (
						await readEquipmentRepositoryFile(
							input.workspaceRoot,
							EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH
						)
					).toString('utf8')
				: null;
		if (current !== contents) throw new Error('The v2 profile acceptance is missing or stale');
		return { mode: 'check', writesPerformed: 0 };
	}
	if (state !== 'absent') throw new Error('The v2 profile acceptance path already exists');
	await exclusiveCreateEquipmentRepositoryFile(
		input.workspaceRoot,
		EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH,
		contents
	);
	return { mode: 'write', writesPerformed: 1 };
}
