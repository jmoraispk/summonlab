<script lang="ts">
	import { onMount } from 'svelte';

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
		name: string;
		identityLine: string;
		affinity: string;
		calling: string;
		stars: number;
		image: string;
	};

	let {
		hero,
		direction,
		runToken,
		reducedMotion,
		muted,
		onreplay,
		oncomplete,
		ontiming
	}: {
		hero: Hero;
		direction: Direction;
		runToken: number;
		reducedMotion: boolean;
		muted: boolean;
		onreplay: () => void;
		oncomplete: () => void;
		ontiming: (milliseconds: number) => void;
	} = $props();

	let phase = $state<Phase>('idle');
	let systemReducedMotion = $state(false);
	let timers: number[] = [];
	let startedAt = 0;
	let recognized = false;
	const constellationPoints = Array.from({ length: 9 }, (_, index) => index);
	const safeMode = $derived(reducedMotion || systemReducedMotion);
	const identityVisible = $derived(['idle', 'identity', 'mechanics', 'complete'].includes(phase));
	const mechanicsVisible = $derived(['idle', 'mechanics', 'complete'].includes(phase));

	const phaseLabels: Record<Phase, string> = {
		idle: 'Featured identity ready',
		charge: 'The Hearth Gate gathers light',
		threshold: 'The threshold opens',
		marks: 'Affinity marks answer',
		form: 'A living pattern takes shape',
		silhouette: 'Someone crosses the threshold',
		identity: 'Identity recognized',
		mechanics: 'Calling and affinity resolved',
		complete: 'Presentation receipt complete'
	};

	const sequences: Record<Direction, Array<[Phase, number]>> = {
		gate: [
			['charge', 0],
			['threshold', 280],
			['silhouette', 600],
			['identity', 1750],
			['mechanics', 2550],
			['complete', 2900]
		],
		constellation: [
			['marks', 0],
			['form', 520],
			['silhouette', 1050],
			['identity', 1550],
			['mechanics', 2350],
			['complete', 2700]
		],
		identity: [
			['identity', 0],
			['mechanics', 700],
			['complete', 1150]
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

		for (const [next, delay] of sequences[direction]) {
			timers.push(window.setTimeout(() => enterPhase(next), delay));
		}
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
	<div class="atmosphere" aria-hidden="true">
		<div class="portal-machine">
			<div class="portal-halo"></div>
			<div class="portal-ring portal-outer">
				{#each ['◇', '✦', '△', '◈', '⌁', '✧', '○', '⟡'] as rune, index (rune)}
					<i style={`--r:${index}`}>{rune}</i>
				{/each}
			</div>
			<div class="portal-ring portal-middle"></div>
			<div class="portal-ring portal-inner"></div>
			<div class="portal-aperture"></div>
			<div class="portal-flare"></div>
			<div class="portal-crosshair"><i></i><i></i></div>
		</div>
		<div class="gate-ring ring-one"></div>
		<div class="gate-ring ring-two"></div>
		<div class="gate-ring ring-three"></div>
		<div class="horizon"></div>
		<div class="constellation">
			{#each constellationPoints as index (index)}
				<i style={`--i:${index};--x:${13 + ((index * 29) % 76)}%;--y:${12 + ((index * 47) % 70)}%`}
				></i>
			{/each}
		</div>
		<div class="threshold-light"></div>
		<div class="floor-seal"><i></i><i></i><i></i></div>
		<div class="summon-burst"></div>
	</div>

	<div class="stage-topline">
		<span>Standard · Fixed receipt LV-R-001</span>
		<span class="sound-state"><i></i>{muted ? 'Sound hook muted' : 'Sound hook armed'}</span>
	</div>

	<figure>
		<div class="portrait-shell">
			<div class="crossing-silhouette" style={`--hero-mask: url("${hero.image}")`}></div>
			<img
				src={hero.image}
				alt={`${hero.name}, featured Standard banner identity`}
				width="1024"
				height="1536"
			/>
			<div class="portrait-light"></div>
			<div class="portrait-scan"></div>
		</div>
		<figcaption class="identity">
			<div class="stars" aria-label={`${hero.stars} star fixture`}>{'✦'.repeat(hero.stars)}</div>
			<p>Hearthbound arrival</p>
			<h1>{hero.name}</h1>
			<span>{hero.identityLine}</span>
			<div class="traits">
				<strong>{hero.calling}</strong><i></i><strong>{hero.affinity} affinity</strong>
			</div>
		</figcaption>
	</figure>

	<div class="stage-footer">
		<div class="phase" aria-live="polite">
			<small>Reveal phase</small>
			<strong>{safeMode && phase !== 'idle' ? 'Reduced-motion reveal' : phaseLabels[phase]}</strong>
		</div>
		<div class="stage-controls">
			<button
				type="button"
				class="skip"
				onclick={skip}
				disabled={phase === 'idle' || phase === 'complete'}>Skip reveal</button
			>
			<button type="button" class="replay" onclick={onreplay}>Replay</button>
		</div>
	</div>
</section>

<style>
	.stage {
		position: relative;
		min-height: 630px;
		overflow: hidden;
		isolation: isolate;
		border: 1px solid #b5d1c92b;
		border-radius: 26px;
		background:
			linear-gradient(180deg, #0a171dc7 0%, #071014e8 62%, #060b0efc 100%),
			radial-gradient(ellipse at 50% 40%, #1f857663, transparent 53%), #070d11;
		box-shadow:
			inset 0 1px #effff114,
			inset 0 -60px 100px #020608cc,
			0 30px 80px #0007;
		color: #eee8dc;
	}

	.stage::after {
		position: absolute;
		z-index: 8;
		inset: 0;
		pointer-events: none;
		background: repeating-linear-gradient(112deg, transparent 0 5px, #fff 6px 7px);
		content: '';
		opacity: 0.012;
		mix-blend-mode: soft-light;
	}

	.atmosphere,
	.gate-ring,
	.horizon,
	.constellation,
	.threshold-light,
	.portal-machine,
	.portal-machine > div,
	.floor-seal,
	.summon-burst {
		position: absolute;
		pointer-events: none;
	}
	.atmosphere {
		z-index: -1;
		inset: 0;
	}
	.portal-machine {
		top: 6%;
		right: 4%;
		width: min(70%, 640px);
		aspect-ratio: 1;
		border-radius: 50%;
		opacity: 0.58;
		filter: drop-shadow(0 0 34px #61c8b62c);
		transition:
			opacity 280ms ease,
			filter 380ms ease,
			transform 450ms ease;
	}
	.portal-halo {
		inset: -10%;
		border-radius: 50%;
		background: radial-gradient(circle, transparent 42%, #2e8f7c1f 57%, transparent 71%);
		box-shadow:
			inset 0 0 80px #49b89f21,
			0 0 80px #143e3938;
	}
	.portal-ring {
		inset: 3%;
		border: 2px solid #c99a4d68;
		border-radius: 50%;
		background:
			repeating-conic-gradient(from 5deg, #dfad5e 0 1deg, transparent 1deg 10deg),
			radial-gradient(circle, transparent 62%, #7ed9c51a 63% 66%, transparent 67%);
		box-shadow:
			inset 0 0 34px #dfaa4d24,
			0 0 18px #dba34e28;
	}
	.portal-outer i {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 28px;
		height: 28px;
		transform: translate(-50%, -50%) rotate(calc(var(--r) * 45deg)) translateY(-255px)
			rotate(calc(var(--r) * -45deg));
		color: #e2b76f;
		font:
			500 1rem/28px Georgia,
			serif;
		text-align: center;
		text-shadow: 0 0 10px #e9ae52;
	}
	.portal-middle {
		inset: 11%;
		border: 1px dashed #79cdbb8f;
		background: repeating-conic-gradient(from 24deg, #8dd8c8 0 0.5deg, transparent 0.5deg 15deg);
		box-shadow:
			inset 0 0 26px #55bca62b,
			0 0 20px #5bc0aa27;
	}
	.portal-inner {
		inset: 18%;
		border: 1px solid #e1b76c70;
		background: repeating-conic-gradient(from 0deg, #e4b96e 0 1deg, transparent 1deg 30deg);
		box-shadow: inset 0 0 40px #80d4c23b;
	}
	.portal-aperture {
		inset: 22%;
		border: 1px solid #a9ebdd52;
		border-radius: 50%;
		background:
			radial-gradient(circle at 56% 43%, #f7d99a22 0 4%, transparent 26%),
			repeating-radial-gradient(circle, #7ad0be14 0 2px, transparent 3px 19px),
			radial-gradient(circle, #24594f76, #081518dd 68%);
		box-shadow:
			inset 0 0 70px #74d4c164,
			0 0 45px #69cab64a;
	}
	.portal-flare {
		inset: 23%;
		border-radius: 50%;
		background: radial-gradient(circle, #fffde7 0, #ffd38d 8%, #83e4d0 27%, transparent 70%);
		opacity: 0;
		filter: blur(10px);
		mix-blend-mode: screen;
	}
	.portal-crosshair {
		inset: 27%;
		border: 1px solid #d4b16d2e;
		border-radius: 50%;
	}
	.portal-crosshair i:first-child {
		position: absolute;
		top: 50%;
		left: -12%;
		width: 124%;
		height: 1px;
		background: linear-gradient(90deg, transparent, #a2e1d280, transparent);
	}
	.portal-crosshair i:last-child {
		position: absolute;
		top: -12%;
		left: 50%;
		width: 1px;
		height: 124%;
		background: linear-gradient(transparent, #dcb16765, transparent);
	}
	.floor-seal {
		right: 8%;
		bottom: 10%;
		width: 65%;
		height: 15%;
		transform: perspective(300px) rotateX(68deg);
		border: 1px solid #d9ab5a68;
		border-radius: 50%;
		box-shadow:
			inset 0 0 32px #6bc7b042,
			0 0 26px #d99f4540;
	}
	.floor-seal i {
		position: absolute;
		inset: 18%;
		border: 1px dashed #82d2c073;
		border-radius: 50%;
	}
	.floor-seal i:nth-child(2) {
		inset: 35%;
		border-style: solid;
		border-color: #e2b76975;
	}
	.floor-seal i:nth-child(3) {
		inset: -35% 49%;
		border: 0;
		border-left: 1px solid #87d2c0;
		border-radius: 0;
	}
	.summon-burst {
		top: 12%;
		right: 13%;
		width: 52%;
		height: 80%;
		background: linear-gradient(90deg, transparent 49%, #fff 50%, transparent 51%);
		opacity: 0;
		filter: blur(3px);
		mix-blend-mode: screen;
	}
	.gate-ring {
		inset: 13% 18% 5%;
		border: 1px solid #77d3bf2b;
		border-radius: 50% 50% 44% 44%;
		opacity: 0.6;
	}
	.ring-one {
		transform: rotate(-8deg);
		box-shadow:
			inset 0 0 70px #43baa028,
			0 0 40px #61c7b516;
	}
	.ring-two {
		inset: 18% 24% 9%;
		transform: rotate(13deg);
		border-color: #d8a1513b;
	}
	.ring-three {
		inset: 22% 29% 13%;
		transform: rotate(-18deg);
		border-style: dashed;
	}
	.horizon {
		right: 8%;
		bottom: 16%;
		left: 8%;
		height: 1px;
		background: linear-gradient(90deg, transparent, #68c4b180, transparent);
		box-shadow: 0 0 26px #62bfa7;
	}
	.threshold-light {
		inset: 25% 31% 6%;
		border-radius: 50%;
		background: radial-gradient(ellipse, #e8b66d70, #65d3bd35 30%, transparent 68%);
		filter: blur(22px);
		opacity: 0.2;
	}

	.constellation {
		inset: 13% 17% 13%;
		opacity: 0;
	}
	.constellation i {
		position: absolute;
		top: var(--y);
		left: var(--x);
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #c2f3e7;
		box-shadow: 0 0 12px #7fe2cf;
	}
	.constellation i::after {
		position: absolute;
		width: 54px;
		height: 1px;
		transform: rotate(calc(var(--i) * 23deg));
		transform-origin: left;
		background: linear-gradient(90deg, #80d7c97a, transparent);
		content: '';
	}

	.stage-topline {
		position: relative;
		z-index: 10;
		display: flex;
		justify-content: space-between;
		padding: 18px 20px;
		color: #90a09a;
		font:
			660 0.62rem/1.2 Inter,
			ui-sans-serif,
			system-ui;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.sound-state {
		display: flex;
		gap: 7px;
		align-items: center;
	}
	.sound-state i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #68bead;
		box-shadow: 0 0 8px #68bead;
	}

	figure {
		position: absolute;
		inset: 40px 0 76px;
		margin: 0;
	}
	.portrait-shell {
		position: absolute;
		inset: 2% 2% 0 20%;
		opacity: 0;
		filter: saturate(0.58) brightness(0.52);
		transform: translate3d(4%, -1%, 0) scale(0.82);
		mask-image: radial-gradient(ellipse 44% 64% at 57% 49%, #000 55%, transparent 94%);
		transition:
			opacity 550ms ease,
			filter 650ms ease,
			transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.crossing-silhouette {
		position: absolute;
		z-index: 4;
		inset: 2% 0 0;
		background: #020607;
		opacity: 0;
		filter: drop-shadow(0 0 18px #dffdf6) drop-shadow(0 0 42px #75d4c0);
		-webkit-mask-image: var(--hero-mask);
		mask-image: var(--hero-mask);
		-webkit-mask-position: center bottom;
		mask-position: center bottom;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: contain;
		mask-size: contain;
		mask-mode: luminance;
		transform: translateY(8%) scale(0.84);
		transition:
			opacity 220ms ease,
			transform 620ms cubic-bezier(0.18, 0.78, 0.24, 1);
	}
	.portrait-shell img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center bottom;
		filter: drop-shadow(0 22px 30px #000a);
		mix-blend-mode: screen;
	}
	.portrait-light {
		position: absolute;
		inset: 8% 12% 5% 10%;
		border-radius: 50%;
		background: radial-gradient(ellipse, #db9d5128, transparent 60%);
		mix-blend-mode: screen;
	}
	.portrait-scan {
		position: absolute;
		inset: 8% 13%;
		border-top: 1px solid #d8f7ed00;
		opacity: 0;
	}

	.identity-visible .portrait-shell {
		opacity: 1;
		filter: saturate(0.9) brightness(0.92);
		transform: translate3d(0, 0, 0) scale(1);
	}
	[data-direction='gate'][data-phase='silhouette'] .portrait-shell,
	[data-direction='constellation'][data-phase='silhouette'] .portrait-shell {
		opacity: 1;
		filter: none;
		transform: translate3d(0, 2%, 0) scale(0.94);
	}
	[data-phase='silhouette'] .portrait-shell img {
		opacity: 0;
	}
	[data-phase='silhouette'] .crossing-silhouette {
		opacity: 0.92;
		transform: translateY(0) scale(0.98);
	}

	.identity {
		position: absolute;
		z-index: 3;
		right: 6%;
		bottom: 7%;
		left: 6%;
		max-width: 470px;
		opacity: 0;
		transform: translateY(16px);
		transition:
			opacity 450ms ease 120ms,
			transform 500ms ease 120ms;
		text-shadow: 0 2px 15px #000;
	}
	.identity-visible .identity {
		opacity: 1;
		transform: translateY(0);
	}
	.identity p {
		margin: 0 0 5px;
		color: #d3ae70;
		font:
			720 0.65rem/1.2 Inter,
			ui-sans-serif,
			system-ui;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	.identity h1 {
		margin: 0;
		font:
			500 clamp(2.8rem, 6vw, 5.4rem)/0.88 Georgia,
			'Times New Roman',
			serif;
		letter-spacing: -0.055em;
	}
	.identity > span {
		display: block;
		max-width: 390px;
		margin-top: 13px;
		color: #c8ccc6;
		font:
			400 0.9rem/1.5 Inter,
			ui-sans-serif,
			system-ui;
	}
	.stars {
		margin-bottom: 10px;
		color: #dfad62;
		font-size: 0.78rem;
		letter-spacing: 0.18em;
	}
	.traits {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-top: 14px;
		color: #9ed4ca;
		font:
			680 0.68rem/1.2 Inter,
			ui-sans-serif,
			system-ui;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0;
		transition: opacity 450ms ease;
	}
	.traits i {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: #d1a45e;
	}
	.mechanics-visible .traits {
		opacity: 1;
	}

	.stage-footer {
		position: absolute;
		z-index: 12;
		right: 0;
		bottom: 0;
		left: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 14px 18px;
		border-top: 1px solid #e0eee318;
		background: #050a0dcc;
		backdrop-filter: blur(12px);
	}
	.phase {
		display: grid;
		gap: 2px;
		min-width: 0;
		font-family: Inter, ui-sans-serif, system-ui;
	}
	.phase small {
		color: #6f807a;
		font-size: 0.59rem;
		font-weight: 760;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.phase strong {
		overflow: hidden;
		color: #cbd4cf;
		font-size: 0.74rem;
		font-weight: 590;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stage-controls {
		display: flex;
		gap: 7px;
		flex: 0 0 auto;
	}
	.stage-controls button {
		min-height: 34px;
		padding: 0 12px;
		border: 1px solid #c3d8d130;
		border-radius: 8px;
		background: #10191dcb;
		color: #c8d1cc;
		font:
			690 0.68rem Inter,
			ui-sans-serif,
			system-ui;
		cursor: pointer;
	}
	.stage-controls button:hover:not(:disabled),
	.stage-controls button:focus-visible {
		border-color: #92cfc0;
		color: #fff;
	}
	.stage-controls button:disabled {
		opacity: 0.38;
		cursor: default;
	}
	.stage-controls .replay {
		border-color: #c7954a55;
		color: #e5c184;
	}

	.portal-outer {
		animation: portal-drift 22s linear infinite;
	}
	.portal-middle {
		animation: portal-drift-reverse 17s linear infinite;
	}
	[data-direction='gate'][data-phase='charge'] .portal-machine {
		opacity: 1;
		filter: drop-shadow(0 0 48px #66d7be80);
		animation: portal-awaken 450ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	[data-direction='gate'][data-phase='charge'] .portal-aperture {
		animation: aperture-charge 520ms ease-in-out infinite alternate;
	}
	[data-direction='gate'][data-phase='threshold'] .portal-machine,
	[data-direction='gate'][data-phase='silhouette'] .portal-machine {
		opacity: 1;
		filter: drop-shadow(0 0 70px #f0bd656e);
	}
	[data-direction='gate'][data-phase='threshold'] .portal-flare {
		opacity: 1;
		animation: portal-open 620ms ease-out both;
	}
	[data-direction='gate'][data-phase='threshold'] .summon-burst {
		animation: vertical-burst 620ms ease-out both;
	}
	[data-direction='gate'][data-phase='silhouette'] .portal-aperture {
		background: radial-gradient(circle, #fff8db 0, #d4a75e 22%, #4ec4ad 55%, #071417 75%);
		box-shadow:
			inset 0 0 80px #fff7d1,
			0 0 70px #e5b35a9c;
	}
	[data-direction='gate'][data-phase='identity'] .portal-flare,
	[data-direction='identity'][data-phase='identity'] .portal-flare {
		animation: identity-flash 780ms ease-out both;
	}
	[data-direction='constellation'][data-phase='form'] .portal-machine,
	[data-direction='constellation'][data-phase='silhouette'] .portal-machine {
		opacity: 0.9;
		filter: drop-shadow(0 0 55px #70dbc493);
	}

	[data-direction='gate'][data-phase='charge'] .ring-one,
	[data-direction='gate'][data-phase='threshold'] .gate-ring {
		animation: ring-charge 900ms ease-in-out infinite alternate;
	}
	[data-direction='gate'][data-phase='threshold'] .threshold-light,
	[data-direction='gate'][data-phase='silhouette'] .threshold-light {
		opacity: 0.8;
		animation: threshold-pulse 700ms ease-in-out infinite alternate;
	}
	[data-direction='constellation'][data-phase='marks'] .constellation,
	[data-direction='constellation'][data-phase='form'] .constellation,
	[data-direction='constellation'][data-phase='silhouette'] .constellation {
		opacity: 1;
	}
	[data-direction='constellation'][data-phase='marks'] .constellation i {
		animation: star-gather 900ms calc(var(--i) * 45ms) both;
	}
	[data-direction='constellation'][data-phase='form'] .constellation {
		animation: constellation-form 1s ease both;
	}
	[data-direction='identity'] .portrait-shell {
		transform-origin: 62% 42%;
	}
	[data-direction='identity'][data-phase='identity'] .portrait-shell {
		animation: premium-settle 1.15s cubic-bezier(0.18, 0.7, 0.23, 1) both;
	}

	@keyframes portal-drift {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes portal-drift-reverse {
		to {
			transform: rotate(-360deg);
		}
	}
	@keyframes portal-awaken {
		from {
			opacity: 0.25;
			transform: scale(0.78);
			filter: blur(5px);
		}
		70% {
			transform: scale(1.035);
		}
		to {
			opacity: 1;
			transform: scale(1);
			filter: blur(0);
		}
	}
	@keyframes aperture-charge {
		to {
			background-color: #4eae9a55;
			box-shadow:
				inset 0 0 95px #9df2df91,
				0 0 65px #5cd0b687;
			transform: scale(1.035);
		}
	}
	@keyframes portal-open {
		0% {
			opacity: 0;
			transform: scale(0.2);
		}
		45% {
			opacity: 1;
			transform: scale(1.18);
		}
		100% {
			opacity: 0.76;
			transform: scale(1);
		}
	}
	@keyframes vertical-burst {
		0% {
			opacity: 0;
			transform: scaleX(0.2);
		}
		35% {
			opacity: 0.9;
			transform: scaleX(1);
		}
		100% {
			opacity: 0;
			transform: scaleX(1.8);
		}
	}
	@keyframes identity-flash {
		0% {
			opacity: 0.9;
			transform: scale(0.72);
		}
		40% {
			opacity: 0.72;
			transform: scale(1.25);
		}
		100% {
			opacity: 0;
			transform: scale(1.65);
		}
	}

	@keyframes ring-charge {
		to {
			opacity: 1;
			transform: rotate(2deg) scale(1.035);
			border-color: #98dece70;
			box-shadow:
				inset 0 0 85px #4ec8ab35,
				0 0 55px #61c7b525;
		}
	}
	@keyframes threshold-pulse {
		to {
			transform: scale(1.12);
			filter: blur(30px);
		}
	}
	@keyframes star-gather {
		from {
			opacity: 0;
			transform: translate(calc((var(--x) - 50%) * 0.6), calc((var(--y) - 50%) * 0.6)) scale(2.5);
		}
		to {
			opacity: 1;
			transform: translate(0) scale(1);
		}
	}
	@keyframes constellation-form {
		to {
			transform: scale(0.72) translateY(7%);
			filter: blur(1px);
			opacity: 0.38;
		}
	}
	@keyframes premium-settle {
		from {
			transform: translate3d(1.5%, 0, 0) scale(1.035);
			filter: saturate(0.75) brightness(0.78);
		}
		to {
			transform: translate3d(0, 0, 0) scale(1);
			filter: saturate(0.9) brightness(0.92);
		}
	}

	.safe *,
	.safe *::before,
	.safe *::after {
		animation-duration: 1ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 1ms !important;
	}

	@media (prefers-reduced-motion: reduce) {
		.stage *,
		.stage *::before,
		.stage *::after {
			animation-duration: 1ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 1ms !important;
		}
	}

	@media (max-width: 720px) {
		.stage {
			min-height: 476px;
			border-radius: 19px;
		}
		.portal-machine {
			top: 7%;
			right: -8%;
			width: 82%;
		}
		.portal-outer i {
			transform: translate(-50%, -50%) rotate(calc(var(--r) * 45deg)) translateY(-145px)
				rotate(calc(var(--r) * -45deg));
			font-size: 0.7rem;
		}
		.floor-seal {
			right: -3%;
			width: 82%;
		}
		.stage-topline {
			padding: 13px 14px;
			font-size: 0.52rem;
		}
		.stage-topline > span:first-child {
			max-width: 52%;
		}
		figure {
			inset: 32px 0 70px;
		}
		.portrait-shell {
			inset: 2% -12% 0 5%;
		}
		.identity {
			right: 18px;
			bottom: 7%;
			left: 18px;
		}
		.identity h1 {
			font-size: clamp(2.45rem, 13vw, 3.4rem);
		}
		.identity > span {
			max-width: 86%;
			font-size: 0.75rem;
		}
		.traits {
			font-size: 0.6rem;
		}
		.stage-footer {
			padding: 10px 11px;
		}
		.phase {
			max-width: 45%;
		}
		.stage-controls button {
			min-height: 36px;
			padding: 0 9px;
		}
	}
</style>
