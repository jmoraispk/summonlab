const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;
const CLOCK_SPEEDS = new Set([0, 1, 2, 4, 8]);

function timeMilliseconds(isoTime: string, label: string): number {
	const milliseconds = Date.parse(isoTime);
	if (!Number.isFinite(milliseconds)) throw new Error(`Invalid ${label}: ${isoTime}`);
	return milliseconds;
}

export function addGameSeconds(isoTime: string, seconds: number): string {
	if (!Number.isSafeInteger(seconds) || seconds < 0) {
		throw new Error('Game-second delta must be a nonnegative safe integer');
	}
	const milliseconds = Date.parse(isoTime);
	if (!Number.isFinite(milliseconds)) throw new Error(`Invalid game time: ${isoTime}`);
	return new Date(milliseconds + seconds * SECOND_MS).toISOString();
}

export function addGameMinutes(isoTime: string, minutes: number): string {
	if (!Number.isSafeInteger(minutes) || minutes < 0) {
		throw new Error('Game-minute delta must be a nonnegative safe integer');
	}
	const milliseconds = Date.parse(isoTime);
	if (!Number.isFinite(milliseconds)) throw new Error(`Invalid game time: ${isoTime}`);
	return new Date(milliseconds + minutes * MINUTE_MS).toISOString();
}

export function compareGameTime(left: string, right: string): number {
	const leftMilliseconds = Date.parse(left);
	const rightMilliseconds = Date.parse(right);
	if (!Number.isFinite(leftMilliseconds) || !Number.isFinite(rightMilliseconds)) {
		throw new Error('Cannot compare invalid game times');
	}
	return Math.sign(leftMilliseconds - rightMilliseconds);
}

export function gameMinutesBetween(left: string, right: string): number {
	const milliseconds = Date.parse(right) - Date.parse(left);
	if (!Number.isFinite(milliseconds)) throw new Error('Cannot subtract invalid game times');
	return milliseconds / MINUTE_MS;
}

export function projectGameTime(
	anchorGameTime: string,
	anchorRealTime: string,
	wallTime: string,
	speed: number
): string {
	if (!CLOCK_SPEEDS.has(speed)) throw new Error(`Unsupported simulation speed: ${speed}`);
	const gameMilliseconds = timeMilliseconds(anchorGameTime, 'game anchor');
	const realMilliseconds = timeMilliseconds(anchorRealTime, 'real anchor');
	const wallMilliseconds = timeMilliseconds(wallTime, 'wall time');
	const elapsedRealMilliseconds = Math.max(0, wallMilliseconds - realMilliseconds);
	return new Date(gameMilliseconds + elapsedRealMilliseconds * speed).toISOString();
}

export function realTimeForGameTime(
	anchorGameTime: string,
	anchorRealTime: string,
	gameTime: string,
	speed: number
): string | null {
	if (!CLOCK_SPEEDS.has(speed)) throw new Error(`Unsupported simulation speed: ${speed}`);
	if (speed === 0) return null;
	const gameMilliseconds = timeMilliseconds(anchorGameTime, 'game anchor');
	const targetGameMilliseconds = timeMilliseconds(gameTime, 'target game time');
	const realMilliseconds = timeMilliseconds(anchorRealTime, 'real anchor');
	const elapsedGameMilliseconds = Math.max(0, targetGameMilliseconds - gameMilliseconds);
	return new Date(realMilliseconds + elapsedGameMilliseconds / speed).toISOString();
}
