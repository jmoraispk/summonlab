<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		ActionSource,
		ActivityKind,
		EngineCommand,
		EngineReplayReport
	} from '@summonlab/contracts';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let report = $state<EngineReplayReport>(data.report);
	let pending = $state(false);
	let resultMessage = $state('');
	let errorMessage = $state('');
	const hero = $derived(Object.values(report.snapshot.state.heroes)[0]);
	const engineState = $derived(report.snapshot.state);
	const survivalState = $derived(engineState.schemaVersion === 2 ? engineState : null);
	const survivalHero = $derived(hero && 'progression' in hero ? hero : null);
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

	function commandMeta(actorId: string, expectedVersion = engineState.version) {
		const commandId = crypto.randomUUID();
		return {
			commandId,
			runId: report.runId,
			actorId,
			expectedVersion,
			correlationId: commandId,
			source: manualSource
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
				>{engineState.simulatedAt.slice(11, 16)}</strong
			>
		</div>
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
					<div><strong>Summoned hero</strong><span>{hero.location} · {hero.lifeState}</span></div>
					<code>{hero.health}/{hero.maxHealth}</code>
				</article>
			{/if}
			{#if survivalHero && survivalState}
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
					<span>Scheduled work</span>
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
		grid-template-columns: repeat(5, 1fr);
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
		grid-template-columns: 1fr 1fr;
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
			border-right: 0;
		}
		.metrics div:nth-child(-n + 2) {
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}
		.metrics div:last-child {
			grid-column: 1 / -1;
		}
		.survival-stats {
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
