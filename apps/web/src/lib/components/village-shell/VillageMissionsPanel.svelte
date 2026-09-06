<script lang="ts">
	import type { CampaignObjectiveProjection } from '@summonlab/contracts';

	let { objectives }: { objectives: CampaignObjectiveProjection } = $props();
</script>

<section class="mission-ledger" data-testid="village-missions" aria-labelledby="missions-title">
	<header>
		<p>Campaign record · {objectives.completedCount} of {objectives.objectives.length} complete</p>
		<h1 id="missions-title">What the company is trying to do</h1>
		<span>These entries follow the authoritative campaign record—not the Tower lab prototype.</span>
	</header>

	<div class="objectives">
		{#each objectives.objectives as objective, index (objective.objectiveId)}
			<article
				class:current={objective.status === 'current'}
				class:complete={objective.status === 'complete'}
			>
				<div class="ordinal">{String(index + 1).padStart(2, '0')}</div>
				<div class="copy">
					<p>{objective.chapter}</p>
					<h2>{objective.title}</h2>
					<span>{objective.detail}</span>
					{#if objective.evidence[0]}<small>{objective.evidence[0]}</small>{/if}
				</div>
				<strong
					>{objective.status === 'complete'
						? 'Complete'
						: objective.status === 'current'
							? 'Current'
							: 'Locked'}</strong
				>
			</article>
		{/each}
	</div>
</section>

<style>
	.mission-ledger {
		min-height: calc(100vh - 8.55rem);
		padding: clamp(2rem, 5vw, 5rem) clamp(1rem, 6vw, 7rem) 9rem;
		background:
			linear-gradient(90deg, rgba(192, 123, 54, 0.035) 1px, transparent 1px) 0 0 / 5rem 100%,
			linear-gradient(180deg, #121116, #08090c 75%);
	}

	header,
	.objectives {
		max-width: 66rem;
		margin-right: auto;
		margin-left: auto;
	}

	header {
		margin-bottom: 2rem;
	}

	p {
		margin: 0 0 0.55rem;
		color: #c77b3a;
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
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
		max-width: 48rem;
		font-size: clamp(2.2rem, 5vw, 4.8rem);
		line-height: 0.95;
	}

	header > span {
		display: block;
		max-width: 37rem;
		margin-top: 1.2rem;
		color: rgba(239, 233, 221, 0.45);
		font:
			italic 0.92rem/1.55 Georgia,
			serif;
	}

	.objectives {
		border-top: 1px solid rgba(240, 207, 145, 0.16);
	}

	article {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) 6rem;
		align-items: start;
		gap: 1.2rem;
		padding: 1.35rem 0;
		border-bottom: 1px solid rgba(240, 207, 145, 0.1);
		opacity: 0.42;
	}

	article.current,
	article.complete {
		opacity: 1;
	}

	article.current {
		background: linear-gradient(90deg, rgba(192, 102, 42, 0.11), transparent 70%);
		box-shadow: inset 2px 0 #cc7138;
	}

	.ordinal {
		padding-left: 1.1rem;
		color: rgba(237, 202, 137, 0.42);
		font:
			1.7rem Georgia,
			serif;
	}

	h2 {
		font-size: 1.4rem;
	}

	.copy > span,
	.copy small {
		display: block;
		color: rgba(239, 233, 221, 0.53);
		font-size: 0.76rem;
		line-height: 1.5;
	}

	.copy small {
		margin-top: 0.5rem;
		color: rgba(211, 159, 80, 0.6);
	}

	article > strong {
		padding-top: 0.35rem;
		color: rgba(239, 233, 221, 0.34);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-align: right;
		text-transform: uppercase;
	}

	article.current > strong {
		color: #e2a15d;
	}

	article.complete > strong {
		color: #859b7a;
	}

	@media (max-width: 650px) {
		.mission-ledger {
			padding-bottom: 11rem;
		}

		article {
			grid-template-columns: 2.6rem minmax(0, 1fr);
			gap: 0.7rem;
		}

		.ordinal {
			padding-left: 0.55rem;
			font-size: 1.1rem;
		}

		article > strong {
			grid-column: 2;
			text-align: left;
		}
	}
</style>
