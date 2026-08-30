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
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.3rem;
		min-width: 0;
	}

	.summary {
		position: relative;
		min-width: 0;
		padding: 0.38rem 0.55rem 0.38rem 0.7rem;
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
		font-size: 0.5rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	strong {
		display: block;
		margin-top: 0.12rem;
		color: #fff7e9;
		font:
			400 0.85rem/1 Georgia,
			serif;
	}

	small {
		margin-top: 0.15rem;
		color: rgba(241, 231, 213, 0.42);
		font-size: 0.53rem;
	}

	@media (max-width: 860px) {
		.summary {
			padding-inline: 0.4rem;
		}

		.summary small {
			display: none;
		}
	}
</style>
