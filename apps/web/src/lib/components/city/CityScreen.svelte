<script lang="ts">
	import type { CityIntent, CityViewModel } from '$lib/city';

	import CityModeDock from './CityModeDock.svelte';
	import CityOccupancyLedger from './CityOccupancyLedger.svelte';
	import CityStatusStrip from './CityStatusStrip.svelte';
	import CityVillageViewport from './CityVillageViewport.svelte';

	let {
		view,
		onIntent = async () => undefined,
		pendingIntent = null,
		intentError = null
	}: {
		view: CityViewModel;
		onIntent?: (intent: CityIntent) => void | Promise<void>;
		pendingIntent?: CityIntent | null;
		intentError?: string | null;
	} = $props();
</script>

<section class="city-screen" data-testid="city-screen">
	<CityModeDock runId={view.runId} current={view.mode} />
	<CityStatusStrip {view} />
	{#if view.mode === 'village'}
		<div class="village-stage">
			<CityVillageViewport {view} {onIntent} {pendingIntent} {intentError} />
			<CityOccupancyLedger rows={view.occupancy} />
		</div>
	{:else}
		<section class="mode-placeholder" aria-label={`${view.mode} City mode`}>
			<h2>{view.mode}</h2>
			<p>This campaign surface remains available while the City shell converges.</p>
		</section>
	{/if}
</section>

<style>
	.city-screen {
		min-height: 100vh;
		background: #080b0f;
		color: #f4ecdf;
	}

	.village-stage {
		position: relative;
		padding: 0.45rem;
	}

	.mode-placeholder {
		min-height: 60vh;
		padding: 2rem;
		text-align: center;
		text-transform: capitalize;
	}

	@media (max-width: 650px) {
		.city-screen {
			padding-bottom: calc(5.65rem + env(safe-area-inset-bottom));
		}

		.village-stage {
			padding: 0.3rem;
		}
	}
</style>
