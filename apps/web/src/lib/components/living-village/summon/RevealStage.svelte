<script lang="ts">
	import { onMount } from 'svelte';
	import HeroDossier from './HeroDossier.svelte';
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
		aptitudes: readonly string[];
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
		hero: Pick<Hero, 'name' | 'identityLine' | 'affinity' | 'calling' | 'stars' | 'image'>;
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
	const identityVisible = $derived(['idle', 'identity', 'mechanics', 'complete'].includes(phase));
	const mechanicsVisible = $derived(['idle', 'mechanics', 'complete'].includes(phase));

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
			['threshold', 340],
			['silhouette', 770],
			['identity', 1580],
			['mechanics', 2050],
			['complete', 2380]
		],
		constellation: [
			['marks', 0],
			['form', 430],
			['silhouette', 1200],
			['identity', 1720],
			['mechanics', 2180],
			['complete', 2500]
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
	class:safe={safeMode}
	data-direction={direction}
	data-phase={phase}
	data-testid="reveal-stage"
	aria-label={`${hero.name} summon reveal`}
>
	<div class="world" aria-hidden="true">
		<PortalCanvas {direction} {phase} {runToken} reducedMotion={safeMode} />
		<div class="vault"><i></i><i></i><i></i><i></i><i></i></div>
		<div class="floor"><i></i><i></i><i></i></div>
		<div class="light-pillar"></div>
		<div class="impact"></div>
	</div>

	<div class="topline">
		<span>Standard · Hearth Gate</span>
		<span><i></i>{muted ? 'Sound muted' : 'Sound on'}</span>
	</div>

	<figure>
		<div class="portrait-shell">
			<img
				src={hero.image}
				alt={`${hero.name}, featured Standard banner identity`}
				width="1024"
				height="1536"
			/>
			<div class="rim"></div>
		</div>
		<figcaption>
			<div class="stars">{'✦'.repeat(hero.stars)}</div>
			<p>Hearthbound</p>
			<h1>{hero.name}</h1>
			<span>{hero.identityLine}</span>
			<div class="traits">
				<strong>{hero.calling}</strong><i></i><strong>{hero.affinity} affinity</strong>
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
		<ResultPresentation mode={resultMode} {results} onselect={(next) => onselect(next as Hero)} />
	{/if}
	{#if selectedHero}
		<HeroDossier hero={selectedHero} onclose={onclosedossier} />
	{/if}
</section>

<style>
	.stage {
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
		inset: 1% 31% 0 4%;
	}
	.portrait-shell img {
		position: absolute;
		z-index: 2;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: 47% 100%;
		filter: saturate(0.72) brightness(0.78) contrast(1.09) drop-shadow(0 24px 30px #000b);
		mix-blend-mode: screen;
		mask-image: radial-gradient(ellipse 54% 59% at 50% 51%, #000 58%, #000c 72%, transparent 100%);
		opacity: 0;
		transform: translateY(12px) scale(0.98);
		transition:
			opacity 500ms ease,
			transform 700ms cubic-bezier(0.18, 0.82, 0.22, 1),
			filter 650ms ease;
	}
	.identity-visible .portrait-shell img {
		opacity: 1;
		transform: none;
		filter: saturate(0.9) brightness(0.96) contrast(1.04) drop-shadow(0 24px 30px #000b);
	}
	.stage[data-phase='silhouette'] .portrait-shell img,
	.stage[data-phase='form'] .portrait-shell img {
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
		color: #e7b15b;
		font-size: 0.7rem;
		letter-spacing: 0.18em;
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
		background: #d5aa5f;
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
			inset: 2% -3% 27% -8%;
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
