<script lang="ts">
	import type { ProofEvent } from '@summonlab/contracts';

	let { events, compact = false }: { events: ProofEvent[]; compact?: boolean } = $props();
</script>

<section class:compact class="journal" aria-labelledby="journal-title">
	<header>
		<div>
			<p>Authoritative journal</p>
			<h2 id="journal-title">What actually happened</h2>
		</div>
		<span>{events.length} events</span>
	</header>
	<ol>
		{#each events as event (event.eventId)}
			<li>
				<div class="sequence">{String(event.sequence).padStart(2, '0')}</div>
				<div>
					<div class="meta">
						<code>{event.eventType}</code>
						<span>{event.decisionSource}</span>
					</div>
					<p>{event.summary}</p>
					<small title={event.eventHash}>hash {event.eventHash.slice(0, 10)}</small>
				</div>
			</li>
		{/each}
	</ol>
</section>

<style>
	.journal {
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(8, 10, 16, 0.8);
		backdrop-filter: blur(18px);
	}

	header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.4rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	header p,
	header h2 {
		margin: 0;
	}

	header p {
		margin-bottom: 0.35rem;
		color: #d4a653;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	header h2 {
		font-family: Georgia, serif;
		font-size: 1.45rem;
		font-weight: 400;
	}

	header > span {
		color: rgba(244, 240, 232, 0.45);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 2.3rem minmax(0, 1fr);
		gap: 0.8rem;
		padding: 1rem 1.4rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	li:last-child {
		border-bottom: 0;
	}

	.sequence {
		padding-top: 0.15rem;
		color: rgba(244, 240, 232, 0.3);
		font-family: ui-monospace, monospace;
		font-size: 0.66rem;
	}

	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	code {
		color: #7fd8e9;
		font-family: ui-monospace, monospace;
		font-size: 0.66rem;
	}

	.meta span {
		padding: 0.2rem 0.42rem;
		border: 1px solid rgba(212, 166, 83, 0.22);
		color: #d4a653;
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	li p {
		margin: 0.4rem 0;
		color: rgba(244, 240, 232, 0.75);
		font-size: 0.78rem;
		line-height: 1.55;
	}

	small {
		color: rgba(244, 240, 232, 0.3);
		font-family: ui-monospace, monospace;
		font-size: 0.57rem;
	}

	.compact header {
		padding: 1rem;
	}

	.compact header h2 {
		font-size: 1rem;
	}

	.compact li {
		padding: 0.8rem 1rem;
	}
</style>
