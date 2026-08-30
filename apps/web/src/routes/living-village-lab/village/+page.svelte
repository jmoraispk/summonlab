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
	<header class="page-heading">
		<div>
			<p>Living Village · Hearth 01</p>
			<h1>The Village is<br /><em>the roster.</em></h1>
		</div>
		<div class="heading-copy">
			<span>Day 4 · 18:40 · Dusk watch</span>
			<p>
				Six lives share this courtyard. Find a resident where they stand, read what matters, and
				give the next order without leaving the world.
			</p>
		</div>
	</header>

	<VillageSummary items={summaryItems} />

	<section class="overlook" aria-labelledby="overlook-heading">
		<header>
			<div>
				<p>World command surface</p>
				<h2 id="overlook-heading">Hearth overlook</h2>
			</div>
			<span><i></i> Six residents visible · Local fixture</span>
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

	<footer>
		<p>
			Orders on this prototype use a brief destination transition. Arrival timing and polished
			walking remain owned by the activity system.
		</p>
		<span>living-village-v1 · six fixed identities · no provider access</span>
	</footer>
</main>

<style>
	main {
		min-height: 100vh;
		overflow: hidden;
		background:
			radial-gradient(circle at 72% 0%, rgba(47, 96, 111, 0.13), transparent 32rem),
			linear-gradient(180deg, #0d1015, #080a0d 70%);
		color: #f4ecdf;
	}

	.page-heading,
	.overlook,
	:global(.summary-rail),
	footer {
		width: min(100% - 2rem, 92rem);
		margin-inline: auto;
	}

	.page-heading {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(20rem, 0.75fr);
		align-items: end;
		gap: clamp(2rem, 8vw, 8rem);
		padding: clamp(2.5rem, 6vw, 5rem) 0 clamp(1.5rem, 3vw, 2.4rem);
	}

	.page-heading > div:first-child > p,
	.overlook > header p {
		margin: 0 0 0.65rem;
		color: #d69a59;
		font-size: 0.64rem;
		font-weight: 850;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font:
			400 clamp(2.8rem, 6vw, 6rem) / 0.84 Georgia,
			serif;
		letter-spacing: -0.06em;
	}

	h1 em {
		color: #76cbd0;
		font-weight: 400;
	}

	.heading-copy {
		padding: 0 0 0.4rem 1.2rem;
		border-left: 1px solid rgba(226, 195, 143, 0.2);
	}

	.heading-copy span {
		color: #78c5ca;
		font-size: 0.67rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.heading-copy p {
		margin: 0.65rem 0 0;
		color: rgba(244, 236, 223, 0.63);
		font:
			400 0.98rem/1.65 Georgia,
			serif;
	}

	.overlook {
		padding: 0.8rem 0 clamp(2rem, 5vw, 5rem);
	}

	.overlook > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 0 0.8rem;
	}

	.overlook > header p {
		margin-bottom: 0.25rem;
	}

	h2 {
		margin: 0;
		font:
			400 1.75rem/1 Georgia,
			serif;
	}

	.overlook > header > span {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: rgba(244, 236, 223, 0.48);
		font-size: 0.64rem;
	}

	.overlook > header i {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: #6ed1d6;
		box-shadow: 0 0 0.7rem #6ed1d6;
	}

	footer {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.2rem 0 2.5rem;
		border-top: 1px solid rgba(227, 204, 166, 0.12);
		color: rgba(244, 236, 223, 0.42);
		font-size: 0.65rem;
	}

	footer p {
		max-width: 42rem;
		margin: 0;
	}

	footer span {
		text-align: right;
	}

	@media (max-width: 760px) {
		.page-heading,
		.overlook,
		:global(.summary-rail),
		footer {
			width: min(100% - 1rem, 92rem);
		}

		.page-heading {
			grid-template-columns: 1fr;
			gap: 1.2rem;
			padding-top: 2rem;
		}

		h1 {
			font-size: clamp(2.8rem, 15vw, 4.2rem);
		}

		.heading-copy {
			padding-left: 0.8rem;
		}

		.overlook > header {
			align-items: start;
			flex-direction: column;
		}

		footer {
			align-items: start;
			flex-direction: column;
		}

		footer span {
			text-align: left;
		}
	}
</style>
