import {
	ENCOUNTER_CAP,
	FIXTURE_VERSION,
	HUNT_SEED,
	INVENTORY_CAPACITY,
	type Affinity,
	type FloorFixture,
	type HealthThreshold,
	type HeroFixture,
	type SpeciesFixture
} from './tower-fixtures';

export type ResourceState = {
	unitId: HeroFixture['id'];
	health: number;
	maxHealth: number;
	mana: number;
	maxMana: number;
};

export type Contribution = { label: string; value: string };

export type CombatEvent = {
	id: string;
	tick: number;
	actorId: string;
	actorName: string;
	targetId?: string;
	targetName?: string;
	verb: 'TELEGRAPH' | 'SKILL' | 'STRIKE' | 'STATUS' | 'VICTORY' | 'DEFEAT';
	title: string;
	detail: string;
	healthDelta?: number;
	manaDelta?: number;
	status?: string;
	contributions: Contribution[];
};

export type MaterialClaim = {
	claimId: string;
	materialId: string;
	name: string;
	quantity: number;
	sourceUnitId: string;
	sourceEventId: string;
};

export type SkillUse = { skillId: string; skillName: string; uses: number };

export type CombatReceipt = {
	schemaVersion: 'living-village-combat-receipt-proposal-v0';
	receiptId: string;
	requestId: string;
	huntId: string;
	encounterIndex: number;
	attemptId: string;
	fixtureStatus: 'presentation-fixture-not-final-math';
	rulesVersion: typeof FIXTURE_VERSION;
	seedPurposeRef: string;
	floorRef: { floorId: string; definitionVersion: string; contentHash: string };
	encounterRef: {
		encounterId: string;
		speciesId: SpeciesFixture['id'];
		definitionVersion: string;
		contentHash: string;
	};
	partySnapshotRef: {
		partyId: string;
		revision: number;
		snapshotHash: string;
		heroIds: HeroFixture['id'][];
	};
	startedAtTick: number;
	endedAtTick: number;
	outcome: 'victory' | 'defeat';
	choiceLog: { actorId: string; actionId: string; rationale: string }[];
	events: CombatEvent[];
	perUnit: {
		unitId: string;
		initiativeOrder: number[];
		damageDealt: number;
		damageTaken: number;
		manaSpent: number;
		manaRecovered: number;
		statusesApplied: string[];
		skillUses: SkillUse[];
		downed: boolean;
	}[];
	finalResources: ResourceState[];
	decisiveCause: { code: string; summary: string; supportingEventIds: string[] };
	progressionClaims: { heroId: HeroFixture['id']; levelXp: number; skillUses: SkillUse[] }[];
	materialClaims: MaterialClaim[];
	inputStateHash: string;
	outputStateHash: string;
	traceHash: string;
};

export type ReturnReasonCode =
	| 'encounter-defeat'
	| 'health-threshold'
	| 'inventory-capacity'
	| 'encounter-cap'
	| 'next-encounter-unsafe';

export type HuntFixtureSpec = {
	floor: FloorFixture;
	speciesPool: SpeciesFixture[];
	party: HeroFixture[];
	threshold: HealthThreshold;
	seed?: string;
	inventoryCapacity?: number;
	encounterCap?: number;
};

export type HuntFixtureResult = {
	huntId: string;
	seed: string;
	selectedThreshold: HealthThreshold;
	inventoryCapacity: number;
	encounterCap: number;
	combatReceipts: CombatReceipt[];
	encountersCompleted: number;
	speciesKills: number;
	speciesKillCounts: { speciesId: SpeciesFixture['id']; name: string; quantity: number }[];
	levelXpClaims: { heroId: HeroFixture['id']; amount: number }[];
	practicalSkillClaims: { heroId: HeroFixture['id']; skillName: string; uses: number }[];
	materialHaul: { materialId: string; name: string; quantity: number }[];
	inventoryUsed: number;
	finalResources: ResourceState[];
	returnReason: { code: ReturnReasonCode; summary: string; supportingReceiptIds: string[] };
	contributingReturnReasons: ReturnReasonCode[];
	firstClearClaim?: string;
	unlockedFloorClaim?: number;
	trainingEligibleHeroIds: HeroFixture['id'][];
	inputStateHash: string;
	outputStateHash: string;
	haulHash: string;
};

function stableHash(input: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

function canonical(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
		.join(',')}}`;
}

export function fixtureRoll(
	seed: string,
	encounterIndex: number,
	tick: number,
	actorId: string,
	purpose: 'ENCOUNTER' | 'INITIATIVE' | 'HIT' | 'CRIT' | 'STATUS' | 'DROP' | 'REWARD',
	sequence: number
): number {
	return Number.parseInt(
		stableHash(`${seed}|${encounterIndex}|${tick}|${actorId}|${purpose}|${sequence}`),
		16
	);
}

function speciesForEncounter(
	speciesPool: SpeciesFixture[],
	seed: string,
	floor: FloorFixture,
	encounterIndex: number
): SpeciesFixture {
	if (speciesPool.length === 0) throw new Error('A floor exploration requires known species.');
	const index = fixtureRoll(seed, encounterIndex, 0, floor.id, 'ENCOUNTER', 0) % speciesPool.length;
	return speciesPool[index]!;
}

const OVERCOMES: Record<Affinity, Affinity> = {
	Wood: 'Earth',
	Fire: 'Metal',
	Earth: 'Water',
	Metal: 'Wood',
	Water: 'Fire'
};

const FEEDS: Record<Affinity, Affinity> = {
	Wood: 'Fire',
	Fire: 'Earth',
	Earth: 'Metal',
	Metal: 'Water',
	Water: 'Wood'
};

function affinityEffect(
	attacker: Affinity,
	defender: Affinity
): {
	multiplier: number;
	label: string;
	manaRecovery: number;
} {
	if (OVERCOMES[attacker] === defender) {
		return { multiplier: 1.25, label: `${attacker} overcomes ${defender} ×1.25`, manaRecovery: 0 };
	}
	if (OVERCOMES[defender] === attacker) {
		return {
			multiplier: 0.8,
			label: `${attacker} is overcome by ${defender} ×0.80`,
			manaRecovery: 0
		};
	}
	if (FEEDS[attacker] === defender) {
		return { multiplier: 0.7, label: `${attacker} feeds ${defender} ×0.70`, manaRecovery: 0 };
	}
	if (FEEDS[defender] === attacker) {
		return { multiplier: 1, label: `${attacker} is fed by ${defender} ×1.00`, manaRecovery: 3 };
	}
	if (attacker === defender) {
		return { multiplier: 0.55, label: `Same ${attacker} affinity ×0.55`, manaRecovery: 4 };
	}
	return { multiplier: 1, label: 'Neutral affinity ×1.00', manaRecovery: 0 };
}

function initialResources(party: HeroFixture[]): ResourceState[] {
	return party.map((hero) => ({
		unitId: hero.id,
		health: hero.maxHealth,
		maxHealth: hero.maxHealth,
		mana: hero.maxMana,
		maxMana: hero.maxMana
	}));
}

function encounterDamage(
	species: SpeciesFixture,
	floor: FloorFixture,
	encounterIndex: number
): number {
	return species.baseDamage + floor.number + encounterIndex * 2;
}

function nextEncounterUnsafe(
	resources: ResourceState[],
	species: SpeciesFixture,
	floor: FloorFixture,
	nextEncounterIndex: number
): boolean {
	const projectedUpperBound = encounterDamage(species, floor, nextEncounterIndex) + 6;
	return resources.some((resource) => resource.health - projectedUpperBound <= 0);
}

function simulateEncounter(args: {
	floor: FloorFixture;
	species: SpeciesFixture;
	party: HeroFixture[];
	resources: ResourceState[];
	seed: string;
	huntId: string;
	encounterIndex: number;
}): CombatReceipt {
	const { floor, species, party, seed, huntId, encounterIndex } = args;
	const inputResources = args.resources.map((resource) => ({ ...resource }));
	const finalResources = args.resources.map((resource) => ({ ...resource }));
	const enemyId = `${species.id}-${encounterIndex}`;
	let enemyHealth = species.baseHealth + floor.number * 4 + encounterIndex;
	const events: CombatEvent[] = [];
	const choiceLog: CombatReceipt['choiceLog'] = [];
	const heroDamage = new Map<string, number>();
	const heroTaken = new Map<string, number>();
	const heroManaSpent = new Map<string, number>();
	const heroManaRecovered = new Map<string, number>();
	const heroStatuses = new Map<string, string[]>();

	const initiatives = [
		...party.map((hero, sequence) => ({
			id: hero.id,
			initiative:
				hero.agility * 4 +
				(fixtureRoll(seed, encounterIndex, 0, hero.id, 'INITIATIVE', sequence) % 13),
			hero
		})),
		{
			id: enemyId,
			initiative:
				species.baseAgility * 4 +
				(fixtureRoll(seed, encounterIndex, 0, enemyId, 'INITIATIVE', 0) % 13),
			hero: null
		}
	].sort((left, right) => right.initiative - left.initiative || left.id.localeCompare(right.id));

	events.push({
		id: `${huntId}-e${encounterIndex}-telegraph`,
		tick: 0,
		actorId: enemyId,
		actorName: species.name,
		verb: 'TELEGRAPH',
		title: `${species.role} telegraph`,
		detail: `${species.name} declares its next pressure line before initiative resolves.`,
		contributions: [
			{ label: 'Encounter scaling', value: `Floor ${floor.number} · repeat ${encounterIndex}` },
			{
				label: 'Fixture initiative',
				value: `${initiatives.find((item) => item.id === enemyId)!.initiative}`
			}
		]
	});

	for (const [order, actor] of initiatives.entries()) {
		const tick = order + 1;
		if (actor.hero) {
			const hero = actor.hero;
			const resource = finalResources.find((candidate) => candidate.unitId === hero.id)!;
			if (resource.health <= 0 || enemyHealth <= 0) continue;
			const affinity = affinityEffect(hero.affinity, species.affinity);
			const critical = fixtureRoll(seed, encounterIndex, tick, hero.id, 'CRIT', 0) % 100 < 18;
			const criticalMultiplier = critical ? 1.45 : 1;
			const mitigation = Math.min(0.24, 0.09 + floor.number * 0.008);
			const damage = Math.max(
				1,
				Math.round(
					hero.skill.base *
						(1 + hero.skill.attributeScale) *
						(1 + hero.skill.equipmentBonus) *
						affinity.multiplier *
						criticalMultiplier *
						(1 - mitigation)
				)
			);
			const manaBefore = resource.mana;
			resource.mana = Math.max(
				0,
				Math.min(resource.maxMana, resource.mana - hero.skill.manaCost + affinity.manaRecovery)
			);
			enemyHealth = Math.max(0, enemyHealth - damage);
			heroDamage.set(hero.id, (heroDamage.get(hero.id) ?? 0) + damage);
			heroManaSpent.set(hero.id, hero.skill.manaCost);
			heroManaRecovered.set(hero.id, affinity.manaRecovery);
			const statusApplied =
				fixtureRoll(seed, encounterIndex, tick, hero.id, 'STATUS', 0) % 100 < 56;
			if (statusApplied) heroStatuses.set(hero.id, [hero.skill.status]);
			choiceLog.push({
				actorId: hero.id,
				actionId: hero.skill.id,
				rationale: `Scripted fixture: use ${hero.skill.name} on the selected hunt species.`
			});
			events.push({
				id: `${huntId}-e${encounterIndex}-a${order}`,
				tick,
				actorId: hero.id,
				actorName: hero.name,
				targetId: enemyId,
				targetName: species.name,
				verb: 'SKILL',
				title: hero.skill.name,
				detail: `${damage} damage${critical ? ' · critical' : ''}${statusApplied ? ` · ${hero.skill.status} applied` : ''}.`,
				healthDelta: -damage,
				manaDelta: resource.mana - manaBefore,
				status: statusApplied ? hero.skill.status : undefined,
				contributions: [
					{ label: 'Skill base', value: `${hero.skill.base}` },
					{ label: 'Attributes', value: `+${Math.round(hero.skill.attributeScale * 100)}%` },
					{ label: 'Equipment', value: `+${Math.round(hero.skill.equipmentBonus * 100)}%` },
					{ label: 'Affinity', value: affinity.label },
					{ label: 'Critical', value: critical ? '×1.45' : '×1.00' },
					{ label: 'Mitigation', value: `−${Math.round(mitigation * 100)}%` }
				]
			});
		} else {
			const livingTargets = finalResources.filter((resource) => resource.health > 0);
			if (livingTargets.length === 0 || enemyHealth <= 0) continue;
			const targetIndex =
				fixtureRoll(seed, encounterIndex, tick, enemyId, 'HIT', 0) % livingTargets.length;
			const target = livingTargets[targetIndex]!;
			const targetHero = party.find((hero) => hero.id === target.unitId)!;
			const rawDamage = encounterDamage(species, floor, encounterIndex);
			const damage = Math.max(1, rawDamage - targetHero.armour);
			target.health = Math.max(0, target.health - damage);
			heroTaken.set(target.unitId, (heroTaken.get(target.unitId) ?? 0) + damage);
			choiceLog.push({
				actorId: enemyId,
				actionId: `${species.id}-pressure-v0`,
				rationale: `Known ${species.role.toLowerCase()} pattern targets the exposed party member.`
			});
			events.push({
				id: `${huntId}-e${encounterIndex}-a${order}`,
				tick,
				actorId: enemyId,
				actorName: species.name,
				targetId: target.unitId,
				targetName: targetHero.name,
				verb: 'STRIKE',
				title: species.role,
				detail: `${damage} Health lost after ${targetHero.armour} armour.`,
				healthDelta: -damage,
				status: species.affinity === 'Fire' ? 'Burn pressure' : undefined,
				contributions: [
					{ label: 'Species power', value: `${species.baseDamage}` },
					{ label: 'Floor scaling', value: `+${floor.number}` },
					{ label: 'Repeat pressure', value: `+${encounterIndex * 2}` },
					{ label: 'Hero armour', value: `−${targetHero.armour}` }
				]
			});
		}
	}

	const outcome = enemyHealth <= 0 ? 'victory' : 'defeat';
	const decisiveEventId = `${huntId}-e${encounterIndex}-result`;
	events.push({
		id: decisiveEventId,
		tick: initiatives.length + 1,
		actorId: outcome === 'victory' ? 'party' : enemyId,
		actorName: outcome === 'victory' ? 'Hunt party' : species.name,
		verb: outcome === 'victory' ? 'VICTORY' : 'DEFEAT',
		title: outcome === 'victory' ? 'Formation held' : 'Pressure exceeded the party',
		detail:
			outcome === 'victory'
				? 'Three skill actions overcame the target before its repeat pressure could compound.'
				: 'The selected species retained Health after the party action cycle.',
		contributions: [
			{ label: 'Enemy remaining Health', value: `${enemyHealth}` },
			{ label: 'Action order', value: initiatives.map((item) => item.id).join(' → ') }
		]
	});

	const materialClaims: MaterialClaim[] =
		outcome === 'victory'
			? species.materials.map((material, sequence) => {
					const range = material.maximum - material.minimum + 1;
					const quantity =
						material.minimum +
						(fixtureRoll(seed, encounterIndex, 9, enemyId, 'DROP', sequence) % range);
					return {
						claimId: `${huntId}-e${encounterIndex}-${material.id}`,
						materialId: material.id,
						name: material.name,
						quantity,
						sourceUnitId: enemyId,
						sourceEventId: decisiveEventId
					};
				})
			: [];

	const inputStateHash = stableHash(canonical(inputResources));
	const outputStateHash = stableHash(canonical(finalResources));
	const traceHash = stableHash(canonical(events));
	const receiptId = `combat-${stableHash(`${huntId}|${encounterIndex}|${traceHash}`)}`;
	const partyHash = stableHash(canonical(party.map((hero) => hero.id)));
	const xp = outcome === 'victory' ? 8 + floor.number * 2 : 0;

	return {
		schemaVersion: 'living-village-combat-receipt-proposal-v0',
		receiptId,
		requestId: `request-${stableHash(`${huntId}|${encounterIndex}`)}`,
		huntId,
		encounterIndex,
		attemptId: `${huntId}-encounter-${encounterIndex}`,
		fixtureStatus: 'presentation-fixture-not-final-math',
		rulesVersion: FIXTURE_VERSION,
		seedPurposeRef: `${seed}:encounter:${encounterIndex}`,
		floorRef: {
			floorId: floor.id,
			definitionVersion: 'living-village-floor-fixture-v0',
			contentHash: stableHash(canonical(floor))
		},
		encounterRef: {
			encounterId: `${floor.id}-${species.id}-hunt`,
			speciesId: species.id,
			definitionVersion: 'living-village-species-fixture-v0',
			contentHash: stableHash(canonical(species))
		},
		partySnapshotRef: {
			partyId: 'living-village-party-01',
			revision: 1,
			snapshotHash: partyHash,
			heroIds: party.map((hero) => hero.id)
		},
		startedAtTick: 0,
		endedAtTick: initiatives.length + 1,
		outcome,
		choiceLog,
		events,
		perUnit: party.map((hero) => ({
			unitId: hero.id,
			initiativeOrder: [initiatives.findIndex((item) => item.id === hero.id) + 1],
			damageDealt: heroDamage.get(hero.id) ?? 0,
			damageTaken: heroTaken.get(hero.id) ?? 0,
			manaSpent: heroManaSpent.get(hero.id) ?? 0,
			manaRecovered: heroManaRecovered.get(hero.id) ?? 0,
			statusesApplied: heroStatuses.get(hero.id) ?? [],
			skillUses: [{ skillId: hero.skill.id, skillName: hero.skill.name, uses: 1 }],
			downed: finalResources.find((resource) => resource.unitId === hero.id)!.health <= 0
		})),
		finalResources,
		decisiveCause: {
			code: outcome === 'victory' ? 'party-action-cycle' : 'species-health-remained',
			summary:
				outcome === 'victory'
					? 'The party completed three complementary skill actions before repeat pressure compounded.'
					: `${species.name} survived the party action cycle and ended the encounter.`,
			supportingEventIds: [decisiveEventId]
		},
		progressionClaims: party.map((hero) => ({
			heroId: hero.id,
			levelXp: xp,
			skillUses: [{ skillId: hero.skill.id, skillName: hero.skill.name, uses: 1 }]
		})),
		materialClaims,
		inputStateHash,
		outputStateHash,
		traceHash
	};
}

function reasonSummary(
	code: ReturnReasonCode,
	threshold: HealthThreshold,
	lowestHero?: { name: string; percent: number }
): string {
	switch (code) {
		case 'encounter-defeat':
			return 'The party lost the representative encounter. Living Village returns every hero safely.';
		case 'health-threshold':
			return `${lowestHero?.name ?? 'A hero'} ended a complete encounter at ${lowestHero?.percent ?? threshold}% Health, at or below the selected ${threshold}% return threshold. The check happened after that encounter.`;
		case 'inventory-capacity':
			return 'The material inventory reached its fixture capacity, so the party returned with the haul.';
		case 'encounter-cap':
			return 'The bounded fixture encounter cap was reached.';
		case 'next-encounter-unsafe':
			return 'The next encounter upper-bound projection could reduce a hero to 0 Health.';
	}
}

export function simulateHunt(spec: HuntFixtureSpec): HuntFixtureResult {
	const seed = spec.seed ?? HUNT_SEED;
	const inventoryCapacity = spec.inventoryCapacity ?? INVENTORY_CAPACITY;
	const encounterCap = spec.encounterCap ?? ENCOUNTER_CAP;
	const speciesPoolKey = spec.speciesPool.map((species) => species.id).join(',');
	const huntId = `hunt-${stableHash(`${seed}|${spec.floor.id}|${speciesPoolKey}|${spec.threshold}`)}`;
	let resources = initialResources(spec.party);
	const inputStateHash = stableHash(canonical({ spec, resources }));
	const receipts: CombatReceipt[] = [];
	const haul = new Map<string, { materialId: string; name: string; quantity: number }>();
	let inventoryUsed = 0;
	let returnCode: ReturnReasonCode | undefined;
	let contributing: ReturnReasonCode[] = [];

	for (let encounterIndex = 1; encounterIndex <= encounterCap; encounterIndex += 1) {
		const species = speciesForEncounter(spec.speciesPool, seed, spec.floor, encounterIndex);
		const receipt = simulateEncounter({
			floor: spec.floor,
			species,
			party: spec.party,
			resources,
			seed,
			huntId,
			encounterIndex
		});
		receipts.push(receipt);
		resources = receipt.finalResources.map((resource) => ({ ...resource }));

		for (const claim of receipt.materialClaims) {
			const accepted = Math.min(claim.quantity, inventoryCapacity - inventoryUsed);
			if (accepted <= 0) break;
			const current = haul.get(claim.materialId) ?? {
				materialId: claim.materialId,
				name: claim.name,
				quantity: 0
			};
			current.quantity += accepted;
			haul.set(claim.materialId, current);
			inventoryUsed += accepted;
		}

		const lowest = resources
			.map((resource) => ({
				resource,
				percent: Math.round((resource.health / resource.maxHealth) * 100)
			}))
			.sort((left, right) => left.percent - right.percent)[0]!;
		const conditions: ReturnReasonCode[] = [];
		if (receipt.outcome === 'defeat') conditions.push('encounter-defeat');
		if (lowest.percent <= spec.threshold) conditions.push('health-threshold');
		if (inventoryUsed >= inventoryCapacity) conditions.push('inventory-capacity');
		if (encounterIndex >= encounterCap) conditions.push('encounter-cap');
		if (
			receipt.outcome === 'victory' &&
			nextEncounterUnsafe(
				resources,
				speciesForEncounter(spec.speciesPool, seed, spec.floor, encounterIndex + 1),
				spec.floor,
				encounterIndex + 1
			)
		) {
			conditions.push('next-encounter-unsafe');
		}

		if (conditions.length > 0) {
			returnCode = conditions[0];
			contributing = conditions.slice(1);
			break;
		}
	}

	returnCode ??= 'encounter-cap';
	const lowest = resources
		.map((resource) => ({
			name: spec.party.find((hero) => hero.id === resource.unitId)!.name,
			percent: Math.round((resource.health / resource.maxHealth) * 100)
		}))
		.sort((left, right) => left.percent - right.percent)[0];
	const speciesKills = receipts.filter((receipt) => receipt.outcome === 'victory').length;
	const speciesKillCounts = spec.speciesPool
		.map((species) => ({
			speciesId: species.id,
			name: species.name,
			quantity: receipts.filter(
				(receipt) => receipt.outcome === 'victory' && receipt.encounterRef.speciesId === species.id
			).length
		}))
		.filter((entry) => entry.quantity > 0);
	const levelXpClaims = spec.party.map((hero) => ({
		heroId: hero.id,
		amount: receipts.reduce(
			(total, receipt) =>
				total + (receipt.progressionClaims.find((claim) => claim.heroId === hero.id)?.levelXp ?? 0),
			0
		)
	}));
	const practicalSkillClaims = spec.party.map((hero) => ({
		heroId: hero.id,
		skillName: hero.skill.name,
		uses: receipts.filter((receipt) => receipt.outcome === 'victory').length
	}));
	const materialHaul = [...haul.values()].sort((left, right) =>
		left.materialId.localeCompare(right.materialId)
	);
	const supportingReceiptIds = receipts.length > 0 ? [receipts.at(-1)!.receiptId] : [];
	const outputStateHash = stableHash(canonical(resources));
	const haulHash = stableHash(canonical({ materialHaul, levelXpClaims, practicalSkillClaims }));

	return {
		huntId,
		seed,
		selectedThreshold: spec.threshold,
		inventoryCapacity,
		encounterCap,
		combatReceipts: receipts,
		encountersCompleted: receipts.length,
		speciesKills,
		speciesKillCounts,
		levelXpClaims,
		practicalSkillClaims,
		materialHaul,
		inventoryUsed,
		finalResources: resources,
		returnReason: {
			code: returnCode,
			summary: reasonSummary(returnCode, spec.threshold, lowest),
			supportingReceiptIds
		},
		contributingReturnReasons: contributing,
		firstClearClaim:
			spec.floor.state === 'frontier' && speciesKills > 0 ? spec.floor.firstClearReward : undefined,
		unlockedFloorClaim:
			spec.floor.state === 'frontier' && speciesKills > 0 ? spec.floor.number + 1 : undefined,
		trainingEligibleHeroIds: resources
			.filter((resource) => resource.health > 0)
			.map((resource) => resource.unitId),
		inputStateHash,
		outputStateHash,
		haulHash
	};
}
