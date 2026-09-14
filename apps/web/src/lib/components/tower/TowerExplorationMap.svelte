<script lang="ts">
	import type { TowerExplorationView } from '$lib/city';

	let {
		exploration,
		onMove,
		onExtract,
		busy = false
	}: {
		exploration: TowerExplorationView;
		onMove: (tileId: string) => void | Promise<void>;
		onExtract: () => void | Promise<void>;
		busy?: boolean;
	} = $props();

	const stepIds = $derived(new Set(exploration.legalSteps.map((step) => step.tileId)));
	const atThreshold = $derived(exploration.positionTileId === 'f001-r016-c005');
</script>

<section class="exploration" aria-labelledby="exploration-title">
	<header>
		<div>
			<p>Active expedition</p>
			<h1 id="exploration-title">{exploration.floorName}</h1>
		</div>
		<div class="status">
			<span>{exploration.revealedCount} tiles known · {exploration.pendingLoot.length} finds</span
			><b>Position {exploration.positionTileId}</b>
		</div>
	</header>
	<div class="layout">
		<div
			class="map"
			style={`--columns:${exploration.columns};--rows:${exploration.rows}`}
			aria-label="Floor exploration map"
		>
			{#each exploration.tiles as tile (tile.tileId)}
				<button
					type="button"
					class:unknown={tile.knowledge === 'hidden'}
					class:wall={tile.knowledge === 'revealed' && tile.walkable === false}
					class:current={tile.tileId === exploration.positionTileId}
					class:legal={stepIds.has(tile.tileId)}
					class:encounter={tile.interactionKind === 'encounter'}
					disabled={busy || !stepIds.has(tile.tileId)}
					onclick={() => onMove(tile.tileId)}
					aria-label={tile.tileId === exploration.positionTileId
						? `Company at ${tile.zoneLabel}`
						: (tile.zoneLabel ?? 'Unknown tile')}
					style={`grid-column:${tile.column + 1};grid-row:${tile.row + 1}`}
				></button>
			{/each}
		</div>
		<aside>
			<p>Movement</p>
			<h2>Choose an adjacent tile</h2>
			{#each exploration.legalSteps as step (step.tileId)}
				<button type="button" disabled={busy} onclick={() => onMove(step.tileId)}
					>{step.label}</button
				>
			{/each}
			{#if atThreshold}<button
					class="extract"
					type="button"
					disabled={busy || !exploration.objectiveComplete}
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
	.map button.legal {
		background: #285566;
		box-shadow: inset 0 0 0 1px #55d6ec;
		cursor: pointer;
	}
	.map button.current {
		background: #f0b45c;
		box-shadow: 0 0 1rem #f0a43f;
	}
	.map button.encounter {
		border-color: #b95645;
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
