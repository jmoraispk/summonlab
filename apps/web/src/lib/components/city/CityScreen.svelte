<script lang="ts">
	import EquipmentWorkshop from '$lib/components/EquipmentWorkshop.svelte';
	import VillageInventoryPanel from '$lib/components/village-shell/VillageInventoryPanel.svelte';
	import VillageMissionsPanel from '$lib/components/village-shell/VillageMissionsPanel.svelte';
	import VillageResidentsPanel from '$lib/components/village-shell/VillageResidentsPanel.svelte';
	import VillageTowerPanel from '$lib/components/village-shell/VillageTowerPanel.svelte';
	import type { CityIntent, CityViewModel } from '$lib/city';

	import CityModeDock from './CityModeDock.svelte';
	import CityOccupancyLedger from './CityOccupancyLedger.svelte';
	import CityVillageViewport from './CityVillageViewport.svelte';

	let {
		view,
		onIntent = async () => undefined,
		pendingIntent = null,
		intentError = null,
		onEquipmentChanged
	}: {
		view: CityViewModel;
		onIntent?: (intent: CityIntent) => void | Promise<void>;
		pendingIntent?: CityIntent | null;
		intentError?: string | null;
		onEquipmentChanged?: () => void | Promise<void>;
	} = $props();
</script>

<section class="city-screen" data-testid="city-screen">
	<CityModeDock current={view.mode} />
	{#if view.mode === 'village'}
		<div class="village-stage">
			<CityVillageViewport {view} {onIntent} {pendingIntent} {intentError} />
			<CityOccupancyLedger rows={view.occupancy} />
		</div>
	{:else if view.mode === 'residents'}
		<VillageResidentsPanel residents={view.residents} />
	{:else if view.mode === 'tower'}
		<VillageTowerPanel />
	{:else if view.mode === 'missions' && view.objectives}
		<VillageMissionsPanel objectives={view.objectives} />
	{:else if view.mode === 'inventory' && view.inventory}
		<EquipmentWorkshop
			runId={view.runId}
			initialProjection={view.inventory}
			onChanged={onEquipmentChanged}
		/>
	{:else if view.mode === 'inventory'}
		<VillageInventoryPanel />
	{:else}
		<section class="mode-placeholder" aria-label={`${view.mode} City mode`}>
			<h2>{view.mode}</h2>
			<p>This City record is not available for the current campaign.</p>
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
