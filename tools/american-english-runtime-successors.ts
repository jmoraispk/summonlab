import { canonicalJson as characterCanonicalJson } from '../packages/characters/src/index.js';
import {
	canonicalJson as engineCanonicalJson,
	hashCanonical
} from '../packages/engine/src/hash.js';
import {
	digestBytes,
	digestUtf8,
	planTopologicalIntegritySuccessors,
	verifyTopologicalIntegritySuccessors,
	type AmericanEnglishIntegrityOwner,
	type IntegritySerializerId
} from './american-english-integrity-contracts.js';
import { OWNER_DIGEST_POINTER_PATTERNS } from './american-english-integrity-pointers.js';

export const RUNTIME_AND_ENGINE_INTEGRITY_PATH_PATTERNS = [
	/^apps\/web\/src\/lib\/components\/living-village\//u,
	/^apps\/web\/src\/routes\/story-patch\//u,
	/^docs\/(?:evidence\/living-village-|evidence\/phase-|private-playtest-release\.md$|system-architecture\/)/u,
	/^docs\/wiki\/mechanics\/skills\//u,
	/^packages\/content\/src\/(?:tower-|story)/u,
	/^packages\/contracts\/src\/(?:contracts\.spec\.ts$|engine\/|final-controlled-)/u,
	/^packages\/(?:engine|evaluation|policies)\//u,
	/^tools\/(?:activate-final-controlled-rerun|compose-empty-rarity-frame-v6|export-recognition-audit|export-skill-taxonomy-migration(?:\.spec)?|final-controlled-design-risk-readiness|package-playtest-release|prepare-final-controlled-rerun|report-final-controlled-activation-readiness|skill-taxonomy-lib(?:\.spec)?)\.ts$/u
] as const;

export const RUNTIME_AND_ENGINE_FILE_BINDING_PATH_PATTERNS = [
	/^apps\/web\/src\/(?:lib\/components\/living-village|routes\/story-patch)\/.*\.(?:ts|svelte)$/u,
	/^docs\/(?:evidence\/living-village-(?:tower-handoff|village-plan)\.md|private-playtest-release\.md|system-architecture\/integration-contracts\.md)$/u,
	/^packages\/content\/src\/tower-band-01-story\.ts$/u,
	/^packages\/contracts\/src\/(?:contracts\.spec\.ts|engine\/settlement-state\.ts|final-controlled-design-risk-(?:decisions|resolutions)\.ts)$/u,
	/^packages\/engine\/src\/(?:compatibility\/replay-vectors\.ts|domains\/settlement\/(?:equipment\.spec|routines)\.ts|orchestration\/(?:__snapshots__\/actions\.spec\.ts\.snap|legal-actions\.ts)|presentation(?:\.spec)?\.ts|story(?:\.spec)?\.ts)$/u,
	/^packages\/evaluation\/src\/(?:foundry|story-patch)\.ts$/u,
	/^packages\/policies\/src\/(?:index|openai(?:\.spec)?)\.ts$/u,
	/^tools\/(?:activate-final-controlled-rerun|compose-empty-rarity-frame-v6|export-recognition-audit|export-skill-taxonomy-migration(?:\.spec)?|final-controlled-design-risk-readiness|package-playtest-release|prepare-final-controlled-rerun|report-final-controlled-activation-readiness|skill-taxonomy-lib(?:\.spec)?)\.ts$/u
] as const;

function runtimeDigest(serializer: IntegritySerializerId, value: unknown): string {
	if (serializer === 'raw-file' && value instanceof Uint8Array) return digestBytes(value);
	if (serializer === 'utf8-string' && typeof value === 'string') return digestUtf8(value);
	if (serializer === 'engine') return hashCanonical(value);
	if (serializer === 'character-manifest') return digestUtf8(characterCanonicalJson(value));
	throw new Error(`Runtime-and-engine owner cannot use serializer ${serializer}`);
}

export const runtimeCanonicalSerializers = {
	engine: engineCanonicalJson,
	'character-manifest': characterCanonicalJson
} as const;

export const runtimeAndEngineIntegrityOwner: AmericanEnglishIntegrityOwner = {
	id: 'runtime-and-engine',
	intentMaterialization: {
		commands: [
			['pnpm', 'tsx', 'tools/reseal-skill-taxonomy-expectations.ts'],
			['pnpm', 'tsx', 'tools/export-skill-taxonomy-migration.ts', '--write'],
			['pnpm', 'tsx', 'tools/reseal-engine-replay-expectations.ts'],
			['pnpm', 'export:story-patch'],
			['pnpm', 'prettier', '--write', 'tools/package-playtest-release.ts']
		],
		paths: [
			'tools/package-playtest-release.ts',
			'packages/engine/src/compatibility/replay-vectors.ts',
			'docs/evidence/phase-6-runtime-story-patch.json',
			'docs/wiki/mechanics/skills/migration-v2.json',
			'tools/export-skill-taxonomy-migration.spec.ts',
			'tools/skill-taxonomy-lib.ts'
		]
	},
	regeneration: {
		writeCommand:
			'pnpm tsx tools/export-skill-taxonomy-migration.ts --write && pnpm export:story-envelope && pnpm export:story-patch && pnpm export:story-workshop && pnpm export:moderated-playtest && pnpm export:playtest-release && pnpm package:playtest -- --acknowledge-private-release',
		checkCommand:
			'pnpm tsx tools/export-skill-taxonomy-migration.ts --check && pnpm validate:story-envelope && pnpm validate:story-patch && pnpm validate:story-workshop && pnpm validate:moderated-playtest && pnpm validate:playtest-release && pnpm rehearse:playtest-package && pnpm --filter @summonlab/engine test'
	},
	serializerFor(path, kind) {
		if (kind === 'raw-file') return null;
		if (kind === 'utf8-string' || !path.endsWith('.json')) return 'utf8-string';
		return this.ownsPath(path) ? 'engine' : null;
	},
	ownsPath(path) {
		return RUNTIME_AND_ENGINE_INTEGRITY_PATH_PATTERNS.some((pattern) => pattern.test(path));
	},
	regeneratesPath(path) {
		return this.ownsPath(path);
	},
	owns(path, jsonPointer) {
		if (!this.ownsPath(path)) return false;
		if (jsonPointer === '') {
			return RUNTIME_AND_ENGINE_FILE_BINDING_PATH_PATTERNS.some((pattern) => pattern.test(path));
		}
		return OWNER_DIGEST_POINTER_PATTERNS['runtime-and-engine'].some((pattern) =>
			pattern.test(jsonPointer)
		);
	},
	digest: runtimeDigest,
	planSuccessors(context) {
		return planTopologicalIntegritySuccessors(context, runtimeDigest);
	},
	verify(context) {
		return verifyTopologicalIntegritySuccessors(context, runtimeDigest);
	}
};
