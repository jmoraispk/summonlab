import {
	CombatEquipmentProfileSchema,
	CombatSkillDefinitionSchema,
	LearnedCombatSkillStateSchema,
	type CombatEquipmentProfile,
	type CombatSkillDefinition,
	type EquipmentFamilyTag,
	type EquipmentProficiencyTag,
	type LearnedCombatSkillState
} from '@summonlab/contracts';

export type CombatLoadoutInput = Readonly<{
	intrinsicMight: number;
	effectiveLoadMight: number;
	proficiencyTags: readonly EquipmentProficiencyTag[];
	equipment: readonly CombatEquipmentProfile[];
}>;

export type CombatLoadoutEvaluation = Readonly<{
	eligible: boolean;
	totalLoad: number;
	mightLoadTolerance: number;
	reasons: readonly string[];
}>;

export type LegalCombatSkillAction = Readonly<{
	skillId: string;
	displayName: string;
	kind: CombatSkillDefinition['kind'];
	deliveryTag: EquipmentFamilyTag;
	accuracyBasisPoints: number;
	reliabilityBasisPoints: number;
	refinementUnlockIds: readonly string[];
}>;

export type CombatSkillActionInput = CombatLoadoutInput &
	Readonly<{
		skills: readonly CombatSkillDefinition[];
		learnedSkills: readonly LearnedCombatSkillState[];
	}>;

function requireIntrinsicMight(might: number): number {
	if (!Number.isInteger(might) || might < 1 || might > 100) {
		throw new Error('Intrinsic Might must be an integer from 1 through 100');
	}
	return might;
}

export function mightLoadTolerance(effectiveLoadMight: number): number {
	if (!Number.isInteger(effectiveLoadMight) || effectiveLoadMight < 0) {
		throw new Error('Effective equipment-load Might must be a nonnegative integer');
	}
	return effectiveLoadMight;
}

export function evaluateCombatLoadout(input: CombatLoadoutInput): CombatLoadoutEvaluation {
	const intrinsicMight = requireIntrinsicMight(input.intrinsicMight);
	const equipment = input.equipment.map((profile) => CombatEquipmentProfileSchema.parse(profile));
	const proficiencyTags = new Set(input.proficiencyTags);
	const totalLoad = equipment.reduce((total, profile) => total + profile.load, 0);
	const tolerance = mightLoadTolerance(input.effectiveLoadMight);
	const reasons: string[] = [];

	for (const profile of equipment) {
		if (
			profile.requirements.minimumMight !== null &&
			intrinsicMight < profile.requirements.minimumMight
		) {
			reasons.push(`${profile.definitionId}:minimum-might`);
		}
		for (const proficiency of profile.requirements.proficiencyTags) {
			if (!proficiencyTags.has(proficiency)) {
				reasons.push(`${profile.definitionId}:missing-${proficiency}`);
			}
		}
	}
	if (totalLoad > tolerance) reasons.push('loadout:over-might-tolerance');

	return Object.freeze({
		eligible: reasons.length === 0,
		totalLoad,
		mightLoadTolerance: tolerance,
		reasons: Object.freeze(reasons)
	});
}

export function legalCombatSkillActions(
	input: CombatSkillActionInput
): readonly LegalCombatSkillAction[] {
	if (!evaluateCombatLoadout(input).eligible) return [];
	const equipment = input.equipment.map((profile) => CombatEquipmentProfileSchema.parse(profile));
	const equippedTags = new Set(equipment.flatMap((profile) => profile.familyTags));
	if (equippedTags.size === 0) equippedTags.add('unarmed');
	const learnedBySkillId = new Map(
		input.learnedSkills.map((state) => {
			const parsed = LearnedCombatSkillStateSchema.parse(state);
			return [parsed.skillId, parsed] as const;
		})
	);
	const actions: LegalCombatSkillAction[] = [];

	for (const skillInput of input.skills) {
		const skill = CombatSkillDefinitionSchema.parse(skillInput);
		if (skill.kind === 'passive') continue;
		const learned = learnedBySkillId.get(skill.skillId);
		if (!learned) continue;
		const trainedTags = new Set(learned.trainedDeliveryTags);
		const deliveryTag = skill.deliveryTags.find(
			(tag) => equippedTags.has(tag) && trainedTags.has(tag)
		);
		if (!deliveryTag) continue;

		const attainedSteps = skill.masteryProgression.filter(
			(step) => step.minimumMastery <= learned.mastery
		);
		const currentStep = attainedSteps.at(-1)!;
		actions.push(
			Object.freeze({
				skillId: skill.skillId,
				displayName: skill.displayName,
				kind: skill.kind,
				deliveryTag,
				accuracyBasisPoints: currentStep.accuracyBasisPoints,
				reliabilityBasisPoints: currentStep.reliabilityBasisPoints,
				refinementUnlockIds: Object.freeze(
					attainedSteps.flatMap((step) => step.refinementUnlockIds ?? [])
				)
			})
		);
	}

	return Object.freeze(actions);
}
