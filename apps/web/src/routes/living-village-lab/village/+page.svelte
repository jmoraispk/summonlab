<script lang="ts">
	import VillageSummary from '$lib/components/living-village/village/VillageSummary.svelte';
	import VillageViewport from '$lib/components/living-village/village/VillageViewport.svelte';
	import type {
		VillageHeroId,
		VillageHeroRuntime,
		VillageOrder,
		VillagePoint
	} from '$lib/components/living-village/village/types';

	import { facilities, hearthEnvironment, heroes, huntSpecies, summaryItems } from './fixtures';

	let runtime = $state(
		Object.fromEntries(
			heroes.map((hero) => [
				hero.id,
				{ activity: hero.activity, position: { ...hero.position }, order: null }
			])
		) as Record<VillageHeroId, VillageHeroRuntime>
	);

	function destinationFor(order: VillageOrder): VillagePoint {
		const index = heroes.findIndex((hero) => hero.id === order.heroId);
		if (order.kind === 'court') {
			return { x: 0.72 + (index % 3) * 0.045, y: 0.68 + Math.floor(index / 3) * 0.045 };
		}
		return { x: 0.47 + (index % 3) * 0.03, y: 0.86 + Math.floor(index / 3) * 0.025 };
	}

	function assignOrder(order: VillageOrder): void {
		const hero = heroes.find((candidate) => candidate.id === order.heroId)!;
		const activity = order.kind === 'court' ? 'Training at the Court' : `Hunting ${order.species}`;
		const orderLabel =
			order.kind === 'court'
				? 'Assigned locally · Training Court'
				: `Assigned to Tower · ${order.species}`;
		runtime[order.heroId] = {
			activity,
			position: destinationFor(order),
			order: `${hero.name}: ${orderLabel}`
		};
	}
</script>

<svelte:head>
	<title>Living Village · Hearth command surface</title>
	<meta
		name="description"
		content="Find Hearth's six residents, inspect their readiness, and assign Court training or Tower hunts without leaving the Village."
	/>
</svelte:head>

<main>
	<section class="overlook" aria-labelledby="village-heading">
		<header class="info-toolbar">
			<div class="village-identity">
				<span>Living Village</span>
				<h1 id="village-heading">Hearth 01</h1>
				<small>Day 4 · 18:40 · Dusk watch</small>
			</div>
			<VillageSummary items={summaryItems} />
		</header>
		<VillageViewport
			{heroes}
			{facilities}
			environment={hearthEnvironment}
			{runtime}
			{huntSpecies}
			onOrder={assignOrder}
		/>
	</section>
</main>

<style>
	main {
		min-height: 100vh;
		overflow: hidden;
		background: #080b0f;
		color: #f4ecdf;
	}

	.info-toolbar {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: stretch;
		gap: 0.55rem;
		padding: 0.45rem;
		border-bottom: 1px solid rgba(221, 192, 142, 0.18);
		background: #11151a;
	}

	.village-identity {
		display: grid;
		grid-template-columns: auto auto;
		align-content: center;
		gap: 0.1rem 0.65rem;
		min-width: 12.5rem;
		padding: 0.2rem 0.85rem;
		border-right: 1px solid rgba(221, 192, 142, 0.16);
	}

	.village-identity span {
		grid-column: 1 / -1;
		color: #d69a59;
		font-size: 0.55rem;
		font-weight: 850;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font:
			400 1.1rem/1 Georgia,
			serif;
	}

	.village-identity small {
		align-self: end;
		color: #78c5ca;
		font-size: 0.52rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.overlook {
		width: 100%;
	}

	@media (max-width: 760px) {
		.info-toolbar {
			grid-template-columns: 1fr;
			gap: 0.35rem;
			padding: 0.35rem;
		}

		.village-identity {
			grid-template-columns: auto 1fr auto;
			min-width: 0;
			padding: 0.35rem 0.5rem;
			border-right: 0;
		}

		.village-identity span {
			grid-column: auto;
		}
	}
</style>
