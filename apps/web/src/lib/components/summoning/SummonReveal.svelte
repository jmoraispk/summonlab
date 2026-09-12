<script lang="ts">
	import { onDestroy } from 'svelte';

	import type { CitySummonHero } from '$lib/city';

	import PortalCanvas from './PortalCanvas.svelte';

	type RevealPhase = 'charge' | 'threshold' | 'silhouette' | 'identity' | 'complete';

	let {
		hero,
		runToken,
		reducedMotion,
		onComplete
	}: {
		hero: CitySummonHero;
		runToken: number;
		reducedMotion: boolean;
		onComplete: () => void;
	} = $props();

	let phase = $state<RevealPhase>('charge');
	let timers: ReturnType<typeof setTimeout>[] = [];

	function clearTimers() {
		for (const timer of timers) clearTimeout(timer);
		timers = [];
	}

	function complete() {
		clearTimers();
		if (phase === 'complete') return;
		phase = 'complete';
		onComplete();
	}

	$effect(() => {
		runToken;
		clearTimers();
		phase = 'charge';
		const beats: ReadonlyArray<{ phase: Exclude<RevealPhase, 'charge'>; delay: number }> =
			reducedMotion
				? [
						{ phase: 'threshold', delay: 80 },
						{ phase: 'silhouette', delay: 160 },
						{ phase: 'identity', delay: 240 },
						{ phase: 'complete', delay: 360 }
					]
				: [
						{ phase: 'threshold', delay: 900 },
						{ phase: 'silhouette', delay: 1_800 },
						{ phase: 'identity', delay: 2_850 },
						{ phase: 'complete', delay: 4_100 }
					];
		for (const beat of beats) {
			timers.push(
				setTimeout(() => {
					if (beat.phase === 'complete') complete();
					else phase = beat.phase;
				}, beat.delay)
			);
		}
		return clearTimers;
	});

	onDestroy(clearTimers);
</script>

<section class="reveal" data-testid="summon-reveal" data-phase={phase} aria-live="polite">
	<div class="portal" aria-hidden="true">
		<PortalCanvas direction="gate" {phase} {runToken} {reducedMotion} stars={hero.rarityStars} />
	</div>
	<div class:known={phase === 'identity' || phase === 'complete'} class="hero-art">
		<img
			src={hero.summonArt.publicPath}
			width={hero.summonArt.width}
			height={hero.summonArt.height}
			alt={phase === 'identity' || phase === 'complete' ? `${hero.name}, newly summoned` : ''}
		/>
	</div>
	<div class="reveal-copy">
		<span>Summon {String(hero.ordinal).padStart(2, '0')} · {phase}</span>
		<h3>
			{phase === 'identity' || phase === 'complete' ? hero.name : 'A life crosses the threshold'}
		</h3>
		<p>
			{phase === 'complete'
				? `${hero.name} now stands in Hearth 01.`
				: 'The circle is resolving a stable identity.'}
		</p>
	</div>
	{#if phase !== 'complete'}
		<button class="skip" type="button" onclick={complete}>Skip reveal</button>
	{/if}
</section>

<style>
	.reveal {
		position: relative;
		display: grid;
		min-height: min(34rem, 70vh);
		overflow: hidden;
		border: 1px solid rgba(112, 222, 210, 0.28);
		background: radial-gradient(circle at 45% 40%, #123534 0, #071012 42%, #050708 72%);
	}

	.portal,
	.hero-art {
		position: absolute;
		inset: 0;
	}

	.hero-art {
		display: grid;
		place-items: end center;
		opacity: 0;
		transition: opacity 650ms ease;
	}

	.hero-art.known,
	.reveal[data-phase='silhouette'] .hero-art {
		opacity: 1;
	}

	.hero-art img {
		width: min(48%, 24rem);
		height: 90%;
		object-fit: contain;
		object-position: center bottom;
		filter: brightness(0) drop-shadow(0 0 2rem #62d7ce88);
	}

	.hero-art.known img {
		filter: drop-shadow(0 1.5rem 2rem #000b);
	}

	.reveal-copy {
		position: relative;
		z-index: 3;
		align-self: end;
		padding: 6rem 2rem 1.5rem;
		background: linear-gradient(transparent, rgba(2, 5, 6, 0.94));
	}

	.reveal-copy span {
		color: #6ed9d1;
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.reveal-copy h3 {
		margin: 0.35rem 0;
		font-family: Georgia, serif;
		font-size: clamp(1.8rem, 5vw, 3.4rem);
		font-weight: 400;
	}

	.reveal-copy p {
		margin: 0;
		color: #d7ccbcaa;
	}

	.skip {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 4;
		padding: 0.7rem 0.9rem;
		border: 1px solid #d7ccbc44;
		background: #080c0ddd;
		color: #eee4d6;
		cursor: pointer;
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-art {
			transition: none;
		}
	}
</style>
