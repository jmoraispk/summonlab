<script lang="ts">
	import type { CityOccupancyRow } from '$lib/city';

	let { rows }: { rows: readonly CityOccupancyRow[] } = $props();
</script>

<aside class="ledger" aria-label="City occupancy and assignment capacity">
	<strong>People & places</strong>
	<ul>
		{#each rows as row (row.id)}
			<li data-power={row.powerState}>
				<span>{row.label}</span>
				<b>{row.occupantCount} / {row.assignmentCapacity}</b>
				<small>{row.assignmentCount} assigned</small>
			</li>
		{/each}
	</ul>
</aside>

<style>
	.ledger {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 35;
		width: min(11rem, calc(100% - 1.5rem));
		padding: 0.55rem;
		border: 1px solid rgba(224, 197, 153, 0.3);
		background: rgba(7, 11, 15, 0.88);
		box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.42);
		pointer-events: none;
	}

	.ledger > strong {
		color: #d8a563;
		font-size: 0.56rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	ul {
		display: grid;
		gap: 0.2rem;
		margin: 0.4rem 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0 0.4rem;
		padding-inline-start: 0.4rem;
		border-inline-start: 2px solid #8e805f;
		font-size: 0.65rem;
	}

	li[data-power='powered'] {
		border-color: #69ccd0;
	}

	li b {
		font:
			400 0.72rem Georgia,
			serif;
	}

	li small {
		grid-column: 1 / -1;
		color: rgba(242, 232, 214, 0.48);
		font-size: 0.52rem;
	}

	@media (max-width: 650px) {
		.ledger {
			right: 0.4rem;
			bottom: 0.4rem;
			width: 8.5rem;
			padding: 0.4rem;
		}

		li small {
			display: none;
		}
	}
</style>
