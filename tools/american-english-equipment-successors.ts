import {
	canonicalJson as canonicalEquipmentJson,
	canonicalSha256
} from './equipment-rank-first-production-v3.js';
import {
	digestBytes,
	digestUtf8,
	planTopologicalIntegritySuccessors,
	verifyTopologicalIntegritySuccessors,
	type AmericanEnglishIntegrityOwner,
	type IntegritySerializerId
} from './american-english-integrity-contracts.js';
import { OWNER_DIGEST_POINTER_PATTERNS } from './american-english-integrity-pointers.js';
import { selectEquipmentPromptLineagePaths } from './reseal-equipment-prompt-lineage.js';

export const EQUIPMENT_INTEGRITY_PATH_PATTERNS = [
	/^assets\/equipment\//u,
	/^apps\/web\/src\/lib\/server\/equipment-runtime(?:\.|\/)/u,
	/^apps\/web\/static\/runtime\/equipment-v1\//u,
	/^docs\/superpowers\/plans\/[^/]*equipment[^/]*\.md$/u,
	/^docs\/wiki\/mechanics\/equipment\//u,
	/^packages\/(?:content|contracts)\/src\/equipment(?:-|\.|\/)/u,
	/^tools\/[^/]*equipment[^/]*\.(?:json|ts|mjs)$/u
] as const;

export const EQUIPMENT_FILE_BINDING_PATH_PATTERNS = [
	/^assets\/equipment\/(?:experiments\/material-equipment-v1|references\/2026-09-02-owner-weapon-inspiration)\/README\.md$/u,
	/^assets\/equipment\/(?:approved|experiments)\/.*\/(?:manifest|catalog|report|receipt|review|checkpoint|journal|target|assignment|result|profile|schema)[^/]*\.(?:json|html)$/u,
	/^assets\/equipment\/.*\/(?:schemas|reviews)\/.*\.(?:json|html)$/u,
	/^apps\/web\/(?:src\/lib\/server\/equipment-runtime(?:\.|\/)|static\/runtime\/equipment-v1\/)/u,
	/^docs\/superpowers\/plans\/[^/]*equipment[^/]*\.md$/u,
	/^docs\/wiki\/mechanics\/equipment\/README\.md$/u,
	/^packages\/(?:content|contracts)\/src\/equipment(?:-|\.|\/)/u,
	/^tools\/[^/]*equipment[^/]*\.(?:json|ts|mjs)$/u
] as const;

export const EQUIPMENT_BINARY_PATH_PATTERNS = [
	/^assets\/equipment\/.*\.(?:png|webp)$/u,
	/^apps\/web\/static\/runtime\/equipment-v1\/.*\.webp$/u
] as const;

function equipmentDigest(serializer: IntegritySerializerId, value: unknown): string {
	if (serializer === 'raw-file' && value instanceof Uint8Array) return digestBytes(value);
	if (serializer === 'utf8-string' && typeof value === 'string') return digestUtf8(value);
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
	intentMaterialization: {
		commands: [
			['pnpm', 'tsx', 'tools/reseal-equipment-prompt-lineage.ts'],
			['pnpm', 'tsx', 'tools/reseal-equipment-promotion-authorization.ts'],
			['pnpm', 'tsx', 'tools/reseal-equipment-content-expectations.ts'],
			['pnpm', 'export:equipment-runtime-visuals'],
			['pnpm', 'export:equipment-integration-report']
		],
		paths: [
			'apps/web/static/runtime/equipment-v1/manifest.json',
			'tools/equipment-approved-source-contract.spec.ts',
			'assets/equipment/approved/material-equipment-v1/integration-report.json',
			'assets/equipment/approved/material-equipment-v1/reviews/runtime-v1/index.html',
			'packages/content/src/equipment.ts',
			'tools/equipment-approved-source-contract.ts',
			'assets/equipment/approved/material-equipment-v1/manifest.json',
			'assets/equipment/approved/material-equipment-v1/receipts/promotion-v1.json',
			'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-1-directions.json',
			'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-2-roots.json',
			'assets/equipment/experiments/material-equipment-v3/reviews/proposed-promotions/candidate-promotion-v1.json'
		],
		selectPaths(paths) {
			return [
				...selectEquipmentPromptLineagePaths(paths),
				...paths.filter((repositoryPath) =>
					/^assets\/equipment\/experiments\/material-equipment-v3\/checkpoints\/checkpoint-3-[^/]+-pieces\.json$/u.test(
						repositoryPath
					)
				)
			];
		}
	},
	regeneration: {
		writeCommand:
			'pnpm export:equipment-runtime-visuals && pnpm export:equipment-integration-report',
		checkCommand:
			'pnpm validate:repository-assets && pnpm validate:equipment-approved-sources && pnpm validate:equipment-runtime-visuals && pnpm validate:equipment-content-bindings && pnpm validate:equipment-integration-report'
	},
	ownsPath(path) {
		return EQUIPMENT_INTEGRITY_PATH_PATTERNS.some((pattern) => pattern.test(path));
	},
	regeneratesPath(path) {
		return this.ownsPath(path) && !path.includes('/runs/');
	},
	owns(path, jsonPointer) {
		if (!this.ownsPath(path)) return false;
		if (jsonPointer === '') {
			return [...EQUIPMENT_FILE_BINDING_PATH_PATTERNS, ...EQUIPMENT_BINARY_PATH_PATTERNS].some(
				(pattern) => pattern.test(path)
			);
		}
		return OWNER_DIGEST_POINTER_PATTERNS.equipment.some((pattern) => pattern.test(jsonPointer));
	},
	serializerFor(path, kind) {
		if (kind === 'raw-file')
			return EQUIPMENT_BINARY_PATH_PATTERNS.some((p) => p.test(path)) ? 'raw-file' : null;
		if (kind === 'utf8-string' || path.startsWith('tools/') || !path.endsWith('.json')) {
			return 'utf8-string';
		}
		if (path.includes('material-equipment-v1') || path.includes('equipment-v1'))
			return 'equipment-v1';
		if (path.includes('material-equipment-v2') || path.includes('equipment-v2'))
			return 'equipment-v2';
		if (path.includes('material-equipment-v3') || path.includes('equipment-v3'))
			return 'equipment-v3';
		return null;
	},
	digest: equipmentDigest,
	planSuccessors(context) {
		return planTopologicalIntegritySuccessors(context, equipmentDigest);
	},
	verify(context) {
		return verifyTopologicalIntegritySuccessors(context, equipmentDigest);
	}
};
