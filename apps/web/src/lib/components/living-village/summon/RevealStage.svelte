<script lang="ts">
	import { onMount } from 'svelte';
	import HeroDossier from './HeroDossier.svelte';
	import MechanicIcon from './MechanicIcon.svelte';
	import PortalCanvas from './PortalCanvas.svelte';
	import ResultPresentation from './ResultPresentation.svelte';

	type Direction = 'gate' | 'constellation' | 'identity';
	type Phase =
		| 'idle'
		| 'charge'
		| 'threshold'
		| 'marks'
		| 'form'
		| 'silhouette'
		| 'identity'
		| 'mechanics'
		| 'complete';
	type Hero = {
		id: string;
		name: string;
		identityLine: string;
		affinity: string;
		affinityIcon: 'ember' | 'tide' | 'gale' | 'grove';
		calling: string;
		stars: number;
		image: string;
		attributes: readonly { name: string; value: number }[];
		personality: {
			traits: readonly string[];
			value: string;
			drive: string;
			socialStyle: string;
			stressResponse: string;
			tendency: string;
		};
		aptitudes: readonly { name: string; class: 'martial' | 'magic' | 'crafting' }[];
		arrivalId?: string;
		unread?: boolean;
		isBonus?: boolean;
	};

	let {
		hero,
		direction,
		runToken,
		reducedMotion,
		muted,
		resultVisible,
		resultMode,
		results,
		selectedHero,
		onselect,
		onclosedossier,
		onreplay,
		oncomplete,
		ontiming
	}: {
		hero: Pick<
			Hero,
			'name' | 'identityLine' | 'affinity' | 'affinityIcon' | 'calling' | 'stars' | 'image'
		>;
		direction: Direction;
		runToken: number;
		reducedMotion: boolean;
		muted: boolean;
		resultVisible: boolean;
		resultMode: 'single' | 'batch';
		results: readonly Hero[];
		selectedHero: Hero | null;
		onselect: (hero: Hero) => void;
		onclosedossier: () => void;
		onreplay: () => void;
		oncomplete: () => void;
		ontiming: (milliseconds: number) => void;
	} = $props();

	let phase = $state<Phase>('idle');
	let systemReducedMotion = $state(false);
	let timers: number[] = [];
	let startedAt = 0;
	let recognized = false;
	const safeMode = $derived(reducedMotion || systemReducedMotion);
	const veilLines = Array.from({ length: 9 }, (_, index) => index);
	const identityVisible = $derived(['idle', 'identity', 'mechanics', 'complete'].includes(phase));
	const mechanicsVisible = $derived(['idle', 'mechanics', 'complete'].includes(phase));
	const vesselVisible = $derived(
		['idle', 'threshold', 'form', 'silhouette', 'identity', 'mechanics', 'complete'].includes(phase)
	);

	const phaseLabels: Record<Phase, string> = {
		idle: 'The gate is listening',
		charge: 'Igniting the threshold',
		threshold: 'The way opens',
		marks: 'Affinity answers',
		form: 'A presence takes form',
		silhouette: 'Someone is crossing',
		identity: 'Identity recognized',
		mechanics: 'The bond settles',
		complete: 'Arrival complete'
	};

	const sequences: Record<Direction, Array<[Phase, number]>> = {
		gate: [
			['charge', 0],
			['threshold', 620],
			['silhouette', 1080],
			['identity', 1430],
			['mechanics', 1780],
			['complete', 2130]
		],
		constellation: [
			['marks', 0],
			['form', 500],
			['silhouette', 1050],
			['identity', 1550],
			['mechanics', 1940],
			['complete', 2250]
		],
		identity: [
			['identity', 0],
			['mechanics', 430],
			['complete', 820]
		]
	};

	function clearTimers() {
		for (const timer of timers) window.clearTimeout(timer);
		timers = [];
	}

	function recognize() {
		if (recognized) return;
		recognized = true;
		ontiming(Math.max(0, Math.round(performance.now() - startedAt)));
	}

	function enterPhase(next: Phase) {
		phase = next;
		if (next === 'identity') recognize();
		if (next === 'complete') oncomplete();
	}

	function begin() {
		clearTimers();
		recognized = false;
		startedAt = performance.now();
		if (safeMode) {
			phase = 'identity';
			recognize();
			timers.push(window.setTimeout(() => enterPhase('complete'), 40));
			return;
		}
		for (const [next, delay] of sequences[direction])
			timers.push(window.setTimeout(() => enterPhase(next), delay));
	}

	function skip() {
		clearTimers();
		if (!recognized) recognize();
		enterPhase('complete');
	}

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => (systemReducedMotion = media.matches);
		sync();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	});

	$effect(() => {
		if (runToken > 0) begin();
		return clearTimers;
	});
</script>

<section
	class="stage"
	class:identity-visible={identityVisible}
	class:mechanics-visible={mechanicsVisible}
	class:vessel-visible={vesselVisible}
	class:safe={safeMode}
	data-direction={direction}
	data-phase={phase}
	data-testid="reveal-stage"
	data-stars={hero.stars}
	data-vessel-visible={vesselVisible}
	aria-label={`${hero.name} summon reveal`}
>
	<div class="world" aria-hidden="true">
		<PortalCanvas {direction} {phase} {runToken} reducedMotion={safeMode} stars={hero.stars} />
		<div class="vault"><i></i><i></i><i></i><i></i><i></i></div>
		<div class="floor"><i></i><i></i><i></i></div>
		<div class="veil-lines">
			{#each veilLines as index (index)}<i style={`--line:${index}`}></i>{/each}
		</div>
		<div class="light-pillar"></div>
		<div class="rarity-strike"><i></i><i></i></div>
		<div class="chromatic-bloom"></div>
		<div class="impact"></div>
	</div>

	<div class="topline">
		<span>Standard · Hearth Gate</span>
		<span><i></i>{muted ? 'Sound muted' : 'Sound on'}</span>
	</div>

	<figure>
		<div class="portrait-shell">
			<img
				data-testid="reveal-portrait"
				src={hero.image}
				alt={`${hero.name}, featured Standard banner identity`}
				width="1024"
				height="1536"
			/>
			<div class="rim"></div>
		</div>
		<figcaption>
			<div class="stars">{'✦'.repeat(hero.stars)} <i>{hero.stars}★</i></div>
			<p>Hearthbound</p>
			<h1>{hero.name}</h1>
			<span>{hero.identityLine}</span>
			<div class="traits">
				<strong>{hero.calling}</strong><i></i><strong class="affinity"
					><MechanicIcon kind={hero.affinityIcon} size={15} />{hero.affinity} affinity</strong
				>
			</div>
		</figcaption>
	</figure>

	<div class="stage-footer">
		<div class="phase" aria-live="polite">
			<i></i><span>{safeMode && runToken > 0 ? 'Reduced-motion reveal' : phaseLabels[phase]}</span>
		</div>
		<div>
			<button type="button" onclick={skip} disabled={phase === 'idle' || phase === 'complete'}
				>Skip</button
			>
			<button type="button" onclick={onreplay}>Replay</button>
		</div>
	</div>

	{#if resultVisible && results.length > 0}
		<ResultPresentation
			mode={resultMode}
			{results}
			reducedMotion={safeMode}
			onselect={(next) => onselect(next as Hero)}
		/>
	{/if}
	{#if selectedHero}
		<HeroDossier hero={selectedHero} onclose={onclosedossier} />
	{/if}
</section>

<style>
	.stage {
		--rarity: #d9a956;
		--rarity-soft: #d9a9562e;
		position: relative;
		min-height: 668px;
		overflow: hidden;
		isolation: isolate;
		border: 1px solid #aedbd02f;
		border-radius: 28px;
		background:
			radial-gradient(ellipse at 46% 40%, #17695f55, transparent 42%),
			linear-gradient(180deg, #09151b 0%, #050a0e 76%);
		box-shadow:
			inset 0 1px #eafff817,
			inset 0 -80px 120px #0009,
			0 35px 100px #0009;
		color: #eee9df;
	}
	.stage[data-stars='2'] {
		--rarity: #75c4f4;
		--rarity-soft: #488fca3b;
	}
	.stage[data-stars='3'] {
		--rarity: #bd8cf4;
		--rarity-soft: #8857c447;
	}
	.stage::before {
		position: absolute;
		z-index: 4;
		inset: 0;
		pointer-events: none;
		background:
			linear-gradient(90deg, #0207099e 0%, transparent 24%, transparent 75%, #020708b8 100%),
			linear-gradient(0deg, #020608e8 0%, transparent 31%);
		content: '';
	}
	.stage::after {
		position: absolute;
		z-index: 15;
		inset: 0;
		pointer-events: none;
		background: repeating-linear-gradient(108deg, transparent 0 7px, #fff 8px 9px);
		content: '';
		opacity: 0.011;
		mix-blend-mode: soft-light;
	}
	.world {
		position: absolute;
		z-index: 1;
		inset: 0;
		overflow: hidden;
		transform-origin: 47% 43%;
	}
	.stage[data-phase='charge'] .world,
	.stage[data-phase='marks'] .world {
		animation: world-inhale 760ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	.stage[data-phase='threshold'] .world {
		animation: world-compress 430ms cubic-bezier(0.55, 0, 0.8, 0.35) both;
	}
	.stage[data-phase='identity'] .world {
		animation: world-impact 660ms cubic-bezier(0.12, 0.72, 0.2, 1) both;
	}
	@keyframes world-inhale {
		from {
			transform: scale(1.11);
			filter: saturate(0.65) brightness(0.7);
		}
		to {
			transform: scale(1);
			filter: none;
		}
	}
	@keyframes world-compress {
		0% {
			transform: scale(1);
		}
		76% {
			transform: scale(0.92);
			filter: brightness(1.22);
		}
		100% {
			transform: scale(1.025);
			filter: brightness(1.65);
		}
	}
	@keyframes world-impact {
		0% {
			transform: scale(0.96);
			filter: brightness(2.2) saturate(0.4);
		}
		22% {
			transform: scale(1.065);
			filter: brightness(1.5) saturate(1.35);
		}
		100% {
			transform: scale(1);
			filter: none;
		}
	}
	.vault {
		position: absolute;
		inset: 0;
		opacity: 0.38;
	}
	.vault i {
		position: absolute;
		top: -15%;
		bottom: -10%;
		width: 1px;
		background: linear-gradient(transparent, #75c8b828 25%, #75c8b838 70%, transparent);
		transform-origin: 50% 100%;
	}
	.vault i:nth-child(1) {
		left: 12%;
		transform: rotate(13deg);
	}
	.vault i:nth-child(2) {
		left: 29%;
		transform: rotate(5deg);
	}
	.vault i:nth-child(3) {
		left: 50%;
	}
	.vault i:nth-child(4) {
		left: 71%;
		transform: rotate(-5deg);
	}
	.vault i:nth-child(5) {
		left: 88%;
		transform: rotate(-13deg);
	}
	.floor {
		position: absolute;
		left: 3%;
		right: 3%;
		bottom: -28%;
		height: 56%;
		transform: perspective(420px) rotateX(68deg);
		border: 1px solid #6cc1af30;
		border-radius: 50%;
		box-shadow:
			inset 0 0 60px #2c9c8733,
			0 0 40px #37aa9628;
	}
	.floor i {
		position: absolute;
		inset: 12%;
		border: 1px solid #86d6c539;
		border-radius: 50%;
	}
	.floor i:nth-child(2) {
		inset: 28%;
	}
	.floor i:nth-child(3) {
		inset: 44%;
		background: #74d9c320;
		box-shadow: 0 0 55px #56bea9;
	}
	.veil-lines {
		position: absolute;
		top: 10%;
		left: 47%;
		width: 33%;
		height: 70%;
		transform: translateX(-50%);
		opacity: 0;
	}
	.veil-lines i {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(8% + var(--line) * 10.5%);
		width: 1px;
		transform: skewX(calc((var(--line) - 4) * 1.8deg));
		background: linear-gradient(
			transparent,
			color-mix(in srgb, var(--rarity) 72%, transparent) 26%,
			#effff9c9 51%,
			color-mix(in srgb, var(--rarity) 65%, transparent) 74%,
			transparent
		);
		filter: blur(0.4px) drop-shadow(0 0 6px var(--rarity));
	}
	.stage[data-phase='threshold'] .veil-lines,
	.stage[data-phase='form'] .veil-lines,
	.stage[data-phase='silhouette'] .veil-lines {
		opacity: 0.82;
		animation: veil-shiver 170ms steps(2, jump-none) infinite alternate;
	}
	@keyframes veil-shiver {
		to {
			transform: translateX(-50%) scaleX(1.05);
			filter: brightness(1.35);
		}
	}
	.light-pillar {
		position: absolute;
		top: 12%;
		left: 45%;
		width: 15%;
		height: 69%;
		transform: translateX(-50%);
		background: linear-gradient(90deg, transparent, #b7fff12a, #e2fff97a, #8ce3d237, transparent);
		filter: blur(14px);
		opacity: 0.16;
	}
	.impact {
		position: absolute;
		top: 43%;
		left: 47%;
		width: 80px;
		height: 80px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: #eafff6;
		filter: blur(10px);
		opacity: 0;
	}
	.rarity-strike,
	.chromatic-bloom {
		position: absolute;
		pointer-events: none;
	}
	.rarity-strike {
		top: 43%;
		left: 47%;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.rarity-strike i {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: linear-gradient(
			90deg,
			transparent,
			var(--rarity),
			#fff,
			var(--rarity),
			transparent
		);
		box-shadow: 0 0 28px var(--rarity);
	}
	.rarity-strike i:first-child {
		width: 640px;
		height: 2px;
	}
	.rarity-strike i:last-child {
		width: 2px;
		height: 640px;
	}
	.chromatic-bloom {
		top: 43%;
		left: 47%;
		width: 110px;
		height: 110px;
		transform: translate(-50%, -50%);
		border: 2px solid var(--rarity);
		border-radius: 50%;
		opacity: 0;
		box-shadow:
			0 0 55px var(--rarity),
			inset 0 0 35px var(--rarity);
	}
	.stage[data-phase='identity'] .rarity-strike {
		animation: rarity-strike 520ms ease-out both;
	}
	.stage[data-phase='identity'] .chromatic-bloom {
		animation: chromatic-bloom 780ms cubic-bezier(0.1, 0.72, 0.15, 1) both;
	}
	@keyframes rarity-strike {
		0% {
			opacity: 0;
			transform: scale(0.05);
		}
		14% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.25);
		}
	}
	@keyframes chromatic-bloom {
		0% {
			opacity: 0.95;
			transform: translate(-50%, -50%) scale(0.1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(8);
			border-width: 0.5px;
		}
	}
	.stage[data-phase='threshold'] .light-pillar,
	.stage[data-phase='silhouette'] .light-pillar,
	.stage[data-phase='form'] .light-pillar {
		opacity: 0.78;
		animation: pillar 620ms ease-in-out infinite alternate;
	}
	.stage[data-phase='identity'] .impact {
		animation: impact 580ms ease-out both;
	}
	@keyframes pillar {
		to {
			opacity: 1;
			transform: translateX(-50%) scaleX(1.3);
		}
	}
	@keyframes impact {
		from {
			opacity: 0.9;
			transform: translate(-50%, -50%) scale(0.2);
		}
		to {
			opacity: 0;
			transform: translate(-50%, -50%) scale(7);
		}
	}
	.topline {
		position: absolute;
		z-index: 8;
		top: 20px;
		right: 22px;
		left: 22px;
		display: flex;
		justify-content: space-between;
		color: #769089;
		font-size: 0.58rem;
		font-weight: 650;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.topline span:last-child {
		display: flex;
		gap: 7px;
		align-items: center;
	}
	.topline i,
	.phase i {
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #67c9b4;
		box-shadow: 0 0 9px #67c9b4;
	}
	figure {
		position: absolute;
		z-index: 5;
		inset: 38px 0 54px;
		margin: 0;
	}
	.portrait-shell {
		position: absolute;
		inset: 8% 53% 4% 9%;
		overflow: hidden;
		opacity: 0;
		transform: translateY(10px) scale(0.97);
		border: 1px solid color-mix(in srgb, var(--rarity) 44%, #80d5c2 22%);
		border-radius: 48% 48% 16% 16% / 25% 25% 10% 10%;
		background:
			radial-gradient(
				ellipse at 50% 34%,
				color-mix(in srgb, var(--rarity) 16%, transparent),
				transparent 48%
			),
			linear-gradient(180deg, #071116, #03070b 78%);
		box-shadow:
			inset 0 0 55px #49ad9822,
			0 0 42px #06100f;
		transition:
			opacity 160ms ease,
			transform 320ms cubic-bezier(0.18, 0.82, 0.22, 1);
	}
	.portrait-shell::before {
		position: absolute;
		z-index: 1;
		inset: 10px;
		pointer-events: none;
		border: 1px solid #91decf24;
		border-radius: inherit;
		box-shadow:
			inset 0 0 38px #000a,
			0 0 20px var(--rarity-soft);
		content: '';
	}
	.vessel-visible .portrait-shell {
		opacity: 1;
		transform: none;
	}
	.stage[data-phase='threshold'] .portrait-shell,
	.stage[data-phase='form'] .portrait-shell {
		animation: vessel-lock 480ms cubic-bezier(0.16, 0.78, 0.2, 1) both;
	}
	@keyframes vessel-lock {
		0% {
			opacity: 0;
			transform: translateY(18px) scaleX(0.72) scaleY(1.05);
			filter: brightness(2);
		}
		58% {
			opacity: 1;
			transform: translateY(-2px) scaleX(1.015);
		}
		100% {
			transform: none;
			filter: none;
		}
	}
	.portrait-shell img {
		position: absolute;
		z-index: 2;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
		filter: saturate(0.78) brightness(0.9) contrast(1.06) drop-shadow(0 24px 30px #000b);
		opacity: 0;
		transform: translateY(12px) scale(0.98);
	}
	.stage[data-phase='idle'] .portrait-shell img,
	.stage[data-phase='mechanics'] .portrait-shell img,
	.stage[data-phase='complete'] .portrait-shell img {
		opacity: 1;
		transform: none;
		filter: saturate(0.9) brightness(0.98) contrast(1.04) drop-shadow(0 24px 30px #000b);
	}
	.stage[data-phase='identity'] .portrait-shell img {
		animation: identity-arrive 620ms cubic-bezier(0.1, 0.75, 0.15, 1) 90ms both;
	}
	@keyframes identity-arrive {
		0% {
			opacity: 0;
			transform: translateY(26px) scale(0.9);
			filter: saturate(0) brightness(4) contrast(1.7) drop-shadow(0 0 55px var(--rarity));
		}
		24% {
			opacity: 1;
		}
		44% {
			transform: translateY(-4px) scale(1.025);
			filter: saturate(0.65) brightness(1.55) contrast(1.2) drop-shadow(0 0 32px var(--rarity));
		}
		100% {
			opacity: 1;
			transform: none;
			filter: saturate(0.9) brightness(0.96) contrast(1.04) drop-shadow(0 24px 30px #000b);
		}
	}
	.stage[data-phase='silhouette'] .portrait-shell img {
		opacity: 0.62;
		transform: translateY(18px) scale(0.95);
		filter: saturate(0) brightness(1.65) contrast(1.8) drop-shadow(0 0 34px #9cf3e2);
		animation: cross 900ms cubic-bezier(0.2, 0.75, 0.2, 1) both;
	}
	.stage[data-direction='identity'] .portrait-shell img {
		transition-duration: 120ms, 900ms, 600ms;
	}
	@keyframes cross {
		from {
			opacity: 0;
			transform: translateY(32px) scale(0.88);
			filter: blur(15px) drop-shadow(0 0 36px #a4f5e5);
		}
	}
	.rim {
		position: absolute;
		z-index: 3;
		inset: 10% 12% 2%;
		pointer-events: none;
		opacity: 0;
		border-radius: 48% 48% 18% 18%;
		box-shadow: inset 0 -25px 60px #75dac424;
	}
	.identity-visible .rim {
		opacity: 1;
	}
	figcaption {
		position: absolute;
		z-index: 6;
		right: 5%;
		bottom: 14%;
		width: 42%;
		opacity: 0;
		transform: translateY(15px);
		transition:
			opacity 520ms ease 120ms,
			transform 620ms cubic-bezier(0.18, 0.82, 0.22, 1) 120ms;
	}
	.identity-visible figcaption {
		opacity: 1;
		transform: none;
	}
	.stars {
		margin-bottom: 12px;
		color: var(--rarity);
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		text-shadow: 0 0 18px var(--rarity-soft);
	}
	.stars i {
		font-size: 0.58rem;
		font-style: normal;
		opacity: 0.72;
	}
	figcaption p {
		margin: 0;
		color: #83c9b9;
		font-size: 0.6rem;
		font-weight: 780;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	figcaption h1 {
		margin: 8px 0 11px;
		font:
			500 clamp(3rem, 6.2vw, 5.8rem)/0.82 Georgia,
			serif;
		letter-spacing: -0.07em;
		text-shadow: 0 10px 40px #000d;
	}
	.stage[data-phase='identity'] figcaption h1 {
		animation: name-resolve 620ms cubic-bezier(0.16, 0.8, 0.2, 1) 110ms both;
	}
	@keyframes name-resolve {
		from {
			opacity: 0;
			transform: translateY(18px);
			clip-path: inset(100% 0 0);
			letter-spacing: -0.11em;
		}
		to {
			opacity: 1;
			transform: none;
			clip-path: inset(0);
		}
	}
	figcaption > span {
		display: block;
		max-width: 420px;
		color: #aab4af;
		font-size: 0.78rem;
		line-height: 1.55;
	}
	.traits {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-top: 18px;
		color: #b8dcd4;
		font-size: 0.57rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0;
		transition: opacity 380ms ease 320ms;
	}
	.mechanics-visible .traits {
		opacity: 1;
	}
	.traits i {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--rarity);
	}
	.traits .affinity {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	.stage-footer {
		position: absolute;
		z-index: 8;
		right: 19px;
		bottom: 17px;
		left: 19px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.phase {
		display: flex;
		gap: 8px;
		align-items: center;
		color: #899d96;
		font-size: 0.62rem;
	}
	.stage-footer > div:last-child {
		display: flex;
		gap: 7px;
	}
	.stage-footer button {
		padding: 7px 13px;
		border: 1px solid #bed9d129;
		border-radius: 99px;
		background: #0d181dcc;
		color: #aebdb7;
		font-size: 0.6rem;
		font-weight: 680;
		cursor: pointer;
	}
	.stage-footer button:hover:not(:disabled) {
		border-color: #76c8b695;
		color: #eafff8;
	}
	.stage-footer button:disabled {
		opacity: 0.32;
		cursor: default;
	}
	.safe *,
	.safe *::before,
	.safe *::after {
		animation-duration: 1ms !important;
		animation-delay: 0ms !important;
		transition-duration: 1ms !important;
	}
	@media (max-width: 760px) {
		.stage {
			min-height: 660px;
			border-radius: 20px;
		}
		.topline {
			top: 16px;
			right: 16px;
			left: 16px;
		}
		.topline span:first-child {
			display: none;
		}
		.topline {
			justify-content: flex-end;
		}
		figure {
			inset: 30px 0 54px;
		}
		.portrait-shell {
			inset: 7% 15% 32%;
		}
		figcaption {
			right: 20px;
			bottom: 11%;
			left: 20px;
			width: auto;
			text-align: center;
		}
		figcaption h1 {
			font-size: clamp(3.1rem, 16vw, 4.4rem);
		}
		figcaption > span {
			margin-inline: auto;
			font-size: 0.69rem;
		}
		.traits {
			justify-content: center;
		}
		.stage-footer {
			right: 13px;
			bottom: 13px;
			left: 13px;
		}
		.phase span {
			max-width: 150px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
