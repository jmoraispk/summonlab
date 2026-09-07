import {
	canonicalJson as canonicalEquipmentJson,
	canonicalSha256
} from './equipment-rank-first-production-v3.js';
import {
	planTopologicalIntegritySuccessors,
	verifyTopologicalIntegritySuccessors,
	type AmericanEnglishIntegrityOwner,
	type IntegritySerializerId
} from './american-english-integrity.js';

export const EQUIPMENT_INTEGRITY_PATH_PATTERNS = [
	/^assets\/equipment\//u,
	/^apps\/web\/src\/lib\/server\/equipment-runtime(?:\.|\/)/u,
	/^apps\/web\/static\/runtime\/equipment-v1\//u,
	/^docs\/superpowers\/plans\/[^/]*equipment[^/]*\.md$/u,
	/^docs\/wiki\/mechanics\/equipment\//u,
	/^packages\/(?:content|contracts)\/src\/equipment(?:-|\.|\/)/u,
	/^tools\/[^/]*equipment[^/]*\.(?:ts|mjs)$/u
] as const;

function equipmentDigest(serializer: IntegritySerializerId, value: unknown): string {
	if (
		serializer === 'equipment-v1' ||
		serializer === 'equipment-v2' ||
		serializer === 'equipment-v3'
	) {
		return canonicalSha256(value);
	}
	throw new Error(`Equipment owner cannot use serializer ${serializer}`);
}

export const equipmentCanonicalSerializers = {
	'equipment-v1': canonicalEquipmentJson,
	'equipment-v2': canonicalEquipmentJson,
	'equipment-v3': canonicalEquipmentJson
} as const;

export const equipmentIntegrityOwner: AmericanEnglishIntegrityOwner = {
	id: 'equipment',
	regeneration: {
		writeCommand:
			'pnpm export:equipment-runtime-visuals && pnpm export:equipment-integration-report',
		checkCommand:
			'pnpm validate:repository-assets && pnpm validate:equipment-approved-sources && pnpm validate:equipment-runtime-visuals && pnpm validate:equipment-content-bindings && pnpm validate:equipment-integration-report'
	},
	owns(path) {
		return EQUIPMENT_INTEGRITY_PATH_PATTERNS.some((pattern) => pattern.test(path));
	},
	planSuccessors(context) {
		return planTopologicalIntegritySuccessors(context, equipmentDigest);
	},
	verify(context) {
		return verifyTopologicalIntegritySuccessors(context, equipmentDigest);
	}
};
