<script lang="ts">
	import type { CityViewModel } from '$lib/city';

	let { view }: { view: CityViewModel } = $props();
	const time = $derived(
		new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
			new Date(view.gameTime)
		)
	);
</script>

<header class="status-strip">
	<div class="identity">
		<span>Living City</span>
		<h1>Hearth 01</h1>
	</div>
	<div class="clock" aria-label={`Day ${view.dayNumber}, ${time}, ${view.dayPhase}`}>
		<span>Day {view.dayNumber}</span>
		<strong>{time}</strong>
		<small>{view.dayPhase}</small>
	</div>
	<div class="state">
		<span>World state</span>
		<strong>Event {view.eventCursor}</strong>
		<small>{view.stateHash.slice(0, 8)}</small>
	</div>
</header>

<style>
	.status-strip {
		display: grid;
		grid-template-columns: minmax(10rem, 1fr) auto auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.65rem;
		border-bottom: 1px solid rgba(221, 192, 142, 0.18);
		background: #11151a;
	}

	.identity span,
	.clock span,
	.state span {
		display: block;
		color: #d69a59;
		font-size: 0.55rem;
		font-weight: 850;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.15rem 0 0;
		font:
			400 1.1rem Georgia,
			serif;
	}

	.clock,
	.state {
		min-width: 6.5rem;
		padding: 0.35rem 0.65rem;
		border-inline-start: 1px solid rgba(221, 192, 142, 0.16);
	}

	.clock strong,
	.clock small,
	.state strong,
	.state small {
		display: block;
	}

	.clock strong,
	.state strong {
		margin-top: 0.1rem;
		font:
			400 0.9rem Georgia,
			serif;
	}

	.clock small,
	.state small {
		margin-top: 0.1rem;
		color: #78c5ca;
		font-size: 0.55rem;
		text-transform: capitalize;
	}

	@media (max-width: 650px) {
		.status-strip {
			grid-template-columns: 1fr auto;
		}

		.state {
			display: none;
		}
	}
</style>
