import type { CombatClip } from './actor-animator';
import type { RealtimeActor } from './realtime-combat';

export type ActorVisualRegistration = Readonly<{
	bodyOffsetY: number;
	shadowRadiusX: number;
	shadowRadiusY: number;
}>;

export function actorVisualRegistration(
	actorId: string,
	role: RealtimeActor['role'],
	clip: CombatClip
): ActorVisualRegistration {
	const defaultShadowRadiusX = role === 'brute' ? 72 : role === 'swarm' ? 29 : 45;
	const bodyOffsetY =
		clip === 'down' ? 0 : actorId === 'moss-archer' ? -4 : actorId === 'iron-guardian' ? -3 : 0;

	return {
		bodyOffsetY,
		shadowRadiusX: actorId === 'iron-guardian' ? 39 : defaultShadowRadiusX,
		shadowRadiusY: actorId === 'iron-guardian' ? 13 : 14
	};
}
