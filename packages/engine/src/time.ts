const MINUTE_MS = 60_000;

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
