import { canonicalJson as characterCanonicalJson } from '../packages/characters/src/index.js';
import {
	familyAffinitySha256,
	stableFamilyAffinityJson
} from './family-affinity-production-lib.js';
import { canonicalJson, sha256Json } from './image-production-lib.js';
import {
	digestUtf8,
	planTopologicalIntegritySuccessors,
	verifyTopologicalIntegritySuccessors,
	type AmericanEnglishIntegrityOwner,
	type IntegritySerializerId
} from './american-english-integrity-contracts.js';
import { OWNER_DIGEST_POINTER_PATTERNS } from './american-english-integrity-pointers.js';

export const VISUAL_PRODUCTION_INTEGRITY_PATH_PATTERNS = [
	/^assets\/(?:enemies|heroes|wiki)\//u,
	/^apps\/web\/static\/runtime\/enemies\/fauna-family-v1\//u,
	/^apps\/web\/static\/wiki-media\/monsters\//u,
	/^apps\/web\/static\/wiki-media\/skills\//u,
	/^docs\/(?:affinity-|evidence\/fauna-family-|wiki\/creatures\/)/u,
	/^docs\/superpowers\/plans\/[^/]*(?:monster|skill-icon|visual)[^/]*\.md$/u,
	/^packages\/characters\//u,
	/^packages\/content\/src\/affinity-workflow(?:\.|\/)/u,
	/^packages\/contracts\/src\/(?:character|image-production)(?:\.|\/)/u,
	/^tools\/(?![^/]*equipment)[^/]*(?:affinity|earth-bridge|family|fauna|hero|skill-icon|visual|wiki)[^/]*\.(?:ts|mjs)$/u,
	/^tools\/image-production-lib(?:\.spec)?\.ts$/u,
	/^tools\/[^/]*reversal-cut[^/]*\.(?:ts|mjs)$/u
] as const;

export const VISUAL_PRODUCTION_FILE_BINDING_PATH_PATTERNS = [
	/^assets\/(?:enemies|heroes|wiki)\/.*\/[^/]*manifest[^/]*\.json$/u,
	/^assets\/(?:enemies|heroes|wiki)\/.*\/(?:review|reviews)\/.*\.(?:json|html|md)$/u,
	/^assets\/(?:enemies|heroes|wiki)\/.*\/schemas\/.*\.json$/u,
	/^assets\/heroes\/.*\/(?:scripts|tests)\/.*\.(?:py|ts)$/u,
	/^apps\/web\/static\/(?:runtime\/enemies\/fauna-family-v1|wiki-media\/(?:monsters|skills))\//u,
	/^docs\/(?:affinity-wave-scheduler\.md|evidence\/fauna-family-v1\/index\.html)$/u,
	/^docs\/superpowers\/plans\/[^/]*(?:monster|skill-icon)[^/]*\.md$/u,
	/^packages\/characters\//u,
	/^packages\/(?:content\/src\/affinity-workflow|contracts\/src\/(?:character|image-production))(?:\.|\/)/u,
	/^tools\/(?![^/]*equipment)[^/]*(?:affinity|earth-bridge|family|fauna|hero|skill-icon|visual|wiki)[^/]*\.(?:ts|mjs)$/u,
	/^tools\/image-production-lib(?:\.spec)?\.ts$/u,
	/^tools\/[^/]*reversal-cut[^/]*\.(?:ts|mjs)$/u
] as const;

export const VISUAL_PRODUCTION_BINARY_PATH_PATTERNS = [
	/^assets\/(?:enemies|heroes|wiki)\/.*\.(?:png|webp)$/u,
	/^apps\/web\/static\/(?:runtime\/enemies\/fauna-family-v1|wiki-media\/(?:monsters|skills))\/.*\.(?:png|webp)$/u
] as const;

function visualDigest(serializer: IntegritySerializerId, value: unknown): string {
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
	serializer: 'image-production',
	regeneration: {
		writeCommand:
			'pnpm export:family-affinity-production && pnpm export:affinity-workflow && pnpm export:enemy-affinity-expansion && pnpm export:wiki-monsters && pnpm export:wiki-skill-visual-catalog && pnpm export:runtime-visuals && pnpm export:player-visuals && pnpm tsx tools/export-summonable-hero-runtime.ts && pnpm export:skill-icon-runtime',
		checkCommand:
			'pnpm check:family-affinity-production && pnpm validate:affinity-workflow && pnpm check:enemy-affinity-expansion-review && pnpm validate:wiki-monsters && pnpm validate:wiki-skill-visual-catalog && pnpm validate:runtime-visuals && pnpm validate:player-visuals && pnpm tsx tools/export-summonable-hero-runtime.ts --check && pnpm check:skill-icon-runtime && pnpm validate:skill-icons'
	},
	ownsPath(path) {
		return VISUAL_PRODUCTION_INTEGRITY_PATH_PATTERNS.some((pattern) => pattern.test(path));
	},
	owns(path, jsonPointer) {
		if (!this.ownsPath(path)) return false;
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
	planSuccessors(context) {
		return planTopologicalIntegritySuccessors(context, visualDigest);
	},
	verify(context) {
		return verifyTopologicalIntegritySuccessors(context, visualDigest);
	}
};
