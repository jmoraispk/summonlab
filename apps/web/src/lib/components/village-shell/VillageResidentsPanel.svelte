<script lang="ts">
	import HeroArtPlaceholder from '$lib/components/HeroArtPlaceholder.svelte';
	import type { VillageResident } from '$lib/village-shell';

	let { residents }: { residents: readonly VillageResident[] } = $props();
</script>

<section class="resident-ledger" data-testid="village-residents" aria-labelledby="residents-title">
	<header>
		<div>
			<p>Company ledger · {residents.length} autonomous residents</p>
			<h1 id="residents-title">The people behind the summons</h1>
		</div>
		<span>Their locations, beliefs, and first words come from this campaign’s current state.</span>
	</header>

	<div class="resident-grid">
		{#each residents as resident (resident.heroId)}
			<article id={`resident-${resident.heroId}`} data-testid="village-resident">
				<div class="portrait">
					{#if resident.portrait}
						<img
							src={resident.portrait.publicPath}
							width={resident.portrait.width}
							height={resident.portrait.height}
							alt={`${resident.name} portrait`}
						/>
					{:else}
						<HeroArtPlaceholder name={resident.name} compact />
					{/if}
					<i>{String(resident.ordinal).padStart(2, '0')}</i>
				</div>
				<div class="identity">
					<p>{'✦'.repeat(resident.rarityStars)} · {resident.role}</p>
					<h2>{resident.name}</h2>
					<span>{resident.pronouns} · {resident.location}</span>
				</div>
				<dl>
					<div>
						<dt>Now</dt>
						<dd>{resident.activity}</dd>
					</div>
					<div>
						<dt>Relationship</dt>
						<dd>{resident.relationship}</dd>
					</div>
					<div>
						<dt>Authority</dt>
						<dd>{resident.authority}</dd>
					</div>
					<div>
						<dt>Beliefs</dt>
						<dd>{resident.beliefCount} held</dd>
					</div>
				</dl>
				{#if resident.firstReply}
					<blockquote>“{resident.firstReply}”</blockquote>
				{:else if resident.latestObservation}
					<blockquote>{resident.latestObservation}</blockquote>
				{/if}
			</article>
		{/each}
	</div>
</section>

<style>
	.resident-ledger {
		min-height: calc(100vh - 8.55rem);
		padding: clamp(2rem, 5vw, 5rem) clamp(1rem, 5vw, 5rem) 8rem;
		background:
			radial-gradient(circle at 75% 0%, rgba(150, 100, 55, 0.13), transparent 35rem),
			linear-gradient(180deg, #111116, #08090c 70%);
	}

	.resident-ledger > header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 28rem);
		align-items: end;
		gap: 2rem;
		max-width: 78rem;
		margin: 0 auto 2.2rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid rgba(235, 205, 150, 0.14);
	}

	p {
		margin: 0 0 0.5rem;
		color: #c8813e;
		font-family: ui-monospace, monospace;
		font-size: 0.62rem;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h1,
	h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-weight: 400;
	}

	h1 {
		font-size: clamp(2rem, 4vw, 4.2rem);
		line-height: 0.95;
	}

	.resident-ledger > header > span {
		color: rgba(239, 233, 221, 0.48);
		font-family: Georgia, serif;
		font-size: 0.95rem;
		font-style: italic;
		line-height: 1.6;
	}

	.resident-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		max-width: 78rem;
		margin: auto;
		background: rgba(235, 205, 150, 0.13);
	}

	article {
		min-width: 0;
		padding: 1rem;
		scroll-margin-top: 6rem;
		background: #0d0e12;
	}

	.portrait {
		position: relative;
		height: 19rem;
		overflow: hidden;
		background: #17171a;
	}

	.portrait::after {
		position: absolute;
		inset: 0;
		border: 1px solid rgba(238, 202, 136, 0.14);
		box-shadow: inset 0 -5rem 6rem rgba(7, 7, 9, 0.7);
		content: '';
		pointer-events: none;
	}

	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top center;
	}

	.portrait i {
		position: absolute;
		right: 0.7rem;
		bottom: 0.5rem;
		z-index: 1;
		color: rgba(240, 206, 143, 0.48);
		font:
			normal 2.4rem Georgia,
			serif;
	}

	.identity {
		padding: 1rem 0 0.9rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	h2 {
		font-size: 1.55rem;
	}

	.identity span {
		color: rgba(239, 233, 221, 0.44);
		font-size: 0.68rem;
		text-transform: capitalize;
	}

	dl {
		margin: 0.8rem 0;
	}

	dl div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.42rem 0;
		border-bottom: 1px dotted rgba(255, 255, 255, 0.07);
	}

	dt {
		color: rgba(239, 233, 221, 0.32);
		font-size: 0.57rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	dd {
		margin: 0;
		color: rgba(239, 233, 221, 0.72);
		font-size: 0.68rem;
		text-align: right;
		text-transform: capitalize;
	}

	blockquote {
		margin: 1rem 0 0;
		padding: 0.8rem 0 0.1rem 1rem;
		border-left: 1px solid #b56835;
		color: rgba(239, 233, 221, 0.62);
		font:
			italic 0.85rem/1.5 Georgia,
			serif;
	}

	@media (max-width: 800px) {
		.resident-ledger > header,
		.resident-grid {
			grid-template-columns: 1fr;
		}

		.resident-grid {
			gap: 1px;
		}

		article {
			display: grid;
			grid-template-columns: 7.5rem minmax(0, 1fr);
			gap: 0 1rem;
		}

		.portrait {
			grid-row: span 3;
			height: 11rem;
		}

		.identity {
			padding-top: 0.25rem;
		}

		dl,
		blockquote {
			grid-column: 2;
		}
	}

	@media (max-width: 470px) {
		.resident-ledger {
			padding-bottom: 11rem;
		}

		.resident-ledger > header {
			grid-template-columns: 1fr;
		}

		article {
			grid-template-columns: 5.7rem minmax(0, 1fr);
			padding: 0.75rem;
		}

		.portrait {
			height: 8.5rem;
		}

		h2 {
			font-size: 1.25rem;
		}
	}
</style>
