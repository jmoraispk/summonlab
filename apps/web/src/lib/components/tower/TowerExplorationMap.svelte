<script lang="ts">
	import { tick } from 'svelte';
	import type { ExplorationTravelResult } from '@summonlab/contracts';

	import type { CityResident, TowerExplorationView } from '$lib/city';

	let {
		exploration,
		party,
		onMove,
		onTravelComplete,
		onExtract,
		busy = false
	}: {
		exploration: TowerExplorationView;
		party: readonly CityResident[];
		onMove: (tileId: string) => Promise<ExplorationTravelResult | null>;
		onTravelComplete: () => void | Promise<void>;
		onExtract: () => void | Promise<void>;
		busy?: boolean;
	} = $props();

	let moving = $state(false);
	let visualTileId = $state<string | null>(null);
	const effectiveVisualTileId = $derived(visualTileId ?? exploration.positionTileId);
	const destinations = $derived(
		new Map(exploration.destinations.map((destination) => [destination.tileId, destination]))
	);
	const visualTile = $derived(
		exploration.tiles.find((tile) => tile.tileId === effectiveVisualTileId) ?? null
	);
	const atThreshold = $derived(exploration.positionTileId === 'f001-r016-c005');
	const controlsBusy = $derived(busy || moving);

	$effect(() => {
		if (!moving) visualTileId = exploration.positionTileId;
	});

	function reducedMotion(): boolean {
		return (
			typeof window !== 'undefined' &&
			(document.documentElement.dataset.playerMotion === 'reduced' ||
				window.matchMedia('(prefers-reduced-motion: reduce)').matches)
		);
	}

	function wait(milliseconds: number): Promise<void> {
		return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
	}

	function tileLabel(
		tile: TowerExplorationView['tiles'][number],
		destination: TowerExplorationView['destinations'][number] | undefined
	): string {
		if (tile.tileId === effectiveVisualTileId)
			return `Company at ${tile.zoneLabel ?? 'the passage'}`;
		if (destination?.intent === 'encounter') {
			return `Engage enemies at ${destination.zoneLabel}`;
		}
		if (destination) return `Travel to ${destination.zoneLabel}, ${destination.distance} tiles`;
		if (tile.knowledge === 'revealed' && tile.walkable) {
			return `${tile.zoneLabel ?? 'Revealed passage'}. No safe route avoids enemy-controlled tiles.`;
		}
		return tile.zoneLabel ?? 'Unknown tile';
	}

	async function travelTo(tileId: string) {
		if (controlsBusy || !destinations.has(tileId)) return;
		moving = true;
		try {
			const travel = await onMove(tileId);
			if (!travel) return;
			const shouldPause = !reducedMotion();
			for (const tileId of travel.pathTileIds) {
				visualTileId = tileId;
				await tick();
				if (shouldPause) await wait(135);
			}
			await onTravelComplete();
		} finally {
			moving = false;
		}
	}
</script>

<section class="exploration" aria-labelledby="exploration-title">
	<header>
		<div>
			<p>Active expedition</p>
			<h1 id="exploration-title">{exploration.floorName}</h1>
		</div>
		<div class="status">
			<span>{exploration.revealedCount} tiles known · {exploration.pendingLoot.length} finds</span
			><b>Position {effectiveVisualTileId}</b>
		</div>
	</header>
	<div class="layout">
		<div
			class="map"
			class:moving
			style={`--columns:${exploration.columns};--rows:${exploration.rows}`}
			aria-label="Floor exploration map"
			aria-busy={controlsBusy}
		>
			{#each exploration.tiles as tile (tile.tileId)}
				{@const destination = destinations.get(tile.tileId)}
				<button
					type="button"
					class:unknown={tile.knowledge === 'hidden'}
					class:wall={tile.knowledge === 'revealed' && tile.walkable === false}
					class:current={tile.tileId === effectiveVisualTileId}
					class:destination={Boolean(destination)}
					class:encounter={destination?.intent === 'encounter'}
					disabled={controlsBusy || !destination}
					onclick={() => travelTo(tile.tileId)}
					aria-label={tileLabel(tile, destination)}
					title={tileLabel(tile, destination)}
					style={`grid-column:${tile.column + 1};grid-row:${tile.row + 1}`}
				></button>
			{/each}
			{#if visualTile}
				<div
					class="party-marker"
					data-testid="tower-party"
					style={`grid-column:${visualTile.column + 1};grid-row:${visualTile.row + 1}`}
					aria-label={`${party.length} heroes at ${visualTile.zoneLabel ?? 'the passage'}`}
				>
					{#each party as resident, index (resident.heroId)}
						{#if resident.combatArt}
							<img
								src={resident.combatArt.publicPath}
								alt={resident.name}
								data-testid="tower-party-member"
								style={`--party-offset:${(index - (party.length - 1) / 2) * 20}%`}
							/>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
		<aside>
			<p>Route planning</p>
			<h2>{moving ? 'Company moving' : 'Choose a destination'}</h2>
			<p class="guidance">
				Cyan tiles have a safe route. Red tiles deliberately begin an encounter. Enemy-adjacent
				passages stay unavailable.
			</p>
			{#if atThreshold}<button
					class="extract"
					type="button"
					disabled={controlsBusy || !exploration.objectiveComplete}
					onclick={onExtract}
					>{exploration.objectiveComplete ? 'Extract to Village' : 'Objective required'}</button
				>{/if}
		</aside>
	</div>
</section>

<style>
	.exploration {
		min-height: calc(100vh - 7rem);
		padding: clamp(1rem, 3vw, 3rem);
		background: radial-gradient(circle at 50% 20%, #19384d, #080b10 55%);
		color: #efe9df;
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		max-width: 75rem;
		margin: 0 auto 1rem;
	}
	p {
		margin: 0 0 0.35rem;
		color: #55d6ec;
		font:
			700 0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1,
	h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-weight: 400;
	}
	h1 {
		font-size: clamp(1.7rem, 4vw, 3.5rem);
	}
	.status {
		display: grid;
		text-align: right;
		color: #eee7dc99;
		font-size: 0.72rem;
	}
	.status b {
		color: #dca560;
		font-family: ui-monospace, monospace;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(18rem, 42rem) minmax(14rem, 20rem);
		justify-content: center;
		gap: 2rem;
	}
	.map {
		display: grid;
		isolation: isolate;
		grid-template-columns: repeat(var(--columns), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
		aspect-ratio: 11 / 17;
		max-height: 68vh;
		background: #05070a;
		border: 1px solid #4bcde755;
		box-shadow: 0 1rem 5rem #000;
	}
	.map button {
		min-width: 0;
		border: 1px solid #14232c;
		background: #25333c;
	}
	.map button.unknown {
		background: #05070a;
		border-color: #080b0e;
	}
	.map button.wall {
		background: #111820;
	}
	.map button.destination {
		background: #285566;
		box-shadow: inset 0 0 0 1px #55d6ec;
		cursor: pointer;
	}
	.map button.destination:hover,
	.map button.destination:focus-visible {
		position: relative;
		z-index: 2;
		outline: 2px solid #b8f4ff;
		outline-offset: -2px;
		background: #347087;
	}
	.map button.current {
		background: #f0b45c;
		box-shadow: 0 0 1rem #f0a43f;
	}
	.map button.encounter {
		border-color: #ec725d;
		background: #65352e;
		box-shadow: inset 0 0 0 1px #ec725d;
	}
	.party-marker {
		position: relative;
		z-index: 4;
		align-self: end;
		justify-self: center;
		width: 100%;
		height: 100%;
		pointer-events: none;
		transition: transform 120ms ease-out;
	}
	.party-marker img {
		position: absolute;
		left: calc(50% + var(--party-offset));
		bottom: -12%;
		width: auto;
		height: 260%;
		max-width: none;
		transform: translateX(-50%);
		filter: drop-shadow(0 0.2rem 0.25rem #000c);
	}
	.map.moving .party-marker {
		transform: translateY(-8%);
	}
	aside {
		align-self: start;
		padding: 1.2rem;
		border: 1px solid #dca56044;
		background: #080c11e8;
	}
	aside h2 {
		margin-bottom: 1rem;
	}
	aside .guidance {
		color: #c6c4bd;
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 400;
		line-height: 1.6;
		letter-spacing: 0;
		text-transform: none;
	}
	aside button {
		display: block;
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.75rem;
		border: 1px solid #55d6ec55;
		background: #10222c;
		color: #eaf9fc;
		text-align: left;
		cursor: pointer;
	}
	aside button.extract {
		margin-top: 1.3rem;
		border-color: #dca560;
		background: #2f2114;
		color: #f5d5aa;
	}
	@media (prefers-reduced-motion: reduce) {
		.party-marker {
			transition: none;
		}
	}
	@media (max-width: 650px) {
		.exploration {
			padding-bottom: 8rem;
		}
		.layout {
			grid-template-columns: 1fr;
		}
		.map {
			width: min(100%, 24rem);
			margin: auto;
		}
		header {
			display: block;
		}
		.status {
			margin-top: 0.8rem;
			text-align: left;
		}
	}
</style>
