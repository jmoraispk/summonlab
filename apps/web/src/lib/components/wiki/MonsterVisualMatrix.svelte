<script lang="ts">
	import { resolve } from '$app/paths';

	type Variant = {
		affinity: string;
		status: string;
		thumbnailPath: string;
		candidatePath: string;
		contentHash: string;
		version: number;
	};

	type Monster = {
		name: string;
		familyName: string;
		role: string;
		variants: Variant[];
	};

	let { monster }: { monster: Monster } = $props();

	const normal = $derived(monster.variants[0]);
	const affinityVariants = $derived(monster.variants.slice(1));
	const label = (affinity: string) => affinity[0]?.toUpperCase() + affinity.slice(1);
	const sourceUrl = (path: string) => `https://github.com/jmoraispk/summonlab/blob/main/${path}`;
</script>

<section class="matrix" aria-labelledby="monster-matrix-heading">
	<header>
		<a href={resolve('/wiki/creatures/monsters')}>← Monster database</a>
		<p>{monster.familyName}</p>
		<h1 id="monster-matrix-heading">{monster.name}</h1>
		<span>{monster.role}</span>
	</header>

	{#if normal}
		<div class="neutral-layout">
			<figure class="neutral">
				<img
					src={normal.thumbnailPath}
					alt={`${monster.name}, unaffiliated visual candidate`}
					width="720"
					height="480"
					fetchpriority="high"
				/>
				<figcaption>
					<div><span>Base class</span><strong>Unaffiliated</strong></div>
					<i class:revise={normal.status === 'revise'}>{normal.status}</i>
				</figcaption>
			</figure>
			<div class="neutral-copy">
				<span>Identity anchor</span>
				<h2>Read the creature before the element.</h2>
				<p>
					The neutral study establishes anatomy, silhouette, equipment, and battlefield duty. Every
					affinity below must remain recognizably this same monster.
				</p>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external GitHub source -->
				<a href={sourceUrl(normal.candidatePath)}>Inspect full-resolution source ↗</a>
				<code>{normal.contentHash.slice(0, 16)}… · v{normal.version}</code>
			</div>
		</div>
	{/if}

	<div class="variant-heading">
		<div>
			<span>Affinity studies</span>
			<h2>One identity, five transformations</h2>
		</div>
		<p>Candidate status is not runtime approval.</p>
	</div>
	<div class="variant-grid">
		{#each affinityVariants as variant (variant.affinity)}
			<figure class={`variant affinity-${variant.affinity}`}>
				<img
					src={variant.thumbnailPath}
					alt={`${monster.name}, ${label(variant.affinity)} affinity visual candidate`}
					width="720"
					height="480"
					loading="lazy"
				/>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external GitHub source -->
				<a
					href={sourceUrl(variant.candidatePath)}
					aria-label={`Open ${label(variant.affinity)} source`}
				>
					Source ↗
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<figcaption>
					<div>
						<span>{variant.affinity} affinity</span><strong>{label(variant.affinity)}</strong>
					</div>
					<i class:revise={variant.status === 'revise'}>{variant.status}</i>
				</figcaption>
			</figure>
		{/each}
	</div>
</section>

<style>
	.matrix {
		--line: rgba(222, 211, 190, 0.15);
		padding: clamp(3rem, 6vw, 6rem);
		background:
			radial-gradient(circle at 78% 8%, rgba(55, 142, 158, 0.14), transparent 26rem),
			linear-gradient(180deg, #090d12, #090805);
	}
	.matrix > header,
	.neutral-layout,
	.variant-heading,
	.variant-grid {
		max-width: 92rem;
		margin-inline: auto;
	}
	.matrix > header {
		margin-bottom: 2rem;
	}
	.matrix > header > a {
		display: inline-block;
		margin-bottom: 2.5rem;
		color: rgba(243, 234, 217, 0.56);
		font:
			0.64rem ui-monospace,
			monospace;
		letter-spacing: 0.11em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.matrix > header p,
	.neutral-copy > span,
	.variant-heading span {
		margin: 0 0 0.65rem;
		color: #70c7d2;
		font:
			0.66rem ui-monospace,
			monospace;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.matrix > header h1 {
		margin: 0;
		font:
			400 clamp(3.4rem, 8vw, 7.4rem) / 0.87 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	.matrix > header > span {
		display: block;
		margin-top: 1.2rem;
		color: rgba(243, 234, 217, 0.58);
		font:
			1.05rem Georgia,
			serif;
	}
	.neutral-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.65fr) minmax(18rem, 0.7fr);
		gap: 1px;
		border: 1px solid var(--line);
		background: var(--line);
	}
	figure {
		position: relative;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		background: #06090d;
	}
	figure img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
	}
	figure figcaption {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding: 4rem 1rem 1rem;
		background: linear-gradient(transparent, rgba(3, 5, 7, 0.94));
	}
	figcaption div {
		display: grid;
		gap: 0.2rem;
	}
	figcaption span {
		color: #70c7d2;
		font:
			0.55rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	figcaption strong {
		font:
			400 1.35rem Georgia,
			serif;
	}
	figcaption i {
		padding: 0.28rem 0.46rem;
		border: 1px solid rgba(107, 194, 156, 0.28);
		border-radius: 2rem;
		background: rgba(33, 109, 77, 0.24);
		color: #89d5ae;
		font:
			0.5rem ui-monospace,
			monospace;
		font-style: normal;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	figcaption i.revise {
		border-color: rgba(229, 158, 75, 0.35);
		background: rgba(142, 77, 30, 0.3);
		color: #e8b16d;
	}
	.neutral-copy {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(2rem, 4vw, 4rem);
		background: #0a0e13;
	}
	.neutral-copy h2,
	.variant-heading h2 {
		margin: 0;
		font:
			400 clamp(2rem, 3.7vw, 3.5rem) / 1 Georgia,
			serif;
		letter-spacing: -0.04em;
	}
	.neutral-copy p {
		margin: 1.5rem 0;
		color: rgba(243, 234, 217, 0.64);
		font:
			1rem/1.65 Georgia,
			serif;
	}
	.neutral-copy a {
		color: #70c7d2;
		font:
			0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.neutral-copy code {
		margin-top: 0.8rem;
		color: rgba(243, 234, 217, 0.34);
		font-size: 0.58rem;
	}
	.variant-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-top: 5rem;
		margin-bottom: 1.2rem;
	}
	.variant-heading p {
		margin: 0;
		color: rgba(243, 234, 217, 0.4);
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.variant-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.55rem;
	}
	.variant {
		border: 1px solid var(--line);
		border-top: 2px solid var(--affinity);
		border-radius: 0.28rem;
	}
	.variant figcaption {
		padding-top: 3rem;
	}
	.variant figcaption strong {
		font-size: 1.08rem;
	}
	.variant > a {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		padding: 0.35rem 0.45rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.2rem;
		background: rgba(4, 6, 8, 0.72);
		color: rgba(255, 255, 255, 0.65);
		font:
			0.5rem ui-monospace,
			monospace;
		text-decoration: none;
		text-transform: uppercase;
	}
	.affinity-wood {
		--affinity: #87a85c;
	}
	.affinity-fire {
		--affinity: #e26f3d;
	}
	.affinity-metal {
		--affinity: #c0b07e;
	}
	.affinity-water {
		--affinity: #4fa8cf;
	}
	.affinity-wind {
		--affinity: #c7e8ec;
	}
	@media (max-width: 78rem) {
		.variant-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 58rem) {
		.matrix {
			padding-inline: 1rem;
		}
		.neutral-layout {
			grid-template-columns: 1fr;
		}
		.variant-heading {
			align-items: start;
			flex-direction: column;
		}
	}
	@media (max-width: 39rem) {
		.matrix > header h1 {
			font-size: 3.15rem;
		}
		.variant-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
