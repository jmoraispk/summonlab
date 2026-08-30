<script lang="ts">
	import type { FloorFixture } from './tower-fixtures';

	let {
		floors,
		selectedFloorId,
		onSelect
	}: {
		floors: FloorFixture[];
		selectedFloorId: string;
		onSelect: (floor: FloorFixture) => void;
	} = $props();
</script>

<section class="floor-section" aria-labelledby="floor-heading">
	<header>
		<div>
			<p class="eyebrow">01 · Tower floor</p>
			<h2 id="floor-heading">Choose a floor</h2>
		</div>
		<p>
			Cleared floors remain available for another expedition. The frontier carries its first-clear
			claim.
		</p>
	</header>

	<div class="floor-list" aria-label="Tower Floors 1 through 10">
		{#each floors as floor (floor.id)}
			<button
				type="button"
				class:active={selectedFloorId === floor.id}
				class:locked={floor.state === 'locked'}
				disabled={floor.state === 'locked'}
				aria-pressed={selectedFloorId === floor.id}
				aria-label={`Floor ${floor.number}, ${floor.name}, ${floor.state}, ${floor.difficulty}`}
				onclick={() => onSelect(floor)}
			>
				<span>{String(floor.number).padStart(2, '0')}</span>
				<strong>{floor.name}</strong>
				<small>{floor.state === 'frontier' ? 'First clear' : floor.state}</small>
				<i>{floor.difficulty}</i>
			</button>
		{/each}
	</div>
</section>

<style>
	.floor-section {
		padding: clamp(0.8rem, 2vw, 1.25rem);
		border: 1px solid rgba(225, 188, 121, 0.22);
		background: rgba(11, 13, 17, 0.88);
	}
	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 0.75rem;
	}
	header > p {
		max-width: 34rem;
		margin: 0;
		color: #a9a59d;
		font-size: 0.88rem;
		line-height: 1.55;
		text-align: right;
	}
	.eyebrow {
		margin: 0 0 0.45rem;
		color: #d99b54;
		font:
			0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(1.35rem, 2.5vw, 1.85rem);
		font-weight: 400;
	}
	.floor-list {
		display: grid;
		grid-template-columns: repeat(10, minmax(7rem, 1fr));
		gap: 0.55rem;
		overflow-x: auto;
		padding: 0.25rem 0.15rem 0.65rem;
		scrollbar-color: #a66c32 #171719;
	}
	button {
		min-height: 5.8rem;
		padding: 0.65rem;
		border: 1px solid rgba(219, 194, 151, 0.2);
		border-radius: 0.2rem;
		background: #15171b;
		color: #e9e2d5;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			transform 160ms ease;
	}
	button:hover:not(:disabled) {
		border-color: #d99b54;
		transform: translateY(-2px);
	}
	button.active {
		border-color: #efbb71;
		background: linear-gradient(160deg, #382616, #17171a 72%);
		box-shadow: inset 0 0 0 1px rgba(255, 204, 124, 0.15);
	}
	button.locked {
		color: #77746f;
		background: #101115;
		cursor: not-allowed;
	}
	button span,
	button strong,
	button small,
	button i {
		display: block;
	}
	button span {
		color: #d99b54;
		font:
			0.73rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
	}
	button strong {
		min-height: 0;
		margin-top: 0.3rem;
		font-family: Georgia, serif;
		font-size: 1rem;
		font-weight: 400;
		line-height: 1.05;
	}
	button small {
		margin-top: 0.4rem;
		color: #c9b391;
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	button i {
		margin-top: 0.25rem;
		color: #8f8c85;
		font-size: 0.65rem;
		font-style: normal;
	}
	@media (max-width: 680px) {
		.floor-section {
			padding: 0.75rem;
		}
		header {
			display: block;
		}
		header > p {
			display: none;
			text-align: left;
		}
		.floor-list {
			grid-template-columns: repeat(10, 6.7rem);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
		button:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
