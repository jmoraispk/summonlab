<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { MissionLifecycleRequest } from '@summonlab/contracts';
	import HeroRig from '$lib/components/HeroRig.svelte';

	let { data } = $props();
	let busy = $state(false);
	let selectedHeroIds = $state<string[]>([]);
	let selectionInitialized = $state(false);
	let resultMessage = $state('');
	let errorMessage = $state('');
	let selectedMasterActionId = $state('');

	const engineState = $derived(data.report.snapshot.state);
	const isPortal = $derived(engineState.schemaVersion === 15);
	const isAttemptAftermath = $derived(engineState.schemaVersion === 18);
	const isMasterRisk = $derived(engineState.schemaVersion === 17 || isAttemptAftermath);
	const isAftermath = $derived(
		engineState.schemaVersion === 16 || engineState.schemaVersion === 17 || isAttemptAftermath
	);
	const isGameOver = $derived(engineState.status === 'game_over');
	const mission = $derived(
		engineState.schemaVersion === 13 ||
			engineState.schemaVersion === 15 ||
			engineState.schemaVersion === 16 ||
			engineState.schemaVersion === 17 ||
			engineState.schemaVersion === 18
			? engineState.mission
			: null
	);
	const attempt = $derived(mission?.attempt ?? null);
	const turnState = $derived(attempt?.turnState ?? null);
	const portalTurnState = $derived(
		engineState.schemaVersion === 15 ? (engineState.mission.attempt?.turnState ?? null) : null
	);
	const combatTurnState = $derived(
		engineState.schemaVersion === 13 ||
			engineState.schemaVersion === 16 ||
			engineState.schemaVersion === 17 ||
			engineState.schemaVersion === 18
			? (engineState.mission.attempt?.turnState ?? null)
			: null
	);
	const aftermath = $derived(
		engineState.schemaVersion === 16 ||
			engineState.schemaVersion === 17 ||
			engineState.schemaVersion === 18
			? engineState.mission.aftermath
			: null
	);
	const portalSettlementIron = $derived(
		engineState.schemaVersion === 15 ? engineState.settlement.resources['iron-ore'] : 0
	);
	const lastRound = $derived(turnState?.rounds.at(-1) ?? null);
	const phase = $derived(attempt?.status ?? 'available');
	const redSlagImminent = $derived(
		isMasterRisk &&
			(phase === 'deployed' || phase === 'resolving') &&
			(turnState?.roundNumber ?? 0) + 1 >= 2 &&
			((turnState?.roundNumber ?? 0) + 1) % 2 === 0
	);
	const hero = $derived(Object.values(engineState.heroes)[0]);
	const heroSelected = $derived(hero ? selectedHeroIds.includes(hero.heroId) : false);
	const terminal = $derived(
		attempt
			? ['success', 'failure', 'retreat', 'canceled', 'death'].includes(attempt.status)
			: false
	);
	const eventRows = $derived(
		data.report.checks
			.filter((check) => check.eventType.startsWith('mission.'))
			.slice()
			.reverse()
	);
	const masterTurnActions = $derived(
		(data.report.legalActionsByActor[engineState.master.masterId] ?? []).filter(
			(action) =>
				action.actionId.startsWith('mission.move.') ||
				action.actionId.startsWith('mission.inspect.') ||
				action.actionId.startsWith('mission.recover.') ||
				action.actionId.startsWith('mission.mine.') ||
				action.actionId.startsWith('mission.attack.') ||
				action.actionId === 'mission.hold'
		)
	);
	const retreatAvailable = $derived(
		(data.report.legalActionsByActor[engineState.master.masterId] ?? []).some(
			(action) => action.actionId === 'mission.retreat'
		)
	);

	$effect(() => {
		if (selectionInitialized || !hero) return;
		selectedHeroIds =
			attempt?.status === 'preparing'
				? [...attempt.party.heroIds]
				: hero.lifeState === 'active'
					? [hero.heroId]
					: [];
		selectionInitialized = true;
	});

	$effect(() => {
		if (hero?.lifeState !== 'active' && selectedHeroIds.includes(hero?.heroId ?? '')) {
			selectedHeroIds = selectedHeroIds.filter((heroId) => heroId !== hero?.heroId);
		}
	});

	$effect(() => {
		if (
			selectedMasterActionId &&
			!masterTurnActions.some((action) => action.actionId === selectedMasterActionId)
		) {
			selectedMasterActionId = '';
		}
	});

	function toggleHero() {
		if (!hero) return;
		selectedHeroIds = heroSelected ? [] : [hero.heroId];
	}

	async function act(payload: MissionLifecycleRequest, success: string) {
		busy = true;
		resultMessage = '';
		errorMessage = '';
		try {
			const response = await fetch(`/api/runs/${engineState.runId}/mission`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(body.message ?? 'The mission engine rejected that action.');
			resultMessage = success;
			await invalidateAll();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The mission transition failed.';
		} finally {
			busy = false;
		}
	}

	function prepare() {
		return act(
			{
				action: 'prepare',
				heroIds: selectedHeroIds,
				...(isPortal ? { missionId: 'iron-moon' } : {})
			},
			'The threshold roster is reserved in the authoritative event stream.'
		);
	}

	async function resolveTurn() {
		if (!selectedMasterActionId) return;
		await act(
			{ action: 'resolve-turn', masterActionId: selectedMasterActionId },
			'Every party choice resolved in authoritative initiative order.'
		);
		selectedMasterActionId = '';
	}

	function actorName(actorId: string) {
		const monster = turnState?.monsters[actorId];
		if (monster) return monster.label;
		return actorId === engineState.master.masterId
			? 'The Master'
			: actorId === hero?.heroId
				? data.proof.manifest.displayName
				: 'Unknown hero';
	}

	function guardFor(actorId: string) {
		return turnState?.partyGuard[actorId] ?? null;
	}

	function itemForHero(heroId: string) {
		if (
			engineState.schemaVersion !== 16 &&
			engineState.schemaVersion !== 17 &&
			engineState.schemaVersion !== 18
		)
			return null;
		const itemId = engineState.heroes[heroId]?.equipment.mainHand;
		return itemId ? engineState.items[itemId] : null;
	}

	function nodePosition(nodeId: string) {
		return data.arena.nodes.find((node) => node.nodeId === nodeId)?.position ?? { x: 0, y: 0 };
	}
</script>

<svelte:head>
	<title>{data.missionDefinition.displayName} · summonlab</title>
	<meta name="description" content={data.missionDefinition.tagline} />
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div class="run-binding">
			<span>Run {engineState.runId.slice(0, 8)}</span>
			<code data-testid="run-version"
				>v{engineState.version} · cursor {engineState.eventCursor}</code
			>
		</div>
		<a class="utility" href={resolve('/replay/[runId]', { runId: engineState.runId })}
			>inspect replay</a
		>
	</header>

	<section class="hero-copy">
		<div>
			<p class="eyebrow">
				{isPortal
					? 'Portal World / extraction clock'
					: isMasterRisk
						? 'Tower Floor 03 / the Master is mortal'
						: isAftermath
							? 'Tower Floor 03 / persistent consequences'
							: 'Tower Floor 01 / authoritative threshold'}
			</p>
			<h1>
				{isPortal
					? 'The Closing'
					: isMasterRisk
						? 'The Last'
						: isAftermath
							? 'The Red'
							: 'The Unlit'}<br /><em
					>{isPortal ? 'Scar' : isMasterRisk ? 'Command' : isAftermath ? 'Tithe' : 'Muster'}</em
				>
			</h1>
		</div>
		<div class="mission-brief">
			<span class="status-light"></span>
			<p>{data.missionDefinition.objectiveSummary}</p>
			<small
				>Master required · 1–5 total · {isPortal
					? `${data.missionDefinition.maximumRounds} rounds to return`
					: 'no reserve party'}</small
			>
		</div>
	</section>

	<section class="binding-strip" aria-label="Immutable mission binding">
		<div>
			<span>Content binding</span>
			<strong>{mission?.binding.missionId}</strong>
		</div>
		<div>
			<span>Package</span>
			<strong>{mission?.binding.contentVersion}</strong>
		</div>
		<code>{mission?.binding.contentHash}</code>
	</section>

	<section class="threshold-shell" data-testid="mission-threshold">
		<div class="threshold-scene" class:opened={phase !== 'available' && phase !== 'preparing'}>
			<div class="tower-number">{isPortal ? '08' : isAftermath ? '03' : '01'}</div>
			{#if attempt && ['deployed', 'resolving', 'extraction', 'success', 'failure', 'retreat', 'death'].includes(attempt.status)}
				<div class="tactical-board" data-testid="mission-board">
					<svg viewBox={`0 0 ${data.arena.width} ${data.arena.height}`} aria-hidden="true">
						{#each data.arena.edges as edge (edge.edgeId)}
							<polyline
								class:guarded={edge.exposure === 'guarded'}
								class:exposed={edge.exposure === 'exposed'}
								points={edge.visualPath.map((point) => `${point.x},${point.y}`).join(' ')}
							/>
						{/each}
					</svg>
					{#each data.arena.nodes as node (node.nodeId)}
						<div
							class="arena-node"
							class:visited={node.visited}
							class:objective={node.kind === 'objective'}
							style={`left:${(node.position.x / data.arena.width) * 100}%;top:${(node.position.y / data.arena.height) * 100}%`}
						>
							<i></i><span>{node.label}</span>
						</div>
					{/each}
					{#each attempt.party.memberIds as actorId, index (actorId)}
						{@const position = nodePosition(attempt.positions[actorId] ?? attempt.entryNodeId)}
						<div
							class="actor-token"
							class:master={actorId === engineState.master.masterId}
							style={`left:calc(${(position.x / data.arena.width) * 100}% + ${(index % 3) * 18 - 18}px);top:calc(${(position.y / data.arena.height) * 100}% - ${index * 7 + 34}px)`}
							title={actorName(actorId)}
						>
							{actorId === engineState.master.masterId
								? 'M'
								: data.proof.manifest.displayName.slice(0, 1)}
						</div>
					{/each}
					{#each Object.values(turnState?.monsters ?? {}).filter((monster) => monster.status === 'active') as monster (monster.monsterId)}
						{@const position = nodePosition(monster.nodeId)}
						<div
							class="monster-token"
							style={`left:${(position.x / data.arena.width) * 100}%;top:${(position.y / data.arena.height) * 100}%`}
							title={`${monster.label} · ${monster.vitality}/${monster.maximumVitality} vitality`}
							data-testid="monster-token"
						>
							<span>G</span><small>{monster.vitality}</small>
						</div>
					{/each}
					{#if !isPortal && combatTurnState?.objective.status === 'carried'}
						<div class="objective-banner">
							{data.missionDefinition.objectiveTitle} carried by {actorName(
								combatTurnState.objective.carrierId!
							)}
						</div>
					{:else if !isPortal && combatTurnState?.objective.status === 'delivered'}
						<div class="objective-banner delivered">
							{data.missionDefinition.objectiveTitle} returned to threshold
						</div>
					{:else if portalTurnState}
						<div class="objective-banner" data-testid="portal-board-status">
							{portalTurnState.objective.minedAmount}/{portalTurnState.objective.quota} ore secured ·
							{portalTurnState.portal.roundsRemaining} rounds remain
						</div>
					{/if}
				</div>
			{:else}
				<div class="arch">
					<div class="portal"><span></span></div>
				</div>
				<div class="floor-lines"></div>
			{/if}
			<div class="scene-caption">
				<span>{phase === 'available' ? 'Threshold dormant' : phase.replaceAll('-', ' ')}</span>
				<strong
					>{attempt
						? `Attempt ${attempt.ordinal} · Round ${turnState?.roundNumber ?? 0}/${data.missionDefinition.maximumRounds}`
						: 'No attempt committed'}</strong
				>
			</div>
		</div>

		<div class="operations">
			{#if portalTurnState}
				<div class="portal-clock {portalTurnState.portal.pressureStage}" data-testid="portal-clock">
					<div>
						<span>Scar integrity</span>
						<strong>{portalTurnState.portal.roundsRemaining}</strong>
						<small>rounds remaining</small>
					</div>
					<div>
						<span>Pressure</span>
						<strong>{portalTurnState.portal.pressureStage}</strong>
						<small>collapse at zero</small>
					</div>
					<div>
						<span>Ore quota</span>
						<strong
							>{portalTurnState.objective.minedAmount}/{portalTurnState.objective.quota}</strong
						>
						<small>credit only on extraction</small>
					</div>
				</div>
			{/if}
			<div class="phase-heading">
				<div>
					<span>Mission state</span>
					<h2>{isGameOver ? 'game over' : phase.replaceAll('-', ' ')}</h2>
				</div>
				<strong
					>{attempt
						? `${attempt.party.memberIds.length}/5`
						: `${selectedHeroIds.length + 1}/5`}</strong
				>
			</div>

			{#if phase === 'available' || terminal}
				<div class="instruction">
					<span>{terminal ? 'Attempt sealed' : 'Party preparation'}</span>
					<p>
						{terminal
							? isGameOver
								? 'The Master died permanently. Every unfinished activity was canceled; the chronicle and replay remain available.'
								: attempt?.status === 'success'
									? isPortal
										? `Iron Moon extraction credited ${portalTurnState?.portal.extractedAmount ?? 0} ore.`
										: 'Floor 01 is complete. This run cannot farm the First Ember twice.'
									: attempt?.status === 'death'
										? 'A summoned hero died permanently. The wound, damaged gear, witnesses, and social reaction remain in this run.'
										: 'The event stream keeps this outcome. A legal retry creates a new attempt ID.'
							: 'Choose who crosses with the Master. Selection reserves heroes only after you lock the roster.'}
					</p>
				</div>
			{/if}

			<div class="party-cards" aria-label="Threshold party">
				<article
					class="party-card master-card selected"
					class:fatal={isGameOver}
					data-testid="master-roster-card"
				>
					<div class="portrait master-portrait"><span></span></div>
					<div>
						<span>Required · leader</span>
						<strong>The Master</strong>
						<small
							>{engineState.master.health} / {engineState.master.maxHealth} vitality · {engineState
								.master.lifeState}{guardFor(engineState.master.masterId)
								? ` · guard ${guardFor(engineState.master.masterId)!.guard}/${guardFor(engineState.master.masterId)!.maximumGuard}`
								: ''}</small
						>
					</div>
					<b>{isGameOver ? 'DEAD' : 'LOCKED'}</b>
				</article>
				{#if hero}
					<button
						type="button"
						class="party-card hero-card"
						class:selected={attempt?.status === 'preparing'
							? attempt.party.heroIds.includes(hero.heroId)
							: heroSelected}
						disabled={busy ||
							hero.lifeState !== 'active' ||
							(attempt !== null && attempt.status !== 'preparing' && !terminal)}
						onclick={toggleHero}
						data-testid="hero-roster-card"
					>
						<div class="portrait hero-portrait">
							<HeroRig manifest={data.proof.manifest} compact />
						</div>
						<div>
							<span>{'✦'.repeat(data.proof.manifest.rarityStars)} · summoned hero</span>
							<strong>{data.proof.manifest.displayName}</strong>
							<small
								>Lv. {hero.progression.level} · {hero.health} / {hero.maxHealth} vitality · {hero.lifeState}{guardFor(
									hero.heroId
								)
									? ` · guard ${guardFor(hero.heroId)!.guard}/${guardFor(hero.heroId)!.maximumGuard}`
									: ''}{itemForHero(hero.heroId)
									? ` · gear ${itemForHero(hero.heroId)!.durability}/${itemForHero(hero.heroId)!.maxDurability}`
									: ''}</small
							>
						</div>
						<b
							>{isGameOver
								? 'SEALED'
								: hero.lifeState === 'active'
									? heroSelected
										? 'READY'
										: 'STAY'
									: 'DEAD'}</b
						>
					</button>
				{/if}
			</div>

			<div class="action-deck">
				{#if isGameOver}
					<div class="terminal-card" data-testid="mission-game-over">
						<span>Terminal run state</span>
						<strong>The Master is dead. The command ends here.</strong>
						<p>
							No actor has a legal move. The chronicle and deterministic replay remain inspectable.
						</p>
						<a href={resolve('/replay/[runId]', { runId: engineState.runId })}
							>Open the sealed replay</a
						>
					</div>
				{:else if phase === 'available' || (terminal && attempt?.status !== 'success')}
					<button class="primary" disabled={busy} onclick={prepare} data-testid="prepare-party">
						<span>Lock threshold roster</span><small
							>creates attempt {mission ? mission.attemptCount + 1 : 1}</small
						>
					</button>
				{:else if phase === 'preparing'}
					<button
						class="primary"
						disabled={busy}
						onclick={() => act({ action: 'deploy' }, 'Party deployment committed.')}
						data-testid="deploy-party"
						><span
							>{isPortal
								? 'Cross the silver scar'
								: isAftermath
									? 'Enter Floor 03'
									: 'Enter Floor 01'}</span
						><small>commit all selected members</small></button
					>
					<button
						disabled={busy}
						onclick={() =>
							act({ action: 'revise-party', heroIds: selectedHeroIds }, 'Prepared party revised.')}
						>revise roster</button
					>
					<button
						class="quiet"
						disabled={busy}
						onclick={() => act({ action: 'cancel' }, 'Party released before deployment.')}
						>stand down</button
					>
				{:else if phase === 'deployed' || phase === 'resolving'}
					<div class="turn-objective">
						<span>Round {(turnState?.roundNumber ?? 0) + 1}</span>
						<strong
							>{turnState?.objective.status ?? 'available'} · {data.missionDefinition
								.objectiveTitle}</strong
						>
						<small>Choose only the Master. Every summoned hero chooses independently.</small>
					</div>
					{#if turnState && (turnState.currentThreatIntents.length > 0 || redSlagImminent)}
						<div class="threat-ledger" data-testid="threat-intents">
							<div><span>Declared threats</span><small>visible before you commit</small></div>
							{#if redSlagImminent}
								<article class="hazard-warning" data-testid="red-slag-warning">
									<strong>RED SLAG VENTS</strong>
									<p>The Red Gallery will strip 1 guard from every actor beneath its vents.</p>
									<small>environment · resolves after initiative</small>
								</article>
							{/if}
							{#each turnState.currentThreatIntents as intent (intent.monsterId)}
								<article>
									<strong>{actorName(intent.monsterId)}</strong>
									<p>{intent.telegraph}</p>
									<small>{intent.kind.replaceAll('-', ' ')} · {intent.anticipatedEffect}</small>
								</article>
							{/each}
						</div>
					{/if}
					<div class="turn-choices" data-testid="master-turn-actions">
						{#each masterTurnActions as choice (choice.actionId)}
							<button
								type="button"
								class:selected={choice.actionId === selectedMasterActionId}
								disabled={busy}
								onclick={() => (selectedMasterActionId = choice.actionId)}
							>
								<strong>{choice.label}</strong><small>{choice.description}</small>
							</button>
						{/each}
					</div>
					<button
						class="primary resolve"
						disabled={busy || !selectedMasterActionId}
						onclick={resolveTurn}
						data-testid="resolve-turn"
						><span>Commit round</span><small>hero policy → seeded initiative → engine</small
						></button
					>
					{#if retreatAvailable}
						<button
							class="quiet"
							disabled={busy}
							onclick={() => act({ action: 'retreat' }, 'The party retreated alive.')}
							data-testid="retreat-party">retreat at threshold</button
						>
					{/if}
				{:else if phase === 'extraction'}
					<button
						class="primary ember"
						disabled={busy}
						onclick={() =>
							act(
								{ action: 'extract' },
								isPortal
									? 'Iron Moon ore reached settlement stores.'
									: 'Floor 01 extraction succeeded.'
							)}
						data-testid="extract-party"
						><span
							>{isPortal
								? 'Cross before collapse'
								: isAftermath
									? 'Carry the cache home'
									: 'Extract the First Ember'}</span
						><small>all survivors are at the boundary</small></button
					>
					<button
						class="quiet"
						disabled={busy}
						onclick={() => act({ action: 'retreat' }, 'The objective was abandoned.')}
						>abandon + retreat</button
					>
				{/if}
			</div>

			{#if resultMessage}<p class="result" role="status">{resultMessage}</p>{/if}
			{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
		</div>
	</section>

	{#if portalTurnState}
		<section class="ore-console" data-testid="ore-console">
			<div class="ore-heading">
				<div>
					<span>Attempt-local cargo</span>
					<h2>Nothing is yours until you return.</h2>
				</div>
				<strong>{portalSettlementIron} settlement iron</strong>
			</div>
			<div class="ore-grid">
				<div>
					<h3>Finite deposits</h3>
					{#each Object.values(portalTurnState.portal.deposits) as deposit (deposit.depositId)}
						<article>
							<span>{deposit.nodeId.replaceAll('-', ' ')}</span>
							<strong>{deposit.remainingAmount}/{deposit.initialAmount}</strong>
							<small>{deposit.mineAmountPerAction} ore / action</small>
						</article>
					{/each}
				</div>
				<div>
					<h3>Carried ore</h3>
					{#each Object.values(portalTurnState.portal.cargo) as cargo (cargo.actorId)}
						<article>
							<span>{actorName(cargo.actorId)}</span>
							<strong>{cargo.amount}/{cargo.capacity}</strong>
							<small>{cargo.amount > 0 ? 'lost on collapse' : 'cargo empty'}</small>
						</article>
					{/each}
				</div>
				<div class="ore-events">
					<h3>Ore ledger</h3>
					{#if portalTurnState.portal.oreLedger.length === 0}
						<p>No ore has changed hands.</p>
					{:else}
						{#each portalTurnState.portal.oreLedger.slice().reverse() as entry (entry.entryId)}
							<article>
								<span>#{entry.sequence} · {entry.kind}</span>
								<strong>{entry.amount} iron ore</strong>
								<small>round {entry.roundNumber} · {actorName(entry.actorId)}</small>
							</article>
						{/each}
					{/if}
				</div>
			</div>
		</section>
	{/if}

	{#if aftermath}
		<section class="aftermath-console" data-testid="aftermath-console">
			<div class="aftermath-heading">
				<div>
					<span>Persistent consequence ledger</span>
					<h2>The body remembers. Witnesses do too.</h2>
				</div>
				<strong>{aftermath.consequences.length} recorded</strong>
			</div>
			{#if aftermath.consequences.length === 0}
				<p class="aftermath-empty">
					Guard absorbs the first blows. Once exposed, the next impact changes settlement state.
				</p>
			{:else}
				<div class="aftermath-grid">
					{#each aftermath.consequences
						.slice()
						.reverse() as consequence (consequence.consequenceId)}
						<article class:fatal={consequence.fatal} data-testid="aftermath-entry">
							<div class="harm-mark">{consequence.fatal ? '†' : '✦'}</div>
							<div>
								<span
									>Round {consequence.roundNumber} · {consequence.nodeId.replaceAll('-', ' ')}</span
								>
								<strong>{consequence.fatal ? 'Permanent death' : consequence.injury?.kind}</strong>
								<p>{consequence.summary}</p>
								<small
									>{consequence.healthBefore} → {consequence.healthAfter} health · {'itemWear' in
										consequence && consequence.itemWear
										? `gear ${consequence.itemWear.durabilityBefore} → ${consequence.itemWear.durabilityAfter}`
										: 'no equipped gear wear'} · {consequence.witnesses.length} surviving witness{consequence
										.witnesses.length === 1
										? ''
										: 'es'}</small
								>
							</div>
						</article>
					{/each}
				</div>
			{/if}
			{#if 'archives' in aftermath && aftermath.archives.length > 0}
				<div class="aftermath-grid archived-attempts" data-testid="aftermath-archives">
					{#each aftermath.archives.slice().reverse() as archive (archive.attemptId)}
						<article>
							<div class="harm-mark">⌁</div>
							<div>
								<span>Attempt {archive.ordinal} · {archive.binding.missionId}</span>
								<strong>{archive.outcome} · {archive.consequences.length} archived</strong>
								<p>
									Rounds 0–{archive.finalRoundNumber} remain bound to {archive.attemptId.slice(
										0,
										8
									)}.
								</p>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if lastRound}
		<section class="initiative-report" data-testid="initiative-report">
			<div class="round-header">
				<div>
					<span>Resolved round</span>
					<h2>Initiative {lastRound.roundNumber}</h2>
				</div>
				<strong
					>{lastRound.environmentEventIds.includes('red-slag-fall')
						? 'RED SLAG'
						: lastRound.environmentEventIds.length > 0
							? 'EMBER PULSE'
							: 'FIELD QUIET'}</strong
				>
			</div>
			<div class="initiative-actions">
				{#each lastRound.initiativeOrder as actorId, index (actorId)}
					{@const partyAction = lastRound.actions.find((action) => action.actorId === actorId)}
					{@const monsterAction = lastRound.monsterActions.find(
						(action) => action.monsterId === actorId
					)}
					{@const resolved = partyAction ?? monsterAction!}
					<article class:superseded={resolved.outcome === 'superseded'}>
						<div class="initiative-rank">{String(index + 1).padStart(2, '0')}</div>
						<div>
							<span
								>{partyAction
									? `${partyAction.actorKind} · ${partyAction.choiceSource}`
									: `monster · ${monsterAction!.kind.replaceAll('-', ' ')}`}</span
							>
							<strong>{actorName(actorId)}</strong>
							<p>{resolved.summary}</p>
							{#if partyAction?.actorKind === 'hero'}<small>{partyAction.publicIntent}</small>{/if}
						</div>
						<code>{resolved.initiative}</code>
					</article>
				{/each}
			</div>
		</section>
	{/if}

	<section class="state-rail">
		{#each ['available', 'preparing', 'deployed', 'resolving', 'extraction', 'success'] as stage, index (stage)}
			<div
				class:active={phase === stage}
				class:passed={['preparing', 'deployed', 'extraction', 'success'].indexOf(phase) >=
					index - 1}
			>
				<span>{String(index + 1).padStart(2, '0')}</span><strong>{stage}</strong>
			</div>
		{/each}
	</section>

	<section class="ledger">
		<div class="ledger-heading">
			<div>
				<span>Append-only mission log</span>
				<h2>What the engine remembers</h2>
			</div>
			<strong>{eventRows.length} transitions</strong>
		</div>
		{#if eventRows.length === 0}
			<p class="empty-log">
				No mission attempt exists. Settlement routines remain free to continue.
			</p>
		{:else}
			<div class="event-list">
				{#each eventRows as row (row.sequence)}
					<article>
						<span>#{row.sequence}</span>
						<div>
							<strong>{row.eventType}</strong>
							<p>{row.summary}</p>
						</div>
						<code>{row.afterStateHash.slice(0, 10)}</code>
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<footer>
		<span
			>{isPortal
				? 'MIS-007 · authoritative portal extraction'
				: isMasterRisk
					? 'MIS-009 · controllable Master + atomic game over'
					: isAftermath
						? 'MIS-008 · persistent mission aftermath'
						: 'MIS-004 · autonomous monster duties'}</span
		>
		<p>
			{isPortal
				? 'Next: injuries, death, equipment durability, and social aftermath.'
				: isMasterRisk
					? 'Next: selectable control modes and per-turn fallback timing.'
					: isAftermath
						? 'Next: controllable Master actions and atomic game-over inside missions.'
						: 'Next: Floor 02–05 threats and the Foundry Warden confrontation.'}
		</p>
	</footer>
</main>

<style>
	:global(body) {
		background:
			radial-gradient(circle at 70% 16%, rgba(66, 121, 128, 0.12), transparent 32rem), #080a0c;
		color: #e8e2d5;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	:global(*) {
		box-sizing: border-box;
	}
	main {
		min-height: 100vh;
		overflow: hidden;
	}
	.topbar {
		height: 4.5rem;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 4vw;
		border-bottom: 1px solid #252a2d;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.wordmark {
		color: #f0b95a;
		font-family: Georgia, serif;
		font-size: 1.15rem;
		font-weight: 800;
		text-decoration: none;
	}
	.run-binding {
		text-align: center;
		display: grid;
		gap: 0.2rem;
		font-size: 0.58rem;
		color: #7e8788;
	}
	.run-binding code {
		color: #c3ccc9;
		font-size: 0.62rem;
	}
	.utility {
		justify-self: end;
		color: #8f9998;
		text-decoration: none;
		font-size: 0.62rem;
	}
	.hero-copy {
		width: min(92vw, 1320px);
		margin: 4.5rem auto 2.5rem;
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		align-items: end;
		gap: 3rem;
	}
	.eyebrow,
	.phase-heading span,
	.instruction span,
	.ledger-heading span {
		color: #d5a34e;
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
	}
	h1 {
		margin: 0.7rem 0 0;
		font:
			400 clamp(3.8rem, 8vw, 8rem)/0.78 Georgia,
			serif;
		letter-spacing: -0.065em;
		text-transform: uppercase;
	}
	h1 em {
		color: transparent;
		-webkit-text-stroke: 1px #cab993;
		font-style: normal;
	}
	.mission-brief {
		border-left: 1px solid #444c4d;
		padding: 0 0 0.3rem 2rem;
		position: relative;
	}
	.mission-brief p {
		margin: 0 0 1rem;
		font:
			1.15rem/1.5 Georgia,
			serif;
		max-width: 32rem;
	}
	.mission-brief small {
		color: #7d8584;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.status-light {
		position: absolute;
		left: -0.28rem;
		top: 0.25rem;
		width: 0.52rem;
		height: 0.52rem;
		background: #51d5d2;
		border-radius: 50%;
		box-shadow: 0 0 1rem #51d5d2;
	}
	.binding-strip {
		width: min(92vw, 1320px);
		margin: 0 auto 1.25rem;
		min-height: 3.8rem;
		border: 1px solid #282e30;
		display: grid;
		grid-template-columns: 12rem 14rem 1fr;
		align-items: center;
		background: #0d1012;
	}
	.binding-strip > div {
		padding: 0.8rem 1rem;
		border-right: 1px solid #282e30;
		display: grid;
		gap: 0.2rem;
	}
	.binding-strip span {
		color: #697273;
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}
	.binding-strip strong {
		font-size: 0.76rem;
		text-transform: uppercase;
	}
	.binding-strip code {
		padding: 0 1rem;
		color: #5f8586;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.68rem;
	}
	.threshold-shell {
		width: min(92vw, 1320px);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1.08fr 0.92fr;
		min-height: 45rem;
		border: 1px solid #2b3132;
		background: #0d1012;
	}
	.threshold-scene {
		position: relative;
		min-height: 45rem;
		overflow: hidden;
		border-right: 1px solid #2b3132;
		background:
			radial-gradient(ellipse at 50% 45%, rgba(29, 69, 73, 0.32), transparent 31%),
			linear-gradient(155deg, #11181a, #080a0c 65%);
	}
	.threshold-scene:before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			repeating-linear-gradient(90deg, transparent 0 79px, rgba(255, 255, 255, 0.025) 80px),
			repeating-linear-gradient(0deg, transparent 0 79px, rgba(255, 255, 255, 0.02) 80px);
		mask-image: linear-gradient(to bottom, #000, transparent 72%);
	}
	.tower-number {
		position: absolute;
		top: 2rem;
		left: 2rem;
		color: #343b3d;
		font:
			8rem/0.8 Georgia,
			serif;
	}
	.arch {
		position: absolute;
		width: 25rem;
		height: 35rem;
		left: 50%;
		top: 3.5rem;
		transform: translateX(-50%);
		border: 1px solid #41494b;
		border-bottom: 0;
		border-radius: 14rem 14rem 0 0;
		box-shadow:
			0 0 0 1.4rem #0b0e10,
			0 0 0 1.45rem #262d2f;
	}
	.portal {
		position: absolute;
		inset: 1rem;
		border-radius: 13rem 13rem 0 0;
		overflow: hidden;
		background:
			radial-gradient(ellipse at 50% 72%, rgba(72, 218, 211, 0.2), transparent 40%),
			linear-gradient(180deg, #030506, #0c1719);
	}
	.portal:before,
	.portal:after {
		content: '';
		position: absolute;
		inset: 8% 20%;
		border-left: 1px solid rgba(88, 215, 209, 0.25);
		border-right: 1px solid rgba(88, 215, 209, 0.25);
		transform: perspective(200px) rotateX(-12deg);
	}
	.portal span {
		position: absolute;
		width: 2px;
		height: 80%;
		left: 50%;
		top: 10%;
		background: linear-gradient(transparent, #56d9d5, transparent);
		opacity: 0.22;
		box-shadow: 0 0 2rem 0.4rem #55d4d0;
		transition: opacity 0.5s;
	}
	.opened .portal span {
		opacity: 0.9;
	}
	.floor-lines {
		position: absolute;
		left: -20%;
		right: -20%;
		bottom: -10%;
		height: 45%;
		background:
			repeating-linear-gradient(100deg, transparent 0 74px, rgba(111, 143, 143, 0.11) 75px),
			repeating-linear-gradient(0deg, transparent 0 44px, rgba(111, 143, 143, 0.08) 45px);
		transform: perspective(380px) rotateX(58deg);
	}
	.tactical-board {
		position: absolute;
		inset: 5.5rem 1.5rem 5rem;
		border: 1px solid #293335;
		background:
			radial-gradient(circle at 78% 52%, rgba(209, 126, 42, 0.12), transparent 24%),
			linear-gradient(155deg, rgba(16, 28, 30, 0.94), rgba(7, 10, 12, 0.98));
		box-shadow: inset 0 0 5rem #050708;
		overflow: hidden;
	}
	.tactical-board:before {
		content: '';
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(116, 159, 158, 0.035) 1px, transparent 1px),
			linear-gradient(90deg, rgba(116, 159, 158, 0.035) 1px, transparent 1px);
		background-size: 2rem 2rem;
	}
	.tactical-board svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.tactical-board polyline {
		fill: none;
		stroke: #355d5d;
		stroke-width: 4;
		stroke-dasharray: 9 13;
		vector-effect: non-scaling-stroke;
	}
	.tactical-board polyline.guarded {
		stroke: #7b623c;
	}
	.tactical-board polyline.exposed {
		stroke: #7f4037;
	}
	.arena-node {
		position: absolute;
		transform: translate(-50%, -50%);
		display: grid;
		justify-items: center;
		gap: 0.45rem;
		width: 7rem;
		color: #657071;
		font-size: 0.54rem;
		letter-spacing: 0.08em;
		text-align: center;
		text-transform: uppercase;
	}
	.arena-node i {
		width: 1rem;
		height: 1rem;
		border: 1px solid #536061;
		background: #111719;
		transform: rotate(45deg);
	}
	.arena-node.visited {
		color: #b4bfbb;
	}
	.arena-node.visited i {
		background: #3ea8a4;
		border-color: #8bd7d3;
		box-shadow: 0 0 1rem rgba(77, 210, 204, 0.5);
	}
	.arena-node.objective i {
		background: #9d6427;
		border-color: #e4ad59;
		box-shadow: 0 0 1.2rem rgba(230, 148, 48, 0.38);
	}
	.actor-token {
		position: absolute;
		z-index: 4;
		width: 2rem;
		height: 2rem;
		border: 1px solid #82d3ce;
		border-radius: 50%;
		background: #153b3c;
		box-shadow:
			0 0 0 3px #090d0f,
			0 0 1rem rgba(76, 210, 205, 0.3);
		display: grid;
		place-items: center;
		color: #dcfffb;
		font:
			700 0.7rem Georgia,
			serif;
		transform: translate(-50%, -50%);
	}
	.actor-token.master {
		border-color: #f0bd69;
		background: #62431e;
		color: #fff0cf;
	}
	.monster-token {
		position: absolute;
		z-index: 5;
		width: 2.35rem;
		height: 2.35rem;
		border: 1px solid #e16f50;
		background: #481d18;
		box-shadow:
			0 0 0 3px #090d0f,
			0 0 1.2rem rgba(225, 80, 48, 0.38);
		color: #ffd8c8;
		transform: translate(-50%, -50%) rotate(45deg);
		display: grid;
		place-items: center;
	}
	.monster-token span,
	.monster-token small {
		position: absolute;
		transform: rotate(-45deg);
	}
	.monster-token span {
		font:
			700 0.7rem Georgia,
			serif;
	}
	.monster-token small {
		right: -0.25rem;
		bottom: -0.35rem;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: #090d0f;
		color: #e99b7f;
		font-size: 0.48rem;
		display: grid;
		place-items: center;
	}
	.objective-banner {
		position: absolute;
		right: 1rem;
		top: 1rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid #815c2e;
		background: rgba(64, 37, 13, 0.9);
		color: #e7b963;
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.objective-banner.delivered {
		border-color: #397b77;
		background: rgba(17, 62, 61, 0.9);
		color: #76d9d2;
	}
	.scene-caption {
		position: absolute;
		left: 2rem;
		right: 2rem;
		bottom: 2rem;
		display: flex;
		justify-content: space-between;
		border-top: 1px solid #343b3d;
		padding-top: 0.8rem;
		text-transform: uppercase;
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		color: #758081;
	}
	.scene-caption strong {
		color: #c3cbc7;
	}
	.operations {
		padding: 2rem;
		display: flex;
		flex-direction: column;
	}
	.phase-heading {
		display: flex;
		justify-content: space-between;
		align-items: start;
		border-bottom: 1px solid #2c3233;
		padding-bottom: 1.2rem;
	}
	.phase-heading h2 {
		margin: 0.35rem 0 0;
		font:
			2.1rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.phase-heading > strong {
		font:
			2.6rem Georgia,
			serif;
		color: #6a7474;
	}
	.instruction {
		margin: 1.4rem 0 0;
		padding: 1rem;
		background: #121719;
		border-left: 2px solid #bf8d3e;
	}
	.instruction p {
		color: #9ba3a0;
		line-height: 1.5;
		margin: 0.45rem 0 0;
		font-size: 0.8rem;
	}
	.party-cards {
		display: grid;
		gap: 0.7rem;
		margin: 1.25rem 0;
	}
	.party-card {
		width: 100%;
		min-height: 6.6rem;
		display: grid;
		grid-template-columns: 4.7rem 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.7rem;
		text-align: left;
		color: inherit;
		border: 1px solid #313839;
		background: #101416;
		position: relative;
	}
	button.party-card {
		cursor: pointer;
	}
	.party-card.selected {
		border-color: #8f713f;
		background: linear-gradient(90deg, rgba(180, 128, 46, 0.1), #101416 45%);
	}
	.party-card .portrait {
		height: 5rem;
		overflow: hidden;
		background: #080a0b;
		position: relative;
	}
	.master-portrait:before {
		content: '';
		position: absolute;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		background: #4d5554;
		left: 1.55rem;
		top: 0.6rem;
	}
	.master-portrait span {
		position: absolute;
		width: 3.3rem;
		height: 3rem;
		left: 0.7rem;
		bottom: 0;
		background: linear-gradient(90deg, #202526, #59605e, #171b1c);
		clip-path: polygon(28% 0, 72% 0, 100% 100%, 0 100%);
	}
	.party-card > div:nth-child(2) {
		display: grid;
		gap: 0.28rem;
	}
	.party-card span {
		color: #b68a43;
		font-size: 0.56rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.party-card strong {
		font:
			1.16rem Georgia,
			serif;
	}
	.party-card small {
		color: #717b7b;
		font-size: 0.67rem;
	}
	.party-card b {
		color: #596261;
		font-size: 0.55rem;
		letter-spacing: 0.12em;
	}
	.party-card.selected b {
		color: #58cac6;
	}
	.action-deck {
		margin-top: auto;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.65rem;
	}
	.turn-objective,
	.turn-choices,
	.threat-ledger {
		grid-column: 1 / -1;
	}
	.turn-objective {
		display: grid;
		gap: 0.25rem;
		padding: 0.8rem;
		border: 1px solid #343c3d;
		background: #0e1315;
	}
	.turn-objective span {
		color: #d5a34e;
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}
	.turn-objective strong {
		font:
			1rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.turn-objective small {
		color: #727c7b;
	}
	.threat-ledger {
		border: 1px solid #633b32;
		background: linear-gradient(120deg, rgba(86, 35, 27, 0.35), #0e1214);
		max-height: 12rem;
		overflow-y: auto;
	}
	.threat-ledger > div,
	.threat-ledger article {
		padding: 0.65rem 0.8rem;
		border-bottom: 1px solid rgba(130, 67, 53, 0.35);
	}
	.threat-ledger .hazard-warning {
		border-color: #8e372a;
		background: linear-gradient(100deg, rgba(135, 40, 25, 0.2), rgba(43, 17, 14, 0.3));
	}
	.threat-ledger .hazard-warning strong,
	.threat-ledger .hazard-warning small {
		color: #e47855;
	}
	.terminal-card {
		margin-top: 1.5rem;
		padding: 1.4rem;
		border: 1px solid #823a32;
		background: linear-gradient(120deg, rgba(119, 27, 23, 0.28), rgba(15, 10, 10, 0.7));
	}
	.terminal-card span,
	.terminal-card strong {
		display: block;
	}
	.terminal-card span {
		color: #d16b55;
		font-size: 0.57rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.terminal-card strong {
		margin-top: 0.55rem;
		font:
			1.35rem Georgia,
			serif;
	}
	.terminal-card p {
		color: #9d8c82;
		font-size: 0.72rem;
		line-height: 1.55;
	}
	.terminal-card a {
		color: #e0a060;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.master-card.fatal {
		border-color: #7f322c;
		background: rgba(91, 23, 20, 0.22);
	}
	.threat-ledger > div {
		display: flex;
		justify-content: space-between;
		color: #d2775f;
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.threat-ledger article:last-child {
		border-bottom: 0;
	}
	.threat-ledger article {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: 0.2rem 0.8rem;
	}
	.threat-ledger article strong {
		color: #e6a088;
		font:
			0.78rem Georgia,
			serif;
	}
	.threat-ledger article p {
		margin: 0;
		color: #b5aaa4;
		font-size: 0.66rem;
	}
	.threat-ledger article small {
		grid-column: 2;
		color: #706c69;
		font-size: 0.55rem;
	}
	.turn-choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
		max-height: 13rem;
		overflow-y: auto;
	}
	.turn-choices button {
		min-height: 4.6rem;
		display: grid;
		gap: 0.3rem;
		text-align: left;
		text-transform: none;
		letter-spacing: 0;
	}
	.turn-choices button.selected {
		border-color: #4ebdb8;
		background: #183638;
		box-shadow: inset 3px 0 #56d4ce;
	}
	.turn-choices strong {
		font:
			0.8rem Georgia,
			serif;
		color: #e1ded3;
	}
	.turn-choices small {
		color: #778180;
		font-size: 0.6rem;
		line-height: 1.35;
	}
	.action-deck .resolve {
		border-color: #2d8986;
		background: linear-gradient(110deg, #153c3d, #247471);
	}
	.action-deck button {
		min-height: 3rem;
		border: 1px solid #3a4142;
		background: #171c1e;
		color: #b8c0bd;
		padding: 0.7rem 1rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.62rem;
		cursor: pointer;
	}
	.action-deck .primary {
		grid-column: 1 / -1;
		min-height: 4.4rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-color: #b17e33;
		background: linear-gradient(110deg, #6f481d, #ae762f);
		color: #fff3dc;
	}
	.action-deck .primary span {
		font:
			1rem Georgia,
			serif;
		text-transform: none;
		letter-spacing: 0;
	}
	.action-deck .primary small {
		opacity: 0.72;
	}
	.action-deck .ember {
		box-shadow:
			inset 0 0 2rem rgba(255, 188, 64, 0.18),
			0 0 1.5rem rgba(255, 150, 26, 0.08);
	}
	.action-deck button:disabled {
		opacity: 0.45;
		cursor: wait;
	}
	.result,
	.error {
		margin: 0.8rem 0 0;
		padding: 0.65rem;
		font-size: 0.7rem;
		border: 1px solid #275b59;
		color: #64c5c0;
	}
	.error {
		border-color: #71453e;
		color: #e19080;
	}
	.state-rail {
		width: min(92vw, 1320px);
		margin: 1.25rem auto 5rem;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		border: 1px solid #252b2c;
	}
	.initiative-report {
		width: min(92vw, 1120px);
		margin: 1.25rem auto 5rem;
		border: 1px solid #2d3536;
		background: #0d1113;
	}
	.round-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		padding: 1.2rem 1.4rem;
		border-bottom: 1px solid #2d3536;
	}
	.round-header span {
		color: #c79445;
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.round-header h2 {
		margin: 0.3rem 0 0;
		font:
			1.65rem Georgia,
			serif;
	}
	.round-header > strong {
		color: #5f9996;
		font-size: 0.58rem;
		letter-spacing: 0.14em;
	}
	.initiative-actions article {
		display: grid;
		grid-template-columns: 3rem 1fr auto;
		gap: 1rem;
		align-items: start;
		padding: 1rem 1.4rem;
		border-bottom: 1px solid #22292a;
	}
	.initiative-actions article:last-child {
		border-bottom: 0;
	}
	.initiative-actions article.superseded {
		opacity: 0.55;
	}
	.initiative-rank {
		color: #4b8582;
		font:
			1.2rem Georgia,
			serif;
	}
	.initiative-actions article div:nth-child(2) {
		display: grid;
		gap: 0.25rem;
	}
	.initiative-actions span,
	.initiative-actions small {
		color: #697473;
		font-size: 0.56rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.initiative-actions p {
		margin: 0.2rem 0;
		color: #a6aeab;
		font-size: 0.72rem;
	}
	.initiative-actions code {
		color: #d9ab5e;
		font-size: 1rem;
	}
	.state-rail div {
		padding: 1rem;
		border-right: 1px solid #252b2c;
		display: flex;
		gap: 0.8rem;
		color: #464e4f;
		text-transform: uppercase;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
	}
	.state-rail div:last-child {
		border: 0;
	}
	.state-rail .passed {
		color: #8e9692;
	}
	.state-rail .active {
		background: #161b1d;
		color: #e2b45f;
	}
	.state-rail span {
		font-family: monospace;
	}
	.ledger {
		width: min(92vw, 1120px);
		margin: 0 auto 6rem;
	}
	.ledger-heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 1.4rem;
	}
	.ledger-heading h2 {
		margin: 0.45rem 0 0;
		font:
			2.1rem Georgia,
			serif;
	}
	.ledger-heading > strong {
		color: #606968;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.empty-log {
		border: 1px dashed #303738;
		padding: 2rem;
		color: #687271;
		text-align: center;
	}
	.event-list {
		border-top: 1px solid #303738;
	}
	.event-list article {
		display: grid;
		grid-template-columns: 3rem 1fr auto;
		gap: 1rem;
		padding: 1rem 0.2rem;
		border-bottom: 1px solid #232829;
	}
	.event-list > article > span {
		color: #a77b3a;
		font-family: monospace;
	}
	.event-list strong {
		font-size: 0.78rem;
	}
	.event-list p {
		margin: 0.3rem 0 0;
		color: #798281;
		font-size: 0.7rem;
	}
	.event-list code {
		color: #4e7776;
		font-size: 0.62rem;
	}
	footer {
		padding: 2.5rem 4vw;
		border-top: 1px solid #252b2c;
		display: flex;
		justify-content: space-between;
		color: #6c7574;
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	footer p {
		margin: 0;
	}
	.portal-clock {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		margin: -1px -1px 1.2rem;
		border: 1px solid #354345;
		background: linear-gradient(115deg, rgba(52, 107, 113, 0.2), rgba(8, 12, 14, 0.9));
	}
	.portal-clock.warning {
		border-color: #90713d;
	}
	.portal-clock.critical,
	.portal-clock.collapsed {
		border-color: #9d5147;
		box-shadow: inset 0 0 2rem rgba(155, 51, 42, 0.12);
	}
	.portal-clock > div {
		padding: 0.85rem;
		border-right: 1px solid #303c3e;
		display: grid;
		gap: 0.15rem;
	}
	.portal-clock > div:last-child {
		border: 0;
	}
	.portal-clock span,
	.portal-clock small,
	.ore-heading span,
	.ore-grid h3,
	.ore-grid small {
		color: #758182;
		font-size: 0.54rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.portal-clock strong {
		color: #d6e7e5;
		font:
			1.35rem Georgia,
			serif;
		text-transform: uppercase;
	}
	.ore-console {
		width: min(92vw, 1320px);
		margin: 1.5rem auto 4rem;
		border: 1px solid #293234;
		background: #0b0f11;
	}
	.ore-heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		padding: 1.5rem;
		border-bottom: 1px solid #293234;
	}
	.ore-heading h2 {
		margin: 0.4rem 0 0;
		font:
			1.7rem Georgia,
			serif;
	}
	.ore-heading > strong {
		color: #cfaa67;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.ore-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1.25fr;
	}
	.ore-grid > div {
		padding: 1.2rem 1.5rem;
		border-right: 1px solid #293234;
	}
	.ore-grid > div:last-child {
		border: 0;
	}
	.ore-grid h3 {
		margin: 0 0 0.8rem;
	}
	.ore-grid article {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.18rem 1rem;
		padding: 0.65rem 0;
		border-top: 1px solid #202729;
		font-size: 0.72rem;
		text-transform: capitalize;
	}
	.ore-grid article small {
		grid-column: 1 / -1;
	}
	.ore-events p {
		color: #667172;
		font-size: 0.7rem;
	}
	.aftermath-console {
		width: min(92vw, 1320px);
		margin: 1.5rem auto 4rem;
		border: 1px solid #4b292b;
		background: linear-gradient(110deg, rgba(104, 22, 28, 0.13), transparent 42%), #0e0b0c;
		box-shadow: inset 0 0 5rem rgba(74, 13, 18, 0.08);
	}
	.aftermath-heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 2rem;
		padding: 1.6rem;
		border-bottom: 1px solid #4b292b;
	}
	.aftermath-heading span,
	.aftermath-grid span,
	.aftermath-grid small {
		color: #9c7371;
		font-size: 0.57rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.aftermath-heading h2 {
		margin: 0.45rem 0 0;
		font:
			1.75rem Georgia,
			serif;
	}
	.aftermath-heading > strong {
		color: #d09672;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.aftermath-empty {
		margin: 0;
		padding: 2rem 1.6rem;
		color: #817271;
		font:
			1rem/1.5 Georgia,
			serif;
	}
	.aftermath-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.aftermath-grid article {
		min-height: 12rem;
		padding: 1.4rem;
		display: grid;
		grid-template-columns: 3.5rem 1fr;
		gap: 1rem;
		border-right: 1px solid #392325;
		border-bottom: 1px solid #392325;
	}
	.aftermath-grid article.fatal {
		background: linear-gradient(120deg, rgba(133, 19, 26, 0.22), transparent 60%);
	}
	.harm-mark {
		width: 3.2rem;
		height: 3.2rem;
		display: grid;
		place-items: center;
		border: 1px solid #75343a;
		border-radius: 50%;
		color: #dc7d75;
		font:
			1.35rem Georgia,
			serif;
	}
	.aftermath-grid strong {
		display: block;
		margin-top: 0.38rem;
		font:
			1.2rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.aftermath-grid p {
		min-height: 2.5rem;
		margin: 0.8rem 0;
		color: #b8a8a1;
		font-size: 0.75rem;
		line-height: 1.55;
	}
	@media (max-width: 850px) {
		.topbar {
			grid-template-columns: 1fr auto;
			padding: 0 1rem;
		}
		.run-binding {
			display: none;
		}
		.hero-copy {
			grid-template-columns: 1fr;
			margin-top: 3rem;
			gap: 2rem;
		}
		h1 {
			font-size: clamp(3.8rem, 20vw, 6rem);
		}
		.mission-brief {
			margin-left: 0.3rem;
		}
		.binding-strip {
			grid-template-columns: 1fr 1fr;
		}
		.binding-strip code {
			grid-column: 1 / -1;
			padding: 0.7rem 1rem;
			border-top: 1px solid #282e30;
		}
		.threshold-shell {
			grid-template-columns: 1fr;
		}
		.threshold-scene {
			min-height: 30rem;
			border-right: 0;
			border-bottom: 1px solid #2b3132;
		}
		.arch {
			width: 19rem;
			height: 26rem;
			top: 2rem;
		}
		.operations {
			min-height: 42rem;
			padding: 1.2rem;
		}
		.portal-clock,
		.ore-grid,
		.aftermath-grid {
			grid-template-columns: 1fr;
		}
		.portal-clock > div,
		.ore-grid > div {
			border-right: 0;
			border-bottom: 1px solid #293234;
		}
		.state-rail {
			overflow-x: auto;
			grid-template-columns: repeat(6, 9rem);
			margin-bottom: 4rem;
		}
		.ledger-heading {
			align-items: start;
		}
		.event-list article {
			grid-template-columns: 2.4rem 1fr;
		}
		.event-list code {
			display: none;
		}
		footer {
			display: grid;
			gap: 0.7rem;
		}
		footer p {
			line-height: 1.5;
		}
	}
</style>
