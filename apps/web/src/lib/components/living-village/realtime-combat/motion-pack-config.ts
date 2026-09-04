const ART_ROOT = '/runtime/combat/realtime-study-v1';

export function createMotionPack(source: string) {
	const version = source.match(/-motion-v(\d+)\.json$/)?.[1];
	if (!version) throw new Error(`Expected a versioned motion-pack URL: ${source}`);
	return { source, version: Number(version) } as const;
}

export const REALTIME_COMBAT_MOTION = {
	asha: createMotionPack(`${ART_ROOT}/animation-canary-v1/asha/asha-motion-v2.json`),
	'iron-guardian': createMotionPack(
		`${ART_ROOT}/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.json`
	),
	'moss-archer': createMotionPack(
		`${ART_ROOT}/animation-canary-v1/moss-archer/moss-archer-motion-v2.json`
	),
	'rat-brute': createMotionPack(
		`${ART_ROOT}/animation-canary-v1/rat-brute/rat-brute-motion-v1.json`
	),
	'lesser-rat': createMotionPack(
		`${ART_ROOT}/animation-canary-v1/lesser-rat/lesser-rat-motion-v2.json`
	)
} as const;

export function motionPackVersionDiagnostic(
	motionPacks: Record<string, { source: string; version: number }>
) {
	return Object.entries(motionPacks)
		.map(([actorId, motionPack]) => `${actorId}:${motionPack.version}`)
		.join(',');
}
