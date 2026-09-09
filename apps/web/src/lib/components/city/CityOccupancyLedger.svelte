<script lang="ts">
	import type { CityOccupancyRow } from '$lib/city';

	let { rows }: { rows: readonly CityOccupancyRow[] } = $props();
</script>

<aside class="ledger" aria-label="People in each place">
	<ul>
		{#each rows as row (row.id)}
			<li data-power={row.powerState}>
				<span>{row.label}</span>
				<b aria-label={`${row.occupantCount} people at ${row.label}`}>{row.occupantCount}</b>
				<small>{row.assignmentCount}/{row.assignmentCapacity} assigned</small>
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
		width: min(31rem, calc(100% - 1.5rem));
		border: 1px solid rgba(224, 197, 153, 0.3);
		background: rgba(7, 11, 15, 0.88);
		box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.42);
		pointer-events: none;
	}

	ul {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.12rem 0.4rem;
		padding: 0.5rem 0.55rem;
		border-inline-end: 1px solid rgba(224, 197, 153, 0.14);
		border-block-start: 2px solid #8e805f;
		font-size: 0.65rem;
	}

	li:last-child {
		border-inline-end: 0;
	}

	li[data-power='powered'] {
		border-color: #69ccd0;
	}

	li b {
		color: #7cdae0;
		font:
			400 0.9rem Georgia,
			serif;
	}

	li small {
		grid-column: 1 / -1;
		color: rgba(242, 232, 214, 0.48);
		font-size: 0.52rem;
	}

	@media (max-width: 650px) {
		.ledger {
			left: 0.4rem;
			right: 0.4rem;
			bottom: 0.4rem;
			width: auto;
		}

		li {
			padding: 0.4rem 0.3rem;
		}

		li small {
			display: none;
		}
	}
</style>
