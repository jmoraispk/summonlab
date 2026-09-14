<script lang="ts">
	import type { CityViewModel } from '$lib/city';
	import TowerEncounter from './combat/TowerEncounter.svelte';
	import TowerExplorationMap from './TowerExplorationMap.svelte';
	import TowerFloorList from './TowerFloorList.svelte';
	import TowerReport from './TowerReport.svelte';

	let {
		view,
		onChanged = async () => undefined
	}: { view: CityViewModel; onChanged?: () => void | Promise<void> } = $props();
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function command(path: string, body: unknown) {
		if (busy) return;
		busy = true;
		error = null;
		try {
			const response = await fetch(`/api/runs/${view.runId}/tower/${path}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const payload = (await response.json().catch(() => ({}))) as { message?: string };
			if (!response.ok) throw new Error(payload.message ?? 'The Tower command was rejected.');
			await onChanged();
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'The Tower command was rejected.';
		} finally {
			busy = false;
		}
	}

	const active = $derived(
		view.tower.state === 'exploration' || view.tower.state === 'encounter'
			? view.tower.exploration
			: null
	);
</script>

<div data-testid="tower-screen">
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if view.tower.state === 'floor-list'}
		<TowerFloorList
			floors={view.tower.floors}
			{busy}
			onExplore={(floorId) => command('start', { floorId })}
		/>
	{:else if view.tower.state === 'exploration'}
		{@const exploration = view.tower.exploration}
		<TowerExplorationMap
			{exploration}
			{busy}
			onMove={(destinationTileId) =>
				command('move', {
					attemptId: exploration.attemptId,
					expectedVersion: exploration.version,
					destinationTileId
				})}
			onExtract={() =>
				command('extract', {
					attemptId: exploration.attemptId,
					expectedVersion: exploration.version
				})}
		/>
	{:else if view.tower.state === 'encounter' && active}
		<TowerEncounter
			floorName={active.floorName}
			positionTileId={active.positionTileId}
			{busy}
			onResolve={(mode) =>
				command('encounter', {
					attemptId: active.attemptId,
					expectedVersion: active.version,
					mode
				})}
		/>
	{:else if view.tower.state === 'report'}
		<TowerReport
			outcome={view.tower.outcome}
			loot={view.tower.loot}
			onExploreAgain={() => command('start', { floorId: 'tower-floor-01' })}
		/>
	{/if}
</div>

<style>
	.error {
		position: fixed;
		z-index: 30;
		top: 6.5rem;
		left: 50%;
		transform: translateX(-50%);
		max-width: 40rem;
		padding: 0.8rem 1rem;
		border: 1px solid #dd765c;
		background: #2b100d;
		color: #ffd9cf;
	}
</style>
