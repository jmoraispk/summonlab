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
} from './american-english-integrity.js';

export const VISUAL_PRODUCTION_INTEGRITY_PATH_PATTERNS = [
	/^assets\/(?:enemies|heroes|wiki)\//u,
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
	regeneration: {
		writeCommand:
			'pnpm export:family-affinity-production && pnpm export:affinity-workflow && pnpm export:enemy-affinity-expansion && pnpm export:wiki-monsters && pnpm export:wiki-skill-visual-catalog && pnpm export:runtime-visuals && pnpm export:player-visuals && pnpm tsx tools/export-summonable-hero-runtime.ts && pnpm export:skill-icon-runtime',
		checkCommand:
			'pnpm check:family-affinity-production && pnpm validate:affinity-workflow && pnpm check:enemy-affinity-expansion-review && pnpm validate:wiki-monsters && pnpm validate:wiki-skill-visual-catalog && pnpm validate:runtime-visuals && pnpm validate:player-visuals && pnpm tsx tools/export-summonable-hero-runtime.ts --check && pnpm check:skill-icon-runtime && pnpm validate:skill-icons'
	},
	owns(path) {
		return VISUAL_PRODUCTION_INTEGRITY_PATH_PATTERNS.some((pattern) => pattern.test(path));
	},
	planSuccessors(context) {
		return planTopologicalIntegritySuccessors(context, visualDigest);
	},
	verify(context) {
		return verifyTopologicalIntegritySuccessors(context, visualDigest);
	}
};
