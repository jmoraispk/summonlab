import {
	CombatEquipmentProfileSchema,
	CombatSkillDefinitionSchema,
	NamedResistanceSourceSchema,
	ResistanceGrantReceiptSchema,
	type CombatEquipmentProfile,
	type CombatRulesV1,
	type CombatSkillDefinition,
	type NamedResistanceGrant,
	type NamedResistanceSource,
	type ResistanceGrantReceipt
} from '@summonlab/contracts';

import { deterministicUuid } from '../../hash.js';

export type EquipmentResistanceSourceInput = Readonly<{
	sourceInstanceId: string;
	profile: CombatEquipmentProfile;
}>;

export type PassiveSkillResistanceSourceInput = Readonly<{
	sourceInstanceId: string;
	skill: CombatSkillDefinition;
}>;

export type PhysiologyResistanceSourceInput = Readonly<{
	sourceInstanceId: string;
	source: NamedResistanceSource;
}>;

export type AuthoredResistanceSourcesInput = Readonly<{
	equipment: readonly EquipmentResistanceSourceInput[];
	passiveSkills: readonly PassiveSkillResistanceSourceInput[];
	physiology: readonly PhysiologyResistanceSourceInput[];
}>;

type NormalizedResistanceSource = Readonly<{
	receiptSourceKind: 'equipment' | 'skill' | 'physiology';
	authoredSourceId: string;
	sourceInstanceId: string;
	grants: readonly NamedResistanceGrant[];
}>;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

function validateInstanceId(sourceInstanceId: string): string {
	const validated = sourceInstanceId.trim();
	if (validated.length === 0 || validated.length > 80) {
		throw new Error('Resistance source instance ID must contain 1 through 80 characters');
	}
	return validated;
}

function normalizedSources(input: AuthoredResistanceSourcesInput): NormalizedResistanceSource[] {
	const sources: NormalizedResistanceSource[] = [];
	for (const source of input.equipment) {
		const profile = CombatEquipmentProfileSchema.parse(source.profile);
		sources.push({
			receiptSourceKind: 'equipment',
			authoredSourceId: profile.definitionId,
			sourceInstanceId: validateInstanceId(source.sourceInstanceId),
			grants: profile.resistanceGrants
		});
	}
	for (const source of input.passiveSkills) {
		const skill = CombatSkillDefinitionSchema.parse(source.skill);
		if (skill.kind !== 'passive') {
			throw new Error(`Resistance skill ${skill.skillId} must be passive`);
		}
		sources.push({
			receiptSourceKind: 'skill',
			authoredSourceId: skill.skillId,
			sourceInstanceId: validateInstanceId(source.sourceInstanceId),
			grants: skill.resistanceGrants
		});
	}
	for (const sourceInput of input.physiology) {
		const source = NamedResistanceSourceSchema.parse(sourceInput.source);
		if (source.sourceKind !== 'physiology') {
			throw new Error(`Resistance source ${source.sourceId} must be physiology`);
		}
		sources.push({
			receiptSourceKind: 'physiology',
			authoredSourceId: source.sourceId,
			sourceInstanceId: validateInstanceId(sourceInput.sourceInstanceId),
			grants: source.grants
		});
	}

	sources.sort(
		(left, right) =>
			left.receiptSourceKind.localeCompare(right.receiptSourceKind) ||
			left.authoredSourceId.localeCompare(right.authoredSourceId) ||
			left.sourceInstanceId.localeCompare(right.sourceInstanceId)
	);
	for (let index = 1; index < sources.length; index += 1) {
		const previous = sources[index - 1]!;
		const current = sources[index]!;
		if (
			previous.receiptSourceKind === current.receiptSourceKind &&
			previous.authoredSourceId === current.authoredSourceId &&
			previous.sourceInstanceId === current.sourceInstanceId
		) {
			throw new Error('Duplicate authored resistance source instance');
		}
	}
	return sources;
}

export function resistanceGrantReceiptsFromAuthoredSources(
	input: AuthoredResistanceSourcesInput,
	rules: CombatRulesV1
): readonly ResistanceGrantReceipt[] {
	const receipts = normalizedSources(input).flatMap((source) => {
		const sourceIdentityParts = [
			'resistance-source-v1',
			source.receiptSourceKind,
			source.authoredSourceId,
			source.sourceInstanceId
		] as const;
		const sourceIdentity = JSON.stringify(sourceIdentityParts);
		return [...source.grants]
			.sort((left, right) => left.tag.localeCompare(right.tag))
			.map((grant) => {
				const capBasisPoints = Math.min(grant.capBasisPoints, rules.resistance.capBasisPoints);
				return ResistanceGrantReceiptSchema.parse({
					grantId: deterministicUuid(JSON.stringify([...sourceIdentityParts, grant.tag])),
					tag: grant.tag,
					basisPoints: Math.min(grant.basisPoints, capBasisPoints),
					stackingRule: 'additive',
					capBasisPoints,
					source: {
						receiptId: deterministicUuid(sourceIdentity),
						sourceKind: source.receiptSourceKind,
						sourceId: source.authoredSourceId
					},
					rulesVersion: rules.rulesVersion
				});
			});
	});
	return deepFreeze(receipts);
}
