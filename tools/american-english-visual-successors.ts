import { canonicalJson as characterCanonicalJson } from '../packages/characters/src/index.js';
import {
	familyAffinitySha256,
	stableFamilyAffinityJson
} from './family-affinity-production-lib.js';
import { canonicalJson, sha256Json } from './image-production-lib.js';
import {
	digestBytes,
	digestUtf8,
	planTopologicalIntegritySuccessors,
	verifyTopologicalIntegritySuccessors,
	type AmericanEnglishIntegrityOwner,
	type IntegritySerializerId
} from './american-english-integrity-contracts.js';
import { OWNER_DIGEST_POINTER_PATTERNS } from './american-english-integrity-pointers.js';
import { selectFamilyAffinitySourceLineagePaths } from './reseal-family-affinity-source-lineage.js';

const SKILL_ICON_LINEAGE_PATH =
	/^assets\/wiki\/skills\/icon-production-v1\/(?:mass-production-v1\/results\/(?:families|skills)|quality-cleanup-v1\/(?:prompts\/revisions(?:-v[23])?|results\/(?:revisions|completion-audits)))\/[^/]+\.json$/u;

export function selectVisualProductionIntentPaths(paths: readonly string[]): readonly string[] {
	return [
		...new Set([
			...selectFamilyAffinitySourceLineagePaths(paths),
			...paths.filter((repositoryPath) => SKILL_ICON_LINEAGE_PATH.test(repositoryPath))
		])
	].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

const FAMILY_PRODUCTION_CONTRACT_PATH =
	'skills/summonlab-image-production/references/contract-v3.json';
const FAMILY_PRODUCTION_BUNDLE_PATH =
	'skills/summonlab-image-production/scripts/family_dispatch_gate.mjs';
const FAMILY_PRODUCTION_CONTRACT_DIGEST_POINTER_PATTERNS = [
	/^\/executionSurface\/expectedNonContractSha256\/[^/]+$/u,
	/^\/repositoryDispatch\/sha256$/u,
	/^\/sealedLauncher\/(?:bundle|node)\/sha256$/u,
	/^\/sealedLauncher\/sources\/(?:0|[1-9]\d*)\/sha256$/u
] as const;

export const VISUAL_PRODUCTION_INTEGRITY_PATH_PATTERNS = [
	/^assets\/(?:enemies|heroes|wiki)\//u,
	/^apps\/web\/static\/runtime\/(?:enemies\/monster-wiki-v1|summonable-heroes-v1)\//u,
	/^apps\/web\/static\/wiki-media\/monsters\//u,
	/^apps\/web\/static\/wiki-media\/skills\//u,
	/^docs\/(?:affinity-|evidence\/fauna-family-|wiki\/creatures\/)/u,
	/^docs\/superpowers\/plans\/[^/]*(?:monster|skill-icon|visual)[^/]*\.md$/u,
	/^docs\/superpowers\/reports\/[^/]*skill-icon[^/]*\.md$/u,
	/^packages\/characters\/(?:src|test)\/.*\.(?:ts|json)$/u,
	/^packages\/content\/src\/affinity-workflow(?:\.|\/)/u,
	/^packages\/contracts\/src\/(?:character|image-production)(?:\.|\/)/u,
	/^tools\/(?![^/]*equipment)[^/]*(?:affinity|earth-bridge|family|fauna|hero|skill-icon|visual|wiki)[^/]*\.(?:ts|mjs)$/u,
	/^tools\/image-production-lib(?:\.spec)?\.ts$/u,
	/^tools\/[^/]*reversal-cut[^/]*\.(?:ts|mjs)$/u
] as const;

export const VISUAL_PRODUCTION_FILE_BINDING_PATH_PATTERNS = [
	/^assets\/(?:enemies|heroes|wiki)\/.*\/(?:target|assignment|result)\.json$/u,
	/^assets\/(?:enemies|heroes|wiki)\/.*\/[^/]*manifest[^/]*\.json$/u,
	/^assets\/(?:enemies|heroes|wiki)\/.*\/(?:review|reviews)\/.*\.(?:json|html|md)$/u,
	/^assets\/(?:enemies|heroes|wiki)\/.*\/schemas\/.*\.json$/u,
	/^assets\/heroes\/.*\/(?:scripts|tests)\/.*\.(?:py|ts)$/u,
	/^apps\/web\/static\/(?:runtime\/(?:enemies\/monster-wiki-v1|summonable-heroes-v1)|wiki-media\/(?:monsters|skills))\//u,
	/^docs\/(?:affinity-wave-scheduler\.md|evidence\/fauna-family-v1\/index\.html)$/u,
	/^docs\/superpowers\/plans\/[^/]*(?:monster|skill-icon)[^/]*\.md$/u,
	/^docs\/superpowers\/reports\/[^/]*skill-icon[^/]*\.md$/u,
	/^packages\/characters\/src\/(?:characters\.spec|index)\.ts$/u,
	/^packages\/content\/src\/affinity-workflow(?:\.spec)?\.ts$/u,
	/^packages\/contracts\/src\/(?:character|image-production)\.ts$/u,
	/^tools\/(?![^/]*equipment)[^/]*(?:affinity|earth-bridge|family|fauna|hero|skill-icon|visual|wiki)[^/]*\.(?:ts|mjs)$/u,
	/^tools\/image-production-lib(?:\.spec)?\.ts$/u,
	/^tools\/[^/]*reversal-cut[^/]*\.(?:ts|mjs)$/u
] as const;

export const VISUAL_PRODUCTION_BINARY_PATH_PATTERNS = [
	/^assets\/(?:enemies|heroes|wiki)\/.*\.(?:png|webp)$/u,
	/^apps\/web\/static\/(?:runtime\/(?:enemies\/monster-wiki-v1|summonable-heroes-v1)|wiki-media\/(?:monsters|skills))\/.*\.(?:png|webp)$/u
] as const;

function visualDigest(serializer: IntegritySerializerId, value: unknown): string {
	if (serializer === 'raw-file' && value instanceof Uint8Array) return digestBytes(value);
	if (serializer === 'utf8-string' && typeof value === 'string') return digestUtf8(value);
	if (serializer === 'family-affinity') return familyAffinitySha256(value);
	if (serializer === 'image-production') return sha256Json(value);
	if (serializer === 'character-manifest') return digestUtf8(characterCanonicalJson(value));
	throw new Error(`Visual-production owner cannot use serializer ${serializer}`);
}

export const visualCanonicalSerializers = {
	'family-affinity': stableFamilyAffinityJson,
	'image-production': canonicalJson,
	'character-manifest': characterCanonicalJson
} as const;

export const visualProductionIntegrityOwner: AmericanEnglishIntegrityOwner = {
	id: 'visual-production',
	intentMaterialization: {
		commands: [
			['pnpm', 'tsx', 'tools/reseal-affinity-wiki-provenance.ts', '--write'],
			['pnpm', 'tsx', 'tools/reseal-retained-enemy-pack-lineage.ts', '--write'],
			['pnpm', 'tsx', 'tools/reseal-family-affinity-source-lineage.ts'],
			['pnpm', 'tsx', 'tools/reseal-fauna-family-promotion-lineage.ts', '--write'],
			['pnpm', 'build:family-affinity-dispatch-bundle'],
			['pnpm', 'tsx', 'tools/reseal-family-production-execution-surface.ts', '--write'],
			['pnpm', 'tsx', 'tools/reseal-family-production-compatibility.ts', '--write'],
			['pnpm', 'tsx', 'tools/reseal-historical-earth-bridge-sources.ts', '--write'],
			['pnpm', 'tsx', 'tools/reseal-character-generation-expectations.ts'],
			['pnpm', 'export:wiki-monster-visuals'],
			['pnpm', 'export:player-visuals'],
			['pnpm', 'export:summonable-hero-runtime'],
			['pnpm', 'tsx', 'tools/reseal-skill-icon-content-bindings.ts'],
			['pnpm', 'tsx', 'tools/reseal-wiki-skill-visual-manifest.ts'],
			['pnpm', 'prettier', '--write', 'packages/contracts/src/character.ts']
		],
		paths: [
			'assets/enemies/wiki/affinities/reference/provenance.json',
			'assets/enemies/legacy/affinity-pack-v1/manifest.json',
			'assets/enemies/experiments/family-affinity-v1/waves/earth-bridge-v1.json',
			'assets/enemies/experiments/fauna-family-v1/inventory.json',
			'assets/enemies/experiments/fauna-family-v1/manifest.json',
			'assets/enemies/approved/fauna-family-v1/manifest.json',
			'assets/enemies/approved/fauna-family-v1/receipts/promotion-v1.json',
			'assets/enemies/runtime/fauna-family-v1/catalog.json',
			'assets/enemies/runtime/fauna-family-v1/receipt-v1.json',
			'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json',
			'apps/web/static/wiki-media/skills/visual-catalog-v1/manifest.json',
			'skills/summonlab-image-production/references/contract-v3.json',
			'skills/summonlab-image-production/scripts/family_dispatch_gate.mjs',
			'packages/contracts/src/character.ts',
			'packages/characters/src/characters.spec.ts',
			'assets/wiki/skills/icon-production-v2/overlay.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v1/manifest.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v2/completion.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v2/guard-flow-ancestor-authority.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v2/individual-attempt-v1.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v2/manifest.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v3/activation.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v3/owner-review.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/correction.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/owner-frame-feedback.json',
			'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/activation.json'
		],
		selectPaths: selectVisualProductionIntentPaths
	},
	regeneration: {
		writeCommand:
			'pnpm export:family-affinity-production && pnpm tsx tools/reseal-fauna-family-promotion-lineage.ts --write && pnpm export:affinity-workflow && pnpm tsx tools/reseal-retained-enemy-pack-lineage.ts --write && pnpm tsx tools/reseal-affinity-wiki-provenance.ts --write && pnpm export:enemy-affinity-expansion && pnpm export:wiki-monsters && pnpm export:wiki-monster-visuals && pnpm finalize:skill-icon-mass-production && pnpm tsx tools/reseal-skill-icon-content-bindings.ts && pnpm export:wiki-skill-visual-catalog && pnpm export:player-visuals && pnpm export:summonable-hero-runtime && pnpm export:skill-icon-runtime',
		checkCommand:
			'pnpm tsx tools/reseal-retained-enemy-pack-lineage.ts --check && pnpm tsx tools/reseal-affinity-wiki-provenance.ts --check && pnpm check:family-affinity-production && pnpm tsx tools/reseal-fauna-family-promotion-lineage.ts --check && pnpm validate:affinity-workflow && pnpm check:enemy-affinity-expansion-review && pnpm validate:wiki-monsters && pnpm validate:wiki-monster-visuals && pnpm check:skill-icon-mass-production && pnpm check:skill-icon-quality-cleanup && pnpm check:skill-icon-cleanup-v2-packets && pnpm check:skill-icon-cleanup-v3-packets && pnpm check:skill-icon-cleanup-v2 && pnpm check:skill-icon-cleanup-v3 && pnpm validate:wiki-skill-visual-catalog && pnpm validate:player-visuals && pnpm validate:summonable-hero-runtime && pnpm check:skill-icon-runtime && pnpm validate:skill-icons'
	},
	serializerFor(path, kind) {
		if (kind === 'raw-file')
			return VISUAL_PRODUCTION_BINARY_PATH_PATTERNS.some((p) => p.test(path)) ? 'raw-file' : null;
		if (kind === 'utf8-string' || !path.endsWith('.json')) return 'utf8-string';
		if (path.includes('family-affinity-v1')) return 'family-affinity';
		if (path.startsWith('packages/characters/')) return 'character-manifest';
		if (this.ownsPath(path)) return 'image-production';
		return null;
	},
	ownsPath(path) {
		return (
			path === FAMILY_PRODUCTION_CONTRACT_PATH ||
			path === FAMILY_PRODUCTION_BUNDLE_PATH ||
			VISUAL_PRODUCTION_INTEGRITY_PATH_PATTERNS.some((pattern) => pattern.test(path))
		);
	},
	regeneratesPath(path) {
		return this.ownsPath(path) && !path.includes('/migrations/');
	},
	owns(path, jsonPointer) {
		if (!this.ownsPath(path)) return false;
		if (path === FAMILY_PRODUCTION_BUNDLE_PATH) return jsonPointer === '';
		if (path === FAMILY_PRODUCTION_CONTRACT_PATH) {
			return FAMILY_PRODUCTION_CONTRACT_DIGEST_POINTER_PATTERNS.some((pattern) =>
				pattern.test(jsonPointer)
			);
		}
		if (jsonPointer === '') {
			return [
				...VISUAL_PRODUCTION_FILE_BINDING_PATH_PATTERNS,
				...VISUAL_PRODUCTION_BINARY_PATH_PATTERNS
			].some((pattern) => pattern.test(path));
		}
		return OWNER_DIGEST_POINTER_PATTERNS['visual-production'].some((pattern) =>
			pattern.test(jsonPointer)
		);
	},
	digest: visualDigest,
	planSuccessors(context) {
		return planTopologicalIntegritySuccessors(context, visualDigest);
	},
	verify(context) {
		return verifyTopologicalIntegritySuccessors(context, visualDigest);
	}
};
