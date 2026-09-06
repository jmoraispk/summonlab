/**
 * Checked-in reducer inventory. Keep these alphabetized; they deliberately
 * document accepted event discriminators rather than deriving them at runtime.
 */
export const RUN_INITIALIZATION_EVENT_TYPES = ['run.initialized'] as const;

export const LEGACY_EVENT_TYPES = [
	'hero.arrived',
	'hero.destination.selected',
	'master.gate.inspected'
] as const;

export const MODERN_EVENT_TYPES = [
	'hero.activity.started',
	'hero.arrived',
	'hero.assignment.changed',
	'hero.attribute.allocated',
	'hero.daily.plan.created',
	'hero.damaged',
	'hero.destination.selected',
	'hero.died',
	'hero.forging.started',
	'hero.item.equipped',
	'hero.routine.started',
	'hero.synthesized',
	'hero.travel.started',
	'master.damaged',
	'master.decision.opened',
	'master.died',
	'master.fallback.changed',
	'master.gate.inspected',
	'master.safety.stopped',
	'master.timing.changed',
	'mission.deployed',
	'mission.extracted',
	'mission.extraction.opened',
	'mission.party.revised',
	'mission.preparation.canceled',
	'mission.preparation.started',
	'mission.retreated',
	'mission.round.resolved',
	'settlement.first.ember.committed',
	'settlement.power.allocated',
	'simulation.advanced',
	'simulation.clock.synced',
	'social.communicative.act.recorded',
	'social.conversation.turn.recorded',
	'social.directive.issued',
	'social.directive.replaced',
	'social.directive.revoked',
	'social.synthesis.rumor.shared',
	'story.first.archive.revealed',
	'story.first.ember.recovered',
	'story.patch.applied'
] as const;

export const ENGINE_EVENT_TYPES = [
	...RUN_INITIALIZATION_EVENT_TYPES,
	...LEGACY_EVENT_TYPES,
	...MODERN_EVENT_TYPES
] as const;
