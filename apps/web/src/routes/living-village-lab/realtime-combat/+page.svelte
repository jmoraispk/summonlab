<script lang="ts">
	import { onMount } from 'svelte';

	import LabBackLink from '$lib/components/living-village/LabBackLink.svelte';
	import RealtimeCombatStage, {
		type CombatPresentationMode
	} from '$lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte';
	import {
		createRealtimeCombat,
		type RealtimeCombatState
	} from '$lib/components/living-village/realtime-combat/realtime-combat';
	import { PLAYER_SETTINGS_EVENT } from '$lib/player-settings';

	let mode = $state<CombatPresentationMode>('2.5d');
	let paused = $state(false);
	let restartKey = $state(0);
	let reducedMotion = $state(false);
	let snapshot = $state<RealtimeCombatState>(createRealtimeCombat());
	let hydrated = $state(false);

	const heroes = $derived(snapshot.actors.filter((actor) => actor.team === 'heroes'));
	const ratsAlive = $derived(
		snapshot.actors.filter((actor) => actor.team === 'rats' && actor.health > 0).length
	);
	const phaseLabel = $derived(
		snapshot.phase === 'running'
			? `${ratsAlive} hostiles remain`
			: snapshot.phase === 'victory'
				? 'Threshold secured'
				: 'Party overwhelmed'
	);

	onMount(() => {
		hydrated = true;
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => {
			const preference = document.documentElement.dataset.playerMotion ?? 'system';
			reducedMotion = preference === 'reduced' || (preference !== 'full' && media.matches);
		};
		syncMotion();
		media.addEventListener('change', syncMotion);
		window.addEventListener(PLAYER_SETTINGS_EVENT, syncMotion);
		return () => {
			media.removeEventListener('change', syncMotion);
			window.removeEventListener(PLAYER_SETTINGS_EVENT, syncMotion);
		};
	});

	function replay(): void {
		restartKey += 1;
		paused = false;
	}
</script>

<svelte:head>
	<title>Near-3D combat study · Summonlab</title>
	<meta
		name="description"
		content="Compare flat 2D and near-3D 2.5D presentation over one deterministic autonomous rat battle."
	/>
</svelte:head>

<main>
	<div class="topline">
		<LabBackLink placement="top" />
		<span>Visual prototype · same combat, two cameras</span>
	</div>

	<header>
		<div class="title-lockup">
			<p>Ruined threshold / field test 01</p>
			<h1>Hold the village gate.</h1>
		</div>
		<p class="brief">
			Three autonomous heroes meet a plague-rat pack. Switch rendering treatment while the fight is
			moving—the agents, damage, and outcome stay identical.
		</p>
	</header>

	<section class="study" aria-label="Realtime combat presentation study">
		<div class="battlefield" data-testid="realtime-combat-stage">
			<RealtimeCombatStage
				{mode}
				{paused}
				{restartKey}
				{reducedMotion}
				onSnapshot={(next) => (snapshot = next)}
			/>

			<div class="battle-hud">
				<div class="encounter-state" data-testid="combat-phase">
					<i class:secured={snapshot.phase === 'victory'} aria-hidden="true"></i>
					<div>
						<span>{phaseLabel}</span><small>{snapshot.elapsedSeconds.toFixed(1)} sec</small>
					</div>
				</div>
				<div class="party-vitals" aria-label="Party vitality">
					{#each heroes as hero (hero.id)}
						<div title={`${hero.label}: ${hero.health} of ${hero.maximumHealth} vitality`}>
							<b>{hero.label.slice(0, 1)}</b>
							<span><i style={`--health:${(hero.health / hero.maximumHealth) * 100}%`}></i></span>
						</div>
					{/each}
				</div>
			</div>

			<div class="battle-caption" aria-live="polite">
				<small>Agent report</small><span>{snapshot.lastEvent}</span>
			</div>

			{#if snapshot.phase !== 'running'}
				<div class="resolution" data-testid="combat-resolution">
					<p>{snapshot.phase === 'victory' ? 'The pack breaks' : 'The gate falls'}</p>
					<strong
						>{snapshot.phase === 'victory'
							? 'Village threshold secured'
							: 'Reinforce and return'}</strong
					>
					<button type="button" onclick={replay}>Run it again</button>
				</div>
			{/if}
		</div>

		<aside>
			<div class="mode-control">
				<p>Presentation lens</p>
				<div role="group" aria-label="Presentation mode">
					<button
						type="button"
						class:active={mode === '2d'}
						aria-pressed={mode === '2d'}
						onclick={() => (mode = '2d')}
					>
						<span>2D</span><small>Fixed scale</small>
					</button>
					<button
						type="button"
						class:active={mode === '2.5d'}
						aria-pressed={mode === '2.5d'}
						onclick={() => (mode = '2.5d')}
					>
						<span>2.5D</span><small>Depth staged</small>
					</button>
				</div>
			</div>

			<div class="evidence" data-testid="presentation-evidence">
				<span>What changes</span>
				<strong>{mode === '2.5d' ? 'A camera with depth cues' : 'A flat composited field'}</strong>
				<p>
					{mode === '2.5d'
						? 'Perspective scaling, foot-anchored Y sorting, deformed contact shadows, parallax drift, fog, and local light.'
						: 'Every actor keeps one scale and layer priority. Atmosphere and camera drift are removed.'}
				</p>
			</div>

			<div class="playback" aria-label="Combat playback">
				<button
					type="button"
					onclick={() => (paused = !paused)}
					disabled={!hydrated || snapshot.phase !== 'running'}
				>
					{paused ? 'Resume agents' : 'Pause agents'}
				</button>
				<button type="button" onclick={replay} disabled={!hydrated}>Replay same fight</button>
			</div>

			<details>
				<summary>Inspect autonomous decisions</summary>
				<div class="agent-list">
					{#each heroes as hero (hero.id)}
						{@const target = snapshot.actors.find((actor) => actor.id === hero.targetId)}
						<div>
							<span>{hero.label}</span>
							<code>{hero.intent}{target ? ` → ${target.label}` : ''}</code>
						</div>
					{/each}
				</div>
			</details>

			<footer>
				<b>Prototype boundary</b>
				<span
					>Static pose art animated by transforms and effects. No skeletal rig or authored attack
					frames yet.</span
				>
			</footer>
		</aside>
	</section>
</main>

<style>
	:global(html) {
		background: #05090e;
	}

	:global(body) {
		margin: 0;
		background: #05090e;
	}

	:global(*) {
		box-sizing: border-box;
	}

	main {
		min-height: 100vh;
		padding: clamp(1rem, 2.5vw, 2.4rem);
		background:
			radial-gradient(circle at 74% 8%, rgba(121, 195, 207, 0.12), transparent 29rem), #05090e;
		color: #eadcbc;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}

	.topline,
	header,
	.study {
		width: min(100%, 70rem);
		margin-inline: auto;
	}

	.topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 2.4rem;
		color: #73838a;
		font-size: 0.62rem;
		font-weight: 750;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 32rem);
		align-items: end;
		gap: 3rem;
		padding: clamp(1.7rem, 4vw, 3.8rem) 0 1.4rem;
	}

	.title-lockup p,
	.mode-control > p,
	.battle-caption small,
	.evidence > span {
		margin: 0 0 0.5rem;
		color: #d89b42;
		font-size: 0.64rem;
		font-weight: 850;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font:
			400 clamp(2.5rem, 5.7vw, 5.5rem) / 0.86 Georgia,
			serif;
		letter-spacing: -0.055em;
	}

	.brief {
		margin: 0;
		padding-left: 1.2rem;
		border-left: 1px solid rgba(121, 195, 207, 0.4);
		color: #9caaad;
		font-size: 0.88rem;
		line-height: 1.65;
	}

	.study {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22rem;
		min-height: min(74vh, 62rem);
		overflow: hidden;
		border: 1px solid rgba(234, 220, 188, 0.2);
		background: #081017;
		box-shadow: 0 2.6rem 8rem rgba(0, 0, 0, 0.48);
	}

	.battlefield {
		position: relative;
		min-height: 50rem;
		overflow: hidden;
		background: #05090e;
		isolation: isolate;
	}

	.battlefield::after {
		content: '';
		position: absolute;
		z-index: 1;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 5rem rgba(0, 0, 0, 0.38);
	}

	.battle-hud {
		position: absolute;
		z-index: 3;
		top: 0.9rem;
		left: 0.9rem;
		right: 0.9rem;
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
		pointer-events: none;
	}

	.encounter-state {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(234, 220, 188, 0.24);
		background: rgba(5, 9, 14, 0.82);
		backdrop-filter: blur(10px);
	}

	.encounter-state > i {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: #a4473f;
		box-shadow: 0 0 0.8rem #a4473f;
	}

	.encounter-state > i.secured {
		background: #79c3cf;
		box-shadow: 0 0 0.8rem #79c3cf;
	}

	.encounter-state div {
		display: grid;
		gap: 0.08rem;
	}

	.encounter-state span {
		font-size: 0.68rem;
		font-weight: 850;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.encounter-state small {
		color: #91a0a4;
		font:
			0.58rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}

	.party-vitals {
		display: flex;
		gap: 0.35rem;
	}

	.party-vitals > div {
		display: grid;
		grid-template-columns: 1.8rem 2.8rem;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.5rem;
		background: rgba(5, 9, 14, 0.8);
	}

	.party-vitals b {
		display: grid;
		place-items: center;
		width: 1.8rem;
		aspect-ratio: 1;
		border: 1px solid #d89b42;
		border-radius: 50%;
		background: #192127;
		font:
			700 0.72rem Georgia,
			serif;
	}

	.party-vitals span {
		height: 0.22rem;
		background: rgba(255, 255, 255, 0.12);
	}

	.party-vitals i {
		display: block;
		width: var(--health);
		height: 100%;
		background: #79c3cf;
	}

	.battle-caption {
		position: absolute;
		z-index: 3;
		left: 1rem;
		right: 1rem;
		bottom: 1rem;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: baseline;
		gap: 0.8rem;
		padding: 0.75rem 0.9rem;
		border-top: 1px solid rgba(216, 155, 66, 0.42);
		background: rgba(5, 9, 14, 0.84);
		backdrop-filter: blur(12px);
	}

	.battle-caption small {
		margin: 0;
		white-space: nowrap;
	}

	.battle-caption span {
		color: #d6d0c2;
		font-size: 0.73rem;
	}

	.resolution {
		position: absolute;
		z-index: 4;
		top: 50%;
		left: 50%;
		width: min(82%, 27rem);
		transform: translate(-50%, -50%);
		padding: 1.8rem;
		border: 1px solid rgba(216, 155, 66, 0.65);
		background: rgba(7, 12, 16, 0.94);
		text-align: center;
		box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.55);
	}

	.resolution p {
		margin: 0 0 0.4rem;
		color: #79c3cf;
		font-size: 0.65rem;
		font-weight: 850;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.resolution strong {
		display: block;
		font:
			400 1.8rem Georgia,
			serif;
	}

	.resolution button {
		margin-top: 1.2rem;
	}

	aside {
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
		padding: 1.35rem;
		border-left: 1px solid rgba(234, 220, 188, 0.18);
		background: #0a1117;
	}

	.mode-control > p {
		color: #79c3cf;
	}

	.mode-control [role='group'] {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}

	button {
		border: 1px solid rgba(234, 220, 188, 0.22);
		background: #111a20;
		color: #d9d1c3;
		font:
			750 0.72rem Inter,
			ui-sans-serif,
			system-ui,
			sans-serif;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		border-color: #d89b42;
		color: #fff2d2;
	}

	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid #79c3cf;
		outline-offset: 3px;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.38;
	}

	.mode-control button {
		display: grid;
		gap: 0.16rem;
		min-height: 4.3rem;
		padding: 0.7rem;
		text-align: left;
	}

	.mode-control button.active {
		border-color: #d89b42;
		background: #2d2215;
		box-shadow: inset 0 -3px #d89b42;
	}

	.mode-control button span {
		font:
			400 1.35rem Georgia,
			serif;
	}

	.mode-control button small {
		color: #89979a;
		font-size: 0.57rem;
	}

	.evidence {
		padding: 1rem 0;
		border-block: 1px solid rgba(234, 220, 188, 0.13);
	}

	.evidence > span {
		display: block;
	}

	.evidence strong {
		display: block;
		font:
			400 1.3rem/1.1 Georgia,
			serif;
	}

	.evidence p,
	footer span {
		margin: 0.7rem 0 0;
		color: #89979a;
		font-size: 0.73rem;
		line-height: 1.55;
	}

	.playback {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem;
	}

	.playback button,
	.resolution button {
		min-height: 2.8rem;
		padding: 0.6rem;
	}

	details {
		border-bottom: 1px solid rgba(234, 220, 188, 0.13);
		padding-bottom: 1rem;
	}

	summary {
		color: #c9c0af;
		font-size: 0.7rem;
		font-weight: 800;
		cursor: pointer;
	}

	.agent-list {
		display: grid;
		gap: 0.55rem;
		margin-top: 0.85rem;
	}

	.agent-list div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.65rem;
	}

	.agent-list code {
		color: #79c3cf;
		font-size: 0.56rem;
	}

	footer {
		margin-top: auto;
	}

	footer b {
		display: block;
		color: #d89b42;
		font-size: 0.61rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	@media (max-width: 920px) {
		header {
			grid-template-columns: 1fr;
			gap: 1.2rem;
		}

		.study {
			grid-template-columns: 1fr;
		}

		.battlefield {
			min-height: min(78rem, 140vw);
		}

		aside {
			border-top: 1px solid rgba(234, 220, 188, 0.18);
			border-left: 0;
		}
	}

	@media (max-width: 560px) {
		main {
			padding: 0.7rem;
		}

		.topline > span {
			display: none;
		}

		header {
			padding-top: 1.2rem;
		}

		h1 {
			font-size: 2.8rem;
		}

		.battlefield {
			min-height: 43rem;
		}

		.party-vitals > div {
			grid-template-columns: 1.7rem;
		}

		.party-vitals span {
			display: none;
		}

		.battle-caption {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
		}
	}
</style>
