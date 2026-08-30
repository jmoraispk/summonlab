<script lang="ts">
	import PortalGlyph from './PortalGlyph.svelte';

	type RateRow = { band: string; value: string; note: string };
	type Guarantee = { current: number; threshold: number; label: string };

	let {
		open,
		rates,
		guarantee,
		onclose
	}: {
		open: boolean;
		rates: readonly RateRow[];
		guarantee: Guarantee;
		onclose: () => void;
	} = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="backdrop" role="presentation" onclick={onclose} data-testid="rates-backdrop"></div>
	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="rates-title"
		data-testid="rates-panel"
	>
		<header>
			<div class="seal"><PortalGlyph kind="star" size={22} /></div>
			<div>
				<p>Standard banner · fixture disclosure</p>
				<h2 id="rates-title">Rates &amp; guarantee</h2>
			</div>
			<button type="button" class="close" aria-label="Close rates and details" onclick={onclose}
				>×</button
			>
		</header>

		<div class="fixture-note">
			<strong>Review values only.</strong>
			<span
				>Prices, probabilities, balances, and guarantee rules are prototype fixtures—not canonical
				economy.</span
			>
		</div>

		<div class="rate-list" aria-label="Prototype summon rates">
			{#each rates as rate (rate.band)}
				<div>
					<span>{rate.band}<small>{rate.note}</small></span>
					<strong>{rate.value}</strong>
				</div>
			{/each}
		</div>

		<section class="guarantee-copy" aria-label="Guarantee behavior">
			<p>Guarantee behavior</p>
			<strong>{guarantee.label} {guarantee.threshold} summons</strong>
			<span
				>Fixture progress begins at {guarantee.current} / {guarantee.threshold}. Session previews
				move it visibly; reset or reload restores it, and nothing carries.</span
			>
		</section>

		<section class="pool" aria-label="Standard fixture identity pool">
			<p>Identity pool · six unique people</p>
			<div>Dara Zev · Mara Vey · Jori Daro · Kira Toren · Iven Orra · Remy Nahl</div>
			<span
				>Repeats in the batch contact sheet are presentation references, never durable duplicate
				heroes.</span
			>
		</section>

		<div class="offer-compare">
			<div>
				<small>Single presentation</small>
				<strong>1 result</strong>
				<span>1 Gate sigil or 160 gems · fixture</span>
			</div>
			<div class="bonus">
				<small>Batch presentation</small>
				<strong>10 paid + 1 bonus</strong>
				<span>1,600 gems · 11 result slots · fixture</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		z-index: 40;
		inset: 0;
		background: rgb(2 7 10 / 78%);
		backdrop-filter: blur(8px);
	}

	.panel {
		position: fixed;
		z-index: 41;
		top: 50%;
		left: 50%;
		width: min(640px, calc(100vw - 32px));
		max-height: min(780px, calc(100vh - 32px));
		overflow-y: auto;
		transform: translate(-50%, -50%);
		border: 1px solid #a3d8ce55;
		border-radius: 22px;
		background:
			linear-gradient(145deg, #132027f5, #090f14fa 62%),
			radial-gradient(circle at 20% 0%, #1e756433, transparent 40%);
		box-shadow:
			0 28px 100px #000c,
			inset 0 1px #d9fff31a;
		color: #eee8dc;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}

	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 14px;
		align-items: center;
		padding: 24px 26px 19px;
		border-bottom: 1px solid #b7dcd21a;
	}

	header p,
	.pool p,
	.guarantee-copy p {
		margin: 0 0 5px;
		color: #78beb2;
		font-size: 0.69rem;
		font-weight: 760;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.5rem, 4vw, 2rem);
		font-weight: 500;
		letter-spacing: -0.025em;
	}

	.seal {
		display: grid;
		width: 42px;
		height: 42px;
		place-items: center;
		border: 1px solid #d0a45c66;
		border-radius: 50%;
		background: #db9f4313;
	}

	.close {
		width: 36px;
		height: 36px;
		border: 1px solid #dae9e323;
		border-radius: 50%;
		background: #fff0;
		color: #c9cec9;
		font:
			300 1.6rem/1 ui-sans-serif,
			system-ui;
		cursor: pointer;
	}

	.close:hover,
	.close:focus-visible {
		background: #fff1;
		color: #fff;
	}

	.fixture-note {
		display: grid;
		gap: 3px;
		margin: 20px 26px 10px;
		padding: 13px 15px;
		border: 1px solid #d2a34b4d;
		border-radius: 10px;
		background: #a8741f17;
		font-size: 0.77rem;
		line-height: 1.45;
	}

	.fixture-note strong {
		color: #e4bf7a;
	}
	.fixture-note span {
		color: #bdc2bd;
	}

	.rate-list {
		padding: 10px 26px;
	}
	.rate-list > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 13px 0;
		border-bottom: 1px solid #dfece313;
	}

	.rate-list span {
		display: grid;
		gap: 2px;
		color: #d9dcd5;
	}
	.rate-list small {
		color: #78847f;
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.rate-list strong {
		color: #fff6e5;
		font-family: Georgia, serif;
		font-size: 1.2rem;
		font-weight: 500;
	}

	.guarantee-copy,
	.pool {
		display: grid;
		gap: 6px;
		margin: 10px 26px;
		padding: 16px;
		border: 1px solid #85cabb30;
		border-radius: 12px;
		background: #3d93830c;
	}

	.guarantee-copy strong {
		color: #dcefe9;
	}
	.guarantee-copy span,
	.pool span {
		color: #8e9a96;
		font-size: 0.75rem;
		line-height: 1.45;
	}
	.pool div {
		color: #d7dbd6;
		font-size: 0.86rem;
		line-height: 1.5;
	}

	.offer-compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		padding: 10px 26px 26px;
	}

	.offer-compare > div {
		display: grid;
		gap: 5px;
		padding: 15px;
		border: 1px solid #d8e5df1f;
		border-radius: 12px;
		background: #ffffff08;
	}

	.offer-compare .bonus {
		border-color: #d7a75957;
		background: #bb7f2613;
	}
	.offer-compare small {
		color: #89958f;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.offer-compare strong {
		color: #f1e6d3;
	}
	.offer-compare span {
		color: #929b96;
		font-size: 0.7rem;
		line-height: 1.35;
	}

	@media (max-width: 560px) {
		.panel {
			border-radius: 16px;
		}
		header {
			padding: 18px;
		}
		.fixture-note,
		.rate-list,
		.guarantee-copy,
		.pool {
			margin-left: 18px;
			margin-right: 18px;
		}
		.rate-list {
			padding-left: 0;
			padding-right: 0;
		}
		.offer-compare {
			grid-template-columns: 1fr;
			padding: 10px 18px 20px;
		}
	}
</style>
