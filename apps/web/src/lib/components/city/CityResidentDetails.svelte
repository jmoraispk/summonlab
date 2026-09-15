<script lang="ts">
	import type { CityResident } from '$lib/city';

	let {
		resident,
		onClose
	}: {
		resident: CityResident;
		onClose: () => void;
	} = $props();
</script>

<aside class="drawer" aria-labelledby="resident-details-heading" data-testid="resident-details">
	<header>
		<div>
			<p>
				Resident record · {resident.level === null
					? 'Level unavailable'
					: `Level ${resident.level}`}
			</p>
			<h2 id="resident-details-heading">{resident.name}</h2>
		</div>
		<button type="button" aria-label="Close resident details" onclick={onClose}>×</button>
	</header>

	<div class="identity">
		{#if resident.portrait}
			<img
				src={resident.portrait.publicPath}
				alt=""
				width={resident.portrait.width}
				height={resident.portrait.height}
			/>
		{/if}
		<div>
			<span>Current activity</span>
			<strong>{resident.activity}</strong>
			<small>{resident.role} · {resident.location}</small>
			<em>{resident.relationship} · {resident.authority}</em>
		</div>
	</div>

	<section aria-labelledby="record-heading">
		<h3 id="record-heading">Record</h3>
		<div class="attributes">
			<div>
				<span>Health</span>
				<strong
					>{resident.health
						? `${resident.health.current} / ${resident.health.maximum}`
						: 'Unavailable'}</strong
				>
			</div>
			<div><span>Rarity</span><strong>{resident.rarityStars}★</strong></div>
			<div><span>Beliefs</span><strong>{resident.beliefCount}</strong></div>
			{#each resident.detailRows as row (row.label)}
				<div><span>{row.label}</span><strong>{row.value}</strong></div>
			{/each}
		</div>
	</section>

	<section aria-labelledby="observation-heading">
		<h3 id="observation-heading">Latest information</h3>
		<p>{resident.latestObservation ?? resident.firstReply ?? 'No further information recorded.'}</p>
	</section>
</aside>

<style>
	.drawer {
		position: relative;
		z-index: 90;
		min-width: 0;
		padding: 1.15rem;
		border: 1px solid rgba(228, 203, 157, 0.2);
		background: linear-gradient(180deg, rgba(30, 29, 29, 0.98), rgba(12, 15, 19, 0.99)), #11151a;
		box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.35);
	}

	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
	}

	header p,
	h3,
	.identity span {
		margin: 0;
		color: #dba666;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h2 {
		margin: 0.25rem 0 0;
		font:
			400 2rem/1 Georgia,
			serif;
	}

	header button {
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid rgba(238, 224, 198, 0.25);
		background: rgba(255, 255, 255, 0.04);
		color: #f5ecdd;
		cursor: pointer;
		font-size: 1.4rem;
	}

	.identity {
		display: grid;
		grid-template-columns: 5.2rem 1fr;
		gap: 0.85rem;
		margin-top: 1rem;
		padding: 0.7rem;
		background: rgba(255, 255, 255, 0.035);
	}

	.identity img {
		width: 5.2rem;
		height: 6.5rem;
		object-fit: cover;
		object-position: 50% 18%;
	}

	.identity > div {
		display: grid;
		align-content: center;
		gap: 0.35rem;
		min-width: 0;
	}

	.identity strong {
		font:
			400 1rem/1.25 Georgia,
			serif;
	}

	.identity small {
		color: #82cdd0;
		font-size: 0.72rem;
	}

	.identity em {
		color: rgba(245, 236, 221, 0.54);
		font-size: 0.68rem;
		font-style: normal;
	}

	section {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(238, 224, 198, 0.1);
	}

	.attributes {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.4rem;
		margin-top: 0.55rem;
	}

	.attributes div {
		padding: 0.55rem;
		background: rgba(255, 255, 255, 0.035);
	}

	.attributes span,
	.attributes strong {
		display: block;
	}

	.attributes span {
		color: rgba(245, 236, 221, 0.46);
		font-size: 0.58rem;
	}

	.attributes strong {
		margin-top: 0.2rem;
		font:
			400 1.1rem Georgia,
			serif;
	}

	section p {
		margin: 0.55rem 0 0;
		color: rgba(245, 236, 221, 0.72);
		font-size: 0.75rem;
		line-height: 1.5;
	}

	@media (max-width: 720px) {
		.attributes {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
