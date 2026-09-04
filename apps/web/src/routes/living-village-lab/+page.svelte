<script lang="ts">
	import { resolve } from '$app/paths';
	import openingArtwork from '../../../../../docs/design-proposals/living-village-ui/mockups/opening-master-connection-desktop.png';
	import summonArtwork from '../../../../../assets/agent-summoning-concept.png';
	import towerArtwork from '../../../../../assets/tower-prototype.png';

	const screens = [
		{
			eyebrow: 'Playable prologue',
			title: 'The First Three',
			description:
				'Connect as Master, summon the first company, answer their questions, assign three starter weapons, and learn why the Tower matters.',
			action: 'Play Opening',
			href: '/living-village-lab/opening' as const,
			image: openingArtwork,
			alt: 'An empty summoning chamber waiting for the Master'
		},
		{
			eyebrow: 'Home surface',
			title: 'The Living Village',
			description:
				'Find the six residents in Hearth 01, inspect their readiness, and assign training, rest, or a hunt from the village itself.',
			action: 'Enter Village',
			href: '/living-village-lab/village' as const,
			image: '/runtime/settlements/hearth-01/environment.96cbb666f3d9.webp',
			alt: 'Hearth 01 village at dusk'
		},
		{
			eyebrow: 'Acquisition surface',
			title: 'The Summoning Portal',
			description:
				'Test the portal choreography, disclosed rates, pity progress, single summons, and the ten-summon bonus arrival.',
			action: 'Open Summoning Portal',
			href: '/living-village-lab/summon' as const,
			image: summonArtwork,
			alt: 'A hero approaching the Summoning Portal'
		},
		{
			eyebrow: 'Mission surface',
			title: 'The Tower Threshold',
			description:
				'Choose a floor and party, set the health-return threshold, watch the deterministic hunt, and inspect its rewards.',
			action: 'Test Tower Expedition',
			href: '/living-village-lab/tower' as const,
			image: towerArtwork,
			alt: 'The Tower rising above the settlement'
		}
	] as const;
</script>

<svelte:head>
	<title>Living Village laboratory · Summonlab</title>
	<meta
		name="description"
		content="A single comparison surface for the Living Village, Summoning Portal, and Tower expedition prototypes."
	/>
</svelte:head>

<main>
	<div class="sky-glow" aria-hidden="true"></div>
	<header class="masthead">
		<div>
			<p>Summonlab · playable integration build</p>
			<h1>Living Village laboratory</h1>
			<span>One six-hero roster. Three connected screens. One core loop to evaluate.</span>
		</div>
		<a class="wiki-link" href={resolve('/wiki/creatures/monsters/')}>Explore monster database</a>
	</header>

	<section class="loop" aria-label="Living Village core loop">
		<span>Meet the first three</span><i>→</i><span>Prepare in Hearth</span><i>→</i><span
			>Hunt the Tower</span
		><i>→</i><span>Return with growth</span>
	</section>

	<section class="screen-grid" aria-label="Playable screens">
		{#each screens as screen, index (screen.href)}
			<article style={`--delay:${index * 80}ms`}>
				<div class="artwork">
					<img src={screen.image} alt={screen.alt} />
					<div aria-hidden="true"></div>
					<b>0{index + 1}</b>
				</div>
				<div class="copy">
					<p>{screen.eyebrow}</p>
					<h2>{screen.title}</h2>
					<span>{screen.description}</span>
					<a href={resolve(screen.href)}>{screen.action}<i aria-hidden="true">↗</i></a>
				</div>
			</article>
		{/each}
	</section>

	<footer>
		<strong>Prototype boundary</strong>
		<span
			>Static Hearth · six fixed heroes · deterministic missions · no autonomous society simulation</span
		>
	</footer>
</main>

<style>
	:global(html) {
		background: #070a0e;
	}

	:global(body) {
		margin: 0;
	}

	main {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		box-sizing: border-box;
		padding: clamp(1.25rem, 4vw, 4.5rem);
		background:
			linear-gradient(180deg, rgba(7, 10, 14, 0.55), #070a0e 78%),
			radial-gradient(circle at 78% 12%, rgba(62, 143, 158, 0.18), transparent 30%), #070a0e;
		color: #f3eadc;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}

	.sky-glow {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image: linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px);
		background-size: 100% 4rem;
		mask-image: linear-gradient(to bottom, black, transparent 65%);
	}

	.masthead,
	.loop,
	.screen-grid,
	footer {
		position: relative;
		z-index: 1;
		max-width: 94rem;
		margin-inline: auto;
	}

	.masthead {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
	}

	.masthead p,
	.copy p {
		margin: 0 0 0.75rem;
		color: #79c8d0;
		font-size: 0.72rem;
		font-weight: 850;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	h1 {
		max-width: 13ch;
		margin: 0;
		font:
			400 clamp(2.7rem, 6vw, 6rem) / 0.88 Georgia,
			serif;
		letter-spacing: -0.055em;
	}

	.masthead span {
		display: block;
		margin-top: 1.35rem;
		color: #a8afb3;
		font-size: clamp(0.9rem, 1.2vw, 1.08rem);
	}

	.wiki-link {
		flex: none;
		padding: 0.85rem 1rem;
		border: 1px solid rgba(121, 200, 208, 0.38);
		border-radius: 999px;
		color: #b8e8eb;
		font-size: 0.78rem;
		font-weight: 800;
		text-decoration: none;
	}

	.loop {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: clamp(2rem, 5vw, 4.5rem);
		padding-block: 1rem;
		border-block: 1px solid rgba(222, 190, 139, 0.18);
		color: #b8aaa0;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.loop i {
		color: #ba7d49;
		font-style: normal;
	}

	.screen-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: clamp(0.8rem, 1.6vw, 1.5rem);
		margin-top: 1.5rem;
	}

	article {
		min-width: 0;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.13);
		border-radius: 0.9rem;
		background: rgba(16, 20, 25, 0.9);
		box-shadow: 0 1.6rem 5rem rgba(0, 0, 0, 0.28);
		animation: arrive 560ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
		animation-delay: var(--delay);
	}

	.artwork {
		position: relative;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		background: #0b1015;
	}

	.artwork img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 600ms ease;
	}

	article:hover .artwork img {
		transform: scale(1.035);
	}

	.artwork div {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 35%, rgba(10, 13, 17, 0.92));
	}

	.artwork b {
		position: absolute;
		right: 0.9rem;
		bottom: 0.65rem;
		color: rgba(255, 255, 255, 0.5);
		font:
			400 1.65rem/1 Georgia,
			serif;
	}

	.copy {
		display: grid;
		align-content: start;
		min-height: 14rem;
		padding: clamp(1.1rem, 2vw, 1.6rem);
	}

	.copy p {
		margin-bottom: 0.45rem;
		color: #ca985d;
		font-size: 0.62rem;
	}

	h2 {
		margin: 0;
		font:
			400 clamp(1.5rem, 2.4vw, 2.15rem) / 1 Georgia,
			serif;
	}

	.copy > span {
		margin-top: 0.8rem;
		color: #aeb4b7;
		font-size: 0.9rem;
		line-height: 1.58;
	}

	.copy a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		align-self: end;
		margin-top: 1.4rem;
		padding-top: 0.85rem;
		border-top: 1px solid rgba(255, 255, 255, 0.11);
		color: #f3eadc;
		font-size: 0.78rem;
		font-weight: 850;
		letter-spacing: 0.07em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.copy a i {
		color: #79c8d0;
		font-style: normal;
		font-size: 1rem;
	}

	footer {
		display: flex;
		gap: 0.65rem;
		margin-top: 1.5rem;
		color: #777f85;
		font-size: 0.72rem;
	}

	footer strong {
		color: #bd8f5b;
		text-transform: uppercase;
	}

	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
	}

	@media (max-width: 850px) {
		.masthead {
			align-items: start;
			flex-direction: column;
		}

		.screen-grid {
			grid-template-columns: 1fr;
		}

		.copy {
			min-height: 0;
		}
	}

	@media (max-width: 520px) {
		main {
			padding: 1rem;
		}

		h1 {
			font-size: 2.55rem;
		}

		.loop {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.3rem;
		}

		.loop i {
			display: none;
		}

		footer {
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		article,
		.artwork img {
			animation: none;
			transition: none;
		}
	}
</style>
