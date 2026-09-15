import type {
	CombatMotionPackBinding,
	CombatRasterBinding,
	ExplorationEncounterRequest
} from '@summonlab/contracts';
import { z } from 'zod';

type TrustedRasterBinding = Readonly<
	Pick<CombatRasterBinding, 'assetKey' | 'source' | 'contentHash' | 'approvalId'>
>;

type TrustedMotionPackBinding = Readonly<
	Pick<
		CombatMotionPackBinding,
		| 'motionPackId'
		| 'source'
		| 'atlasImageSource'
		| 'version'
		| 'contentHash'
		| 'atlasImageHash'
		| 'approvalId'
	>
>;

export type TrustedHeroCombatContent = Readonly<{
	heroId: string;
	characterManifestHash: string;
	combatAssetBinding: TrustedRasterBinding;
	motionPackBinding: TrustedMotionPackBinding | null;
}>;

export type TrustedEnemyCombatContent = Readonly<{
	definitionRef: Readonly<{
		enemyDefinitionId: string;
		definitionVersion: string;
		contentHash: string;
	}>;
	combatAssetBinding: TrustedRasterBinding;
	motionPackBinding: TrustedMotionPackBinding | null;
}>;

export type TrustedBattlefieldCombatContent = Readonly<{
	battlefieldId: string;
	version: string;
	contentHash: string;
	environmentAssetBinding: TrustedRasterBinding;
	occluderAssetBindings: readonly TrustedRasterBinding[];
}>;

export type CombatContentCatalog = Readonly<{
	heroes: readonly TrustedHeroCombatContent[];
	enemies: readonly TrustedEnemyCombatContent[];
	battlefields: readonly TrustedBattlefieldCombatContent[];
}>;

const ContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const TrustedRasterBindingSchema = z
	.object({
		assetKey: z.string().min(1),
		source: z.string().min(1),
		contentHash: ContentHashSchema,
		approvalId: z.string().min(1)
	})
	.strict();
const TrustedMotionPackBindingSchema = z
	.object({
		motionPackId: z.string().min(1),
		source: z.string().min(1),
		atlasImageSource: z.string().min(1),
		version: z.number().int().positive(),
		contentHash: ContentHashSchema,
		atlasImageHash: ContentHashSchema,
		approvalId: z.string().min(1)
	})
	.strict();
const CombatContentCatalogSchema = z
	.object({
		heroes: z.array(
			z
				.object({
					heroId: z.string().min(1),
					characterManifestHash: ContentHashSchema,
					combatAssetBinding: TrustedRasterBindingSchema,
					motionPackBinding: TrustedMotionPackBindingSchema.nullable()
				})
				.strict()
		),
		enemies: z.array(
			z
				.object({
					definitionRef: z
						.object({
							enemyDefinitionId: z.string().min(1),
							definitionVersion: z.string().min(1),
							contentHash: ContentHashSchema
						})
						.strict(),
					combatAssetBinding: TrustedRasterBindingSchema,
					motionPackBinding: TrustedMotionPackBindingSchema.nullable()
				})
				.strict()
		),
		battlefields: z.array(
			z
				.object({
					battlefieldId: z.string().min(1),
					version: z.string().min(1),
					contentHash: ContentHashSchema,
					environmentAssetBinding: TrustedRasterBindingSchema,
					occluderAssetBindings: z.array(TrustedRasterBindingSchema)
				})
				.strict()
		)
	})
	.strict();

export type TrustedProductionContentResolution =
	Readonly<{ kind: 'trusted' }> | Readonly<{ kind: 'untrusted'; fieldPaths: readonly string[] }>;

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

export const EMPTY_COMBAT_CONTENT_CATALOG: CombatContentCatalog = deepFreeze({
	heroes: [],
	enemies: [],
	battlefields: []
});

/**
 * Catalog construction is an application-owned bootstrap step. It clones and freezes the declared
 * expectations so session validation never reads values from a mutable caller-owned catalog.
 */
export function createCombatContentCatalog(input: unknown): CombatContentCatalog {
	return deepFreeze(CombatContentCatalogSchema.parse(structuredClone(input)));
}

function sameRasterBinding(actual: CombatRasterBinding, expected: TrustedRasterBinding): boolean {
	return (
		actual.approvalStatus === 'approved' &&
		actual.assetKey === expected.assetKey &&
		actual.source === expected.source &&
		actual.contentHash === expected.contentHash &&
		actual.approvalId === expected.approvalId
	);
}

function sameMotionPackBinding(
	actual: CombatMotionPackBinding | null,
	expected: TrustedMotionPackBinding | null
): boolean {
	if (!actual || !expected) return actual === expected;
	return (
		actual.approvalStatus === 'approved' &&
		actual.motionPackId === expected.motionPackId &&
		actual.source === expected.source &&
		actual.atlasImageSource === expected.atlasImageSource &&
		actual.version === expected.version &&
		actual.contentHash === expected.contentHash &&
		actual.atlasImageHash === expected.atlasImageHash &&
		actual.approvalId === expected.approvalId
	);
}

function pushBindingFailure(
	fieldPaths: string[],
	path: string,
	actual: {
		combatAssetBinding: CombatRasterBinding;
		motionPackBinding: CombatMotionPackBinding | null;
	},
	expected: {
		combatAssetBinding: TrustedRasterBinding;
		motionPackBinding: TrustedMotionPackBinding | null;
	}
) {
	if (!sameRasterBinding(actual.combatAssetBinding, expected.combatAssetBinding)) {
		fieldPaths.push(`${path}.presentation.combatAssetBinding`);
	}
	if (!sameMotionPackBinding(actual.motionPackBinding, expected.motionPackBinding)) {
		fieldPaths.push(`${path}.presentation.motionPackBinding`);
	}
}

/**
 * Resolves a production request against catalog expectations owned by the application. The request
 * supplies lookup keys only; it never establishes the expected identity, approval, source, or hash.
 */
export function resolveTrustedProductionContent(
	request: ExplorationEncounterRequest,
	catalog: CombatContentCatalog = EMPTY_COMBAT_CONTENT_CATALOG
): TrustedProductionContentResolution {
	const fieldPaths: string[] = [];

	for (const [index, hero] of request.party.entries()) {
		const expected = catalog.heroes.find((candidate) => candidate.heroId === hero.heroRef.heroId);
		if (!expected || expected.characterManifestHash !== hero.heroRef.characterManifestHash) {
			fieldPaths.push(`party.${index}.heroRef`);
			continue;
		}
		pushBindingFailure(fieldPaths, `party.${index}`, hero.presentation, expected);
	}

	for (const [index, enemy] of request.enemies.entries()) {
		const expected = catalog.enemies.find(
			(candidate) =>
				candidate.definitionRef.enemyDefinitionId === enemy.definitionRef.enemyDefinitionId
		);
		if (
			!expected ||
			expected.definitionRef.definitionVersion !== enemy.definitionRef.definitionVersion ||
			expected.definitionRef.contentHash !== enemy.definitionRef.contentHash
		) {
			fieldPaths.push(`enemies.${index}.definitionRef`);
			continue;
		}
		pushBindingFailure(fieldPaths, `enemies.${index}`, enemy.presentation, expected);
	}

	const battlefield = request.battlefieldBinding;
	const expectedBattlefield = catalog.battlefields.find(
		(candidate) => candidate.battlefieldId === battlefield.battlefieldId
	);
	if (
		!expectedBattlefield ||
		expectedBattlefield.version !== battlefield.version ||
		expectedBattlefield.contentHash !== battlefield.contentHash
	) {
		fieldPaths.push('battlefieldBinding');
	} else {
		if (
			!sameRasterBinding(
				battlefield.environmentAssetBinding,
				expectedBattlefield.environmentAssetBinding
			)
		) {
			fieldPaths.push('battlefieldBinding.environmentAssetBinding');
		}
		if (
			battlefield.occluderAssetBindings.length !==
				expectedBattlefield.occluderAssetBindings.length ||
			battlefield.occluderAssetBindings.some(
				(binding, index) =>
					!sameRasterBinding(binding, expectedBattlefield.occluderAssetBindings[index]!)
			)
		) {
			fieldPaths.push('battlefieldBinding.occluderAssetBindings');
		}
	}

	return fieldPaths.length === 0
		? deepFreeze({ kind: 'trusted' } as const)
		: deepFreeze({ kind: 'untrusted', fieldPaths } as const);
}
