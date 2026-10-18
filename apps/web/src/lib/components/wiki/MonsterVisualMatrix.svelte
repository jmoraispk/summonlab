<script lang="ts">
	import { resolve } from '$app/paths';
	import MonsterArtwork from './MonsterArtwork.svelte';
	import type { MonsterArtworkImage } from './monster-artwork';

	type Variant = {
		affinity: string;
		presentationStatus: string;
		thumbnailPath: string;
		sourcePath: string;
		width: number;
		height: number;
	};

	type Monster = {
		name: string;
		familyId: string;
		familyName: string;
		tier: string;
		role: string;
		variants: Variant[];
	};

	let { monster }: { monster: Monster } = $props();

	const label = (value: string) => value[0]?.toUpperCase() + value.slice(1);
	const gallery = $derived<MonsterArtworkImage[]>(
		monster.variants.map((variant) => ({
			src: variant.thumbnailPath,
			sourcePath: variant.sourcePath,
			alt: `${monster.name}, ${label(variant.affinity)} affinity`
		}))
	);
	const statusLabel = (value: string) => value.replaceAll('-', ' ');
	const sourceUrl = (path: string) => `https://github.com/jmoraispk/summonlab/blob/main/${path}`;
</script>

<section class="matrix" aria-labelledby="monster-matrix-heading">
	<header>
		<nav aria-label="Monster hierarchy">
			<a href={resolve('/wiki/creatures/monsters')}>Monster bestiary</a>
			<span>/</span>
			<a href={resolve(`/wiki/creatures/monsters/families/${monster.familyId}`)}>
				{monster.familyName} family
			</a>
		</nav>
		<p>{monster.tier} · {monster.role}</p>
		<h1 id="monster-matrix-heading">{monster.name}</h1>
		<span>Normal, Fire, Earth, Wind, and Water variants for this canonical form.</span>
	</header>

	<div class="variant-grid">
		{#each monster.variants as variant, index (variant.affinity)}
			<figure class:primary={index === 0}>
				<MonsterArtwork
					{gallery}
					src={variant.thumbnailPath}
					sourcePath={variant.sourcePath}
					alt={`${monster.name}, ${label(variant.affinity)} affinity`}
					width={variant.width}
					height={variant.height}
					fetchpriority={index === 0 ? 'high' : 'auto'}
				/>
				<figcaption>
					<div>
						<strong>{label(variant.affinity)}</strong><span
							>{statusLabel(variant.presentationStatus)}</span
						>
					</div>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external GitHub source evidence -->
					<a href={sourceUrl(variant.sourcePath)}>Source evidence ↗</a>
				</figcaption>
			</figure>
		{/each}
	</div>
</section>

<style>
	.matrix {
		--line: rgba(222, 211, 190, 0.16);
		padding: clamp(2.5rem, 5vw, 5rem) clamp(1rem, 5vw, 5rem) clamp(5rem, 9vw, 9rem);
		background:
			radial-gradient(circle at 78% 5%, rgba(55, 142, 158, 0.14), transparent 26rem),
			linear-gradient(180deg, #090d12, #090805);
	}
	.matrix > header,
	.variant-grid {
		max-width: 100rem;
		margin-inline: auto;
	}
	.matrix > header {
		margin-bottom: clamp(2rem, 5vw, 4rem);
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-bottom: 2.5rem;
	}
	nav a,
	nav span {
		color: rgba(243, 234, 217, 0.6);
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	nav a:last-child {
		color: #70c7d2;
	}
	.matrix > header p {
		margin: 0 0 0.65rem;
		color: #70c7d2;
		font:
			800 0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font:
			400 clamp(3.8rem, 9vw, 7.5rem) / 0.86 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	.matrix > header > span {
		display: block;
		margin-top: 1.4rem;
		color: rgba(243, 234, 217, 0.64);
		font:
			1rem/1.6 Georgia,
			serif;
	}
	.variant-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.75rem;
	}
	figure {
		min-width: 0;
		margin: 0;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 0.3rem;
		background: #070a0e;
	}
	figure.primary {
		border-color: rgba(112, 199, 210, 0.5);
	}
	figcaption {
		padding: 0.8rem;
	}
	figcaption div {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	figcaption strong {
		font:
			400 1.15rem Georgia,
			serif;
	}
	figcaption span,
	figcaption a {
		font:
			0.52rem/1.4 ui-monospace,
			monospace;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	figcaption span {
		color: #70c7d2;
		text-align: right;
	}
	figcaption a {
		display: inline-block;
		margin-top: 0.8rem;
		color: rgba(243, 234, 217, 0.54);
		text-decoration: none;
	}
	@media (max-width: 72rem) {
		.variant-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 40rem) {
		.variant-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
