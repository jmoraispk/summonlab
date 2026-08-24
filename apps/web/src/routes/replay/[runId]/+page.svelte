<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		ActionSource,
		ActivityKind,
		BuildingAssignmentRole,
		CatchUpReport,
		EngineCommand,
		EngineReplayReport,
		FirstEmberFacility,
		FirstEmberRationale
	} from '@summonlab/contracts';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let report = $state<EngineReplayReport>(data.report);
	let pending = $state(false);
	let resultMessage = $state('');
	let errorMessage = $state('');
	const hero = $derived(Object.values(report.snapshot.state.heroes)[0]);
	const engineState = $derived(report.snapshot.state);
	const clock = $derived(report.clock);
	const survivalState = $derived(
		engineState.schemaVersion === 2 ||
			engineState.schemaVersion === 3 ||
			engineState.schemaVersion === 4 ||
			engineState.schemaVersion === 5 ||
			engineState.schemaVersion === 6 ||
			engineState.schemaVersion === 7 ||
			engineState.schemaVersion === 8 ||
			engineState.schemaVersion === 9 ||
			engineState.schemaVersion === 10
			? engineState
			: null
	);
	const navigationState = $derived(
		engineState.schemaVersion === 3 ||
			engineState.schemaVersion === 4 ||
			engineState.schemaVersion === 5 ||
			engineState.schemaVersion === 6 ||
			engineState.schemaVersion === 7 ||
			engineState.schemaVersion === 8 ||
			engineState.schemaVersion === 9 ||
			engineState.schemaVersion === 10
			? engineState.settlement.navigation
			: null
	);
	const operationsState = $derived(
		engineState.schemaVersion === 4 ||
			engineState.schemaVersion === 5 ||
			engineState.schemaVersion === 6 ||
			engineState.schemaVersion === 7 ||
			engineState.schemaVersion === 8 ||
			engineState.schemaVersion === 9 ||
			engineState.schemaVersion === 10
			? engineState
			: null
	);
	const routineState = $derived(
		engineState.schemaVersion === 5 ||
			engineState.schemaVersion === 6 ||
			engineState.schemaVersion === 7 ||
			engineState.schemaVersion === 8 ||
			engineState.schemaVersion === 9 ||
			engineState.schemaVersion === 10
			? engineState
			: null
	);
	const firstEmberState = $derived(
		engineState.schemaVersion === 6 ||
			engineState.schemaVersion === 7 ||
			engineState.schemaVersion === 8 ||
			engineState.schemaVersion === 9 ||
			engineState.schemaVersion === 10
			? engineState
			: null
	);
	const socialState = $derived(
		engineState.schemaVersion === 7 ||
			engineState.schemaVersion === 8 ||
			engineState.schemaVersion === 9 ||
			engineState.schemaVersion === 10
			? engineState.society
			: null
	);
	const communicationState = $derived(
		engineState.schemaVersion === 8 ||
			engineState.schemaVersion === 9 ||
			engineState.schemaVersion === 10
			? engineState
			: null
	);
	const survivalHero = $derived(hero && 'progression' in hero ? hero : null);
	const travelHero = $derived(
		(engineState.schemaVersion === 3 ||
			engineState.schemaVersion === 4 ||
			engineState.schemaVersion === 5 ||
			engineState.schemaVersion === 6 ||
			engineState.schemaVersion === 7 ||
			engineState.schemaVersion === 8 ||
			engineState.schemaVersion === 9 ||
			engineState.schemaVersion === 10) &&
			hero
			? engineState.heroes[hero.heroId]
			: null
	);
	const routineHero = $derived(routineState && hero ? routineState.heroes[hero.heroId] : null);
	const heroActions = $derived(hero ? (report.legalActionsByActor[hero.heroId] ?? []) : []);
	const pendingSchedule = $derived(
		report.scheduledEvents.find((scheduled) => scheduled.status === 'pending') ?? null
	);
	const equippedItem = $derived(
		survivalState && survivalHero?.equipment.mainHand
			? survivalState.items[survivalHero.equipment.mainHand]
			: null
	);

	const manualSource: ActionSource = {
		source: 'manual',
		timing: 'step',
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};

	function commandMeta(
		actorId: string,
		expectedVersion = engineState.version,
		source: ActionSource = manualSource
	) {
		const commandId = crypto.randomUUID();
		return {
			commandId,
			runId: report.runId,
			actorId,
			expectedVersion,
			correlationId: commandId,
			source
		};
	}

	async function postCommand(body: EngineCommand) {
		return fetch(`/api/runs/${report.runId}/commands`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	}

	async function refresh() {
		const response = await fetch(`/api/dev/replays/${report.runId}`);
		const body = (await response.json()) as EngineReplayReport & { message?: string };
		if (!response.ok) throw new Error(body.message ?? 'Replay refresh failed.');
		report = body;
	}

	async function execute(command: EngineCommand, success: string) {
		pending = true;
		errorMessage = '';
		resultMessage = '';
		try {
			const response = await postCommand(command);
			const body = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(body.message ?? 'The engine rejected this command.');
			await refresh();
			resultMessage = success;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The engine rejected this command.';
		} finally {
			pending = false;
		}
	}

	async function inspectGate() {
		await execute(
			{
				...commandMeta(engineState.master.masterId),
				commandType: 'master.inspect.gate'
			},
			'Gate resonance committed from one named entropy draw.'
		);
	}

	async function proveStaleGuard() {
		pending = true;
		errorMessage = '';
		resultMessage = '';
		try {
			const expectedVersion = engineState.version;
			const left = {
				...commandMeta(engineState.master.masterId, expectedVersion),
				commandType: 'master.inspect.gate' as const
			};
			const right = {
				...commandMeta(engineState.master.masterId, expectedVersion),
				commandType: 'master.inspect.gate' as const
			};
			const responses = await Promise.all([postCommand(left), postCommand(right)]);
			const accepted = responses.filter((response) => response.ok).length;
			const stale = responses.filter((response) => response.status === 409).length;
			await refresh();
			resultMessage = `${accepted} accepted · ${stale} rejected stale`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Concurrency proof failed.';
		} finally {
			pending = false;
		}
	}

	async function startActivity(activity: ActivityKind) {
		if (!survivalHero) return;
		await execute(
			{
				...commandMeta(survivalHero.heroId),
				commandType: 'hero.start.activity',
				activity
			},
			`${activity} scheduled on the deterministic game clock.`
		);
	}

	async function advanceSimulation() {
		if (!pendingSchedule) return;
		await execute(
			{
				...commandMeta(engineState.master.masterId),
				commandType: 'simulation.advance',
				targetGameTime: pendingSchedule.dueGameTime
			},
			'Offline catch-up resolved through the same reducer.'
		);
	}

	async function startTravel(targetNodeId: string, label: string) {
		if (!travelHero) return;
		await execute(
			{
				...commandMeta(travelHero.heroId),
				commandType: 'hero.start.travel',
				targetNodeId
			},
			`Route to ${label} scheduled; location remains authoritative at the origin.`
		);
	}

	async function assignHero(buildingId: string, role: BuildingAssignmentRole) {
		if (!operationsState || !hero) return;
		await execute(
			{
				...commandMeta(operationsState.master.masterId),
				commandType: 'settlement.assign.hero',
				heroId: hero.heroId,
				buildingId,
				role
			},
			`Hero assignment moved to ${buildingId}.`
		);
	}

	async function unassignHero() {
		if (!operationsState || !hero) return;
		await execute(
			{
				...commandMeta(operationsState.master.masterId),
				commandType: 'settlement.unassign.hero',
				heroId: hero.heroId
			},
			'Hero released from the facility roster.'
		);
	}

	async function allocatePower(buildingId: string) {
		if (!operationsState) return;
		await execute(
			{
				...commandMeta(operationsState.master.masterId),
				commandType: 'settlement.allocate.power',
				buildingId
			},
			`Development power routed to ${buildingId}.`
		);
	}

	async function recoverFirstEmber() {
		if (!firstEmberState) return;
		await execute(
			{
				...commandMeta(firstEmberState.master.masterId, engineState.version, {
					source: 'system',
					timing: null,
					fallbackPolicy: null,
					directiveIds: [],
					decisionJobId: null
				}),
				commandType: 'story.recover.first.ember'
			},
			'Floor 01 recovery committed; the permanent facility choice is now available.'
		);
	}

	async function commitFirstEmber(buildingId: FirstEmberFacility, rationale: FirstEmberRationale) {
		if (!firstEmberState) return;
		await execute(
			{
				...commandMeta(firstEmberState.master.masterId),
				commandType: 'settlement.commit.first.ember',
				buildingId,
				rationale
			},
			`The First Ember is permanently bound to ${buildingId}.`
		);
	}

	async function planDay() {
		if (!routineHero) return;
		await execute(
			{
				...commandMeta(routineHero.heroId),
				commandType: 'hero.plan.day'
			},
			'A four-part daily plan was committed from this hero’s stable mind and current needs.'
		);
	}

	async function followPlan() {
		if (!routineHero) return;
		await execute(
			{
				...commandMeta(routineHero.heroId, engineState.version, {
					source: 'habit',
					timing: 'continuous',
					fallbackPolicy: null,
					directiveIds: [],
					decisionJobId: null
				}),
				commandType: 'hero.start.routine'
			},
			'The inspectable habit resolver scheduled its highest-ranked eligible intention.'
		);
	}

	async function catchUp(simulateSixHours = false) {
		pending = true;
		errorMessage = '';
		resultMessage = '';
		try {
			const wallTime = simulateSixHours
				? new Date(Date.parse(clock.anchorRealTime) + 6 * 60 * 60 * 1_000).toISOString()
				: undefined;
			const response = await fetch(`/api/runs/${report.runId}/catch-up`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(wallTime ? { wallTime } : {})
			});
			const result = (await response.json()) as CatchUpReport & { message?: string };
			if (!response.ok) throw new Error(result.message ?? 'Catch-up could not acquire the run.');
			await refresh();
			resultMessage = `${result.commandsApplied} events · ${result.schedulesResolved} schedules · ${result.plansCreated} plans`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Catch-up failed.';
		} finally {
			pending = false;
		}
	}

	async function equipAlternateItem() {
		const action = heroActions.find((candidate) => candidate.actionId.startsWith('hero.equip.'));
		if (!survivalHero || !action) return;
		await execute(
			{
				...commandMeta(survivalHero.heroId),
				commandType: 'hero.equip.item',
				itemId: action.actionId.replace('hero.equip.', '')
			},
			'Equipment changed through an authoritative event.'
		);
	}

	async function damage(targetId: string, amount: number) {
		await execute(
			{
				...commandMeta(engineState.master.masterId),
				commandType: 'simulation.apply.damage',
				targetId,
				amount,
				damageKind: 'hazard'
			},
			amount === 100 ? 'Terminal state committed and replay verified.' : 'Hazard recorded.'
		);
	}

	function canHero(actionId: string) {
		return heroActions.some((action) => action.actionId === actionId);
	}

	function canMaster(actionId: string) {
		return report.legalActions.some((action) => action.actionId === actionId);
	}
</script>

<svelte:head>
	<title>Replay inspector · summonlab</title>
	<meta
		name="description"
		content="Verify summonlab's deterministic event stream and state hashes."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div>
			<span>Development instrument</span>
			<strong>Deterministic replay</strong>
		</div>
		<a href={resolve('/play/[runId]', { runId: report.runId })}>Return to settlement</a>
	</header>

	<section class="hero">
		<div>
			<p>Canonical event stream · {report.eventCount} events</p>
			<h1>One history.<br />No hidden mutations.</h1>
			<span
				>The reducer rebuilt this run from event 01 and compared every transition with the persisted
				snapshot.</span
			>
		</div>
		<div class:verified={report.verified} class="seal" data-testid="replay-status">
			<i>{report.verified ? '✓' : '!'}</i>
			<strong>{report.verified ? 'Verified' : 'Mismatch'}</strong>
			<span>{report.hashMatchesPersistedSnapshot ? 'snapshot agrees' : 'snapshot diverged'}</span>
		</div>
	</section>

	{#if engineState.status === 'game_over'}
		<section class="game-over" data-testid="game-over">
			<span>Terminal state</span>
			<strong>The Master is dead. This history is sealed.</strong>
			<p>No actor can issue another legal action; the run can only be inspected or replayed.</p>
		</section>
	{/if}

	<section class="metrics" aria-label="Engine state">
		<div>
			<span>Run version</span><strong data-testid="run-version">{engineState.version}</strong>
		</div>
		<div><span>Event cursor</span><strong>{engineState.eventCursor}</strong></div>
		<div>
			<span>Entropy cursor</span><strong data-testid="entropy-cursor"
				>{engineState.entropyCursor}</strong
			>
		</div>
		<div>
			<span>Game clock</span><strong data-testid="game-clock"
				>{clock.currentGameTime.slice(11, 16)}</strong
			>
		</div>
		<div><span>Engine schema</span><strong>v{engineState.schemaVersion}</strong></div>
		<div><span>Run state</span><strong>{engineState.status}</strong></div>
	</section>

	<div class="grid">
		<section class="panel actors">
			<header>
				<span>Materialized state</span>
				<h2>Actors</h2>
			</header>
			<article>
				<div class="sigil">M</div>
				<div>
					<strong>Master</strong><span
						>{engineState.master.location} · {engineState.master.lifeState}</span
					>
				</div>
				<code>{engineState.master.health}/{engineState.master.maxHealth}</code>
			</article>
			{#if hero}
				<article>
					<div class="sigil">H</div>
					<div>
						<strong>Summoned hero</strong><span
							>{hero.location}{travelHero ? ` · ${travelHero.locationNodeId}` : ''} · {hero.lifeState}</span
						>
					</div>
					<code>{hero.health}/{hero.maxHealth}</code>
				</article>
			{/if}
			{#if survivalHero && survivalState}
				{#if navigationState && travelHero}
					<div class="travel-proof" data-testid="travel-proof">
						<span>Authoritative travel · {navigationState.contentVersion}</span>
						{#if travelHero.currentTravel}
							<strong
								>{travelHero.currentTravel.fromNodeId} → {travelHero.currentTravel.toNodeId}</strong
							>
							<code
								>{travelHero.locationNodeId} remains current until {travelHero.currentTravel.arrivesAt.slice(
									11,
									19
								)}</code
							>
						{:else}
							<strong>{travelHero.locationNodeId}</strong>
							<code>{navigationState.contentHash.slice(0, 16)}</code>
						{/if}
					</div>
				{/if}
				{#if routineHero}
					<div class="routine-profile" data-testid="routine-profile">
						<div class="mind-line">
							<span>Stable mind</span>
							<strong>{routineHero.mind.primaryValue} · {routineHero.mind.primaryDrive}</strong>
							<code>{routineHero.mind.socialStyle} / {routineHero.mind.stressResponse}</code>
						</div>
						<div class="habit-line" data-testid="hero-habit">
							<span>Daily habit</span>
							<strong>{routineHero.habit.habit.replaceAll('-', ' ')}</strong>
							<code
								>strength {routineHero.habit.strength} · {routineHero.habit.repetitions} repetitions ·
								{routineHero.habit.satisfaction} satisfaction</code
							>
						</div>
						{#if routineHero.dailyPlan}
							<div class="daily-plan" data-testid="daily-plan">
								<header>
									<span>Day {routineHero.dailyPlan.dayIndex + 1}</span>
									<strong>Four intentions</strong>
								</header>
								{#each routineHero.dailyPlan.entries as entry (entry.planEntryId)}
									<div
										class:active={entry.status === 'active'}
										class:complete={entry.status === 'completed'}
									>
										<span>{entry.period}</span>
										<strong>{entry.kind.replaceAll('-', ' ')}</strong>
										<code>{entry.status}</code>
									</div>
								{/each}
							</div>
						{/if}
						{#if routineHero.currentRoutine}
							<div class="routine-resolution" data-testid="routine-resolution">
								<header>
									<div>
										<span>Resolver trace</span>
										<strong>{routineHero.currentRoutine.kind.replaceAll('-', ' ')}</strong>
									</div>
									<code
										>margin {routineHero.currentRoutine.resolution.margin}{routineHero
											.currentRoutine.resolution.decisionRecommended
											? ' · fallback boundary'
											: ' · decisive'}</code
									>
								</header>
								{#each routineHero.currentRoutine.resolution.candidateScores as candidate (candidate.planEntryId)}
									<div class:ineligible={!candidate.eligible}>
										<span>{candidate.kind.replaceAll('-', ' ')}</span>
										<strong>{candidate.score}</strong>
									</div>
								{/each}
								<p>{routineHero.currentRoutine.resolution.summary}</p>
							</div>
						{/if}
					</div>
				{/if}
				<div class="survival-stats">
					<div><span>Rarity</span><strong>{survivalHero.progression.stars}★</strong></div>
					<div>
						<span>Level / XP</span><strong data-testid="hero-xp"
							>{survivalHero.progression.level} / {survivalHero.progression.experience}</strong
						>
					</div>
					<div>
						<span>Sword skill</span><strong
							>{survivalHero.progression.skills.swordFighting.rank} / {survivalHero.progression
								.skills.swordFighting.experience} XP</strong
						>
					</div>
					<div>
						<span>Needs</span><strong data-testid="hero-needs"
							>H {survivalHero.needs.hunger} · F {survivalHero.needs.fatigue}</strong
						>
					</div>
					<div><span>Main hand</span><strong>{equippedItem?.displayName ?? 'unarmed'}</strong></div>
					<div>
						<span>Durability</span><strong data-testid="item-durability"
							>{equippedItem
								? `${equippedItem.durability}/${equippedItem.maxDurability}`
								: '—'}</strong
						>
					</div>
				</div>
				<div class="resource-ledger" aria-label="Settlement resources">
					{#each Object.entries(survivalState.settlement.resources) as [resource, amount] (resource)}
						<div>
							<span>{resource}</span><strong data-testid={`resource-${resource}`}>{amount}</strong>
						</div>
					{/each}
				</div>
				{#if survivalHero.injuries.length}
					<p class="injuries">
						Injuries · {#each survivalHero.injuries as injury, index (injury.injuryId)}{index
								? ', '
								: ''}{injury.kind}{/each}
					</p>
				{/if}
			{/if}
			<div class="hashes">
				<span>rebuilt</span><code title={report.snapshot.stateHash}
					>{report.snapshot.stateHash}</code
				>
				<span>persisted</span><code title={report.persistedStateHash}
					>{report.persistedStateHash}</code
				>
			</div>
		</section>

		<section class="panel controls">
			<header>
				<span>Survival-state laboratory</span>
				<h2>Act, wait, and inspect</h2>
			</header>
			<p>
				Every button proposes a command. The engine checks legality, commits one event, and rebuilds
				this view from the resulting hash chain.
			</p>
			{#if survivalState && survivalHero}
				<div class="control-group clock-proof" data-testid="simulation-clock">
					<div>
						<span>Continuous settlement clock</span>
						<strong>{clock.speed}× real time</strong>
						<code>{clock.leaseStatus} lease</code>
					</div>
					<div class="clock-times">
						<p>
							<span>authoritative</span><strong
								>{clock.currentGameTime.slice(0, 16).replace('T', ' · ')}</strong
							>
						</p>
						<p>
							<span>projected now</span><strong
								>{clock.projectedGameTime.slice(0, 16).replace('T', ' · ')}</strong
							>
						</p>
						<p>
							<span>backlog</span><strong>{Math.floor(clock.backlogGameMinutes)} game min</strong>
						</p>
						<p>
							<span>next due</span><strong>{clock.nextDueGameTime?.slice(11, 16) ?? 'none'}</strong>
						</p>
					</div>
					<div class="buttons wrap">
						<button
							class="secondary"
							type="button"
							onclick={() => catchUp(false)}
							disabled={pending}>Catch up now</button
						>
						<button type="button" onclick={() => catchUp(true)} disabled={pending}
							>Simulate 6h away</button
						>
					</div>
				</div>
				{#if operationsState && hero}
					<div class="control-group facilities" data-testid="facility-operations">
						<span
							>Facility operations · {firstEmberState
								? 'one permanent First Ember'
								: 'one development power slot'}</span
						>
						{#if firstEmberState}
							<div class="first-ember-proof" data-testid="first-ember-proof">
								<div>
									<strong>First Ember · {firstEmberState.settlement.firstEmber.status}</strong>
									<small
										>{firstEmberState.settlement.firstEmber.buildingId ??
											'Floor 01 recovery not yet recorded'}</small
									>
								</div>
								{#if firstEmberState.settlement.firstEmber.status === 'unrecovered'}
									<button type="button" onclick={recoverFirstEmber} disabled={pending}
										>Recover Floor 01 core</button
									>
								{:else if firstEmberState.settlement.firstEmber.status === 'available'}
									<div class="buttons wrap">
										<button
											type="button"
											onclick={() => commitFirstEmber('kitchen', 'feed-everyone')}
											disabled={pending}>Kitchen</button
										>
										<button
											type="button"
											onclick={() => commitFirstEmber('dormitory', 'protect-recovery')}
											disabled={pending}>Dormitory</button
										>
										<button
											type="button"
											onclick={() => commitFirstEmber('training-ground', 'prepare-tower')}
											disabled={pending}>Training</button
										>
									</div>
								{:else}
									<code
										>{firstEmberState.settlement.firstEmber.modifiers
											.map((modifier) => `${modifier.key} ${modifier.amount}`)
											.join(' · ')}</code
									>
								{/if}
							</div>
						{/if}
						{#if socialState}
							<div class="social-proof" data-testid="social-cognition-proof">
								<div class="social-proof-heading">
									<strong>Hero cognition · provenance ledger</strong>
									<small>{socialState.contentVersion} · no omniscient roster context</small>
								</div>
								<div class="social-proof-grid">
									<article>
										<span>Direct observations</span>
										{#each Object.values(socialState.observations).filter((entry) => entry.observerHeroId === hero.heroId) as observation (observation.observationId)}
											<p><strong>{observation.kind}</strong>{observation.summary}</p>
											<code>{observation.sourceEventId.slice(0, 12)}</code>
										{/each}
									</article>
									<article>
										<span>Held beliefs</span>
										{#each Object.values(socialState.beliefs).filter((entry) => entry.holderHeroId === hero.heroId) as belief (belief.beliefId)}
											<p><strong>{belief.predicate}</strong>{belief.confidence}% confidence</p>
											<code>{belief.provenance.kind} · depth {belief.provenance.chainDepth}</code>
										{/each}
									</article>
									<article>
										<span>Relationship → Master</span>
										{#each Object.values(socialState.relationships).filter((entry) => entry.fromHeroId === hero.heroId && entry.toEntityId === engineState.master.masterId) as relationship (relationship.relationshipId)}
											<p>
												{Object.entries(relationship.dimensions)
													.map(([key, value]) => `${key} ${value}`)
													.join(' · ')}
											</p>
											<code>{relationship.evidence.at(-1)?.summary ?? 'Neutral at awakening'}</code>
										{/each}
									</article>
									<article>
										<span>Authority → Master</span>
										{#each Object.values(socialState.authority).filter((entry) => entry.observerHeroId === hero.heroId) as authority (authority.authorityId)}
											<p>
												{Object.entries(authority.dimensions)
													.map(([key, value]) => `${key} ${value}`)
													.join(' · ')}
											</p>
											<code
												>{authority.evidence.at(-1)?.summary ?? 'No authority recognized yet'}</code
											>
										{/each}
									</article>
								</div>
								{#each Object.values(socialState.promises) as promise (promise.promiseId)}
									<p class="social-promise"><span>{promise.status} promise</span>{promise.terms}</p>
								{/each}
								{#if communicationState}
									<div class="communication-ledger" data-testid="communication-witness-ledger">
										<div class="social-proof-heading">
											<strong>Communicative acts · witness chains</strong>
											<small
												>{Object.keys(communicationState.society.communicativeActs).length} canonical
												acts</small
											>
										</div>
										{#each Object.values(communicationState.society.communicativeActs) as act (act.actId)}
											<article class="communication-act">
												<header>
													<span>{act.kind} · {act.topic} · {act.delivery}</span>
													<code>{act.sourceEventId}</code>
												</header>
												<blockquote>“{act.exactText}”</blockquote>
												<div class="witness-chain">
													{#each act.witnesses as witness (witness.heroId)}
														<p>
															<strong
																>{witness.heroId.slice(0, 8)} · {witness.role} / {witness.perception}</strong
															>
															<code
																>obs {witness.observationId.slice(0, 8)} · belief {witness.beliefId?.slice(
																	0,
																	8
																) ?? 'none'}</code
															>
														</p>
													{/each}
												</div>
											</article>
										{/each}
										{#if communicationState.schemaVersion === 9 || communicationState.schemaVersion === 10}
											{#each Object.values(communicationState.society.conversationTurns) as turn (turn.turnId)}
												<article class="communication-act" data-testid="conversation-replay-turn">
													<header>
														<span
															>hero reply · {turn.response.orderOutcome ?? turn.kind} · {turn.orderIntent ??
																'open'}</span
														>
														<code>{turn.sourceEventId}</code>
													</header>
													<blockquote>“{turn.response.exactText}”</blockquote>
													<p>{turn.response.publicReason}</p>
													{#if turn.response.orderScore}
														<code
															>score {turn.response.orderScore.total} · preference +{turn.response
																.preferenceWeight}</code
														>
													{/if}
												</article>
											{/each}
										{/if}
										{#if communicationState.schemaVersion === 10}
											{#each Object.values(communicationState.society.directives) as directive (directive.directiveId)}
												<article class="communication-act" data-testid="directive-replay-record">
													<header>
														<span>{directive.status} direction · {directive.scope}</span>
														<code>{directive.directiveId}</code>
													</header>
													<blockquote>“{directive.text}”</blockquote>
													<p>{directive.priorities.join(' · ') || 'No structured priorities'}</p>
													<code
														>{directive.witnessObservationIds.length} witnesses · {directive.expiresAt ??
															'manual lifetime'}</code
													>
												</article>
											{/each}
											{#each Object.values(communicationState.society.directiveInfluences) as influence (influence.influenceId)}
												<article class="communication-act" data-testid="directive-influence-record">
													<header>
														<span>{influence.outcome} · {influence.actionId}</span>
														<code>{influence.sourceEventId}</code>
													</header>
													<p>{influence.rationale}</p>
												</article>
											{/each}
										{/if}
									</div>
								{/if}
							</div>
						{/if}
						<div class="facility-list">
							{#each Object.values(operationsState.settlement.buildings) as building (building.buildingId)}
								<article data-testid={`building-${building.buildingId}`}>
									<div>
										<strong>{building.buildingId}</strong>
										<small
											>{building.powerState} · {building.assignedHeroIds
												.length}/{building.assignmentCapacity}
											{building.assignmentRole}</small
										>
									</div>
									<button
										class="secondary compact"
										type="button"
										onclick={() => assignHero(building.buildingId, building.assignmentRole)}
										disabled={pending ||
											!canMaster(`settlement.assign.${hero.heroId}.${building.buildingId}`)}
										>assign</button
									>
									{#if !firstEmberState && building.buildingId !== 'summoning-gate'}
										<button
											class="secondary compact"
											type="button"
											onclick={() => allocatePower(building.buildingId)}
											disabled={pending || !canMaster(`settlement.power.${building.buildingId}`)}
											>power</button
										>
									{/if}
								</article>
							{/each}
						</div>
						{#if operationsState.heroes[hero.heroId]?.assignment}
							<div class="assignment-line" data-testid="hero-assignment">
								<strong>{operationsState.heroes[hero.heroId]?.assignment?.buildingId}</strong>
								<span>{operationsState.heroes[hero.heroId]?.assignment?.role}</span>
								<button
									class="secondary compact"
									type="button"
									onclick={unassignHero}
									disabled={pending || !canMaster(`settlement.unassign.${hero.heroId}`)}
									>release</button
								>
							</div>
						{/if}
					</div>
				{/if}
				{#if travelHero}
					<div class="control-group">
						<span>Verified Hearth routes</span>
						<div class="buttons wrap">
							{#each [['gate-dais', 'gate'], ['kitchen-table', 'kitchen'], ['dormitory-bunks', 'dormitory'], ['training-ring', 'training'], ['workshop-bench', 'workshop'], ['workshop-forge', 'forge'], ['courtyard-heart', 'courtyard']] as destination (destination[0])}
								<button
									class="secondary"
									type="button"
									onclick={() => startTravel(destination[0]!, destination[1]!)}
									disabled={pending ||
										!canHero('hero.travel') ||
										travelHero.locationNodeId === destination[0]}>{destination[1]}</button
								>
							{/each}
						</div>
					</div>
				{/if}
				{#if routineHero}
					<div class="control-group routine-controls" data-testid="routine-controls">
						<span>Mind-managed day · zero model calls</span>
						<p>
							Plans are intentions. Following one ranks habit, duty, hunger, fatigue, health, and
							personality before scheduling work.
						</p>
						<div class="buttons wrap">
							<button
								class="secondary"
								type="button"
								onclick={planDay}
								disabled={pending || !canHero('hero.plan.day')}>Plan day</button
							>
							<button
								type="button"
								onclick={followPlan}
								disabled={pending || !canHero('hero.follow.plan')}>Follow next intention</button
							>
						</div>
					</div>
				{/if}
				<div class="control-group">
					<span>Hero routine</span>
					<div class="buttons wrap">
						{#each ['train', 'eat', 'rest', 'repair'] as activity (activity)}
							<button
								class="secondary"
								type="button"
								onclick={() => startActivity(activity as ActivityKind)}
								disabled={pending || !canHero(`hero.activity.${activity}`)}>{activity}</button
							>
						{/each}
					</div>
				</div>
				<div class="control-group schedule">
					<span>Scheduled work or travel</span>
					{#if pendingSchedule}
						<strong data-testid="pending-schedule"
							>{pendingSchedule.eventKind} · due {pendingSchedule.dueGameTime.slice(11, 16)}</strong
						>
						<button type="button" onclick={advanceSimulation} disabled={pending}
							>Advance to outcome</button
						>
					{:else}
						<strong data-testid="pending-schedule">No pending work</strong>
					{/if}
				</div>
				<div class="buttons wrap">
					<button
						class="secondary"
						type="button"
						onclick={equipAlternateItem}
						disabled={pending ||
							!heroActions.some((action) => action.actionId.startsWith('hero.equip.'))}
						>Swap weapon</button
					>
					<button
						class="secondary danger"
						type="button"
						onclick={() => damage(survivalHero.heroId, 25)}
						disabled={pending || survivalHero.lifeState !== 'active'}>Apply hazard</button
					>
					<button
						class="secondary danger"
						type="button"
						onclick={() => damage(survivalHero.heroId, 100)}
						disabled={pending || survivalHero.lifeState !== 'active'}>Fatal hero proof</button
					>
					<button
						class="danger"
						type="button"
						onclick={() => damage(engineState.master.masterId, 100)}
						disabled={pending || engineState.master.lifeState !== 'alive'}>End run proof</button
					>
				</div>
			{:else}
				<p class="legacy">
					This immutable engine-v1 history remains replayable. Start a new summon to use the
					survival lab.
				</p>
			{/if}
			<div class="buttons proof-buttons">
				<button
					type="button"
					onclick={inspectGate}
					disabled={pending || engineState.status === 'game_over'}>Draw gate resonance</button
				>
				<button
					class="secondary"
					type="button"
					onclick={proveStaleGuard}
					disabled={pending || engineState.status === 'game_over'}>Prove stale guard</button
				>
			</div>
			{#if resultMessage}<output data-testid="command-result">{resultMessage}</output>{/if}
			{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
			<div class="legal">
				<span>Legal actions</span>
				{#each [...report.legalActions, ...heroActions] as action (action.actionId)}<code
						>{action.actionId}</code
					>{/each}
			</div>
		</section>
	</div>

	<section class="timeline">
		<header>
			<div>
				<span>Hash chain</span>
				<h2>Authoritative timeline</h2>
			</div>
			<p>before → reduce(event) → after</p>
		</header>
		<ol>
			{#each report.checks as check (check.sequence)}
				<li class:passed={check.verified}>
					<div class="sequence">{String(check.sequence).padStart(2, '0')}</div>
					<div class="event">
						<strong>{check.eventType}</strong>
						<span>{check.source.source} · {check.verified ? 'hash verified' : 'hash mismatch'}</span
						>
						<p>{check.summary}</p>
					</div>
					<div class="transition">
						<code title={check.beforeStateHash}>{check.beforeStateHash.slice(0, 12)}</code>
						<i>→</i>
						<code title={check.afterStateHash}>{check.afterStateHash.slice(0, 12)}</code>
					</div>
					<div class="draws">
						{#each check.deltas as delta (`${delta.kind}-${delta.key}`)}
							<span class="delta" data-testid={`delta-${delta.key}`}
								>{delta.key} <strong>{delta.delta > 0 ? '+' : ''}{delta.delta}</strong></span
							>
						{/each}
						{#if check.entropyDraws.length}
							{#each check.entropyDraws as draw (`${draw.purpose}-${draw.cursor}`)}
								<span>{draw.purpose} [{draw.cursor}] = <strong>{draw.value}</strong></span>
							{/each}
						{:else if check.deltas.length === 0}<span>no numerical delta</span>{/if}
					</div>
				</li>
			{/each}
		</ol>
	</section>
</main>

<style>
	:global(body) {
		background: #080a0f;
	}
	main {
		min-height: 100vh;
		background: radial-gradient(circle at 78% 5%, #1b2930 0, transparent 34rem), #080a0f;
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 5rem;
		padding: 0 clamp(1.2rem, 4vw, 4rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(6, 8, 12, 0.88);
	}
	.wordmark {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}
	.topbar > div {
		text-align: center;
	}
	.topbar span,
	.topbar strong {
		display: block;
	}
	.topbar span {
		color: #d4a653;
		font-size: 0.48rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.topbar strong {
		margin-top: 0.18rem;
		font:
			400 1rem Georgia,
			serif;
	}
	.topbar > a:last-child {
		justify-self: end;
		color: rgba(244, 240, 232, 0.52);
		font-size: 0.58rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.hero {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: 4rem;
		max-width: 88rem;
		margin: 0 auto;
		padding: clamp(4rem, 9vw, 8rem) 2rem 3.5rem;
	}
	.hero p,
	.panel header span,
	.timeline header span {
		margin: 0 0 0.5rem;
		color: #d4a653;
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.hero h1 {
		margin: 0 0 1rem;
		max-width: 13ch;
		font:
			400 clamp(3rem, 7vw, 6.8rem)/0.88 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	.hero > div > span {
		display: block;
		max-width: 42rem;
		color: rgba(244, 240, 232, 0.5);
		font-size: 0.82rem;
		line-height: 1.7;
	}
	.seal {
		display: grid;
		place-items: center;
		width: 10rem;
		height: 10rem;
		border: 1px solid rgba(242, 147, 143, 0.4);
		border-radius: 50%;
		color: #f2938f;
		text-align: center;
	}
	.seal.verified {
		border-color: rgba(120, 215, 175, 0.45);
		color: #78d7af;
		box-shadow: 0 0 4rem rgba(120, 215, 175, 0.08);
	}
	.seal i,
	.seal strong,
	.seal span {
		display: block;
	}
	.seal i {
		font:
			normal 2rem Georgia,
			serif;
	}
	.seal strong {
		font:
			400 1.2rem Georgia,
			serif;
	}
	.seal span {
		color: currentColor;
		font-size: 0.48rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		max-width: 88rem;
		margin: 0 auto;
		border: 1px solid rgba(255, 255, 255, 0.09);
	}
	.game-over {
		max-width: 88rem;
		margin: 0 auto 1rem;
		padding: 1.25rem 1.5rem;
		border: 1px solid rgba(242, 147, 143, 0.45);
		background: rgba(73, 20, 24, 0.28);
	}
	.game-over span,
	.game-over strong {
		display: block;
	}
	.game-over span {
		color: #f2938f;
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.game-over strong {
		margin-top: 0.3rem;
		font:
			400 1.3rem Georgia,
			serif;
	}
	.game-over p {
		margin: 0.45rem 0 0;
		color: rgba(244, 240, 232, 0.5);
		font-size: 0.68rem;
	}
	.metrics div {
		min-width: 0;
		padding: 1.2rem;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}
	.metrics div:last-child {
		border: 0;
	}
	.metrics span,
	.metrics strong {
		display: block;
	}
	.metrics span {
		margin-bottom: 0.4rem;
		color: rgba(244, 240, 232, 0.35);
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.metrics strong {
		overflow: hidden;
		color: #7fd8e9;
		font:
			400 1rem ui-monospace,
			monospace;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		max-width: 88rem;
		margin: 1rem auto;
	}
	.panel,
	.timeline {
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(10, 12, 18, 0.72);
	}
	.panel > header {
		padding: 1.4rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}
	.panel h2,
	.timeline h2 {
		margin: 0;
		font:
			400 1.65rem Georgia,
			serif;
	}
	.actors article {
		display: grid;
		grid-template-columns: 2.5rem 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.4rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.sigil {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid rgba(212, 166, 83, 0.3);
		border-radius: 50%;
		color: #d4a653;
		font:
			400 1rem Georgia,
			serif;
	}
	.actors article strong,
	.actors article span {
		display: block;
	}
	.actors article strong {
		font:
			400 1rem Georgia,
			serif;
	}
	.actors article span {
		margin-top: 0.2rem;
		color: rgba(244, 240, 232, 0.38);
		font-size: 0.58rem;
		text-transform: capitalize;
	}
	.actors article code {
		color: #78d7af;
		font-size: 0.65rem;
	}
	.travel-proof {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.35rem 1rem;
		padding: 0.9rem 1.4rem;
		border-bottom: 1px solid rgba(127, 216, 233, 0.15);
		background: rgba(40, 91, 104, 0.12);
	}
	.travel-proof span {
		grid-column: 1 / -1;
		color: #7fd8e9;
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.travel-proof strong {
		font:
			400 0.8rem Georgia,
			serif;
	}
	.travel-proof code {
		color: rgba(244, 240, 232, 0.45);
		font-size: 0.56rem;
	}
	.routine-profile {
		padding: 1rem 1.4rem;
		border-bottom: 1px solid rgba(212, 166, 83, 0.16);
		background: linear-gradient(120deg, rgba(212, 166, 83, 0.07), transparent 45%), #090c12;
	}
	.mind-line,
	.habit-line {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr) auto;
		align-items: baseline;
		gap: 0.7rem;
		padding: 0.35rem 0;
	}
	.routine-profile span {
		color: rgba(244, 240, 232, 0.34);
		font-size: 0.48rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.routine-profile strong {
		font:
			400 0.72rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.routine-profile code {
		color: #d4a653;
		font-size: 0.54rem;
	}
	.daily-plan {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		margin-top: 0.8rem;
		background: rgba(255, 255, 255, 0.08);
	}
	.daily-plan header {
		grid-column: 1 / -1;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.55rem 0.7rem;
		background: #10131a;
	}
	.daily-plan > div {
		min-width: 0;
		padding: 0.65rem;
		background: #0b0e14;
	}
	.daily-plan > div strong,
	.daily-plan > div code {
		display: block;
		margin-top: 0.28rem;
	}
	.daily-plan > div.active {
		background: rgba(212, 166, 83, 0.16);
	}
	.daily-plan > div.complete code {
		color: #78d7af;
	}
	.routine-resolution {
		margin-top: 0.7rem;
		border: 1px solid rgba(127, 216, 233, 0.22);
	}
	.routine-resolution header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem;
		background: rgba(40, 91, 104, 0.16);
	}
	.routine-resolution header span,
	.routine-resolution header strong {
		display: block;
	}
	.routine-resolution > div:not(header) {
		display: flex;
		justify-content: space-between;
		padding: 0.35rem 0.65rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	.routine-resolution > div.ineligible {
		opacity: 0.35;
	}
	.routine-resolution p {
		margin: 0;
		padding: 0.55rem 0.65rem;
		color: rgba(244, 240, 232, 0.48);
		font-size: 0.58rem;
		line-height: 1.5;
	}
	.hashes {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr);
		gap: 0.55rem 1rem;
		padding: 1.2rem 1.4rem;
	}
	.survival-stats,
	.resource-ledger {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.06);
	}
	.survival-stats div,
	.resource-ledger div {
		padding: 0.8rem 1rem;
		background: #0b0e14;
	}
	.survival-stats span,
	.resource-ledger span,
	.survival-stats strong,
	.resource-ledger strong {
		display: block;
	}
	.survival-stats span,
	.resource-ledger span {
		color: rgba(244, 240, 232, 0.32);
		font-size: 0.48rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.survival-stats strong,
	.resource-ledger strong {
		margin-top: 0.25rem;
		color: #7fd8e9;
		font:
			0.68rem ui-monospace,
			monospace;
	}
	.resource-ledger strong {
		color: #d4a653;
		font-size: 1rem;
	}
	.injuries,
	.legacy {
		margin: 0;
		padding: 0.8rem 1.4rem;
		border-top: 1px solid rgba(242, 147, 143, 0.2);
		color: #f2938f;
		font-size: 0.62rem;
	}
	.hashes span {
		color: rgba(244, 240, 232, 0.3);
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.hashes code {
		overflow: hidden;
		color: #6c8b95;
		font-size: 0.58rem;
		text-overflow: ellipsis;
	}
	.controls > p {
		margin: 0;
		padding: 1.4rem;
		color: rgba(244, 240, 232, 0.48);
		font-size: 0.76rem;
		line-height: 1.65;
	}
	.buttons {
		display: flex;
		gap: 0.6rem;
		padding: 0 1.4rem 1.2rem;
	}
	.buttons.wrap {
		flex-wrap: wrap;
		padding-top: 0.75rem;
	}
	.buttons.wrap button {
		flex: 1 1 8rem;
	}
	.control-group {
		margin: 0 1.4rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.clock-proof {
		background:
			radial-gradient(circle at 100% 0, rgba(127, 216, 233, 0.12), transparent 45%), #0b0e14;
	}
	.clock-proof > div:first-child {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: baseline;
		gap: 0.7rem;
		padding: 0.75rem 0.8rem;
		border-bottom: 1px solid rgba(127, 216, 233, 0.14);
	}
	.clock-proof > div:first-child span,
	.clock-times span {
		color: rgba(244, 240, 232, 0.35);
		font-size: 0.48rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.clock-proof > div:first-child strong {
		color: #7fd8e9;
		font:
			400 1rem Georgia,
			serif;
	}
	.clock-proof > div:first-child code {
		color: #78d7af;
		font-size: 0.52rem;
	}
	.clock-times {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.06);
	}
	.clock-times p {
		margin: 0;
		padding: 0.65rem 0.75rem;
		background: #090c12;
	}
	.clock-times span,
	.clock-times strong {
		display: block;
	}
	.clock-times strong {
		margin-top: 0.28rem;
		color: #d4a653;
		font:
			0.58rem ui-monospace,
			monospace;
	}
	.control-group > span {
		display: block;
		padding: 0.7rem 0.8rem 0;
		color: rgba(244, 240, 232, 0.35);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.control-group .buttons {
		padding-right: 0.75rem;
		padding-bottom: 0.75rem;
		padding-left: 0.75rem;
	}
	.routine-controls > p {
		margin: 0;
		padding: 0.55rem 0.8rem 0;
		color: rgba(244, 240, 232, 0.48);
		font-size: 0.62rem;
		line-height: 1.5;
	}
	.first-ember-proof {
		margin: 0.7rem;
		padding: 0.75rem;
		border: 1px solid rgba(215, 119, 62, 0.28);
		background: rgba(118, 48, 21, 0.12);
	}
	.first-ember-proof > div:first-child {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.4rem;
	}
	.first-ember-proof strong,
	.first-ember-proof small {
		display: block;
	}
	.first-ember-proof strong {
		color: #d7773e;
		font:
			400 0.75rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.first-ember-proof small,
	.first-ember-proof code {
		color: rgba(244, 240, 232, 0.42);
		font-size: 0.5rem;
	}
	.first-ember-proof > button {
		margin-top: 0.75rem;
		padding: 0.6rem 0.7rem;
	}
	.social-proof {
		margin: 0.7rem;
		padding: 0.8rem;
		border: 1px solid rgba(127, 216, 233, 0.2);
		background: rgba(35, 81, 93, 0.08);
	}
	.social-proof-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.7rem;
	}
	.social-proof-heading strong {
		color: #7fd8e9;
		font:
			400 0.75rem Georgia,
			serif;
	}
	.social-proof-heading small,
	.social-proof article > span,
	.social-promise span {
		color: rgba(244, 240, 232, 0.4);
		font-size: 0.48rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.social-proof-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		background: rgba(255, 255, 255, 0.07);
	}
	.social-proof article {
		min-width: 0;
		padding: 0.7rem;
		background: #090c12;
	}
	.social-proof article p,
	.social-promise {
		margin: 0.45rem 0 0;
		color: rgba(244, 240, 232, 0.72);
		font-size: 0.58rem;
		line-height: 1.45;
	}
	.social-proof article p strong {
		display: block;
		color: #d4a653;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.social-proof article code {
		display: block;
		margin-top: 0.25rem;
		overflow-wrap: anywhere;
		color: rgba(127, 216, 233, 0.58);
		font-size: 0.48rem;
	}
	.social-promise span {
		display: block;
		margin-bottom: 0.15rem;
	}
	.communication-ledger {
		margin-top: 0.8rem;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(127, 216, 233, 0.16);
	}
	.communication-act {
		margin-top: 0.5rem;
		padding: 0.7rem;
		border: 1px solid rgba(212, 166, 83, 0.16);
		background: rgba(8, 9, 14, 0.8);
	}
	.communication-act header {
		display: flex;
		justify-content: space-between;
		gap: 0.8rem;
		color: #d4a653;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.communication-act header code {
		overflow-wrap: anywhere;
		color: rgba(127, 216, 233, 0.48);
		font-size: 0.45rem;
		text-transform: none;
	}
	.communication-act blockquote {
		margin: 0.6rem 0;
		color: rgba(244, 240, 232, 0.8);
		font:
			400 0.7rem/1.5 Georgia,
			serif;
	}
	.witness-chain {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
	}
	.witness-chain p {
		margin: 0;
		padding: 0.45rem;
		background: rgba(127, 216, 233, 0.06);
	}
	.witness-chain strong,
	.witness-chain code {
		display: block;
	}
	.witness-chain strong {
		font-size: 0.48rem;
	}
	.witness-chain code {
		margin-top: 0.2rem;
		color: rgba(127, 216, 233, 0.52);
		font-size: 0.43rem;
	}
	.facility-list {
		display: grid;
		gap: 1px;
		margin-top: 0.7rem;
		background: rgba(255, 255, 255, 0.08);
	}
	.facility-list article {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.45rem;
		padding: 0.55rem 0.65rem;
		background: #0b0e14;
	}
	.facility-list strong,
	.facility-list small {
		display: block;
	}
	.facility-list strong {
		font:
			400 0.72rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.facility-list small {
		margin-top: 0.15rem;
		color: rgba(244, 240, 232, 0.4);
		font-size: 0.48rem;
		text-transform: uppercase;
	}
	button.compact {
		flex: none;
		padding: 0.48rem 0.55rem;
		font-size: 0.48rem;
	}
	.assignment-line {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem;
		border-top: 1px solid rgba(120, 215, 175, 0.18);
		color: #78d7af;
		font-size: 0.58rem;
		text-transform: capitalize;
	}
	.schedule {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.6rem 1rem;
		padding: 0.8rem;
	}
	.schedule > span {
		grid-column: 1 / -1;
		padding: 0;
	}
	.schedule strong {
		color: #7fd8e9;
		font:
			0.62rem ui-monospace,
			monospace;
	}
	.schedule button {
		padding: 0.65rem 0.8rem;
	}
	.proof-buttons {
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
	button.danger {
		border-color: #f2938f;
		background: #f2938f;
		color: #13090b;
	}
	button.secondary.danger {
		background: transparent;
		color: #f2938f;
	}
	button {
		flex: 1;
		padding: 0.8rem;
		border: 1px solid #d4a653;
		background: #d4a653;
		color: #0b0c10;
		cursor: pointer;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	button.secondary {
		background: transparent;
		color: #d4a653;
	}
	button:disabled {
		cursor: wait;
		opacity: 0.45;
	}
	output,
	.error {
		display: block;
		margin: 0 1.4rem 1rem;
		padding: 0.7rem;
		border: 1px solid rgba(120, 215, 175, 0.3);
		color: #78d7af;
		font:
			0.64rem ui-monospace,
			monospace;
	}
	.error {
		border-color: rgba(242, 147, 143, 0.35);
		color: #f2938f;
	}
	.legal {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.7rem;
		padding: 1rem 1.4rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
	.legal span {
		color: rgba(244, 240, 232, 0.3);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.legal code {
		color: #7fd8e9;
		font-size: 0.6rem;
	}
	.timeline {
		max-width: 88rem;
		margin: 1rem auto 6rem;
	}
	.timeline > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.timeline header p {
		margin: 0;
		color: rgba(244, 240, 232, 0.3);
		font:
			0.58rem ui-monospace,
			monospace;
	}
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: 2.5rem 1fr 1.2fr minmax(8rem, 0.8fr);
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	li:last-child {
		border: 0;
	}
	.sequence {
		color: rgba(244, 240, 232, 0.25);
		font:
			0.62rem ui-monospace,
			monospace;
	}
	.event strong,
	.event span {
		display: block;
	}
	.event p {
		margin: 0.35rem 0 0;
		color: rgba(244, 240, 232, 0.45);
		font-size: 0.62rem;
		line-height: 1.4;
	}
	.event strong {
		font:
			400 0.82rem Georgia,
			serif;
	}
	.event span {
		margin-top: 0.2rem;
		color: #f2938f;
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	li.passed .event span {
		color: #78d7af;
	}
	.transition {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.transition code {
		color: #6c8b95;
		font-size: 0.58rem;
	}
	.transition i {
		color: rgba(244, 240, 232, 0.2);
		font-style: normal;
	}
	.draws {
		color: rgba(244, 240, 232, 0.32);
		font:
			0.56rem ui-monospace,
			monospace;
	}
	.draws span,
	.draws strong {
		display: block;
	}
	.draws strong {
		color: #d4a653;
		font-size: 1rem;
	}
	.draws .delta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
		color: rgba(244, 240, 232, 0.5);
	}
	.draws .delta strong {
		display: inline;
		color: #78d7af;
		font-size: 0.72rem;
	}
	@media (max-width: 760px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.hero {
			grid-template-columns: 1fr;
		}
		.seal {
			width: 8rem;
			height: 8rem;
		}
		.metrics {
			grid-template-columns: 1fr 1fr;
			margin: 0 1rem;
		}
		.metrics div:nth-child(2) {
			border-right: 1px solid rgba(255, 255, 255, 0.08);
		}
		.metrics div:nth-child(2n) {
			border-right: 0;
		}
		.metrics div:nth-child(-n + 4) {
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}
		.survival-stats {
			grid-template-columns: 1fr 1fr;
		}
		.mind-line,
		.habit-line {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}
		.daily-plan {
			grid-template-columns: 1fr 1fr;
		}
		.clock-times {
			grid-template-columns: 1fr 1fr;
		}
		.grid {
			grid-template-columns: 1fr;
			margin: 1rem;
		}
		.timeline {
			margin: 1rem;
		}
		li {
			grid-template-columns: 2rem 1fr;
		}
		.transition,
		.draws {
			grid-column: 2;
		}
	}
</style>
