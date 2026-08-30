<script lang="ts">
	import type { VillageSummaryItem } from './types';

	let { items }: { items: readonly VillageSummaryItem[] } = $props();
</script>

<section class="summary-rail" aria-label="Village status">
	{#each items as item (item.label)}
		<article class={`summary tone-${item.tone}`}>
			<span>{item.label}</span>
			<strong>{item.value}</strong>
			<small>{item.detail}</small>
		</article>
	{/each}
</section>

<style>
	.summary-rail {
		display: grid;
		grid-template-columns: 1.25fr repeat(4, 1fr);
		gap: 0.55rem;
	}

	.summary {
		position: relative;
		min-width: 0;
		padding: 0.8rem 0.9rem 0.75rem 1rem;
		overflow: hidden;
		border: 1px solid rgba(231, 212, 177, 0.13);
		background: linear-gradient(145deg, rgba(24, 28, 34, 0.96), rgba(12, 15, 20, 0.98));
		box-shadow: inset 3px 0 var(--tone);
	}

	.summary::after {
		position: absolute;
		top: -1.5rem;
		right: -1.5rem;
		width: 4rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--tone);
		filter: blur(2rem);
		content: '';
		opacity: 0.18;
	}

	.tone-ember {
		--tone: #da7848;
	}

	.tone-aqua {
		--tone: #65cad0;
	}

	.tone-violet {
		--tone: #9a82cb;
	}

	.tone-gold {
		--tone: #d8b66f;
	}

	.tone-stone {
		--tone: #9da39d;
	}

	span,
	small {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	span {
		color: rgba(241, 231, 213, 0.54);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	strong {
		display: block;
		margin-top: 0.22rem;
		color: #fff7e9;
		font:
			400 1.1rem/1.1 Georgia,
			serif;
	}

	small {
		margin-top: 0.3rem;
		color: rgba(241, 231, 213, 0.42);
		font-size: 0.66rem;
	}

	@media (max-width: 860px) {
		.summary-rail {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.summary:first-child {
			grid-column: 1 / -1;
		}
	}
</style>
