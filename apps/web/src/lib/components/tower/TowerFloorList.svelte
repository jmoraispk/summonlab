<script lang="ts">
	import type { TowerFloorView } from '$lib/city';

	let {
		floors,
		onExplore,
		busy = false
	}: {
		floors: readonly TowerFloorView[];
		onExplore: (floorId: string) => void | Promise<void>;
		busy?: boolean;
	} = $props();
</script>

<section class="floor-list" aria-labelledby="tower-heading">
	<header>
		<p>Tower · Band 01</p>
		<h1 id="tower-heading">Choose a floor</h1>
		<span
			>One expedition path. New floors are explored manually; cleared floors will support repeat
			deployments.</span
		>
	</header>
	<div class="floors">
		{#each floors as floor (floor.floorId)}
			<article class:locked={floor.status === 'locked'} data-floor={floor.floorNumber}>
				<div class="number">{String(floor.floorNumber).padStart(2, '0')}</div>
				<div class="floor-copy">
					<small>{floor.status}</small>
					<h2>{floor.name}</h2>
					<p>{floor.tagline}</p>
					<dl>
						<div>
							<dt>Objective</dt>
							<dd>{floor.objective}</dd>
						</div>
						<div>
							<dt>Known opposition</dt>
							<dd>{floor.knownMonsters.join(' · ')}</dd>
						</div>
						<div>
							<dt>Rewards</dt>
							<dd>{floor.rewards.join(' · ')}</dd>
						</div>
					</dl>
				</div>
				{#if floor.status === 'locked'}
					<span class="lock">{floor.lockReason}</span>
				{:else}
					<button type="button" disabled={busy} onclick={() => onExplore(floor.floorId)}>
						{floor.status === 'cleared'
							? 'Explore again'
							: floor.status === 'active'
								? 'Resume'
								: 'Explore'}
					</button>
				{/if}
			</article>
		{/each}
	</div>
</section>

<style>
	.floor-list {
		min-height: calc(100vh - 7rem);
		padding: clamp(2rem, 5vw, 5rem);
		background: radial-gradient(circle at 75% 10%, #12354855, transparent 32rem), #080c11;
		color: #eee7dc;
	}
	header {
		max-width: 65rem;
		margin: 0 auto 2rem;
	}
	header p,
	small,
	dt {
		color: #55d6ec;
		font:
			700 0.65rem/1.3 ui-monospace,
			monospace;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	h1,
	h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-weight: 400;
	}
	h1 {
		font-size: clamp(2.6rem, 6vw, 5.4rem);
	}
	header span {
		display: block;
		max-width: 46rem;
		margin-top: 0.8rem;
		color: #eee7dc99;
		line-height: 1.6;
	}
	.floors {
		display: grid;
		max-width: 75rem;
		margin: auto;
		border-top: 1px solid #d49a553d;
	}
	article {
		display: grid;
		grid-template-columns: 5rem minmax(0, 1fr) auto;
		gap: 1.4rem;
		align-items: center;
		padding: 1.4rem 0.8rem;
		border-bottom: 1px solid #d49a553d;
	}
	article.locked {
		opacity: 0.48;
	}
	.number {
		color: #d9a15b;
		font:
			400 2.4rem/1 Georgia,
			serif;
	}
	h2 {
		margin-top: 0.2rem;
		font-size: 1.45rem;
	}
	.floor-copy > p {
		margin: 0.35rem 0 0.8rem;
		color: #eee7dca8;
	}
	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 2rem;
		margin: 0;
	}
	dt {
		color: #b99263;
	}
	dd {
		margin: 0.15rem 0 0;
		color: #eee7dccc;
		font-size: 0.75rem;
	}
	button {
		min-width: 8rem;
		padding: 0.85rem 1.2rem;
		border: 1px solid #56d8ed;
		background: #102832;
		color: #effcff;
		cursor: pointer;
		font:
			700 0.72rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.lock {
		max-width: 9rem;
		color: #eee7dc99;
		font-size: 0.75rem;
	}
	@media (max-width: 650px) {
		.floor-list {
			padding: 1.4rem 0.8rem 8rem;
		}
		article {
			grid-template-columns: 3.5rem 1fr;
		}
		article > button,
		.lock {
			grid-column: 2;
		}
		dl {
			display: none;
		}
	}
</style>
