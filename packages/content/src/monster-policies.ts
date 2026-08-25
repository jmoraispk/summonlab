import {
	MissionMonsterPolicyCatalogSchema,
	type MissionMonsterPolicyCatalog,
	type MissionMonsterPolicyDefinition
} from '@summonlab/contracts';

export const MONSTER_POLICY_CONTENT_VERSION = 'monster-policies-v1';

const source = {
	schemaVersion: 'monster-policy-catalog-v1',
	contentVersion: MONSTER_POLICY_CONTENT_VERSION,
	policies: [
		{
			policyId: 'guard-chain-court-v1',
			label: 'Guard the duty floor',
			entityLabel: 'Chain Watch',
			archetype: 'goblin',
			behavior: 'guard-duty-node',
			maximumVitality: 2,
			initiativeBase: 34,
			strikePower: 1,
			armor: { kind: 'none', reduction: 0 },
			intentSummary: 'Hold the Chain Court, strike intruders there, and ignore unseen routes.'
		},
		{
			policyId: 'protect-ember-cradle-v1',
			label: 'Protect the ember cradle',
			entityLabel: 'Ember Hauler',
			archetype: 'goblin',
			behavior: 'protect-objective',
			maximumVitality: 1,
			initiativeBase: 39,
			strikePower: 1,
			armor: { kind: 'none', reduction: 0 },
			intentSummary:
				'Raise the alarm when the cradle is threatened, then strike or pursue its carrier by open duty routes.'
		},
		{
			policyId: 'foundry-warden-v1',
			label: 'Defend the living foundry',
			entityLabel: 'Foundry Warden',
			archetype: 'construct',
			behavior: 'foundry-warden',
			maximumVitality: 18,
			initiativeBase: 55,
			strikePower: 3,
			armor: {
				kind: 'furnace-linked',
				litReduction: 3,
				coolingReduction: 1,
				quenchedReduction: 0
			},
			intentSummary:
				'Pressure the closest company member while the furnace burns, but intercept anyone operating an exposed cooling control.'
		}
	],
	contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
} as const;

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

export async function calculateMonsterPolicyContentHash(
	catalog: MissionMonsterPolicyCatalog
): Promise<string> {
	const payload: Partial<MissionMonsterPolicyCatalog> = { ...catalog };
	delete payload.contentHash;
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(canonicalJson(payload))
	);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export const MONSTER_POLICY_CATALOG = deepFreeze(MissionMonsterPolicyCatalogSchema.parse(source));

export function monsterPolicy(policyId: string): MissionMonsterPolicyDefinition {
	const policy = MONSTER_POLICY_CATALOG.policies.find(
		(candidate) => candidate.policyId === policyId
	);
	if (!policy) throw new Error(`Unknown monster policy: ${policyId}`);
	return policy;
}

let verifiedCatalog: Promise<MissionMonsterPolicyCatalog> | undefined;

export function loadMonsterPolicyCatalog(): Promise<MissionMonsterPolicyCatalog> {
	verifiedCatalog ??= (async () => {
		const contentHash = await calculateMonsterPolicyContentHash(MONSTER_POLICY_CATALOG);
		if (contentHash !== MONSTER_POLICY_CATALOG.contentHash) {
			throw new Error(
				`Monster policy content hash drifted: expected ${MONSTER_POLICY_CATALOG.contentHash}, calculated ${contentHash}`
			);
		}
		return MONSTER_POLICY_CATALOG;
	})();
	return verifiedCatalog;
}
