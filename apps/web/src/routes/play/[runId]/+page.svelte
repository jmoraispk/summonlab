<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProofRunSnapshot, SimulationClock } from '@summonlab/contracts';
	import { onMount } from 'svelte';
	import heroAnchor from '../../../../../../assets/heroes/ember-01-anchor-v1.png';
	import EventJournal from '$lib/components/EventJournal.svelte';
	import HeroRig from '$lib/components/HeroRig.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let snapshot = $state<ProofRunSnapshot>(data.snapshot);
	// svelte-ignore state_referenced_locally
	let walking = $state(!snapshot.arrived);
	let journalOpen = $state(false);
	let errorMessage = $state('');
	// svelte-ignore state_referenced_locally
	let clock = $state<SimulationClock | null>(data.clock);
	const settlementDay = $derived(
		clock
			? Math.floor(
					(Date.parse(clock.currentGameTime) - Date.parse('2000-01-01T00:00:00.000Z')) /
						(24 * 60 * 60 * 1_000)
				) + 1
			: 1
	);
	const wallSpines = Array.from({ length: 11 }, (_, index) => index);
	const destinationLabel = $derived(
		snapshot.destination === 'kitchen' ? 'Kitchen' : 'Training Ground'
	);
	const destinationCopy = $derived(
		snapshot.destination === 'kitchen'
			? 'Voices, warm grain, and the chance to learn names before accepting orders.'
			: 'Cold iron, straw targets, and a private answer to what this summoned body remembers.'
	);

	onMount(() => {
		if (snapshot.arrived) return;
		const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 450 : 3_600;
		const timeout = window.setTimeout(() => void recordArrival(), delay);
		return () => window.clearTimeout(timeout);
	});

	async function recordArrival() {
		try {
			const response = await fetch(`/api/runs/${snapshot.runId}/arrive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			});
			const result = (await response.json()) as ProofRunSnapshot & { message?: string };
			if (!response.ok) throw new Error(result.message ?? 'Arrival could not be recorded.');
			snapshot = result;
			walking = false;
			const clockResponse = await fetch(`/api/runs/${snapshot.runId}/clock`);
			if (clockResponse.ok) clock = (await clockResponse.json()) as SimulationClock;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The arrival log failed.';
		}
	}
</script>

<svelte:head>
	<title>{snapshot.manifest.displayName} walks to {destinationLabel} · summonlab</title>
	<meta
		name="description"
		content={`Follow ${snapshot.manifest.displayName}'s first autonomous settlement choice.`}
	/>
</svelte:head>

<main
	class:kitchen={snapshot.destination === 'kitchen'}
	class:training={snapshot.destination === 'training-ground'}
>
	<header>
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div class="clock">
			<span>Hearth 01 · Day {settlementDay}</span>
			<strong>{clock?.currentGameTime.slice(11, 16) ?? '00:00'}</strong>
			<small>{clock?.speed ?? 4}× settlement time · server-owned</small>
		</div>
		<nav>
			<button
				type="button"
				onclick={() => (journalOpen = !journalOpen)}
				aria-expanded={journalOpen}
			>
				Journal <span>{snapshot.events.length}</span>
			</button>
			<a href={resolve('/replay/[runId]', { runId: snapshot.runId })}>Replay</a>
			<a href={resolve('/forge')}>New seed</a>
		</nav>
	</header>

	<section class="world" aria-label={`${snapshot.manifest.displayName} walking through Hearth 01`}>
		<div class="sky"><i></i><i></i><i></i></div>
		<div class="far-wall">
			{#each wallSpines as spine (spine)}<span></span>{/each}
		</div>
		<div class="tower-silhouette">
			<div></div>
			<span>100</span>
		</div>
		<div class="settlement">
			<div class="building dormitory">
				<div class="roof"></div>
				<div class="facade"><span></span><span></span><span></span></div>
				<span class="building-label">Summoning Hall</span>
			</div>
			<div class="building destination">
				<div class="roof"></div>
				<div class="facade">
					<span></span><span></span>
					<div class="door"><i></i></div>
				</div>
				{#if snapshot.destination === 'kitchen'}
					<div class="chimney"><i></i><i></i><i></i></div>
				{:else}
					<div class="targets"><i></i><i></i></div>
				{/if}
				<span class="building-label">{destinationLabel}</span>
			</div>
			<div class="route-line"><i></i><i></i><i></i><i></i><i></i></div>
		</div>

		<div class:in-transit={walking} class:at-destination={!walking} class="walker">
			<div class="thought">
				{walking
					? snapshot.mind.dailyHabit === 'checks-exits'
						? 'One gate. Two towers. Three exits.'
						: `First: ${snapshot.destination === 'kitchen' ? 'names' : 'limits'}. Then answers.`
					: snapshot.destination === 'kitchen'
						? 'Listen before speaking.'
						: 'Balance first. Then reach.'}
			</div>
			<HeroRig manifest={snapshot.manifest} {walking} />
		</div>

		<div class="foreground"><span></span><span></span><span></span></div>
	</section>

	<section class="hero-hud">
		<div class="portrait">
			{#if snapshot.manifest.artKey === 'ember-01-anchor-v1'}
				<img src={heroAnchor} alt={`${snapshot.manifest.displayName} portrait`} />
			{:else}
				<HeroRig manifest={snapshot.manifest} compact />
			{/if}
		</div>
		<div class="hud-copy">
			<p>{'✦'.repeat(snapshot.manifest.rarityStars)} · Summon 001</p>
			<h1>{snapshot.manifest.displayName}</h1>
			<span>{walking ? `Walking to ${destinationLabel}` : `Arrived · ${destinationLabel}`}</span>
		</div>
		<div class="status-bars">
			<div><span>Body</span><i><b style="width: 100%"></b></i><strong>100</strong></div>
			<div>
				<span>Resolve</span><i><b style={`width: ${snapshot.mind.aptitudes.resolve * 10}%`}></b></i
				><strong>{snapshot.mind.aptitudes.resolve}</strong>
			</div>
			<div><span>Trust</span><i><b style="width: 8%"></b></i><strong>unknown</strong></div>
		</div>
		<div class="proof-state">
			<span>{walking ? 'In transit' : 'Persistent state updated'}</span>
			<code>{snapshot.manifestHash.slice(0, 12)}</code>
		</div>
	</section>

	<section class="choice-result">
		<div>
			<p>Agent-altered route · {snapshot.events[2]?.decisionSource}</p>
			<h2>{snapshot.storyBranch?.replaceAll('-', ' ')}</h2>
			<span>{destinationCopy}</span>
		</div>
		<div class="spine">
			<span>Fixed plot remains</span>
			<strong>Form a company → open Floor 01 → survive the first five-floor band.</strong>
		</div>
	</section>

	{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}

	{#if journalOpen}
		<div class="journal-drawer">
			<button class="close" type="button" onclick={() => (journalOpen = false)}
				>Close journal</button
			>
			<EventJournal events={snapshot.events} compact />
		</div>
	{/if}
</main>

<style>
	:global(body) {
		overflow-x: hidden;
		background: #080a0e;
	}

	main {
		min-height: 100vh;
		background: #080a0e;
	}

	header {
		position: relative;
		z-index: 30;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		height: 5rem;
		padding: 0 clamp(1.2rem, 3vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(7, 8, 12, 0.96);
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	.wordmark {
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}

	.clock {
		text-align: center;
	}

	.clock span,
	.clock strong,
	.clock small {
		display: block;
	}

	.clock span,
	.clock small {
		color: rgba(244, 240, 232, 0.36);
		font-size: 0.48rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.clock strong {
		margin: 0.15rem 0;
		font-family: Georgia, serif;
		font-size: 1.15rem;
		font-weight: 400;
	}

	nav {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
	}

	nav button,
	nav a {
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: rgba(244, 240, 232, 0.62);
		cursor: pointer;
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	nav button span {
		margin-left: 0.25rem;
		color: #d4a653;
	}

	.world {
		position: relative;
		height: min(64vw, 43rem);
		min-height: 33rem;
		overflow: hidden;
		isolation: isolate;
		background:
			radial-gradient(circle at 70% 28%, rgba(207, 154, 88, 0.2), transparent 22rem),
			linear-gradient(180deg, #1b2029 0%, #3b3433 48%, #171414 100%);
	}

	.training .world {
		background:
			radial-gradient(circle at 70% 28%, rgba(108, 163, 190, 0.18), transparent 22rem),
			linear-gradient(180deg, #17232d 0%, #2d3538 48%, #15191b 100%);
	}

	.sky {
		position: absolute;
		z-index: -4;
		inset: 0 0 42%;
		background: linear-gradient(180deg, #171c28, #5b5250);
	}

	.sky::before {
		content: '';
		position: absolute;
		top: 18%;
		right: 17%;
		width: 6rem;
		height: 6rem;
		border-radius: 50%;
		background: #d7c5a7;
		box-shadow: 0 0 5rem rgba(231, 201, 151, 0.35);
		opacity: 0.65;
	}

	.sky i {
		position: absolute;
		width: 15rem;
		height: 2rem;
		border-radius: 50%;
		background: rgba(221, 213, 204, 0.08);
		filter: blur(8px);
	}

	.sky i:nth-child(1) {
		top: 20%;
		left: 8%;
	}

	.sky i:nth-child(2) {
		top: 35%;
		left: 45%;
	}

	.sky i:nth-child(3) {
		top: 12%;
		right: 6%;
	}

	.far-wall {
		position: absolute;
		z-index: -3;
		right: 0;
		bottom: 34%;
		left: 0;
		display: flex;
		align-items: flex-end;
		justify-content: space-around;
		height: 13rem;
		border-top: 1rem solid #201d1d;
		background: repeating-linear-gradient(90deg, #2b2929 0 8%, #353130 8% 16%);
		box-shadow: 0 -1rem 3rem rgba(0, 0, 0, 0.2);
	}

	.far-wall span {
		width: 0.8rem;
		height: 15rem;
		background: #181718;
		clip-path: polygon(50% 0, 100% 15%, 85% 100%, 15% 100%, 0 15%);
	}

	.tower-silhouette {
		position: absolute;
		z-index: -2;
		top: -25%;
		left: 7%;
		width: 12rem;
		height: 85%;
		opacity: 0.5;
	}

	.tower-silhouette div {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, #090b11, #191b22, #07080d);
		clip-path: polygon(20% 100%, 24% 14%, 39% 14%, 45% 0, 55% 0, 61% 14%, 76% 14%, 80% 100%);
	}

	.tower-silhouette span {
		position: absolute;
		top: 38%;
		left: 50%;
		color: rgba(212, 166, 83, 0.38);
		font-family: Georgia, serif;
		font-size: 2.5rem;
		transform: translateX(-50%);
	}

	.settlement {
		position: absolute;
		z-index: 2;
		inset: 0;
	}

	.building {
		position: absolute;
		bottom: 22%;
		width: min(29vw, 25rem);
		height: 43%;
	}

	.dormitory {
		left: 4%;
	}

	.destination {
		right: 5%;
	}

	.building .roof {
		position: absolute;
		z-index: 2;
		top: -18%;
		right: -8%;
		left: -8%;
		height: 31%;
		border-bottom: 0.7rem solid #201818;
		background: repeating-linear-gradient(90deg, #342a28 0 1.5rem, #261f20 1.5rem 3rem);
		clip-path: polygon(50% 0, 100% 72%, 96% 100%, 4% 100%, 0 72%);
	}

	.training .destination .roof {
		border-color: #1a2225;
		background: repeating-linear-gradient(90deg, #28373d 0 1.5rem, #202b30 1.5rem 3rem);
	}

	.building .facade {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: space-evenly;
		border: 0.45rem solid #292322;
		background:
			repeating-linear-gradient(90deg, transparent 0 23%, rgba(22, 17, 17, 0.45) 23% 26%),
			linear-gradient(180deg, #67564a, #3a302d);
		box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.4);
	}

	.training .destination .facade {
		border-color: #20292c;
		background:
			repeating-linear-gradient(90deg, transparent 0 23%, rgba(15, 22, 25, 0.45) 23% 26%),
			linear-gradient(180deg, #4e6468, #29383c);
	}

	.facade > span {
		width: 16%;
		height: 25%;
		border: 0.3rem solid #29211f;
		background: #d9a757;
		box-shadow: 0 0 2rem rgba(223, 160, 79, 0.42);
	}

	.training .facade > span {
		background: #7cb6c1;
		box-shadow: 0 0 2rem rgba(102, 183, 200, 0.3);
	}

	.door {
		position: absolute;
		bottom: 0;
		left: 50%;
		width: 22%;
		height: 52%;
		border: 0.35rem solid #241c1a;
		background: #0f0d0d;
		transform: translateX(-50%);
	}

	.door i {
		position: absolute;
		top: 50%;
		right: 12%;
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 50%;
		background: #d4a653;
	}

	.building-label {
		position: absolute;
		bottom: -2.2rem;
		left: 50%;
		padding: 0.42rem 0.65rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(7, 8, 12, 0.78);
		color: rgba(244, 240, 232, 0.6);
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		transform: translateX(-50%);
		text-transform: uppercase;
		white-space: nowrap;
	}

	.chimney {
		position: absolute;
		top: -36%;
		right: 13%;
		width: 2.5rem;
		height: 5rem;
		background: #2b2422;
	}

	.chimney i {
		position: absolute;
		bottom: 100%;
		left: 50%;
		width: 2.3rem;
		height: 2.3rem;
		border-radius: 50%;
		background: rgba(191, 180, 171, 0.16);
		filter: blur(4px);
		animation: smoke 3s ease-in-out infinite;
	}

	.chimney i:nth-child(2) {
		animation-delay: 1s;
	}

	.chimney i:nth-child(3) {
		animation-delay: 2s;
	}

	.targets {
		position: absolute;
		right: -4rem;
		bottom: 0;
		display: flex;
		gap: 0.7rem;
	}

	.targets i {
		display: block;
		width: 2.5rem;
		height: 3.4rem;
		border: 0.3rem solid #c7a36a;
		border-radius: 50%;
		background: repeating-radial-gradient(circle, #5c3028 0 15%, #d3c090 16% 30%);
	}

	.route-line {
		position: absolute;
		right: 22%;
		bottom: 16%;
		left: 22%;
		height: 6%;
		border-bottom: 1px dashed rgba(212, 166, 83, 0.45);
		border-radius: 50%;
	}

	.route-line i {
		position: absolute;
		bottom: -0.18rem;
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 50%;
		background: #d4a653;
		box-shadow: 0 0 0.8rem rgba(212, 166, 83, 0.8);
	}

	.route-line i:nth-child(1) {
		left: 0;
	}
	.route-line i:nth-child(2) {
		left: 25%;
	}
	.route-line i:nth-child(3) {
		left: 50%;
	}
	.route-line i:nth-child(4) {
		left: 75%;
	}
	.route-line i:nth-child(5) {
		right: 0;
	}

	.walker {
		position: absolute;
		z-index: 8;
		bottom: 10%;
		left: 19%;
		width: clamp(7rem, 12vw, 11rem);
		filter: drop-shadow(0 1rem 1rem rgba(0, 0, 0, 0.5));
	}

	.walker.in-transit {
		animation: cross-settlement 3.6s cubic-bezier(0.45, 0.05, 0.55, 0.95) both;
	}

	.walker.at-destination {
		left: 75%;
	}

	.thought {
		position: absolute;
		right: -6rem;
		bottom: 76%;
		width: 11rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(8, 9, 13, 0.83);
		box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.3);
		color: rgba(244, 240, 232, 0.72);
		font-family: Georgia, serif;
		font-size: 0.68rem;
		font-style: italic;
		line-height: 1.45;
	}

	.thought::after {
		content: '';
		position: absolute;
		bottom: -0.55rem;
		left: 1.2rem;
		width: 0.8rem;
		height: 0.8rem;
		border-right: 1px solid rgba(255, 255, 255, 0.12);
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
		background: #0c0d12;
		transform: rotate(45deg);
	}

	.foreground {
		position: absolute;
		z-index: 15;
		right: 0;
		bottom: 0;
		left: 0;
		height: 12%;
		background: linear-gradient(180deg, transparent, #0c0b0b);
		pointer-events: none;
	}

	.foreground span {
		position: absolute;
		bottom: -1rem;
		width: 20rem;
		height: 5rem;
		border-radius: 50%;
		background: #13110f;
		filter: blur(2px);
	}

	.foreground span:nth-child(1) {
		left: -3rem;
	}
	.foreground span:nth-child(2) {
		left: 42%;
	}
	.foreground span:nth-child(3) {
		right: -4rem;
	}

	.hero-hud {
		position: relative;
		z-index: 20;
		display: grid;
		grid-template-columns: 7rem minmax(14rem, 0.6fr) minmax(18rem, 1fr) auto;
		align-items: center;
		gap: 1.5rem;
		min-height: 8.5rem;
		padding: 1rem clamp(1.2rem, 3vw, 3rem);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: #0a0b10;
		box-shadow: 0 -2rem 4rem rgba(0, 0, 0, 0.35);
	}

	.portrait {
		height: 6.5rem;
		overflow: hidden;
		border: 1px solid rgba(212, 166, 83, 0.3);
		background: #0c0e15;
	}

	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 13%;
		transform: scale(1.5);
	}

	.hud-copy p,
	.hud-copy h1 {
		margin: 0;
	}

	.hud-copy p {
		margin-bottom: 0.2rem;
		color: #d4a653;
		font-size: 0.52rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.hud-copy h1 {
		font-family: Georgia, serif;
		font-size: 2rem;
		font-weight: 400;
		letter-spacing: -0.035em;
	}

	.hud-copy span {
		color: rgba(244, 240, 232, 0.45);
		font-size: 0.6rem;
		text-transform: capitalize;
	}

	.status-bars {
		display: grid;
		gap: 0.55rem;
	}

	.status-bars > div {
		display: grid;
		grid-template-columns: 4rem 1fr 3.5rem;
		align-items: center;
		gap: 0.55rem;
	}

	.status-bars span,
	.status-bars strong {
		font-size: 0.52rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	.status-bars span {
		color: rgba(244, 240, 232, 0.42);
	}

	.status-bars strong {
		color: rgba(244, 240, 232, 0.65);
		text-align: right;
	}

	.status-bars i {
		display: block;
		height: 0.28rem;
		background: rgba(255, 255, 255, 0.07);
	}

	.status-bars b {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #6dc1cf, #b2e3d8);
		box-shadow: 0 0 0.6rem rgba(109, 193, 207, 0.45);
	}

	.status-bars > div:last-child b {
		background: #d4a653;
	}

	.proof-state {
		text-align: right;
	}

	.proof-state span,
	.proof-state code {
		display: block;
	}

	.proof-state span {
		margin-bottom: 0.35rem;
		color: #78d7af;
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.proof-state code {
		color: #6dc1cf;
		font-family: ui-monospace, monospace;
		font-size: 0.56rem;
	}

	.choice-result {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4rem;
		max-width: 80rem;
		margin: 0 auto;
		padding: 4rem 2rem 6rem;
	}

	.choice-result p,
	.spine span {
		margin: 0 0 0.45rem;
		color: #d4a653;
		font-size: 0.56rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.choice-result h2 {
		margin: 0 0 0.7rem;
		font-family: Georgia, serif;
		font-size: clamp(2rem, 4vw, 4rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		text-transform: capitalize;
	}

	.choice-result > div > span:last-child,
	.spine strong {
		color: rgba(244, 240, 232, 0.52);
		font-size: 0.78rem;
		font-weight: 400;
		line-height: 1.65;
	}

	.spine {
		align-self: end;
		padding: 1.2rem;
		border-left: 1px solid rgba(255, 255, 255, 0.1);
	}

	.spine span,
	.spine strong {
		display: block;
	}

	.error {
		max-width: 80rem;
		margin: -4rem auto 4rem;
		padding: 1rem;
		border: 1px solid rgba(242, 147, 143, 0.35);
		color: #f2938f;
		font-size: 0.7rem;
	}

	.journal-drawer {
		position: fixed;
		z-index: 80;
		top: 1rem;
		right: 1rem;
		bottom: 1rem;
		width: min(32rem, calc(100vw - 2rem));
		overflow: auto;
		border: 1px solid rgba(212, 166, 83, 0.3);
		background: #080a0f;
		box-shadow: 0 0 8rem rgba(0, 0, 0, 0.75);
	}

	.close {
		width: 100%;
		padding: 0.8rem;
		border: 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: #11131a;
		color: rgba(244, 240, 232, 0.55);
		cursor: pointer;
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	@keyframes cross-settlement {
		0% {
			left: 19%;
			transform: scale(0.82);
		}
		35% {
			transform: scale(0.95);
		}
		70% {
			transform: scale(0.88);
		}
		100% {
			left: 75%;
			transform: scale(0.78);
		}
	}

	@keyframes smoke {
		0% {
			opacity: 0;
			transform: translate(-50%, 0) scale(0.6);
		}
		35% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(-30%, -5rem) scale(1.6);
		}
	}

	@media (max-width: 850px) {
		header {
			grid-template-columns: 1fr auto;
		}

		.clock {
			display: none;
		}

		.world {
			height: 38rem;
		}

		.building {
			width: 38vw;
		}

		.hero-hud {
			grid-template-columns: 5rem 1fr auto;
			gap: 0.8rem;
		}

		.portrait {
			height: 5rem;
		}

		.status-bars {
			grid-column: 1 / -1;
		}

		.choice-result {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
	}

	@media (max-width: 560px) {
		.world {
			height: 32rem;
			min-height: 32rem;
		}

		.tower-silhouette {
			display: none;
		}

		.building {
			bottom: 28%;
			width: 43vw;
			height: 31%;
		}

		.dormitory {
			left: 1%;
		}
		.destination {
			right: 1%;
		}

		.walker {
			bottom: 14%;
			width: 7rem;
		}

		.thought {
			right: -3rem;
			width: 8rem;
			font-size: 0.56rem;
		}

		.hero-hud {
			grid-template-columns: 4.5rem 1fr;
		}

		.proof-state {
			display: none;
		}

		.hud-copy h1 {
			font-size: 1.5rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.walker.in-transit {
			animation-duration: 1ms;
		}

		.chimney i {
			animation: none;
		}
	}
</style>
