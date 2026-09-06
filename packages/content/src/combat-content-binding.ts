import { COMBAT_SKILL_CATALOG, loadCombatSkillCatalog } from './combat-skills.js';
import {
	COMBAT_EQUIPMENT_PROFILE_CATALOG,
	loadCombatEquipmentProfileCatalog
} from './equipment.js';

export type CombatContentComponentBinding = Readonly<{
	contentVersion: string;
	contentHash: string;
}>;

export type CombatContentBinding = Readonly<{
	bindingVersion: 'combat-content-binding-v1';
	components: readonly CombatContentComponentBinding[];
	contentHash: string;
}>;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

function canonicalComponents(
	components: readonly CombatContentComponentBinding[]
): readonly CombatContentComponentBinding[] {
	return components
		.map((component) => {
			if (
				component.contentVersion.length < 1 ||
				component.contentVersion.length > 80 ||
				!/^[a-f0-9]{64}$/u.test(component.contentHash)
			) {
				throw new Error('Invalid combat content component binding');
			}
			return {
				contentVersion: component.contentVersion,
				contentHash: component.contentHash
			};
		})
		.sort(
			(left, right) =>
				left.contentVersion.localeCompare(right.contentVersion) ||
				left.contentHash.localeCompare(right.contentHash)
		);
}

export async function calculateCombatContentAggregateHash(
	components: readonly CombatContentComponentBinding[]
): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(canonicalJson(canonicalComponents(components)))
	);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const COMBAT_CONTENT_BINDING = deepFreeze<CombatContentBinding>({
	bindingVersion: 'combat-content-binding-v1',
	components: [
		{
			contentVersion: COMBAT_EQUIPMENT_PROFILE_CATALOG.contentVersion,
			contentHash: COMBAT_EQUIPMENT_PROFILE_CATALOG.contentHash
		},
		{
			contentVersion: COMBAT_SKILL_CATALOG.contentVersion,
			contentHash: COMBAT_SKILL_CATALOG.contentHash
		}
	],
	contentHash: '1abef40c18eb97d4c1694c674f9b4917f286053e6d810d5b4282760f2ab4c2a7'
});

let verifiedBinding: Promise<CombatContentBinding> | undefined;

export function loadCombatContentBinding(): Promise<CombatContentBinding> {
	verifiedBinding ??= (async () => {
		await Promise.all([loadCombatEquipmentProfileCatalog(), loadCombatSkillCatalog()]);
		const calculated = await calculateCombatContentAggregateHash(COMBAT_CONTENT_BINDING.components);
		if (calculated !== COMBAT_CONTENT_BINDING.contentHash) {
			throw new Error(
				`Combat content aggregate hash drifted: expected ${COMBAT_CONTENT_BINDING.contentHash}, calculated ${calculated}`
			);
		}
		return COMBAT_CONTENT_BINDING;
	})();
	return verifiedBinding;
}
