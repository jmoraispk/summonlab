<script lang="ts">
	import { resolve } from '$app/paths';

	import AffinityIcon from './AffinityIcon.svelte';

	type CurrentAffinity = 'fire' | 'earth' | 'wind' | 'water';

	type Variant = {
		affinity: string;
		status: string;
		presentationStatus: string;
		thumbnailPath: string;
		approvedPath: string;
		contentHash: string;
		version: number;
		width: number;
		height: number;
	};

	type Monster = {
		name: string;
		familyName: string;
		role: string;
		variants: Variant[];
	};

	let { monster }: { monster: Monster } = $props();
	let selectedIndex = $state(0);

	function currentAffinity(affinity: string): CurrentAffinity {
		if (['fire', 'earth', 'wind', 'water'].includes(affinity)) {
			return affinity as CurrentAffinity;
		}
		throw new Error(`Unsupported current monster target: ${affinity}`);
	}

	const currentTargets: readonly CurrentAffinity[] = ['fire', 'earth', 'wind', 'water'];
	const normal = $derived(
		monster.variants.find(
			(variant) => variant.affinity === 'normal' && variant.presentationStatus === 'runtime'
		)
	);
	const affinityVariants = $derived(
		currentTargets.flatMap((target) => {
			const variant = monster.variants.find(
				(entry) => entry.affinity === target && entry.presentationStatus === 'runtime'
			);
			return variant ? [{ ...variant, affinity: currentAffinity(variant.affinity) }] : [];
		})
	);
	const missingCurrentTargets = $derived(
		currentTargets.filter(
			(target) =>
				!monster.variants.some(
					(variant) => variant.affinity === target && variant.presentationStatus === 'runtime'
				)
		)
	);
	const selectedVariant = $derived(affinityVariants[selectedIndex]);
	const label = (affinity: string) => affinity[0]?.toUpperCase() + affinity.slice(1);
	const sourceUrl = (path: string) => `https://github.com/jmoraispk/summonlab/blob/main/${path}`;

	function moveSelection(offset: number) {
		selectedIndex = (selectedIndex + offset + affinityVariants.length) % affinityVariants.length;
	}
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
					alt={`${monster.name} base form`}
					width={normal.width}
					height={normal.height}
					fetchpriority="high"
				/>
			</figure>
			<div class="neutral-copy">
				<div>
					<h2>Base Form</h2>
					<p>
						The base form establishes anatomy, silhouette, equipment, and battlefield duty. Every
						variant remains recognizably this same monster.
					</p>
				</div>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external GitHub source -->
				<a href={sourceUrl(normal.approvedPath)}>Approved full-resolution source ↗</a>
			</div>
		</div>
	{/if}

	<div class="variant-heading">
		<h2>Approved affinity forms</h2>
		<p>
			Normal plus Fire, Earth, Wind, and Water. Each image is owner-approved and wired to the
			enemy-only wiki runtime.
		</p>
	</div>

	{#if selectedVariant}
		<div class="variant-viewer">
			<figure
				class={`variant-stage affinity-${selectedVariant.affinity}`}
				id="selected-affinity-variant"
				aria-live="polite"
			>
				<img
					src={selectedVariant.thumbnailPath}
					alt={`${monster.name}, ${label(selectedVariant.affinity)} affinity`}
					width={selectedVariant.width}
					height={selectedVariant.height}
				/>
				<span class="variant-mark">
					<AffinityIcon affinity={selectedVariant.affinity} />
				</span>
				<span class="variant-status">approved · runtime</span>
				<button
					class="carousel-control previous"
					type="button"
					aria-label="Previous current-target candidate"
					onclick={() => moveSelection(-1)}>←</button
				>
				<button
					class="carousel-control next"
					type="button"
					aria-label="Next current-target candidate"
					onclick={() => moveSelection(1)}>→</button
				>
				<figcaption>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- external GitHub source -->
					<a
						href={sourceUrl(selectedVariant.approvedPath)}
						aria-label={`Open ${label(selectedVariant.affinity)} full-resolution source`}
					>
						Approved full-resolution source ↗
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</figcaption>
			</figure>

			<div class="variant-selector" role="group" aria-label="Choose an approved affinity image">
				{#each affinityVariants as variant, index (variant.affinity)}
					<button
						class={`affinity-${variant.affinity}`}
						type="button"
						aria-label={`${label(variant.affinity)} approved image`}
						aria-controls="selected-affinity-variant"
						aria-pressed={selectedIndex === index}
						title={label(variant.affinity)}
						onclick={() => (selectedIndex = index)}
					>
						<AffinityIcon affinity={variant.affinity} />
					</button>
				{/each}
				{#each missingCurrentTargets as target (target)}
					<span class={`target-status affinity-${target}`}>
						<AffinityIcon affinity={target} />
						<i>{label(target)} runtime image not available</i>
					</span>
				{/each}
			</div>
		</div>
	{/if}
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
	.variant-viewer {
		max-width: 92rem;
		margin-inline: auto;
	}
	.matrix > header {
		margin-bottom: 2rem;
	}
	.matrix > header > a {
		display: inline-block;
		margin-bottom: 2.5rem;
		color: rgba(243, 234, 217, 0.68);
		font:
			0.68rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.matrix > header p {
		margin: 0 0 0.65rem;
		color: #70c7d2;
		font:
			0.68rem ui-monospace,
			monospace;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.matrix > header h1 {
		margin: 0;
		font:
			400 clamp(3.4rem, 8vw, 6rem) / 0.9 Georgia,
			serif;
		letter-spacing: -0.04em;
		text-wrap: balance;
	}
	.matrix > header > span {
		display: block;
		margin-top: 1.2rem;
		color: rgba(243, 234, 217, 0.68);
		font:
			1.08rem Georgia,
			serif;
	}
	.neutral-layout {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		background: #06090d;
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
		height: auto;
		aspect-ratio: 5 / 4;
		object-fit: cover;
	}
	.neutral-copy {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: clamp(2rem, 5vw, 6rem);
		padding: clamp(1.5rem, 3vw, 2.5rem);
		border-top: 1px solid var(--line);
		background: #0a0e13;
	}
	.neutral-copy > div {
		max-width: 52rem;
	}
	.neutral-copy h2,
	.variant-heading h2 {
		margin: 0;
		font:
			400 clamp(2rem, 3.7vw, 3.5rem) / 1 Georgia,
			serif;
		letter-spacing: -0.04em;
		text-wrap: balance;
	}
	.neutral-copy p {
		max-width: 68ch;
		margin: 0.8rem 0 0;
		color: rgba(243, 234, 217, 0.7);
		font:
			1rem/1.65 Georgia,
			serif;
		text-wrap: pretty;
	}
	.neutral-copy a,
	.variant-stage figcaption a {
		flex: none;
		color: #70c7d2;
		font:
			0.68rem ui-monospace,
			monospace;
		letter-spacing: 0.07em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.variant-heading {
		margin-top: clamp(4rem, 8vw, 7rem);
		margin-bottom: 1.5rem;
	}
	.variant-heading p {
		max-width: 58rem;
		margin: 0.8rem 0 0;
		color: rgba(243, 234, 217, 0.68);
		font:
			1rem/1.6 Georgia,
			serif;
	}
	.variant-stage {
		--affinity: #f3ead9;
		border: 1px solid color-mix(in srgb, var(--affinity) 46%, transparent);
	}
	.variant-stage figcaption {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		padding: 0.65rem 0.75rem;
		border-radius: 0.25rem;
		background: rgba(4, 6, 8, 0.86);
	}
	.variant-mark {
		position: absolute;
		top: 1rem;
		left: 1rem;
		display: grid;
		width: 3.5rem;
		height: 3.5rem;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--affinity) 52%, transparent);
		border-radius: 50%;
		background: rgba(4, 6, 8, 0.82);
		color: var(--affinity);
	}
	.variant-status {
		position: absolute;
		top: 1rem;
		left: 5.25rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--affinity) 42%, transparent);
		border-radius: 0.2rem;
		background: rgba(4, 6, 8, 0.82);
		color: var(--affinity);
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.carousel-control {
		position: absolute;
		top: 50%;
		display: grid;
		width: 3rem;
		height: 3.5rem;
		padding: 0;
		place-items: center;
		transform: translateY(-50%);
		border: 1px solid rgba(243, 234, 217, 0.28);
		border-radius: 0.25rem;
		background: rgba(4, 6, 8, 0.78);
		color: #f3ead9;
		font-size: 1.35rem;
		cursor: pointer;
		transition:
			background 160ms ease,
			border-color 160ms ease;
	}
	.carousel-control:hover {
		border-color: rgba(243, 234, 217, 0.58);
		background: rgba(4, 6, 8, 0.94);
	}
	.carousel-control.previous {
		left: 1rem;
	}
	.carousel-control.next {
		right: 1rem;
	}
	.variant-selector {
		display: flex;
		justify-content: center;
		gap: 0.7rem;
		padding-top: 1rem;
	}
	.variant-selector button {
		--affinity: #f3ead9;
		display: grid;
		width: 3.75rem;
		height: 3.75rem;
		padding: 0;
		place-items: center;
		border: 1px solid rgba(243, 234, 217, 0.18);
		border-radius: 50%;
		background: #0a0e13;
		color: rgba(243, 234, 217, 0.45);
		cursor: pointer;
		transition:
			color 160ms ease,
			border-color 160ms ease,
			background 160ms ease;
	}
	.target-status {
		display: flex;
		min-height: 3.75rem;
		align-items: center;
		gap: 0.65rem;
		padding: 0 0.9rem;
		border: 1px dashed color-mix(in srgb, var(--affinity) 48%, transparent);
		border-radius: 2rem;
		color: var(--affinity);
	}
	.target-status i {
		max-width: 9rem;
		font:
			0.64rem/1.25 ui-monospace,
			monospace;
		font-style: normal;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.variant-selector button:hover {
		color: var(--affinity);
		border-color: color-mix(in srgb, var(--affinity) 58%, transparent);
	}
	.variant-selector button[aria-pressed='true'] {
		border-color: var(--affinity);
		background: color-mix(in srgb, var(--affinity) 12%, #0a0e13);
		color: var(--affinity);
	}
	.carousel-control:focus-visible,
	.variant-selector button:focus-visible,
	.matrix a:focus-visible {
		outline: 2px solid #f3ead9;
		outline-offset: 3px;
	}
	.affinity-fire {
		--affinity: #f07842;
	}
	.affinity-earth {
		--affinity: #d0a15f;
	}
	.affinity-water {
		--affinity: #58b4de;
	}
	.affinity-wind {
		--affinity: #c7e8ec;
	}
	@media (max-width: 58rem) {
		.matrix {
			padding-inline: 1rem;
		}
		.neutral-copy {
			align-items: start;
			flex-direction: column;
			gap: 1.5rem;
		}
	}
	@media (max-width: 39rem) {
		.matrix > header h1 {
			font-size: 3.15rem;
		}
		.variant-mark {
			width: 3rem;
			height: 3rem;
		}
		.carousel-control {
			width: 2.75rem;
		}
		.variant-stage figcaption {
			display: none;
		}
		.variant-selector {
			flex-wrap: wrap;
			gap: 0.45rem;
		}
		.variant-selector button {
			width: 3.25rem;
			height: 3.25rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.carousel-control,
		.variant-selector button {
			transition: none;
		}
	}
</style>
