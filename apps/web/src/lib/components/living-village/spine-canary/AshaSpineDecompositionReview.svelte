<script lang="ts">
	import { onMount } from 'svelte';

	import {
		ASHA_EXPLORATION_VISIBLE_HEIGHT,
		ASHA_SPINE_DECOMPOSITION_STATUS,
		decompositionAssets
	} from './asha-spine-decomposition.js';

	const assets = decompositionAssets(2);
	const layers = [
		{
			name: 'Immutable source',
			note: 'Approved 768×768 cutout',
			src: assets.source,
			testId: 'asha-decomposition-source'
		},
		{
			name: 'Body / core',
			note: 'Provider repair only inside source masks',
			src: assets.bodyCore,
			testId: 'asha-decomposition-body-core'
		},
		{
			name: 'Near arm',
			note: 'Locked source pixels only',
			src: assets.nearArm,
			testId: 'asha-decomposition-near-arm'
		},
		{
			name: 'Long braid',
			note: 'Locked source pixels only',
			src: assets.braid,
			testId: 'asha-decomposition-braid'
		},
		{
			name: 'Exact setup pose',
			note: 'SHA-256 equals the approved source',
			src: assets.recomposed,
			testId: 'asha-decomposition-recomposed'
		}
	] as const;

	let comparison = $state<'source' | 'recomposed'>('recomposed');
	let reviewState = $state<'loading' | 'candidate' | 'failed'>('loading');
	let failedAsset = $state<string | null>(null);

	onMount(() => {
		let disposed = false;
		const loadDescriptor = async () => {
			try {
				const response = await fetch(assets.reviewDescriptor, { cache: 'no-store' });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const descriptor = (await response.json()) as {
					schemaVersion?: unknown;
					disposition?: unknown;
				};
				if (
					descriptor.schemaVersion !== 'asha-spine-decomposition-review-v1' ||
					descriptor.disposition !== 'candidate'
				) {
					throw new Error('checked result is not a candidate');
				}
				if (!disposed) reviewState = 'candidate';
			} catch (error) {
				if (disposed) return;
				reviewState = 'failed';
				failedAsset = `checked review descriptor (${error instanceof Error ? error.message : String(error)})`;
			}
		};
		void loadDescriptor();
		return () => {
			disposed = true;
		};
	});
</script>

<section
	class="decomposition"
	aria-labelledby="decomposition-heading"
	data-testid="asha-decomposition-review"
>
	<header>
		<div>
			<p class="eyebrow">Gate 2B · {ASHA_SPINE_DECOMPOSITION_STATUS}</p>
			<h2 id="decomposition-heading">Three source-bound layers, one owner decision.</h2>
		</div>
		<p class="status" class:failed={failedAsset !== null}>
			{reviewState === 'loading'
				? 'Checking candidate receipt'
				: failedAsset === null
					? 'Technical checks passed · not approved art'
					: 'Candidate raster unavailable'}
		</p>
	</header>

	<aside class="review-focus" aria-label="Required visual review focus">
		<strong>Review focus</strong>
		<span>
			The setup-pose recomposition is byte-equivalent to the approved cutout. Inspect the isolated
			body/core for transparent gaps and retained near-arm pixels before accepting any rig work.
		</span>
	</aside>

	{#if failedAsset !== null || reviewState === 'failed'}
		<div class="missing-art" role="status" data-testid="asha-decomposition-failure">
			<strong>Asha decomposition unavailable</strong>
			<p>
				The checked candidate could not load {failedAsset}. This is a non-character missing-art
				state; no layer or gameplay preview is being substituted.
			</p>
		</div>
	{:else if reviewState === 'loading'}
		<div class="review-loading" role="status">Checking the Gate 2B review descriptor…</div>
	{:else}
		<div class="layer-grid" aria-label="Asha decomposition layers">
			{#each layers as layer}
				<article>
					<div class="raster checkerboard">
						<img
							src={layer.src}
							alt={layer.name}
							data-testid={layer.testId}
							onerror={() => (failedAsset = layer.name)}
						/>
					</div>
					<h3>{layer.name}</h3>
					<p>{layer.note}</p>
				</article>
			{/each}
		</div>

		<div class="comparison">
			<div class="comparison-copy">
				<p class="eyebrow">Gameplay calibration</p>
				<h3>
					<span data-testid="asha-selected-scale">{ASHA_EXPLORATION_VISIBLE_HEIGHT} px</span>
					owner-selected default
				</h3>
				<p>Configurable · shown over the same 62 px diamond used by the transport canary.</p>
				<div class="toggle" aria-label="Choose the calibration raster">
					<button
						type="button"
						class:active={comparison === 'source'}
						onclick={() => (comparison = 'source')}>Source</button
					>
					<button
						type="button"
						class:active={comparison === 'recomposed'}
						onclick={() => (comparison = 'recomposed')}>Recomposed</button
					>
				</div>
			</div>

			<div class="scale-stage" data-testid="asha-84px-stage">
				<div class="tile" aria-hidden="true"></div>
				<img
					src={comparison === 'source' ? assets.source : assets.recomposed}
					alt={comparison === 'source'
						? 'Approved Asha source at 84 pixels'
						: 'Recomposed Asha at 84 pixels'}
					style:height={`${ASHA_EXPLORATION_VISIBLE_HEIGHT}px`}
					data-testid="asha-84px-raster"
					onerror={() => (failedAsset = 'gameplay calibration raster')}
				/>
			</div>
		</div>
	{/if}
</section>

<style>
	.decomposition {
		display: grid;
		gap: 1rem;
		padding: clamp(1rem, 2.4vw, 1.5rem);
		border: 1px solid rgba(133, 170, 188, 0.22);
		border-radius: 1.35rem;
		background: rgba(13, 19, 28, 0.82);
		box-shadow: 0 1.2rem 4rem rgba(0, 0, 0, 0.28);
	}

	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		color: #a8d9bf;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		max-width: 44rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.5rem, 3vw, 2.4rem);
		font-weight: 500;
		letter-spacing: -0.035em;
	}

	.status {
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(226, 179, 101, 0.3);
		border-radius: 999px;
		color: #e7c78f;
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.status.failed {
		border-color: rgba(223, 112, 112, 0.55);
		color: #ffd0d0;
	}

	.missing-art {
		display: grid;
		gap: 0.45rem;
		min-height: 13rem;
		place-content: center;
		padding: 1.5rem;
		border: 1px dashed rgba(223, 112, 112, 0.5);
		border-radius: 0.9rem;
		background: rgba(91, 29, 38, 0.2);
		text-align: center;
	}

	.review-loading {
		display: grid;
		min-height: 13rem;
		place-content: center;
		color: #91a5b2;
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.missing-art strong {
		color: #ffd0d0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.35rem;
	}

	.missing-art p {
		max-width: 42rem;
		color: #aebcc5;
		font-size: 0.8rem;
		line-height: 1.55;
	}

	.review-focus {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.7rem;
		padding: 0.8rem 0.9rem;
		border-left: 3px solid #d7a452;
		border-radius: 0.6rem;
		background: rgba(104, 70, 29, 0.2);
		color: #b9c6cc;
		font-size: 0.78rem;
		line-height: 1.5;
	}

	.review-focus strong {
		color: #f3d6a3;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.layer-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.7rem;
	}

	.layer-grid article {
		min-width: 0;
		padding: 0.55rem;
		border: 1px solid rgba(133, 170, 188, 0.18);
		border-radius: 0.85rem;
		background: rgba(20, 28, 40, 0.7);
	}

	.raster {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 0.55rem;
	}

	.checkerboard {
		background-color: #16202a;
		background-image:
			linear-gradient(45deg, rgba(255, 255, 255, 0.06) 25%, transparent 25%),
			linear-gradient(-45deg, rgba(255, 255, 255, 0.06) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.06) 75%),
			linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.06) 75%);
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
		background-size: 16px 16px;
	}

	.raster img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.layer-grid h3 {
		margin-top: 0.55rem;
		font-size: 0.77rem;
	}

	.layer-grid p,
	.comparison-copy > p:last-of-type {
		margin-top: 0.2rem;
		color: #8095a2;
		font-size: 0.68rem;
		line-height: 1.45;
	}

	.comparison {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(15rem, 0.8fr);
		gap: 1rem;
		align-items: stretch;
	}

	.comparison-copy,
	.scale-stage {
		min-height: 11rem;
		padding: 1rem;
		border: 1px solid rgba(133, 170, 188, 0.18);
		border-radius: 0.9rem;
		background: #101721;
	}

	.comparison-copy h3 {
		display: grid;
		gap: 0.25rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.25rem, 2.6vw, 2rem);
		font-weight: 500;
	}

	.comparison-copy h3 span {
		color: #d4f5dc;
	}

	.toggle {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.toggle button {
		padding: 0.48rem 0.7rem;
		border: 1px solid rgba(133, 170, 188, 0.28);
		border-radius: 999px;
		background: transparent;
		color: #91a5b2;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
	}

	.toggle button.active {
		border-color: rgba(168, 217, 191, 0.65);
		background: rgba(73, 125, 101, 0.25);
		color: #d4f5dc;
	}

	.scale-stage {
		position: relative;
		display: grid;
		place-items: center;
		overflow: hidden;
		background:
			radial-gradient(circle at 50% 65%, rgba(84, 126, 112, 0.24), transparent 7rem), #101721;
	}

	.scale-stage img {
		position: relative;
		z-index: 2;
		display: block;
		width: auto;
		object-fit: contain;
	}

	.tile {
		position: absolute;
		z-index: 1;
		top: calc(50% + 34px);
		left: 50%;
		width: 62px;
		height: 31px;
		transform: translate(-50%, -50%) rotate(30deg) skewX(-30deg) scaleY(0.86);
		border: 2px solid rgba(169, 214, 189, 0.7);
		background: rgba(52, 75, 72, 0.72);
	}

	@media (max-width: 900px) {
		header {
			display: grid;
		}

		.status {
			justify-self: start;
			white-space: normal;
		}

		.layer-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.comparison {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 520px) {
		.decomposition {
			padding: 0.8rem;
		}

		.review-focus {
			grid-template-columns: 1fr;
		}

		.layer-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
