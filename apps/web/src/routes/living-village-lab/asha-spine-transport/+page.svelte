<script lang="ts">
	import AshaSpineTransportStage from '$lib/components/living-village/spine-canary/AshaSpineTransportStage.svelte';
	import LabBackLink from '$lib/components/living-village/LabBackLink.svelte';
</script>

<svelte:head>
	<title>Asha Spine transport canary · Summonlab</title>
	<meta
		name="description"
		content="An isolated technical review of Asha's approved cutout transported through Spine 4.3 and PixiJS 8."
	/>
</svelte:head>

<main>
	<LabBackLink placement="top" />
	<header>
		<p class="eyebrow">Candidate · transport-only</p>
		<h1>Asha survived the pipeline.</h1>
		<p class="lede">
			This is not Asha's production idle. It is a deliberately tiny rotation probe proving that her
			existing approved raster cutout can travel through Spine and render intact in PixiJS.
		</p>
	</header>

	<AshaSpineTransportStage />

	<section class="facts" aria-label="Transport contract">
		<article>
			<span>Toolchain</span>
			<strong>Editor 4.3.26</strong>
			<p>Spine Pixi 4.3.13 · PixiJS 8.20.0</p>
		</article>
		<article>
			<span>Anchor</span>
			<strong>(384, 738)</strong>
			<p>One feet anchor in the original 768×768 source.</p>
		</article>
		<article>
			<span>Exploration scale</span>
			<strong>72 · 84 · 96 px</strong>
			<p>Each candidate stands over the same 62 px tile marker.</p>
		</article>
	</section>

	<aside>
		<strong>Boundary preserved.</strong>
		Floor One still lives on a separate branch. This route contains no map, movement, combat, inventory,
		hero-card, or exploration state, and it is not linked from production Village or Tower navigation.
	</aside>
</main>

<style>
	:global(html) {
		background: #090d13;
	}

	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at 50% -15%, rgba(79, 126, 119, 0.2), transparent 45rem),
			linear-gradient(180deg, #0c121a, #080b10 72%);
		color: #edf4f5;
	}

	main {
		display: grid;
		gap: 1.5rem;
		width: min(96vw, 90rem);
		min-height: 100vh;
		box-sizing: border-box;
		margin: 0 auto;
		padding: clamp(4.5rem, 8vw, 7rem) 0 4rem;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}

	header {
		display: grid;
		gap: 0.7rem;
		max-width: 60rem;
	}

	.eyebrow {
		margin: 0;
		color: #a8d9bf;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2.3rem, 6vw, 5.2rem);
		font-weight: 500;
		letter-spacing: -0.05em;
	}

	.lede {
		max-width: 52rem;
		margin: 0;
		color: #9babb6;
		font-size: clamp(0.95rem, 1.8vw, 1.2rem);
		line-height: 1.65;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.facts article,
	aside {
		padding: 1rem 1.1rem;
		border: 1px solid rgba(133, 170, 188, 0.18);
		border-radius: 1rem;
		background: rgba(20, 28, 40, 0.62);
	}

	.facts span {
		display: block;
		margin-bottom: 0.45rem;
		color: #78909e;
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.facts strong {
		font-size: 1rem;
	}

	.facts p,
	aside {
		color: #91a5b2;
		font-size: 0.82rem;
		line-height: 1.55;
	}

	.facts p {
		margin: 0.35rem 0 0;
	}

	aside strong {
		color: #d4f5dc;
	}

	@media (max-width: 760px) {
		main {
			width: min(94vw, 42rem);
			padding-top: 5.5rem;
		}

		.facts {
			grid-template-columns: 1fr;
		}
	}
</style>
