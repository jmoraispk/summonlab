import type { CombatClip } from './actor-animator';
import type { RealtimeActor } from './realtime-combat';

export type ActorVisualRegistration = Readonly<{
	bodyOffsetY: number;
	shadowRadiusX: number;
	shadowRadiusY: number;
	displaySize: number;
}>;

export function actorVisualRegistration(
	input: Pick<RealtimeActor, 'role'> & {
		clip: CombatClip;
		visualTuning: RealtimeActor['presentation']['visualTuning'];
	}
): ActorVisualRegistration {
	const { clip, visualTuning } = input;

	return {
		bodyOffsetY: clip === 'down' ? 0 : visualTuning.bodyOffsetY,
		shadowRadiusX: visualTuning.shadowRadiusX,
		shadowRadiusY: visualTuning.shadowRadiusY,
		displaySize: visualTuning.displaySize
	};
}
