export type CombatCell = Readonly<{ column: number; row: number }>;

export type CombatActorKind = 'hero' | 'monster';
export type CombatActorRole =
	'blade' | 'archer' | 'mage' | 'mummy' | 'bat' | 'witch' | 'skeleton' | 'sprout';
export type CombatBeat = 'ready' | 'focus' | 'move' | 'impact' | 'settle' | 'complete';

export type CombatActorState = Readonly<{
	id: string;
	label: string;
	kind: CombatActorKind;
	role: CombatActorRole;
	cell: CombatCell;
	health: number;
	maximumHealth: number;
	status: 'active' | 'defeated';
}>;

export type CombatFeedEntry = Readonly<{
	id: string;
	actorLabel?: string;
	message: string;
	tone: 'voice' | 'system';
}>;

export type CombatReceipt = Readonly<{
	receiptId: string;
	version: 'combat-motion-proxy-v1';
	board: Readonly<{ columns: number; rows: number }>;
	actingActorId: string;
	targetActorId: string;
	actionLabel: string;
	from: CombatCell;
	to: CombatCell;
	actorsBefore: readonly CombatActorState[];
	actorsAfter: readonly CombatActorState[];
	initiativeBefore: readonly string[];
	initiativeAfter: readonly string[];
	feedBefore: readonly CombatFeedEntry[];
	feedAfter: readonly CombatFeedEntry[];
}>;

export type CombatPlaybackActor = CombatActorState &
	Readonly<{
		position: Readonly<{ column: number; row: number }>;
		recoil: number;
		downProgress: number;
	}>;

export type CombatPlaybackSnapshot = Readonly<{
	beat: CombatBeat;
	beatProgress: number;
	elapsedMs: number;
	totalDurationMs: number;
	actors: readonly CombatPlaybackActor[];
	initiativeOrder: readonly string[];
	readyActorId: string;
	selectedCell: CombatCell;
	feed: readonly CombatFeedEntry[];
	impactStrength: number;
	complete: boolean;
}>;

export const COMBAT_BEAT_DURATIONS = Object.freeze({
	focus: 560,
	move: 720,
	impact: 280,
	settle: 640
});

export const COMBAT_PLAYBACK_DURATION_MS = Object.values(COMBAT_BEAT_DURATIONS).reduce(
	(total, duration) => total + duration,
	0
);

const clamp = (value: number, minimum = 0, maximum = 1) =>
	Math.min(maximum, Math.max(minimum, value));

const easeInOutCubic = (value: number) =>
	value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

function sameCell(left: CombatCell, right: CombatCell): boolean {
	return left.column === right.column && left.row === right.row;
}

function assertReceipt(receipt: CombatReceipt): void {
	const beforeIds = new Set(receipt.actorsBefore.map((actor) => actor.id));
	const afterIds = new Set(receipt.actorsAfter.map((actor) => actor.id));
	if (
		beforeIds.size !== receipt.actorsBefore.length ||
		afterIds.size !== receipt.actorsAfter.length
	) {
		throw new Error('Combat receipt actor ids must be unique.');
	}
	if (!beforeIds.has(receipt.actingActorId) || !beforeIds.has(receipt.targetActorId)) {
		throw new Error('Combat receipt actor references must exist in the before-state.');
	}
	if (
		!sameCell(
			receipt.actorsBefore.find((actor) => actor.id === receipt.actingActorId)!.cell,
			receipt.from
		)
	) {
		throw new Error('Combat receipt origin must match the acting actor before-state.');
	}
	if (
		!sameCell(
			receipt.actorsAfter.find((actor) => actor.id === receipt.actingActorId)!.cell,
			receipt.to
		)
	) {
		throw new Error('Combat receipt destination must match the acting actor after-state.');
	}
	for (const actors of [receipt.actorsBefore, receipt.actorsAfter]) {
		const occupied = new Set<string>();
		for (const actor of actors.filter((candidate) => candidate.status === 'active')) {
			const key = `${actor.cell.column}:${actor.cell.row}`;
			if (occupied.has(key)) throw new Error(`Active combat cell ${key} is occupied twice.`);
			occupied.add(key);
		}
	}
}

function locateBeat(elapsedMs: number): {
	beat: Exclude<CombatBeat, 'ready' | 'complete'>;
	progress: number;
} {
	let cursor = 0;
	for (const beat of ['focus', 'move', 'impact', 'settle'] as const) {
		const duration = COMBAT_BEAT_DURATIONS[beat];
		if (elapsedMs < cursor + duration) {
			return { beat, progress: clamp((elapsedMs - cursor) / duration) };
		}
		cursor += duration;
	}
	return { beat: 'settle', progress: 1 };
}

export function projectCombatPlayback(
	receipt: CombatReceipt,
	elapsedMs: number,
	options: Readonly<{ started?: boolean; reducedMotion?: boolean }> = {}
): CombatPlaybackSnapshot {
	assertReceipt(receipt);
	const started = options.started ?? true;
	if (!started) {
		return {
			beat: 'ready',
			beatProgress: 0,
			elapsedMs: 0,
			totalDurationMs: COMBAT_PLAYBACK_DURATION_MS,
			actors: receipt.actorsBefore.map((actor) => ({
				...actor,
				position: actor.cell,
				recoil: 0,
				downProgress: 0
			})),
			initiativeOrder: receipt.initiativeBefore,
			readyActorId: receipt.actingActorId,
			selectedCell: receipt.from,
			feed: receipt.feedBefore,
			impactStrength: 0,
			complete: false
		};
	}

	const clampedElapsed = options.reducedMotion
		? COMBAT_PLAYBACK_DURATION_MS
		: clamp(elapsedMs, 0, COMBAT_PLAYBACK_DURATION_MS);
	const complete = clampedElapsed >= COMBAT_PLAYBACK_DURATION_MS;
	const located = locateBeat(clampedElapsed);
	const beat: CombatBeat = complete ? 'complete' : located.beat;
	const moveProgress =
		located.beat === 'focus' ? 0 : located.beat === 'move' ? easeInOutCubic(located.progress) : 1;
	const impactStrength = located.beat === 'impact' ? Math.sin(located.progress * Math.PI) : 0;
	const settled = located.beat === 'settle' || complete;
	const afterById = new Map(receipt.actorsAfter.map((actor) => [actor.id, actor]));

	const actors = receipt.actorsBefore.map<CombatPlaybackActor>((actor) => {
		const after = afterById.get(actor.id)!;
		if (actor.id === receipt.actingActorId) {
			return {
				...after,
				position: {
					column: actor.cell.column + (after.cell.column - actor.cell.column) * moveProgress,
					row: actor.cell.row + (after.cell.row - actor.cell.row) * moveProgress
				},
				recoil: 0,
				downProgress: 0
			};
		}
		if (actor.id === receipt.targetActorId) {
			return {
				...(settled ? after : actor),
				position: actor.cell,
				recoil: impactStrength,
				downProgress:
					located.beat === 'settle' ? easeInOutCubic(located.progress) : complete ? 1 : 0
			};
		}
		return { ...(settled ? after : actor), position: after.cell, recoil: 0, downProgress: 0 };
	});

	return {
		beat,
		beatProgress: complete ? 1 : located.progress,
		elapsedMs: clampedElapsed,
		totalDurationMs: COMBAT_PLAYBACK_DURATION_MS,
		actors,
		initiativeOrder: settled ? receipt.initiativeAfter : receipt.initiativeBefore,
		readyActorId: (settled ? receipt.initiativeAfter : receipt.initiativeBefore)[0]!,
		selectedCell: settled ? receipt.to : receipt.from,
		feed: settled && located.progress >= 0.42 ? receipt.feedAfter : receipt.feedBefore,
		impactStrength,
		complete
	};
}

const actorsBefore: readonly CombatActorState[] = [
	{
		id: 'lyra',
		label: 'Lyra',
		kind: 'hero',
		role: 'archer',
		cell: { column: 1, row: 7 },
		health: 82,
		maximumHealth: 82,
		status: 'active'
	},
	{
		id: 'mara',
		label: 'Mara',
		kind: 'hero',
		role: 'blade',
		cell: { column: 3, row: 7 },
		health: 96,
		maximumHealth: 96,
		status: 'active'
	},
	{
		id: 'iven',
		label: 'Iven',
		kind: 'hero',
		role: 'mage',
		cell: { column: 5, row: 7 },
		health: 71,
		maximumHealth: 71,
		status: 'active'
	},
	{
		id: 'mummy_01',
		label: 'Ash Mummy',
		kind: 'monster',
		role: 'mummy',
		cell: { column: 1, row: 2 },
		health: 44,
		maximumHealth: 44,
		status: 'active'
	},
	{
		id: 'bat_01',
		label: 'Moon Bat',
		kind: 'monster',
		role: 'bat',
		cell: { column: 3, row: 2 },
		health: 31,
		maximumHealth: 31,
		status: 'active'
	},
	{
		id: 'witch_01',
		label: 'Lamp Witch',
		kind: 'monster',
		role: 'witch',
		cell: { column: 5, row: 2 },
		health: 38,
		maximumHealth: 38,
		status: 'active'
	},
	{
		id: 'skeleton_01',
		label: 'Bone Guard',
		kind: 'monster',
		role: 'skeleton',
		cell: { column: 1, row: 4 },
		health: 52,
		maximumHealth: 52,
		status: 'active'
	},
	{
		id: 'goblin_02',
		label: 'Sprout Goblin',
		kind: 'monster',
		role: 'sprout',
		cell: { column: 5, row: 4 },
		health: 26,
		maximumHealth: 26,
		status: 'active'
	}
];

const actorsAfter: readonly CombatActorState[] = actorsBefore.map((actor) =>
	actor.id === 'mara'
		? { ...actor, cell: { column: 4, row: 4 } }
		: actor.id === 'goblin_02'
			? { ...actor, health: 0, status: 'defeated' }
			: actor
);

const feedBefore: readonly CombatFeedEntry[] = [
	{ id: 'feed-1', actorLabel: 'Iven', message: 'Holding the center.', tone: 'voice' },
	{ id: 'feed-2', actorLabel: 'Lyra', message: 'I’ll cover the left.', tone: 'voice' },
	{ id: 'feed-3', actorLabel: 'Mara', message: 'I see an opening.', tone: 'voice' }
];

const feedAfter: readonly CombatFeedEntry[] = [
	{ id: 'feed-2', actorLabel: 'Lyra', message: 'I’ll cover the left.', tone: 'voice' },
	{ id: 'feed-3', actorLabel: 'Mara', message: 'I see an opening.', tone: 'voice' },
	{
		id: 'feed-4',
		message: 'hero_04 used Fleeting Step → flanked goblin_02 → Opening → critical → goblin_02 died',
		tone: 'system'
	}
];

export const PROXY_COMBAT_RECEIPT: CombatReceipt = Object.freeze({
	receiptId: 'receipt-observatory-opening-v1',
	version: 'combat-motion-proxy-v1',
	board: { columns: 7, rows: 9 },
	actingActorId: 'mara',
	targetActorId: 'goblin_02',
	actionLabel: 'Fleeting Step',
	from: { column: 3, row: 7 },
	to: { column: 4, row: 4 },
	actorsBefore,
	actorsAfter,
	initiativeBefore: [
		'mara',
		'lyra',
		'iven',
		'bat_01',
		'witch_01',
		'goblin_02',
		'mummy_01',
		'skeleton_01'
	],
	initiativeAfter: ['lyra', 'iven', 'bat_01', 'witch_01', 'mummy_01', 'skeleton_01', 'mara'],
	feedBefore,
	feedAfter
});
