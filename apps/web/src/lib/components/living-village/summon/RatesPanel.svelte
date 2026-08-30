<script lang="ts">
	import PortalGlyph from './PortalGlyph.svelte';

	type Direction = 'gate' | 'constellation' | 'identity';
	type RateRow = { band: string; value: string; note: string };
	type Guarantee = { threshold: number; label: string };
	type DirectionOption = {
		id: Direction;
		label: string;
		shortLabel: string;
		description: string;
	};

	let {
		open,
		rates,
		guarantee,
		progress,
		directions,
		direction,
		reducedMotion,
		muted,
		ondirection,
		onreduced,
		onmuted,
		onclose
	}: {
		open: boolean;
		rates: readonly RateRow[];
		guarantee: Guarantee;
		progress: number;
		directions: readonly DirectionOption[];
		direction: Direction;
		reducedMotion: boolean;
		muted: boolean;
		ondirection: (direction: Direction) => void;
		onreduced: () => void;
		onmuted: () => void;
		onclose: () => void;
	} = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="backdrop" role="presentation" onclick={onclose}></div>
	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="rates-title"
		data-testid="rates-panel"
	>
		<header>
			<div class="seal"><PortalGlyph kind="star" size={21} /></div>
			<div>
				<p>Standard banner</p>
				<h2 id="rates-title">Rates &amp; details</h2>
			</div>
			<button type="button" class="close" aria-label="Close rates and details" onclick={onclose}
				>×</button
			>
		</header>

		<section class="rate-list" aria-label="Summon rates">
			{#each rates as rate (rate.band)}
				<div><span>{rate.band}</span><strong>{rate.value}</strong></div>
			{/each}
		</section>

		<section class="guarantee-copy">
			<p>Guarantee</p>
			<strong>{guarantee.label} {guarantee.threshold} summons</strong>
			<span data-testid="rates-guarantee-progress"
				>Current progress: {progress} / {guarantee.threshold}.</span
			>
		</section>

		<section class="compare">
			<div>
				<small>Single</small><strong>Summon ×1</strong><span>1 Gate sigil or 160 gems</span>
			</div>
			<div class="bonus">
				<small>Batch</small><strong>Summon ×10</strong><span>1,600 gems · +1 bonus</span>
			</div>
		</section>

		<section class="ritual" aria-labelledby="ritual-title">
			<div class="section-heading">
				<div>
					<p>Reveal ritual</p>
					<h3 id="ritual-title">Choose how the gate answers</h3>
				</div>
			</div>
			<div class="directions" data-testid="direction-selector">
				{#each directions as item (item.id)}
					<button
						type="button"
						class:active={direction === item.id}
						aria-pressed={direction === item.id}
						onclick={() => ondirection(item.id)}
					>
						<strong>{item.shortLabel}</strong><span>{item.description}</span>
					</button>
				{/each}
			</div>
			<div class="switches">
				<button
					type="button"
					class:active={reducedMotion}
					aria-pressed={reducedMotion}
					onclick={onreduced}
					data-testid="reduced-motion-toggle"><i></i>Reduced motion</button
				>
				<button type="button" class:active={!muted} aria-pressed={!muted} onclick={onmuted}
					><i></i>{muted ? 'Sound muted' : 'Sound on'}</button
				>
			</div>
		</section>

		<footer>
			<strong>Demo values.</strong> Prices, probabilities, balances, and guarantee rules are not final.
		</footer>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		z-index: 40;
		inset: 0;
		background: #02070ac7;
		backdrop-filter: blur(9px);
	}
	.panel {
		position: fixed;
		z-index: 41;
		top: 50%;
		left: 50%;
		width: min(690px, calc(100vw - 26px));
		max-height: calc(100vh - 26px);
		overflow-y: auto;
		transform: translate(-50%, -50%);
		border: 1px solid #a7dccf4c;
		border-radius: 22px;
		background: linear-gradient(145deg, #122027f8, #080e13fc 65%);
		box-shadow:
			0 32px 110px #000e,
			inset 0 1px #fff1;
		color: #eee9df;
		font-family: Inter, ui-sans-serif, system-ui;
	}
	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 13px;
		align-items: center;
		padding: 21px 24px 18px;
		border-bottom: 1px solid #d8e8e116;
	}
	.seal {
		display: grid;
		width: 40px;
		height: 40px;
		place-items: center;
		border: 1px solid #d3aa644b;
		border-radius: 50%;
		background: #b97b2015;
	}
	header p,
	.guarantee-copy p,
	.section-heading p {
		margin: 0 0 4px;
		color: #7cc8b7;
		font-size: 0.58rem;
		font-weight: 760;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	header h2 {
		margin: 0;
		font:
			500 1.8rem Georgia,
			serif;
		letter-spacing: -0.035em;
	}
	.close {
		width: 36px;
		height: 36px;
		border: 1px solid #d8e8e122;
		border-radius: 50%;
		background: transparent;
		color: #c7cfca;
		font-size: 1.5rem;
		cursor: pointer;
	}
	.rate-list {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		padding: 18px 24px 8px;
	}
	.rate-list div {
		display: grid;
		gap: 5px;
		padding: 13px;
		border: 1px solid #dbe9e21c;
		border-radius: 11px;
		background: linear-gradient(145deg, #132127, #0c151a);
		box-shadow: inset 0 1px #ffffff0b;
	}
	.rate-list span {
		color: #9eb0a9;
		font-size: 0.64rem;
	}
	.rate-list strong {
		color: #efe6d4;
		font:
			500 1.3rem Georgia,
			serif;
	}
	.guarantee-copy {
		display: grid;
		gap: 4px;
		margin: 8px 24px;
		padding: 14px;
		border: 1px solid #71bdac2d;
		border-radius: 11px;
		background: #388b7c0b;
	}
	.guarantee-copy strong {
		color: #dcece7;
		font-size: 0.82rem;
	}
	.guarantee-copy span {
		color: #7f918b;
		font-size: 0.68rem;
	}
	.compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 0 24px 16px;
	}
	.compare > div {
		display: grid;
		gap: 3px;
		padding: 13px;
		border: 1px solid #dce8e219;
		border-radius: 11px;
	}
	.compare .bonus {
		border-color: #d5a95c4c;
		background: #bd7e1910;
	}
	.compare small {
		color: #74857f;
		font-size: 0.54rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.compare strong {
		font:
			500 0.95rem Georgia,
			serif;
	}
	.compare span {
		color: #87948f;
		font-size: 0.63rem;
	}
	.ritual {
		padding: 17px 24px 20px;
		border-top: 1px solid #dce8e216;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		gap: 15px;
		align-items: end;
	}
	.section-heading h3 {
		margin: 0;
		font:
			500 1.1rem Georgia,
			serif;
	}
	.directions {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 7px;
		margin-top: 13px;
	}
	.directions button {
		display: grid;
		gap: 5px;
		min-width: 0;
		padding: 12px;
		border: 1px solid #cfddd720;
		border-radius: 10px;
		background: #101a1f;
		color: #b8c5c0;
		text-align: left;
		cursor: pointer;
	}
	.directions button.active {
		border-color: #75cbb77d;
		background: #2e897918;
		color: #e6eee9;
		box-shadow: inset 0 0 25px #4ab39e15;
	}
	.directions strong {
		font-size: 0.7rem;
	}
	.directions span {
		color: #91a19b;
		font-size: 0.56rem;
		line-height: 1.35;
	}
	.switches {
		display: flex;
		gap: 7px;
		margin-top: 10px;
	}
	.switches button {
		display: flex;
		gap: 7px;
		align-items: center;
		padding: 8px 10px;
		border: 1px solid #d4e0db1f;
		border-radius: 99px;
		background: transparent;
		color: #87948f;
		font-size: 0.6rem;
		cursor: pointer;
	}
	.switches i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #66736e;
	}
	.switches button.active {
		color: #b9d8d0;
	}
	.switches button.active i {
		background: #6ac6b2;
		box-shadow: 0 0 8px #6ac6b2;
	}
	footer {
		padding: 12px 24px 16px;
		border-top: 1px solid #dce8e212;
		color: #65736e;
		font-size: 0.6rem;
	}
	footer strong {
		color: #a1875b;
	}
	@media (max-width: 570px) {
		.rate-list,
		.directions {
			grid-template-columns: 1fr;
		}
		.compare {
			grid-template-columns: 1fr;
		}
		.directions span {
			display: none;
		}
	}
</style>
