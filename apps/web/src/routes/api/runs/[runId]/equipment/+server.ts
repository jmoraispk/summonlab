import { getConfig } from '@summonlab/config';
import {
	EngineCommandSchema,
	EquipmentDefinitionIdSchema,
	type EngineCommand
} from '@summonlab/contracts';
import { getEquipmentDefinition } from '@summonlab/content';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot,
	getStoredEngineCommand
} from '@summonlab/database';
import { IllegalActionError, deterministicUuid, supportsEquipmentApi } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import { projectEquipmentWorkshop } from '$lib/server/equipment-runtime';

import type { RequestHandler } from './$types';

type EquipmentActionRequest =
	| { readonly action: 'forge'; readonly heroId: string; readonly definitionId: string }
	| { readonly action: 'equip'; readonly heroId: string; readonly itemId: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}

function strictActionRequest(value: unknown): EquipmentActionRequest | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	if (record.action === 'forge') {
		if (
			Object.keys(record).sort().join(',') !== 'action,definitionId,heroId' ||
			!isUuid(record.heroId) ||
			!EquipmentDefinitionIdSchema.safeParse(record.definitionId).success
		) {
			return null;
		}
		return {
			action: 'forge',
			heroId: record.heroId as string,
			definitionId: record.definitionId as string
		};
	}
	if (record.action === 'equip') {
		if (
			Object.keys(record).sort().join(',') !== 'action,heroId,itemId' ||
			!isUuid(record.heroId) ||
			!isUuid(record.itemId)
		) {
			return null;
		}
		return {
			action: 'equip',
			heroId: record.heroId as string,
			itemId: record.itemId as string
		};
	}
	return null;
}

function matchesStoredAction(command: EngineCommand, request: EquipmentActionRequest): boolean {
	if (command.actorId !== request.heroId) return false;
	if (request.action === 'forge') {
		return (
			command.commandType === 'hero.start.forging' && command.definitionId === request.definitionId
		);
	}
	return command.commandType === 'hero.equip.item' && command.itemId === request.itemId;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const heroId = url.searchParams.get('heroId');
	if (!isUuid(heroId)) {
		return json({ message: 'Choose a valid workshop hero.' }, { status: 400 });
	}
	const inspectDefinitionId = url.searchParams.get('inspect');
	if (inspectDefinitionId && !EquipmentDefinitionIdSchema.safeParse(inspectDefinitionId).success) {
		return json({ message: 'Choose a valid Equipment definition to inspect.' }, { status: 400 });
	}
	if (inspectDefinitionId && !getEquipmentDefinition(inspectDefinitionId)) {
		return json({ message: 'The Equipment definition is unavailable.' }, { status: 404 });
	}
	try {
		const snapshot = await getEngineSnapshot(getConfig().databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (!supportsEquipmentApi(snapshot.state)) {
			return json({ message: 'This history predates Equipment.' }, { status: 409 });
		}
		if (!snapshot.state.heroes[heroId]) {
			return json({ message: 'The workshop hero does not belong to this run.' }, { status: 404 });
		}
		return json(
			projectEquipmentWorkshop(snapshot, heroId, {
				inspectDefinitionId
			}),
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		console.error('Equipment workshop load failed', error);
		return json({ message: 'The Equipment workshop could not be read.' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = strictActionRequest(await request.json().catch(() => null));
	if (!parsed) {
		return json({ message: 'Choose one valid Equipment workshop action.' }, { status: 400 });
	}
	const idempotencyKey = request.headers.get('idempotency-key');
	if (!isUuid(idempotencyKey)) {
		return json({ message: 'A valid Idempotency-Key header is required.' }, { status: 400 });
	}
	const config = getConfig();
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (!supportsEquipmentApi(snapshot.state)) {
			return json({ message: 'This history predates Equipment.' }, { status: 409 });
		}
		if (!snapshot.state.heroes[parsed.heroId]) {
			return json({ message: 'The workshop hero does not belong to this run.' }, { status: 404 });
		}
		const commandId = deterministicUuid(`equipment-api:${params.runId}:${idempotencyKey}`);
		const stored = await getStoredEngineCommand(config.databaseUrl, params.runId, commandId);
		if (stored) {
			if (!matchesStoredAction(stored, parsed)) {
				return json(
					{
						code: 'IDEMPOTENCY_CONFLICT',
						message: 'The Idempotency-Key was already used for a different Equipment action.'
					},
					{ status: 409 }
				);
			}
			const latestSnapshot =
				(await getEngineSnapshot(config.databaseUrl, params.runId)) ?? snapshot;
			if (!supportsEquipmentApi(latestSnapshot.state)) {
				throw new Error('Equipment command replay changed the engine schema');
			}
			const inspectDefinitionId =
				stored.commandType === 'hero.start.forging'
					? stored.definitionId
					: stored.commandType === 'hero.equip.item'
						? latestSnapshot.state.items[stored.itemId]?.definitionId
						: undefined;
			return json({
				projection: projectEquipmentWorkshop(latestSnapshot, parsed.heroId, {
					inspectDefinitionId
				}),
				idempotentReplay: true
			});
		}
		const base = {
			commandId,
			runId: params.runId,
			actorId: parsed.heroId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId,
			source: {
				source: 'manual' as const,
				timing: 'step' as const,
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			}
		};
		let command: EngineCommand;
		let inspectDefinitionId: string;
		if (parsed.action === 'forge') {
			const definition = getEquipmentDefinition(parsed.definitionId);
			if (!definition) {
				return json({ message: 'The Equipment definition is unavailable.' }, { status: 400 });
			}
			inspectDefinitionId = definition.definitionId;
			command = EngineCommandSchema.parse({
				...base,
				commandType: 'hero.start.forging',
				definitionId: definition.definitionId,
				materialId: definition.materialId,
				craftsmanship: { label: 'standard', bonus: 0 }
			});
		} else {
			const item = snapshot.state.items[parsed.itemId];
			if (!item || item.ownerId !== parsed.heroId) {
				return json({ message: 'The Equipment item is not owned by this hero.' }, { status: 404 });
			}
			inspectDefinitionId = item.definitionId;
			command = EngineCommandSchema.parse({
				...base,
				commandType: 'hero.equip.item',
				itemId: item.itemId
			});
		}
		const committed = await commitEngineCommand(config.databaseUrl, command);
		if (!supportsEquipmentApi(committed.snapshot.state)) {
			throw new Error('Equipment command changed the engine schema');
		}
		return json({
			projection: projectEquipmentWorkshop(committed.snapshot, parsed.heroId, {
				inspectDefinitionId
			}),
			idempotentReplay: committed.idempotentReplay
		});
	} catch (error) {
		if (
			error instanceof StaleRunVersionError ||
			error instanceof IdempotencyConflictError ||
			error instanceof IllegalActionError
		) {
			return json(
				{
					code: error.code,
					message: 'That Equipment action is not currently available.'
				},
				{ status: 409 }
			);
		}
		console.error('Equipment action failed', error);
		return json({ message: 'The Equipment action could not be recorded.' }, { status: 500 });
	}
};
