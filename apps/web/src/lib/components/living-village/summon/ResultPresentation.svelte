<script lang="ts">
	import PortalGlyph from './PortalGlyph.svelte';

	type Hero = {
		id: string;
		name: string;
		identityLine: string;
		affinity: string;
		calling: string;
		stars: number;
		image: string;
	};

	let {
		mode,
		hero,
		batch
	}: {
		mode: 'single' | 'batch';
		hero: Omit<Hero, 'id'>;
		batch: readonly Hero[];
	} = $props();
</script>

<section class="results" data-mode={mode} data-testid="summon-results" aria-live="polite">
	<header>
		<div>
			<p>Presentation receipt · LV-R-001</p>
			<h2>{mode === 'single' ? 'One presence answers.' : 'The Hearth receives eleven echoes.'}</h2>
		</div>
		<span class="ephemeral"><i></i>Presentation only</span>
	</header>

	{#if mode === 'single'}
		<article class="single-result">
			<div class="portrait">
				<img
					src={hero.image}
					alt={`${hero.name} single summon presentation result`}
					width="1024"
					height="1536"
				/>
			</div>
			<div class="single-copy">
				<div class="stars" aria-label={`${hero.stars} star fixture`}>{'✦'.repeat(hero.stars)}</div>
				<small>Identity recognized</small>
				<h3>{hero.name}</h3>
				<p>{hero.identityLine}</p>
				<div class="tags"><span>{hero.calling}</span><span>{hero.affinity} affinity</span></div>
				<div class="welcome">
					<PortalGlyph kind="ember" size={18} /><span>Ready to return to the Living Village</span>
				</div>
			</div>
		</article>
	{:else}
		<div class="batch-summary">
			<div><strong>10</strong><span>paid presentation slots</span></div>
			<i>+</i>
			<div class="bonus"><strong>1</strong><span>clearly marked bonus</span></div>
			<p>
				All eleven reference the same fixed six identities. Session wallet and guarantee previews
				moved; nothing durable was written.
			</p>
		</div>
		<div class="batch-grid" aria-label="Eleven non-persistent presentation results">
			{#each batch as result, index (`${result.id}-${index}`)}
				<article class:bonus={index === 10} data-testid="batch-result">
					{#if index === 10}<span class="bonus-ribbon">Bonus</span>{/if}
					<div class="batch-portrait">
						<img src={result.image} alt="" width="1024" height="1536" />
					</div>
					<div>
						<small>{String(index + 1).padStart(2, '0')} · {'✦'.repeat(result.stars)}</small>
						<strong>{result.name}</strong>
						<span>{result.calling}</span>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<footer>
		<strong>No durable hero copies created.</strong>
		<span>This receipt compares presentation only; unique hero ownership remains untouched.</span>
	</footer>
</section>

<style>
	.results {
		display: grid;
		gap: 18px;
		padding: 24px;
		border: 1px solid #d4b0723b;
		border-radius: 22px;
		background:
			linear-gradient(140deg, #172127e8, #0b1115f5),
			radial-gradient(circle at 20% 0%, #c9883526, transparent 38%);
		box-shadow:
			inset 0 1px #fff1,
			0 20px 60px #0006;
		color: #eee9df;
		font-family: Inter, ui-sans-serif, system-ui;
	}

	header {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		align-items: flex-start;
	}
	header p {
		margin: 0 0 6px;
		color: #bc985f;
		font-size: 0.62rem;
		font-weight: 760;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		font:
			500 clamp(1.5rem, 3vw, 2.25rem)/1.05 Georgia,
			'Times New Roman',
			serif;
		letter-spacing: -0.03em;
	}
	.ephemeral {
		display: flex;
		gap: 7px;
		align-items: center;
		flex: 0 0 auto;
		padding: 7px 9px;
		border: 1px solid #88caba38;
		border-radius: 999px;
		color: #9bc9be;
		font-size: 0.62rem;
		font-weight: 720;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.ephemeral i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #62c3ad;
		box-shadow: 0 0 8px #62c3ad;
	}

	.single-result {
		display: grid;
		grid-template-columns: minmax(180px, 0.72fr) 1.28fr;
		min-height: 320px;
		overflow: hidden;
		border: 1px solid #d8e6df21;
		border-radius: 16px;
		background: #080e12aa;
	}
	.portrait {
		position: relative;
		min-height: 310px;
		overflow: hidden;
		background: radial-gradient(circle at 50% 45%, #527d7138, transparent 52%);
	}
	.portrait::after {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(90deg, transparent 70%, #080e12),
			linear-gradient(0deg, #080e12, transparent 35%);
		content: '';
	}
	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 18%;
		filter: saturate(0.86) contrast(1.02);
	}
	.single-copy {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		padding: 28px;
	}
	.single-copy small {
		color: #8cbcaf;
		font-size: 0.62rem;
		font-weight: 720;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	.single-copy h3 {
		margin: 5px 0 10px;
		font:
			500 clamp(2.2rem, 5vw, 3.7rem)/0.95 Georgia,
			'Times New Roman',
			serif;
		letter-spacing: -0.045em;
	}
	.single-copy p {
		max-width: 440px;
		margin: 0;
		color: #abb3ae;
		font-size: 0.87rem;
		line-height: 1.55;
	}
	.stars {
		margin-bottom: 12px;
		color: #dea85c;
		font-size: 0.73rem;
		letter-spacing: 0.14em;
	}
	.tags {
		display: flex;
		gap: 7px;
		margin-top: 17px;
	}
	.tags span {
		padding: 6px 9px;
		border: 1px solid #7dbbaa31;
		border-radius: 99px;
		color: #acd3c9;
		font-size: 0.62rem;
		font-weight: 680;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.welcome {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-top: 22px;
		color: #d2c7b3;
		font-size: 0.72rem;
	}

	.batch-summary {
		display: grid;
		grid-template-columns: auto auto auto 1fr;
		gap: 14px;
		align-items: center;
		padding: 14px 16px;
		border: 1px solid #d8b26c30;
		border-radius: 13px;
		background: #9e681411;
	}
	.batch-summary > div {
		display: flex;
		gap: 7px;
		align-items: baseline;
	}
	.batch-summary strong {
		color: #f1d093;
		font:
			500 1.55rem Georgia,
			serif;
	}
	.batch-summary span {
		color: #a7aaa5;
		font-size: 0.68rem;
	}
	.batch-summary i {
		color: #6d7772;
		font-style: normal;
	}
	.batch-summary p {
		margin: 0 0 0 auto;
		max-width: 480px;
		color: #8f9893;
		font-size: 0.7rem;
		line-height: 1.45;
		text-align: right;
	}

	.batch-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 8px;
	}
	.batch-grid article {
		position: relative;
		min-width: 0;
		overflow: hidden;
		border: 1px solid #ccded621;
		border-radius: 11px;
		background: #070d10;
	}
	.batch-grid article.bonus {
		grid-column: 3 / span 2;
		border-color: #e1b66478;
		box-shadow: 0 0 25px #d6932430;
	}
	.batch-portrait {
		height: 125px;
		overflow: hidden;
		background: #132126;
	}
	.batch-portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 14%;
		filter: saturate(0.78);
	}
	.batch-grid article > div:last-child {
		display: grid;
		gap: 2px;
		padding: 8px;
	}
	.batch-grid small {
		overflow: hidden;
		color: #bf9552;
		font-size: 0.52rem;
		white-space: nowrap;
	}
	.batch-grid strong {
		overflow: hidden;
		color: #e5e5df;
		font-size: 0.7rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.batch-grid span {
		overflow: hidden;
		color: #71807a;
		font-size: 0.56rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bonus-ribbon {
		position: absolute;
		z-index: 2;
		top: 7px;
		right: 7px;
		padding: 4px 6px;
		border-radius: 99px;
		background: #d39a43;
		color: #111 !important;
		font-size: 0.49rem !important;
		font-weight: 850;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	footer {
		display: flex;
		gap: 7px 15px;
		flex-wrap: wrap;
		padding-top: 2px;
		font-size: 0.68rem;
	}
	footer strong {
		color: #a8d0c6;
	}
	footer span {
		color: #7e8984;
	}

	@media (max-width: 720px) {
		.results {
			padding: 16px;
			border-radius: 17px;
		}
		header {
			align-items: flex-start;
		}
		.ephemeral {
			padding: 6px;
			font-size: 0.5rem;
		}
		.single-result {
			grid-template-columns: 0.75fr 1.25fr;
			min-height: 260px;
		}
		.portrait {
			min-height: 260px;
		}
		.single-copy {
			padding: 15px;
		}
		.single-copy p {
			font-size: 0.72rem;
		}
		.welcome {
			display: none;
		}
		.batch-summary {
			grid-template-columns: auto auto auto;
			gap: 8px;
		}
		.batch-summary > div {
			display: grid;
			gap: 0;
		}
		.batch-summary p {
			grid-column: 1 / -1;
			margin: 0;
			text-align: left;
		}
		.batch-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 6px;
		}
		.batch-grid article.bonus {
			grid-column: 2 / span 2;
		}
		.batch-portrait {
			height: 100px;
		}
	}
</style>
