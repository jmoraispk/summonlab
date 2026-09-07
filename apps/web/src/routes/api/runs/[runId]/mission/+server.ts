import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import {
	MissionLifecycleRequestSchema,
	type ActorDecisionView,
	type ActionSource,
	type CombatActionIntent,
	type EngineCommand,
	type EngineSnapshot,
	type MissionTurnChoice
} from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	createCombatDecisionWindow,
	getEngineSnapshot,
	getProofRun
} from '@summonlab/database';
import {
	IllegalActionError,
	advanceUntilDecision,
	assembleHeroDecisionPacket,
	combatModeAvailability,
	createCombatModeBinding,
	deterministicUuid,
	hashCanonical,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	missionTurnLegalActions,
	selectMasterFallback,
	supportsMissionApi
} from '@summonlab/engine';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { ScriptedPolicy } from '@summonlab/policies';
import { json } from '@sveltejs/kit';

import { projectEngineCommitReceipt } from '$lib/server/public-engine-presentation';
import { projectCombatWindowStatus } from '$lib/server/combat-window-presentation';

import type { RequestHandler } from './$types';

const manualSource: ActionSource = {
	source: 'manual',
	timing: 'step',
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

function deterministicFallback(
	view: ActorDecisionView,
	attemptId: string,
	tick: number,
	snapshotHash: string
): CombatActionIntent {
	const action = view.legalActions[0]!;
	const contract = action.targetContract;
	const target =
		contract.kind === 'self'
			? ({ kind: 'self' } as const)
			: contract.kind === 'entity'
				? ({ kind: 'entity', combatantId: contract.allowedCombatantIds[0]! } as const)
				: contract.kind === 'tile'
					? ({ kind: 'tile', position: contract.allowedPositions[0]! } as const)
					: ({
							kind: 'entity-relative-position',
							combatantId: contract.allowedCombatantIds[0]!,
							relation: contract.allowedRelations[0]!
						} as const);
	return {
		windowId: view.windowId,
		attemptId,
		tick,
		actorId: view.actorId,
		snapshotHash,
		actorViewHash: view.actorViewHash,
		legalActionSetHash: view.legalActionSetHash,
		actionId: action.actionId,
		actionInstanceId: action.actionInstanceId,
		actionKind: action.actionKind,
		skillId: action.skillId,
		target,
		fallbackId: action.fallbackOptions[0]?.fallbackId ?? null,
		publicIntent: `Follow the deterministic fallback: ${action.publicLabel}.`
	};
}

async function assembleMissionChoices(
	snapshot: EngineSnapshot,
	manifest: Parameters<typeof assembleHeroDecisionPacket>[0]['manifest'],
	masterActionId: string | null,
	fallback: boolean
): Promise<MissionTurnChoice[]> {
	if (!supportsMissionApi(snapshot.state)) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const attempt = snapshot.state.mission.attempt;
	if (!attempt) throw new IllegalActionError('mission.resolve.turn');
	const masterActions = missionTurnLegalActions(
		snapshot.state,
		snapshot.state.master.masterId
	).toSorted((left, right) => left.actionId.localeCompare(right.actionId));
	const v20FallbackChoice =
		fallback && snapshot.state.schemaVersion === 20
			? masterFallbackMissionChoice(snapshot.state)
			: null;
	const selectedMasterActionId = fallback
		? (v20FallbackChoice?.actionId ??
			masterActions.find((action) => action.actionId === 'mission.hold')?.actionId ??
			masterActions[0]?.actionId)
		: masterActionId;
	const masterAction = masterActions.find((action) => action.actionId === selectedMasterActionId);
	if (!masterAction) throw new IllegalActionError(masterActionId ?? 'mission.resolve.turn');
	if (fallback && snapshot.state.schemaVersion !== 19 && snapshot.state.schemaVersion !== 20) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const decisionId =
		snapshot.state.schemaVersion === 19 || snapshot.state.schemaVersion === 20
			? snapshot.state.masterControl.activeDecision?.decisionId
			: null;
	const baselinePolicyId = 'master-timing-baseline-v1';
	const choices: MissionTurnChoice[] = [
		fallback
			? (v20FallbackChoice ?? {
					actorId: snapshot.state.master.masterId,
					actionId: masterAction.actionId,
					source: 'scripted',
					policyId: baselinePolicyId,
					packetHash: hashCanonical({
						runId: snapshot.state.runId,
						version: snapshot.state.version,
						decisionId,
						actorId: snapshot.state.master.masterId
					}),
					legalActionHash: hashCanonical(masterActions),
					policyResultHash: hashCanonical({
						policyId: baselinePolicyId,
						actionId: masterAction.actionId,
						decisionId
					}),
					publicIntent: `The timing baseline chose to ${masterAction.label.toLowerCase()}.`
				})
			: {
					actorId: snapshot.state.master.masterId,
					actionId: masterAction.actionId,
					source: 'manual',
					policyId: null,
					packetHash: null,
					legalActionHash: null,
					policyResultHash: null,
					publicIntent: `The Master chose to ${masterAction.label.toLowerCase()}.`
				}
	];
	const policy = new ScriptedPolicy();
	for (const heroId of attempt.party.heroIds) {
		if (manifest.characterId !== heroId) {
			throw new Error(`No stable character manifest is available for mission hero ${heroId}.`);
		}
		const packet = assembleHeroDecisionPacket({
			snapshot,
			manifest,
			heroId,
			decisionKind: 'mission-action'
		});
		const result = await policy.decide(packet);
		choices.push({
			actorId: heroId,
			actionId: result.decision.actionId,
			source: 'scripted',
			policyId: result.policyId,
			packetHash: result.packetHash,
			legalActionHash: result.legalActionHash,
			policyResultHash: result.resultHash,
			publicIntent: result.decision.publicIntent
		});
	}
	return choices;
}

function decisionSource(snapshot: EngineSnapshot, fallback: boolean): ActionSource {
	if (snapshot.state.schemaVersion === 20) {
		const decision = snapshot.state.masterControl.activeDecision;
		if (!decision) throw new IllegalActionError('master.decision.open');
		if (fallback) return masterFallbackActionSource(snapshot.state);
		return { ...manualSource, timing: decision.timing };
	}
	if (snapshot.state.schemaVersion !== 19) {
		if (fallback) throw new IllegalActionError('mission.resolve.turn');
		return manualSource;
	}
	const decision = snapshot.state.masterControl.activeDecision;
	if (!decision) throw new IllegalActionError('master.decision.open');
	if (fallback) {
		if (decision.timing === 'wait') throw new IllegalActionError('mission.resolve.turn');
		return {
			source: decision.timing,
			timing: decision.timing,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		};
	}
	return { ...manualSource, timing: decision.timing };
}

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = MissionLifecycleRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ message: 'Choose a valid mission lifecycle action.' }, { status: 400 });
	}
	const config = getConfig();
	try {
		const [snapshot, proof] = await Promise.all([
			getEngineSnapshot(config.databaseUrl, params.runId),
			getProofRun(config.databaseUrl, params.runId)
		]);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (!proof) return json({ message: 'Summoned company not found.' }, { status: 404 });
		if (!supportsMissionApi(snapshot.state)) {
			return json(
				{ message: 'This history predates authoritative mission turns.' },
				{ status: 409 }
			);
		}
		const commandId = randomUUID();
		const base = {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId
		};
		let command: EngineCommand;
		if (parsed.data.action === 'prepare') {
			command = {
				...base,
				source: manualSource,
				commandType: 'mission.prepare',
				heroIds: parsed.data.heroIds,
				...(snapshot.state.schemaVersion === 25 || snapshot.state.schemaVersion === 26
					? {
							combatModeBinding: createCombatModeBinding(
								snapshot.state.schemaVersion === 25 ? 'legacy-auto-v1' : config.combatMode,
								snapshot.state.simulatedAt
							)
						}
					: {}),
				...(parsed.data.missionId ? { missionId: parsed.data.missionId } : {})
			};
		} else if (parsed.data.action === 'revise-party') {
			command = {
				...base,
				source: manualSource,
				commandType: 'mission.revise.party',
				heroIds: parsed.data.heroIds
			};
		} else if (parsed.data.action === 'cancel') {
			command = { ...base, source: manualSource, commandType: 'mission.cancel' };
		} else if (parsed.data.action === 'deploy') {
			command = { ...base, source: manualSource, commandType: 'mission.deploy' };
		} else if (parsed.data.action === 'advance-automatic-combat') {
			if (
				(snapshot.state.schemaVersion !== 25 && snapshot.state.schemaVersion !== 26) ||
				!snapshot.state.mission.attempt
			) {
				throw new IllegalActionError('mission.advance.automatic');
			}
			const attempt = snapshot.state.mission.attempt;
			const availability = combatModeAvailability(attempt.combatModeBinding);
			if (availability.status !== 'available') {
				return json({ message: availability.message }, { status: 409 });
			}
			if (
				snapshot.state.schemaVersion === 26 &&
				snapshot.state.mission.attempt!.combatState.modeId === 'agent-readiness-v1'
			) {
				const readinessAttempt = snapshot.state.mission.attempt!;
				if (readinessAttempt.combatState.modeId !== 'agent-readiness-v1') {
					throw new IllegalActionError('mission.advance.automatic');
				}
				const advance = advanceUntilDecision(
					readinessAttempt.combatState.readinessState,
					COMBAT_RULES_V1
				);
				if (advance.kind === 'combat-result') {
					const terminalCommandId = deterministicUuid(
						`${params.runId}:${readinessAttempt.attemptId}:readiness-terminal:${advance.result.endedAtTick}`
					);
					const receipt = await commitEngineCommand(config.databaseUrl, {
						commandType: 'mission.commit.readiness-terminal',
						commandId: terminalCommandId,
						runId: params.runId,
						actorId: snapshot.state.master.masterId,
						expectedVersion: snapshot.state.version,
						correlationId: terminalCommandId,
						source: {
							source: 'system',
							timing: null,
							fallbackPolicy: null,
							directiveIds: [],
							decisionJobId: null
						}
					});
					const committedAttempt =
						receipt.snapshot.state.schemaVersion === 26
							? receipt.snapshot.state.mission.attempt
							: null;
					return json({
						status: 'terminal',
						outcome: advance.result.outcome,
						tick: advance.result.endedAtTick,
						missionStatus: committedAttempt?.status ?? null
					});
				}
				const window = await createCombatDecisionWindow(config.databaseUrl, {
					runId: params.runId,
					expectedRunVersion: snapshot.state.version,
					expectedEventCursor: snapshot.state.eventCursor,
					snapshot: advance.snapshot,
					actors: advance.views.map((view) => ({
						view,
						requestedPolicy: config.policyMode,
						deterministicFallback: deterministicFallback(
							view,
							advance.snapshot.attemptId,
							advance.snapshot.tick,
							advance.snapshot.snapshotHash
						),
						maxProviderAttempts: config.decisionJobMaxProviderAttempts
					}))
				});
				return json(projectCombatWindowStatus(window));
			}
			command = {
				...base,
				source: manualSource,
				commandType: 'mission.advance.automatic'
			};
		} else if (parsed.data.action === 'resolve-turn' || parsed.data.action === 'resolve-fallback') {
			if (snapshot.state.schemaVersion === 25) {
				throw new IllegalActionError('mission.resolve.turn');
			}
			const fallback = parsed.data.action === 'resolve-fallback';
			const resolvedAt = new Date().toISOString();
			const safetySelection =
				fallback && snapshot.state.schemaVersion === 20
					? selectMasterFallback(snapshot.state)
					: null;
			if (safetySelection?.safetyStopReason && snapshot.state.schemaVersion === 20) {
				command = {
					...base,
					source: masterFallbackSafetySource(snapshot.state),
					commandType: 'master.apply.safety-stop',
					decisionId: snapshot.state.masterControl.activeDecision!.decisionId,
					observedAt: resolvedAt
				};
			} else {
				command = {
					...base,
					source: decisionSource(snapshot, fallback),
					commandType: 'mission.resolve.turn',
					choices: await assembleMissionChoices(
						snapshot,
						proof.manifest,
						parsed.data.action === 'resolve-turn' ? parsed.data.masterActionId : null,
						fallback
					),
					...(snapshot.state.schemaVersion === 19 || snapshot.state.schemaVersion === 20
						? {
								decisionId: snapshot.state.masterControl.activeDecision!.decisionId,
								resolvedAt
							}
						: {})
				};
			}
		} else if (parsed.data.action === 'extract') {
			command = { ...base, source: manualSource, commandType: 'mission.extract' };
		} else {
			command = { ...base, source: manualSource, commandType: 'mission.retreat' };
		}
		let committed = await commitEngineCommand(config.databaseUrl, command);
		if (
			parsed.data.action === 'deploy' &&
			(committed.snapshot.state.schemaVersion === 19 ||
				committed.snapshot.state.schemaVersion === 20)
		) {
			const openCommandId = randomUUID();
			committed = await commitEngineCommand(config.databaseUrl, {
				commandId: openCommandId,
				runId: params.runId,
				actorId: committed.snapshot.state.master.masterId,
				expectedVersion: committed.snapshot.state.version,
				correlationId: commandId,
				source: manualSource,
				commandType: 'master.open.decision',
				observedAt: new Date().toISOString()
			});
		}
		if (
			committed.snapshot.state.schemaVersion !== 13 &&
			committed.snapshot.state.schemaVersion !== 15 &&
			committed.snapshot.state.schemaVersion !== 16 &&
			committed.snapshot.state.schemaVersion !== 17 &&
			committed.snapshot.state.schemaVersion !== 18 &&
			committed.snapshot.state.schemaVersion !== 19 &&
			committed.snapshot.state.schemaVersion !== 20 &&
			committed.snapshot.state.schemaVersion !== 23 &&
			committed.snapshot.state.schemaVersion !== 24 &&
			committed.snapshot.state.schemaVersion !== 25 &&
			committed.snapshot.state.schemaVersion !== 26
		) {
			throw new Error('Mission commit changed the engine schema.');
		}
		return json(projectEngineCommitReceipt(committed));
	} catch (error) {
		if (error instanceof StaleRunVersionError || error instanceof IdempotencyConflictError) {
			return json(
				{ code: error.code, message: 'The run changed before the mission update.' },
				{ status: 409 }
			);
		}
		if (error instanceof IllegalActionError) {
			return json(
				{ code: error.code, message: 'That mission action is not currently available.' },
				{ status: 409 }
			);
		}
		console.error('Mission transition failed', error);
		return json({ message: 'The mission transition failed.' }, { status: 500 });
	}
};
