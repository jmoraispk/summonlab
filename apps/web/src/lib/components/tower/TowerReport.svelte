<script lang="ts">
	import { resolve } from '$app/paths';

	let {
		outcome,
		loot,
		onExploreAgain
	}: {
		outcome: 'victory' | 'defeat' | 'extracted';
		loot: readonly { readonly kind: string; readonly key: string; readonly amount: number }[];
		onExploreAgain: () => void | Promise<void>;
	} = $props();
</script>

<section class="report" aria-labelledby="report-title">
	<p>Expedition report</p>
	<h1 id="report-title">
		{outcome === 'defeat' ? 'The company was driven back.' : 'The company returned to Hearth 01.'}
	</h1>
	<span
		>{outcome === 'extracted'
			? 'Extraction is recorded once. The Village and its residents remain the same campaign.'
			: 'The encounter result is recorded on this Tower attempt.'}</span
	>
	{#if loot.length > 0}
		<ul aria-label="Extracted loot">
			{#each loot as item, index (`${item.kind}:${item.key}:${index}`)}<li>
					{item.key} ×{item.amount}
				</li>{/each}
		</ul>
	{/if}
	<div>
		<a href={resolve('/village')}>Return to Village</a><button
			type="button"
			onclick={onExploreAgain}>Explore Floor 01 again</button
		>
	</div>
</section>

<style>
	.report {
		display: grid;
		min-height: calc(100vh - 7rem);
		place-content: center;
		padding: 2rem;
		background: radial-gradient(circle, #17313a, #080b0e 65%);
		color: #eee8dd;
		text-align: center;
	}
	p {
		color: #55d6ec;
		font:
			700 0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		max-width: 48rem;
		margin: 0.5rem 0;
		font:
			400 clamp(2.6rem, 6vw, 5.4rem)/0.98 Georgia,
			serif;
	}
	span {
		max-width: 38rem;
		margin: 0.8rem auto;
		color: #eee8dd99;
		line-height: 1.6;
	}
	ul {
		margin: 0.5rem auto;
		color: #e2b879;
		text-align: left;
	}
	div {
		display: flex;
		justify-content: center;
		gap: 0.8rem;
		margin-top: 1rem;
	}
	a,
	button {
		padding: 0.85rem 1.1rem;
		border: 1px solid #55d6ec;
		background: #11262e;
		color: #f1fbfc;
		text-decoration: none;
		cursor: pointer;
	}
</style>
