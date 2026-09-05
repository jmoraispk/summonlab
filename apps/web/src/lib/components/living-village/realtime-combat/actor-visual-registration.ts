import type { CombatClip } from './actor-animator';
import type { RealtimeActor } from './realtime-combat';

export type ActorVisualRegistration = Readonly<{
	bodyOffsetY: number;
	shadowRadiusX: number;
	shadowRadiusY: number;
}>;

function bodyOffsetY(actorId: string, clip: CombatClip): number {
	if (clip === 'down') return 0;
	if (actorId === 'moss-archer') return clip === 'idle' ? -10 : -4;
	if (actorId === 'iron-guardian') return -3;
	return 0;
}

export function actorVisualRegistration(
	actorId: string,
	role: RealtimeActor['role'],
	clip: CombatClip
): ActorVisualRegistration {
	const defaultShadowRadiusX = role === 'brute' ? 72 : role === 'swarm' ? 29 : 45;

	return {
		bodyOffsetY: bodyOffsetY(actorId, clip),
		shadowRadiusX: actorId === 'iron-guardian' ? 39 : defaultShadowRadiusX,
		shadowRadiusY: actorId === 'iron-guardian' ? 13 : 14
	};
}
