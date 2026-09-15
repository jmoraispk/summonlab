<script lang="ts">
	import type { ExplorationTravelResult } from '@summonlab/contracts';

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

	async function command<T extends { message?: string }>(
		path: string,
		body: unknown,
		refresh = true
	): Promise<T | null> {
		if (busy) return null;
		busy = true;
		error = null;
		try {
			const response = await fetch(`/api/runs/${view.runId}/tower/${path}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const payload = (await response.json().catch(() => ({}))) as T;
			if (!response.ok) throw new Error(payload.message ?? 'The Tower command was rejected.');
			if (refresh) await onChanged();
			return payload;
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'The Tower command was rejected.';
			return null;
		} finally {
			busy = false;
		}
	}

	const active = $derived(
		view.tower.state === 'exploration' || view.tower.state === 'encounter'
			? view.tower.exploration
			: null
	);
	const explorationParty = $derived.by(() => {
		if (view.tower.state !== 'exploration') return [];
		const exploration = view.tower.exploration;
		return view.residents.filter((resident) => exploration.partyHeroIds.includes(resident.heroId));
	});
</script>

<div data-testid="tower-screen">
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if view.tower.state === 'floor-list'}
		<TowerFloorList
			floors={view.tower.floors}
			{busy}
			onExplore={async (floorId) => {
				await command('start', { floorId });
			}}
		/>
	{:else if view.tower.state === 'exploration'}
		{@const exploration = view.tower.exploration}
		<TowerExplorationMap
			{exploration}
			party={explorationParty}
			{busy}
			onMove={async (destinationTileId) => {
				const payload = await command<{ message?: string; travel: ExplorationTravelResult }>(
					'move',
					{
						attemptId: exploration.attemptId,
						expectedVersion: exploration.version,
						destinationTileId
					},
					false
				);
				if (!payload) return null;
				return payload.travel;
			}}
			onTravelComplete={onChanged}
			onExtract={async () => {
				await command('extract', {
					attemptId: exploration.attemptId,
					expectedVersion: exploration.version
				});
			}}
		/>
	{:else if view.tower.state === 'encounter' && active && view.tower.encounterRequest}
		<TowerEncounter
			floorName={active.floorName}
			positionTileId={active.positionTileId}
			encounterRequest={view.tower.encounterRequest}
			{busy}
			onComplete={async (receipt) => {
				const settled = await command('encounter', {
					attemptId: active.attemptId,
					expectedVersion: active.version,
					receipt
				});
				return settled !== null;
			}}
		/>
	{:else if view.tower.state === 'encounter'}
		<p class="error" role="alert">The active encounter request could not be loaded.</p>
	{:else if view.tower.state === 'report'}
		<TowerReport
			outcome={view.tower.outcome}
			loot={view.tower.loot}
			onExploreAgain={async () => {
				await command('start', { floorId: 'tower-floor-01' });
			}}
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
