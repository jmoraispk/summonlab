import type { ExplorationEncounterRequest } from '@summonlab/contracts';

import {
	actorCollisionPadding,
	clampToArena,
	engagementPoint,
	engagementRange,
	pushOutsideObstacle,
	routeAroundObstacle
} from './combat-spatial';

export type CombatTeam = 'heroes' | 'rats';
export type CombatPhase = 'running' | 'victory' | 'defeat';
export type CombatIntent = 'advance' | 'attack' | 'down';
type CombatPresentation = ExplorationEncounterRequest['party'][number]['presentation'];

export type RealtimeActor = {
	id: string;
	label: string;
	sourceKind: 'hero' | 'enemy';
	team: CombatTeam;
	role: 'brawler' | 'guardian' | 'archer' | 'brute' | 'swarm';
	x: number;
	y: number;
	health: number;
	maximumHealth: number;
	mana: number;
	maximumMana: number;
	speed: number;
	range: number;
	damage: number;
	attackInterval: number;
	attackIntervalTicks: number;
	attackTimer: number;
	actionDefinitionRefs: readonly string[];
	requiredForVictory: boolean;
	presentation: CombatPresentation;
	targetId?: string;
	intent: CombatIntent;
	attackPulse: number;
	hitPulse: number;
	attacksLanded: number;
	actionRevision: number;
	hitRevision: number;
	defeatRevision: number;
	velocityX: number;
	velocityY: number;
	facingX: number;
	facingY: number;
};

export type RealtimeCombatState = {
	elapsedSeconds: number;
	phase: CombatPhase;
	actors: RealtimeActor[];
	defeatedEnemies: number;
	lastEvent: string;
};

export type RealtimeMechanicsEvent = Readonly<{
	kind:
		| 'intent-selected'
		| 'movement-committed'
		| 'action-started'
		| 'action-resolved'
		| 'resource-changed'
		| 'unit-defeated';
	actorId: string;
	targetIds: readonly string[];
	actionId?: string;
	healthDeltas: readonly { unitId: string; amount: number }[];
	manaDeltas: readonly { unitId: string; amount: number }[];
	publicSummary: string;
}>;

type RealtimeCombatStep = Readonly<{
	state: RealtimeCombatState;
	events: RealtimeMechanicsEvent[];
}>;

const actor = (
	input: Omit<
		RealtimeActor,
		| 'attackTimer'
		| 'intent'
		| 'attackPulse'
		| 'hitPulse'
		| 'attacksLanded'
		| 'actionRevision'
		| 'hitRevision'
		| 'defeatRevision'
		| 'velocityX'
		| 'velocityY'
		| 'facingX'
		| 'facingY'
	>
): RealtimeActor => ({
	...input,
	attackTimer: input.id.length * 0.07,
	intent: 'advance',
	attackPulse: 0,
	hitPulse: 0,
	attacksLanded: 0,
	actionRevision: 0,
	hitRevision: 0,
	defeatRevision: 0,
	velocityX: 0,
	velocityY: 0,
	facingX: 0,
	facingY: input.team === 'heroes' ? -1 : 1
});

function actorFromHero(hero: ExplorationEncounterRequest['party'][number]): RealtimeActor {
	return actor({
		id: hero.heroRef.heroId,
		label: hero.displayName,
		sourceKind: 'hero',
		team: 'heroes',
		role: hero.capability.combatRole,
		x: hero.deployment.x,
		y: hero.deployment.y,
		health: hero.resources.health,
		maximumHealth: hero.resources.maximumHealth,
		mana: hero.resources.mana,
		maximumMana: hero.resources.maximumMana,
		speed: hero.combatProfile.movementUnitsPerSecond,
		range: hero.combatProfile.attackRange,
		damage: hero.combatProfile.attackPower,
		attackInterval: hero.combatProfile.attackIntervalTicks / 60,
		attackIntervalTicks: hero.combatProfile.attackIntervalTicks,
		actionDefinitionRefs: hero.capability.actionDefinitionRefs,
		requiredForVictory: false,
		presentation: hero.presentation
	});
}

function actorFromEnemy(enemy: ExplorationEncounterRequest['enemies'][number]): RealtimeActor {
	return actor({
		id: enemy.enemyInstanceId,
		label: enemy.displayName,
		sourceKind: 'enemy',
		team: 'rats',
		role: enemy.combatRole,
		x: enemy.deployment.x,
		y: enemy.deployment.y,
		health: enemy.resources.health,
		maximumHealth: enemy.resources.maximumHealth,
		mana: enemy.resources.mana,
		maximumMana: enemy.resources.maximumMana,
		speed: enemy.combatProfile.movementUnitsPerSecond,
		range: enemy.combatProfile.attackRange,
		damage: enemy.combatProfile.attackPower,
		attackInterval: enemy.combatProfile.attackIntervalTicks / 60,
		attackIntervalTicks: enemy.combatProfile.attackIntervalTicks,
		actionDefinitionRefs: enemy.actionDefinitionRefs,
		requiredForVictory: enemy.requiredForVictory,
		presentation: enemy.presentation
	});
}

export function createRealtimeCombat(request: ExplorationEncounterRequest): RealtimeCombatState {
	return {
		elapsedSeconds: 0,
		phase: 'running',
		defeatedEnemies: 0,
		lastEvent: 'The rat pack breaks from the ruined gate.',
		actors: [...request.party.map(actorFromHero), ...request.enemies.map(actorFromEnemy)]
	};
}

const distance = (a: RealtimeActor, b: RealtimeActor): number =>
	Math.hypot(a.x - b.x, (a.y - b.y) * 1.18);

function chooseTarget(actor: RealtimeActor, actors: RealtimeActor[]): RealtimeActor | undefined {
	const enemies = actors.filter(
		(candidate) => candidate.team !== actor.team && candidate.health > 0
	);
	if (enemies.length === 0) return undefined;
	const nearest = enemies.reduce((best, candidate) =>
		distance(actor, candidate) < distance(actor, best) ? candidate : best
	);
	const committed = enemies.find((candidate) => candidate.id === actor.targetId);
	if (committed && distance(actor, committed) <= distance(actor, nearest) * 1.35) return committed;
	return nearest;
}

function mechanicsEvent(
	kind: RealtimeMechanicsEvent['kind'],
	actorId: string,
	targetIds: readonly string[],
	publicSummary: string,
	overrides: Pick<Partial<RealtimeMechanicsEvent>, 'actionId' | 'healthDeltas' | 'manaDeltas'> = {}
): RealtimeMechanicsEvent {
	return {
		kind,
		actorId,
		targetIds,
		publicSummary,
		healthDeltas: [],
		manaDeltas: [],
		...overrides
	};
}

function applyDamage(
	source: RealtimeActor,
	target: RealtimeActor,
	damage: number,
	events: RealtimeMechanicsEvent[]
): { unitId: string; amount: number } {
	const wasAlive = target.health > 0;
	const applied = Math.min(target.health, damage);
	target.health = Math.max(0, target.health - damage);
	target.hitPulse = 1;
	target.hitRevision += 1;
	if (wasAlive && target.health === 0) {
		target.defeatRevision += 1;
		events.push(
			mechanicsEvent('unit-defeated', source.id, [target.id], `${target.label} is defeated.`, {
				healthDeltas: [{ unitId: target.id, amount: -applied }]
			})
		);
	}
	return { unitId: target.id, amount: -applied };
}

function damageTarget(
	state: RealtimeCombatState,
	source: RealtimeActor,
	target: RealtimeActor,
	events: RealtimeMechanicsEvent[]
): void {
	source.attackPulse = 1;
	source.attacksLanded += 1;
	source.actionRevision += 1;
	source.attackTimer = source.attackInterval;
	const actionId = source.actionDefinitionRefs[0];
	events.push(
		mechanicsEvent('action-started', source.id, [target.id], `${source.label} starts an action.`, {
			actionId
		})
	);

	const healthDeltas = [applyDamage(source, target, source.damage, events)];
	const targetIds = [target.id];
	if (
		source.actionDefinitionRefs.includes('saffron-arc-v1') &&
		source.attacksLanded % 3 === 0
	) {
		for (const enemy of state.actors) {
			if (enemy.team === source.team || enemy.health <= 0 || enemy.id === target.id || distance(source, enemy) > 0.2)
				continue;
			targetIds.push(enemy.id);
			healthDeltas.push(applyDamage(source, enemy, 11, events));
		}
		state.lastEvent = 'Asha releases Saffron Arc through the clustered pack.';
	} else {
		state.lastEvent = `${source.label} strikes ${target.label}.`;
	}
	events.push(
		mechanicsEvent('action-resolved', source.id, targetIds, state.lastEvent, {
			actionId,
			healthDeltas
		})
	);
	events.push(
		mechanicsEvent('resource-changed', source.id, targetIds, `${target.label} loses health.`, {
			healthDeltas
		})
	);
}

export function stepRealtimeCombat(
	previous: RealtimeCombatState,
	deltaSeconds: number
): RealtimeCombatStep {
	if (previous.phase !== 'running' || deltaSeconds <= 0) return { state: previous, events: [] };
	const state: RealtimeCombatState = {
		...previous,
		elapsedSeconds: previous.elapsedSeconds + deltaSeconds,
		actors: previous.actors.map((entry) => ({ ...entry }))
	};
	const events: RealtimeMechanicsEvent[] = [];

	for (const entry of state.actors) {
		entry.velocityX = 0;
		entry.velocityY = 0;
		entry.attackPulse = Math.max(0, entry.attackPulse - deltaSeconds * 4.8);
		entry.hitPulse = Math.max(0, entry.hitPulse - deltaSeconds * 5.8);
		entry.attackTimer -= deltaSeconds;
		if (entry.health <= 0) {
			entry.intent = 'down';
			continue;
		}

		const target = chooseTarget(entry, state.actors);
		const wasEngagedWithTarget = entry.intent === 'attack' && entry.targetId === target?.id;
		const previousTargetId = entry.targetId;
		entry.targetId = target?.id;
		if (!target) continue;
		if (entry.targetId !== previousTargetId) {
			events.push(
				mechanicsEvent('intent-selected', entry.id, [target.id], `${entry.label} selects ${target.label}.`)
			);
		}
		const facingLength = Math.hypot(target.x - entry.x, target.y - entry.y) || 1;
		entry.facingX = (target.x - entry.x) / facingLength;
		entry.facingY = (target.y - entry.y) / facingLength;
		const gap = distance(entry, target);
		const combatPosition = engagementPoint(entry, target);
		const attackReach = engagementRange(entry, target);
		const navigationGoal = routeAroundObstacle(entry, combatPosition, entry.id);
		const exitReach = attackReach * 1.18;
		if (gap > (wasEngagedWithTarget ? exitReach : attackReach)) {
			entry.intent = 'advance';
			const dx = navigationGoal.x - entry.x;
			const dy = navigationGoal.y - entry.y;
			const length = Math.hypot(dx, dy) || 1;
			const amount = Math.min(entry.speed * deltaSeconds, length);
			entry.velocityX = (dx / length) * entry.speed;
			entry.velocityY = (dy / length) * entry.speed;
			entry.x += (dx / length) * amount;
			entry.y += (dy / length) * amount;
			events.push(
				mechanicsEvent('movement-committed', entry.id, [target.id], `${entry.label} advances.`)
			);
		} else {
			entry.intent = 'attack';
			if (entry.attackTimer <= 0) damageTarget(state, entry, target, events);
		}
		const safePosition = pushOutsideObstacle(entry, actorCollisionPadding(entry));
		const boundedPosition = clampToArena(entry, safePosition);
		entry.x = boundedPosition.x;
		entry.y = boundedPosition.y;
	}

	const livingHeroes = state.actors.filter((entry) => entry.sourceKind === 'hero' && entry.health > 0);
	const livingRequiredEnemies = state.actors.filter(
		(entry) => entry.sourceKind === 'enemy' && entry.requiredForVictory && entry.health > 0
	);
	state.defeatedEnemies = state.actors.filter(
		(entry) => entry.sourceKind === 'enemy' && entry.health <= 0
	).length;
	if (livingRequiredEnemies.length === 0) {
		state.phase = 'victory';
		state.lastEvent = 'The Rat Brute falls. The surviving vermin scatter into the fog.';
	} else if (livingHeroes.length === 0) {
		state.phase = 'defeat';
		state.lastEvent = 'The threshold is lost to the plague pack.';
	}
	return { state, events };
}

export function runRealtimeCombat(
	request: ExplorationEncounterRequest,
	seconds: number,
	step = 1 / 60
): RealtimeCombatState {
	let state = createRealtimeCombat(request);
	for (let elapsed = 0; elapsed < seconds && state.phase === 'running'; elapsed += step) {
		state = stepRealtimeCombat(state, step).state;
	}
	return state;
}
