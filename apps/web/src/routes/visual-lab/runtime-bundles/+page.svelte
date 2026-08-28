<script lang="ts">
	import { onMount } from 'svelte';
	import { base, resolve } from '$app/paths';
	import { loadRuntimeVisualBundle } from '$lib/game/runtime-assets';

	let { data } = $props();
	let pixiCanvas: HTMLCanvasElement;
	let pixiState = $state<'loading' | 'ready' | 'error'>('loading');
	let pixiMessage = $state('Loading the approved bundle through PixiJS Assets…');

	const runtimeAssets = $derived(data.manifest.bundles.flatMap((bundle) => bundle.assets));
	const sourceBytes = $derived(
		data.sources
			.filter((source) => runtimeAssets.some((asset) => asset.sourceAssetKey === source.assetKey))
			.reduce((total, source) => total + source.bytes, 0)
	);
	const reductionPercent = $derived(100 - (data.manifest.initialPayloadBytes / sourceBytes) * 100);
	const budgetPercent = $derived(
		(data.manifest.initialPayloadBytes / data.manifest.initialPayloadBudgetBytes) * 100
	);

	function formatBytes(bytes: number) {
		if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
		return `${(bytes / 1_000).toFixed(1)} KB`;
	}

	function staticPath(path: string) {
		return `${base}${path}`;
	}

	onMount(() => {
		let disposed = false;
		let app: import('pixi.js').Application | undefined;
		void (async () => {
			try {
				const [{ Application, Sprite }, loaded] = await Promise.all([
					import('pixi.js'),
					loadRuntimeVisualBundle(data.manifest, data.manifest.bundles[0]!.name)
				]);
				if (disposed) return;
				app = new Application();
				await app.init({
					canvas: pixiCanvas,
					width: 560,
					height: 660,
					preference: 'webgl',
					antialias: true,
					background: '#080a10',
					resolution: Math.min(window.devicePixelRatio, 2),
					autoDensity: true
				});
				if (disposed) {
					app.destroy(false);
					return;
				}
				const alias = runtimeAssets.find((asset) => asset.usage === 'summon')!.alias;
				const hero = new Sprite(loaded[alias]);
				const scale = Math.min(500 / hero.texture.width, 610 / hero.texture.height);
				hero.scale.set(scale);
				hero.anchor.set(0.5, 0.5);
				hero.position.set(280, 330);
				app.stage.addChild(hero);
				pixiState = 'ready';
				pixiMessage = `${alias} loaded by bundle alias`;
			} catch (caught) {
				pixiState = 'error';
				pixiMessage = caught instanceof Error ? caught.message : 'PixiJS bundle load failed.';
			}
		})();
		return () => {
			disposed = true;
			app?.destroy(false);
		};
	});
</script>

<svelte:head>
	<title>Runtime visual bundles · summonlab</title>
	<meta
		name="description"
		content="Inspect approved, content-addressed WebP visual exports and their PixiJS v8 bundle manifest."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>ART-007</span><strong>Runtime visual bundles</strong></div>
		<nav aria-label="Runtime visual links">
			<a href={resolve('/visual-lab/summon-card')}>Summon-card lab</a>
			<a href={resolve('/visual-lab')}>Visual gate</a>
		</nav>
	</header>

	<section class="opening">
		<div>
			<p class="eyebrow">Approved pixels only · candidates remain source-side</p>
			<h1>Ship the person.<br /><em>Keep the proof.</em></h1>
			<p class="lede">
				One approved identity anchor becomes three purpose-sized WebP textures. Every derivative
				retains its source and manifest hashes, encoder settings, byte ceiling, and a stable PixiJS
				alias. Nothing here changes game state or the source catalog.
			</p>
		</div>
		<div class="budget-orbit" style={`--used:${Math.max(budgetPercent, 1.5)}%`}>
			<div>
				<strong>{formatBytes(data.manifest.initialPayloadBytes)}</strong>
				<span>of {formatBytes(data.manifest.initialPayloadBudgetBytes)}</span>
				<small>{budgetPercent.toFixed(2)}% phone budget</small>
			</div>
		</div>
	</section>

	<section class="summary" aria-label="Runtime export summary">
		<article><span>Approved bundles</span><strong>{data.manifest.bundles.length}</strong></article>
		<article><span>Runtime textures</span><strong>{runtimeAssets.length}</strong></article>
		<article><span>Source reduction</span><strong>{reductionPercent.toFixed(1)}%</strong></article>
		<article>
			<span>Loaded renderer JS</span><strong
				>{formatBytes(
					data.buildBudget.measurements.runtimeInspectorLoadedJavaScriptGzipBytes
				)}</strong
			>
		</article>
		<article><span>Deferred sources</span><strong>{data.manifest.deferred.length}</strong></article>
	</section>

	<section class="proof">
		<div class="pixi-panel">
			<header>
				<p class="eyebrow">Actual renderer proof</p>
				<h2>Loaded by alias,<br />not by accident.</h2>
			</header>
			<div class="canvas-frame">
				<canvas bind:this={pixiCanvas} width="560" height="660"></canvas>
			</div>
			<p class:failed={pixiState === 'error'} data-testid="pixi-runtime-state">
				<i class:ready={pixiState === 'ready'}></i>{pixiMessage}
			</p>
		</div>

		<div class="variants">
			<header>
				<p class="eyebrow">Purpose-sized derivatives</p>
				<h2>Only load what<br />the camera needs.</h2>
			</header>
			<div class="variant-grid">
				{#each runtimeAssets as asset (asset.alias)}
					<article>
						<figure>
							<img
								src={asset.publicPath}
								alt={`${asset.sourceAssetKey} ${asset.usage} runtime texture`}
								width={asset.width}
								height={asset.height}
							/>
						</figure>
						<div>
							<span>{asset.usage}</span>
							<strong>{asset.width}×{asset.height}</strong>
							<small>{formatBytes(asset.bytes)} / {formatBytes(asset.budgetBytes)}</small>
							<code>{asset.contentHash.slice(0, 12)}</code>
						</div>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="ledger">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Gate-aware export queue</p>
				<h2>Deferred means<br />not shipped.</h2>
			</div>
			<strong>{data.manifest.deferred.length} sources await a decision</strong>
		</header>
		<div class="deferred-list" data-testid="deferred-runtime-assets">
			{#each data.manifest.deferred as source (source.sourceAssetKey)}
				<article>
					<div><span>{source.sourceStatus}</span><strong>{source.sourceAssetKey}</strong></div>
					<code>{source.sourceContentHash.slice(0, 12)}</code>
					<i>{source.reason}</i>
				</article>
			{/each}
		</div>
	</section>

	<section class="manifest">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Reproducible handoff</p>
				<h2>Manifest, encoder,<br />and source chain.</h2>
			</div>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static content is not a Svelte route -->
			<a href={staticPath('/runtime/visual-catalog-v1/manifest.json')} download>Download manifest</a
			>
		</header>
		<div class="manifest-grid">
			<dl>
				<div>
					<dt>Schema</dt>
					<dd>{data.manifest.schemaVersion}</dd>
				</div>
				<div>
					<dt>Exporter</dt>
					<dd>{data.manifest.exporterVersion}</dd>
				</div>
				<div>
					<dt>PixiJS / Sharp</dt>
					<dd>{data.manifest.toolchain.pixi} / {data.manifest.toolchain.sharp}</dd>
				</div>
				<div>
					<dt>libvips / WebP</dt>
					<dd>{data.manifest.toolchain.vips} / {data.manifest.toolchain.webp}</dd>
				</div>
			</dl>
			<div class="hashes">
				<span>runtime manifest SHA-256</span><code>{data.manifest.manifestHash}</code>
				<span>source catalog SHA-256</span><code>{data.manifest.catalogContentHash}</code>
				<span>source identity SHA-256</span><code>{runtimeAssets[0]!.manifestHashes[0]}</code>
			</div>
		</div>
	</section>

	<footer>
		<p>
			<code>pnpm validate:runtime-visuals</code> re-encodes every approved derivative and rejects stale
			bytes, unexpected files, hash drift, projection drift, or any asset and bundle budget overrun.
		</p>
		<a href={resolve('/visual-lab')}>Return to visual approval →</a>
	</footer>
</main>

<style>
	:global(body) {
		background:
			radial-gradient(circle at 88% 8%, rgba(117, 67, 132, 0.14), transparent 30rem),
			linear-gradient(180deg, #080a0f, #0a0d13 55%, #07090d);
	}
	main {
		min-height: 100vh;
		color: #f4efe5;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 4.5rem;
		padding: 0 clamp(1rem, 3vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(6, 8, 12, 0.84);
	}
	.wordmark {
		color: #f4efe5;
		font:
			600 1rem Georgia,
			serif;
		letter-spacing: 0.12em;
		text-decoration: none;
	}
	.topbar > div {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.topbar > div span {
		color: #d3a454;
	}
	.topbar nav {
		justify-self: end;
		display: flex;
		gap: 1.4rem;
	}
	.topbar nav a {
		color: #75c8d8;
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.opening {
		display: grid;
		grid-template-columns: 1.4fr 0.6fr;
		gap: 4rem;
		align-items: center;
		padding: clamp(4rem, 8vw, 8rem) clamp(1.2rem, 5vw, 6rem) 3rem;
	}
	.eyebrow {
		margin: 0 0 0.9rem;
		color: #d3a454;
		font-size: 0.54rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h1,
	h2 {
		margin: 0;
		font:
			400 clamp(2.8rem, 6vw, 6.6rem)/0.92 Georgia,
			serif;
		letter-spacing: -0.045em;
	}
	h1 em {
		color: #78c8d8;
		font-weight: 400;
	}
	.lede {
		max-width: 50rem;
		margin: 2rem 0 0;
		color: rgba(244, 239, 229, 0.52);
		font-size: 0.82rem;
		line-height: 1.75;
	}
	.budget-orbit {
		--used: 1.5%;
		position: relative;
		justify-self: center;
		width: min(20rem, 70vw);
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: conic-gradient(#d3a454 var(--used), rgba(255, 255, 255, 0.07) 0);
	}
	.budget-orbit::before {
		content: '';
		position: absolute;
		inset: 2px;
		border-radius: 50%;
		background: radial-gradient(circle, #111722 0 48%, #090c12 49% 64%, transparent 65%);
		border: 1px solid rgba(120, 200, 216, 0.12);
	}
	.budget-orbit > div {
		position: relative;
		z-index: 1;
		text-align: center;
	}
	.budget-orbit strong,
	.budget-orbit span,
	.budget-orbit small {
		display: block;
	}
	.budget-orbit strong {
		font:
			400 2rem Georgia,
			serif;
	}
	.budget-orbit span {
		margin-top: 0.2rem;
		color: rgba(244, 239, 229, 0.36);
		font-size: 0.6rem;
	}
	.budget-orbit small {
		margin-top: 0.9rem;
		color: #75c8d8;
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.summary {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1px;
		margin: 0 clamp(1.2rem, 5vw, 6rem);
		background: rgba(255, 255, 255, 0.09);
	}
	.summary article {
		padding: 1.2rem;
		background: #0b0e14;
	}
	.summary span,
	.summary strong {
		display: block;
	}
	.summary span {
		color: rgba(244, 239, 229, 0.32);
		font-size: 0.5rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.summary strong {
		margin-top: 0.4rem;
		font:
			400 1.4rem Georgia,
			serif;
	}
	.proof {
		display: grid;
		grid-template-columns: minmax(24rem, 0.9fr) minmax(30rem, 1.1fr);
		gap: 1px;
		margin: 1px clamp(1.2rem, 5vw, 6rem) 0;
		background: rgba(255, 255, 255, 0.09);
	}
	.pixi-panel,
	.variants {
		padding: clamp(2rem, 4vw, 4rem);
		background: #0a0d13;
	}
	.proof h2,
	.section-heading h2 {
		font-size: clamp(2.4rem, 4.5vw, 4.8rem);
	}
	.canvas-frame {
		display: grid;
		place-items: center;
		min-height: 34rem;
		margin-top: 2rem;
		overflow: hidden;
		border: 1px solid rgba(117, 200, 216, 0.14);
		background: radial-gradient(circle, rgba(50, 121, 139, 0.14), transparent 52%), #07090e;
	}
	.canvas-frame :global(canvas) {
		display: block;
		width: min(100%, 35rem);
		height: auto;
	}
	.pixi-panel > p {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		margin: 0.9rem 0 0;
		color: #75c8d8;
		font-size: 0.56rem;
	}
	.pixi-panel > p.failed {
		color: #ef9691;
	}
	.pixi-panel > p i {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: #d3a454;
		box-shadow: 0 0 0.8rem #d3a454;
	}
	.pixi-panel > p i.ready {
		background: #75d1a8;
		box-shadow: 0 0 0.8rem #75d1a8;
	}
	.variant-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		margin-top: 2rem;
		background: rgba(255, 255, 255, 0.08);
	}
	.variant-grid article {
		min-width: 0;
		background: #080a0f;
	}
	.variant-grid figure {
		aspect-ratio: 2/3;
		margin: 0;
		overflow: hidden;
	}
	.variant-grid img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.variant-grid article > div {
		padding: 0.8rem;
	}
	.variant-grid span,
	.variant-grid strong,
	.variant-grid small,
	.variant-grid code {
		display: block;
	}
	.variant-grid span {
		color: #d3a454;
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.variant-grid strong {
		margin: 0.3rem 0;
		font:
			400 0.86rem Georgia,
			serif;
	}
	.variant-grid small,
	.variant-grid code {
		color: rgba(244, 239, 229, 0.34);
		font-size: 0.48rem;
	}
	.variant-grid code {
		margin-top: 0.35rem;
		color: #608b94;
	}
	.ledger,
	.manifest {
		padding: clamp(5rem, 9vw, 9rem) clamp(1.2rem, 5vw, 6rem) 0;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 2rem;
	}
	.section-heading > strong,
	.section-heading > a {
		color: #75c8d8;
		font-size: 0.54rem;
		letter-spacing: 0.09em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.deferred-list {
		margin-top: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.deferred-list article {
		display: grid;
		grid-template-columns: 1fr 0.4fr auto;
		gap: 1rem;
		align-items: center;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}
	.deferred-list article:last-child {
		border: 0;
	}
	.deferred-list span,
	.deferred-list strong {
		display: block;
	}
	.deferred-list span {
		color: rgba(244, 239, 229, 0.3);
		font-size: 0.46rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.deferred-list strong {
		margin-top: 0.2rem;
		font:
			400 0.78rem Georgia,
			serif;
	}
	.deferred-list code {
		color: #608b94;
		font-size: 0.52rem;
	}
	.deferred-list i {
		padding: 0.35rem 0.5rem;
		border: 1px solid rgba(211, 164, 84, 0.25);
		color: #d3a454;
		font-size: 0.46rem;
		font-style: normal;
		text-transform: uppercase;
	}
	.manifest {
		padding-bottom: clamp(5rem, 9vw, 9rem);
	}
	.manifest-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin-top: 2rem;
		background: rgba(255, 255, 255, 0.08);
	}
	dl,
	.hashes {
		margin: 0;
		padding: 1.5rem;
		background: #0a0d13;
	}
	dl {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		padding: 1px;
		background: rgba(255, 255, 255, 0.07);
	}
	dl div {
		padding: 1rem;
		background: #0a0d13;
	}
	dt,
	.hashes span {
		color: rgba(244, 239, 229, 0.3);
		font-size: 0.48rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	dd {
		margin: 0.35rem 0 0;
		color: rgba(244, 239, 229, 0.68);
		font-size: 0.64rem;
	}
	.hashes {
		display: grid;
		align-content: center;
		gap: 0.45rem;
	}
	.hashes code {
		margin-bottom: 0.8rem;
		color: #608b94;
		font-size: 0.52rem;
		overflow-wrap: anywhere;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: center;
		padding: 2rem clamp(1.2rem, 5vw, 6rem);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	footer p {
		max-width: 55rem;
		color: rgba(244, 239, 229, 0.4);
		font-size: 0.62rem;
		line-height: 1.6;
	}
	footer a {
		color: #75c8d8;
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	@media (max-width: 900px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.opening,
		.proof,
		.manifest-grid {
			grid-template-columns: 1fr;
		}
		.summary {
			grid-template-columns: 1fr 1fr;
		}
		.budget-orbit {
			width: 15rem;
		}
		.deferred-list article {
			grid-template-columns: 1fr auto;
		}
		.deferred-list code {
			display: none;
		}
	}
	@media (max-width: 560px) {
		.variant-grid {
			grid-template-columns: 1fr;
		}
		.section-heading,
		footer {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
