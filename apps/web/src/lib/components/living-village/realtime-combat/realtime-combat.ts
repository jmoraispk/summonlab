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

export type RealtimeActor = {
	id: string;
	label: string;
	team: CombatTeam;
	role: 'brawler' | 'guardian' | 'archer' | 'brute' | 'swarm';
	x: number;
	y: number;
	health: number;
	maximumHealth: number;
	speed: number;
	range: number;
	damage: number;
	attackInterval: number;
	attackTimer: number;
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
	defeatedRats: number;
	lastEvent: string;
};

const actor = (
	input: Omit<
		RealtimeActor,
		| 'maximumHealth'
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
	maximumHealth: input.health,
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

export function createRealtimeCombat(): RealtimeCombatState {
	return {
		elapsedSeconds: 0,
		phase: 'running',
		defeatedRats: 0,
		lastEvent: 'The rat pack breaks from the ruined gate.',
		actors: [
			actor({
				id: 'saffron-braid',
				label: 'Asha',
				team: 'heroes',
				role: 'brawler',
				x: 0.46,
				y: 0.8,
				health: 168,
				speed: 0.082,
				range: 0.075,
				damage: 19,
				attackInterval: 0.78
			}),
			actor({
				id: 'iron-guardian',
				label: 'Toma',
				team: 'heroes',
				role: 'guardian',
				x: 0.31,
				y: 0.86,
				health: 238,
				speed: 0.063,
				range: 0.08,
				damage: 14,
				attackInterval: 0.95
			}),
			actor({
				id: 'moss-archer',
				label: 'Nessa',
				team: 'heroes',
				role: 'archer',
				x: 0.66,
				y: 0.88,
				health: 126,
				speed: 0.071,
				range: 0.25,
				damage: 17,
				attackInterval: 1.08
			}),
			actor({
				id: 'rat-brute',
				label: 'Rat Brute',
				team: 'rats',
				role: 'brute',
				x: 0.52,
				y: 0.2,
				health: 242,
				speed: 0.052,
				range: 0.09,
				damage: 18,
				attackInterval: 1.2
			}),
			...[
				[0.22, 0.3],
				[0.38, 0.34],
				[0.61, 0.24],
				[0.79, 0.29]
			].map(([x, y], index) =>
				actor({
					id: `plague-rat-${index + 1}`,
					label: `Plague Rat ${index + 1}`,
					team: 'rats',
					role: 'swarm',
					x: x!,
					y: y!,
					health: 58,
					speed: 0.092,
					range: 0.062,
					damage: 9,
					attackInterval: 0.92 + index * 0.04
				})
			)
		]
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

function damageTarget(
	state: RealtimeCombatState,
	source: RealtimeActor,
	target: RealtimeActor
): void {
	const wasAlive = target.health > 0;
	target.health = Math.max(0, target.health - source.damage);
	target.hitPulse = 1;
	target.hitRevision += 1;
	source.attackPulse = 1;
	source.attacksLanded += 1;
	source.actionRevision += 1;
	source.attackTimer = source.attackInterval;
	state.lastEvent = `${source.label} strikes ${target.label}.`;
	if (wasAlive && target.health <= 0) target.defeatRevision += 1;

	if (source.id === 'saffron-braid' && source.attacksLanded % 3 === 0) {
		for (const enemy of state.actors) {
			if (enemy.team === source.team || enemy.health <= 0 || distance(source, enemy) > 0.2)
				continue;
			const wasEnemyAlive = enemy.health > 0;
			enemy.health = Math.max(0, enemy.health - 11);
			enemy.hitPulse = 1;
			enemy.hitRevision += 1;
			if (wasEnemyAlive && enemy.health <= 0) enemy.defeatRevision += 1;
		}
		state.lastEvent = 'Asha releases Saffron Arc through the clustered pack.';
	}
}

export function stepRealtimeCombat(
	previous: RealtimeCombatState,
	deltaSeconds: number
): RealtimeCombatState {
	if (previous.phase !== 'running' || deltaSeconds <= 0) return previous;
	const state: RealtimeCombatState = {
		...previous,
		elapsedSeconds: previous.elapsedSeconds + deltaSeconds,
		actors: previous.actors.map((entry) => ({ ...entry }))
	};

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
		entry.targetId = target?.id;
		if (!target) continue;
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
		} else {
			entry.intent = 'attack';
			if (entry.attackTimer <= 0) damageTarget(state, entry, target);
		}
		const safePosition = pushOutsideObstacle(entry, actorCollisionPadding(entry));
		const boundedPosition = clampToArena(entry, safePosition);
		entry.x = boundedPosition.x;
		entry.y = boundedPosition.y;
	}

	const livingHeroes = state.actors.filter((entry) => entry.team === 'heroes' && entry.health > 0);
	const livingRats = state.actors.filter((entry) => entry.team === 'rats' && entry.health > 0);
	state.defeatedRats = state.actors.filter(
		(entry) => entry.team === 'rats' && entry.health <= 0
	).length;
	if (livingRats.length === 0) {
		state.phase = 'victory';
		state.lastEvent = 'The Rat Brute falls. The surviving vermin scatter into the fog.';
	} else if (livingHeroes.length === 0) {
		state.phase = 'defeat';
		state.lastEvent = 'The threshold is lost to the plague pack.';
	}
	return state;
}

export function runRealtimeCombat(seconds: number, step = 1 / 60): RealtimeCombatState {
	let state = createRealtimeCombat();
	for (let elapsed = 0; elapsed < seconds && state.phase === 'running'; elapsed += step) {
		state = stepRealtimeCombat(state, step);
	}
	return state;
}
