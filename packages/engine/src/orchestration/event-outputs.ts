import type { AuthoritativeEvent, ScheduledEvent } from '@summonlab/contracts';

import { metadataIds } from '../core/event-metadata.js';
import {
	ActivityStartedPayloadSchema,
	DirectiveChangedPayloadSchema,
	ForgingStartedPayloadSchema,
	RoutineStartedPayloadSchema,
	TravelStartedPayloadSchema
} from '../domains/settlement/reducer.js';

export function scheduledEventsFromEvent(event: AuthoritativeEvent): readonly ScheduledEvent[] {
	if (event.eventType === 'hero.activity.started')
		return [ActivityStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.forging.started')
		return [ForgingStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.travel.started')
		return [TravelStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.routine.started')
		return [RoutineStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (
		event.eventType === 'social.directive.issued' ||
		event.eventType === 'social.directive.replaced'
	) {
		const scheduledEvent = DirectiveChangedPayloadSchema.parse(event.payload).scheduledEvent;
		return scheduledEvent ? [scheduledEvent] : [];
	}
	return [];
}

export function resolvedScheduledEventIdsFromEvent(event: AuthoritativeEvent): readonly string[] {
	return metadataIds(event, 'resolvedScheduledEventIds');
}

export function canceledScheduledEventIdsFromEvent(event: AuthoritativeEvent): readonly string[] {
	return metadataIds(event, 'canceledScheduledEventIds');
}
