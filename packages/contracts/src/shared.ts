import { z } from 'zod';

export const EntityIdSchema = z.string().uuid();
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const StateHashSchema = z.string().regex(/^[a-f0-9]{64}$/u, 'Expected a SHA-256 hex hash');
export const ContentVersionSchema = z.string().min(1).max(80);

export type EntityId = z.infer<typeof EntityIdSchema>;
