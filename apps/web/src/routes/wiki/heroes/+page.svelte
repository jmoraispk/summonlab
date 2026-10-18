<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { searchHeroArchive } from '$lib/hero-archive';
	let { data } = $props();
	let mounted = $state(false);
	const results = $derived(
		mounted ? searchHeroArchive(data.index, page.url.searchParams) : data.initial
	);
	onMount(() => {
		mounted = true;
	});

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const params = new SvelteURLSearchParams();
		for (const [key, value] of new FormData(form)) params.set(key, String(value));
		void goto(resolve(`/wiki/heroes?${params}`), { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>Hero archive · Summonlab Wiki</title>
	<meta
		name="description"
		content="Browse 736 named Summonlab heroes: the approved roster, historical candidates, earlier studies, and combat prototypes."
	/>
</svelte:head>

<main>
	<header>
		<p class="eyebrow">Art book · 736 named identities</p>
		<h1>The hero archive</h1>
		<p class="intro">
			Every face has a history. Browse the 200 approved heroes alongside 471 historical candidates,
			62 earlier studies and playtest identities, and three combat prototypes.
		</p>
		<p class="note">
			Collection labels preserve each image’s status. Historical portraits do not expand the
			playable roster.
		</p>
	</header>

	<form
		onsubmit={submitSearch}
		method="GET"
		action={resolve('/wiki/heroes')}
		role="search"
		aria-label="Find a hero"
	>
		<label class="search-field"
			><span>Name, hair, or wardrobe</span><input
				type="search"
				name="q"
				value={results.query}
				placeholder="Try Eirar, locs, or patchwork…"
				maxlength="160"
			/></label
		>
		<label
			><span id="hero-collection-label">Collection</span><select
				name="collection"
				aria-labelledby="hero-collection-label"
				value={results.collection}
				>{#each results.collections as collection (collection.id)}<option value={collection.id}
						>{collection.label} ({collection.count})</option
					>{/each}</select
			></label
		>
		<button type="submit">Find heroes</button>
	</form>

	<div class="results-heading" aria-live="polite">
		<p>
			<strong>{results.total}</strong>
			{results.total === 1 ? 'hero' : 'heroes'}{results.query ? ` matching “${results.query}”` : ''}
		</p>
		<span>{results.first}–{results.last} · Page {results.page} of {results.pageCount}</span>
	</div>

	{#snippet pagination()}
		<nav class="pagination" aria-label="Hero archive pages">
			{#if results.previousHref}<a href={results.previousHref} rel="prev">← Previous</a>{:else}<span
					>← Previous</span
				>{/if}
			<span>Page {results.page} / {results.pageCount}</span>
			{#if results.nextHref}<a href={results.nextHref} rel="next">Next →</a>{:else}<span
					>Next →</span
				>{/if}
		</nav>
	{/snippet}
	{@render pagination()}
	<div class="portraits">
		{#each results.heroes as hero (hero.heroId)}
			<article>
				<a
					class="portrait"
					href={hero.originalUrl}
					target="_blank"
					rel="noreferrer"
					aria-label={`Open ${hero.displayName} original portrait`}
					><img
						src={`${base}${hero.thumbnail}`}
						alt={`${hero.displayName} portrait`}
						width={hero.width}
						height={hero.height}
						loading="lazy"
					/></a
				>
				<div class="caption">
					<p class:approved={hero.collection === 'approved'} class="status">{hero.status}</p>
					<h2>{hero.displayName}</h2>
					<a href={hero.originalUrl} target="_blank" rel="noreferrer">View original ↗</a>
				</div>
			</article>
		{/each}
	</div>
	{#if results.total === 0}<div class="empty">
			<h2>No heroes match this search.</h2>
			<p>Try a shorter name, another hair or wardrobe detail, or all collections.</p>
			<a href={resolve('/wiki/heroes')}>Show all 736 heroes →</a>
		</div>{/if}
	{@render pagination()}
	<footer>
		<a
			href="https://github.com/jmoraispk/summonlab/blob/codex/public-archive-readme/docs/readme-gallery/hero-archive.md"
			>Browse the GitHub galleries and collection notes ↗</a
		><a href={resolve('/wiki/art/living-village-heroes')}>Living Village visual packet →</a>
	</footer>
</main>

<style>
	main {
		max-width: 104rem;
		margin: auto;
		padding: clamp(2rem, 5vw, 5rem);
	}
	header {
		max-width: 55rem;
		margin-bottom: 2rem;
	}
	.eyebrow {
		color: #c58b57;
		font:
			0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.8rem 0 1.2rem;
		font:
			clamp(2.8rem, 5vw, 5rem)/1 Georgia,
			serif;
		letter-spacing: -0.045em;
	}
	.intro {
		color: #d9cbb7;
		font:
			1.15rem/1.7 Georgia,
			serif;
	}
	.note {
		color: #aaa08e;
		font:
			0.9rem/1.6 Georgia,
			serif;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.8rem;
		padding: 1.1rem;
		border: 1px solid var(--line);
		background: #100e09;
	}
	label {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
		flex: 1 1 15rem;
	}
	.search-field {
		flex: 2 1 20rem;
	}
	label > span {
		color: #baa88d;
		font:
			0.67rem ui-monospace,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	input,
	select,
	button {
		min-width: 0;
		min-height: 2.8rem;
		padding: 0.7rem;
		border: 1px solid #564632;
		border-radius: 0.15rem;
		background: #17130d;
		color: var(--paper);
		font:
			0.9rem Georgia,
			serif;
	}
	button {
		padding-inline: 1.3rem;
		background: #c58b57;
		color: #160f08;
		font-weight: bold;
		cursor: pointer;
	}
	.results-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}
	.results-heading p {
		margin: 0;
		color: #d9cbb7;
		font:
			1.1rem Georgia,
			serif;
		overflow-wrap: anywhere;
	}
	.results-heading > span {
		color: #aaa08e;
		font:
			0.72rem ui-monospace,
			monospace;
	}
	.pagination {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		margin: 1rem 0;
		padding: 0.8rem 0;
		border-block: 1px solid var(--line);
		font:
			0.75rem ui-monospace,
			monospace;
	}
	a {
		color: #d9ab79;
		text-decoration: none;
	}
	a:hover {
		color: #f3ead9;
		text-decoration: underline;
	}
	.pagination > span {
		color: #817564;
	}
	.portraits {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
		gap: 1.2rem;
	}
	article {
		min-width: 0;
		border: 1px solid var(--line);
		background: #110f0a;
	}
	.portrait {
		display: flex;
		justify-content: center;
		align-items: center;
		aspect-ratio: 2/3;
		background: radial-gradient(ellipse, #30291c, #15120c);
		overflow: hidden;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.caption {
		padding: 1rem;
	}
	.status {
		min-height: 2.8em;
		margin: 0;
		color: #a99b87;
		font:
			0.64rem/1.5 ui-monospace,
			monospace;
	}
	.status.approved {
		color: #c6b983;
	}
	h2 {
		margin: 0.5rem 0 0.7rem;
		font:
			1.35rem/1.2 Georgia,
			serif;
		overflow-wrap: anywhere;
	}
	.caption > a {
		font:
			0.7rem ui-monospace,
			monospace;
	}
	.empty {
		padding: 3rem 0;
		color: #aaa08e;
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 2rem;
		margin-top: 2rem;
		font:
			0.8rem/1.6 Georgia,
			serif;
	}
	a:focus-visible,
	input:focus-visible,
	select:focus-visible,
	button:focus-visible {
		outline: 2px solid #d9ab79;
		outline-offset: 3px;
	}
	@media (max-width: 550px) {
		main {
			padding: 2rem 1rem;
		}
		.portraits {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.65rem;
		}
		.caption {
			padding: 0.7rem;
		}
		h2 {
			font-size: 1.12rem;
		}
		.status {
			min-height: 4.5em;
			font-size: 0.6rem;
		}
		form button {
			width: 100%;
		}
		.pagination {
			font-size: 0.68rem;
		}
	}
</style>
