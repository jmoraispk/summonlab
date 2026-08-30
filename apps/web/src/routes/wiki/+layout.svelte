<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { data, children } = $props();
	let navigationOpen = $state(false);
	let query = $state('');

	const groups = $derived(
		Object.entries(
			data.navigation.reduce(
				(sections, entry) => {
					if (!entry.title.toLowerCase().includes(query.trim().toLowerCase())) return sections;
					(sections[entry.section] ??= []).push(entry);
					return sections;
				},
				{} as Record<string, typeof data.navigation>
			)
		)
	);
</script>

<svelte:head>
	<meta
		name="description"
		content="The living rulebook, art book, bestiary, and development record for Summonlab."
	/>
</svelte:head>

<div class="wiki-shell">
	<header class="wiki-topbar">
		<a class="wordmark" href={resolve('/wiki')} aria-label="Summonlab wiki home">
			<span>SUMMON</span><b>LAB</b><i>WIKI</i>
		</a>
		<p>{data.pageCount} living documents</p>
		<nav aria-label="Summonlab destinations">
			<a href={resolve('/')}>Enter the game</a>
			<button
				type="button"
				aria-expanded={navigationOpen}
				onclick={() => (navigationOpen = !navigationOpen)}
			>
				{navigationOpen ? 'Close index' : 'Open index'}
			</button>
		</nav>
	</header>

	<aside class:open={navigationOpen} aria-label="Wiki index">
		<label>
			<span>Search the archive</span>
			<input bind:value={query} type="search" placeholder="Heroes, skills, monsters…" />
		</label>
		<div class="nav-scroll">
			{#each groups as [section, entries] (section)}
				<section>
					<h2>{section}</h2>
					{#each entries as entry (entry.href)}
						<a
							href={entry.href}
							aria-current={page.url.pathname === entry.href ? 'page' : undefined}
							onclick={() => (navigationOpen = false)}
						>
							<span>{entry.title}</span><i>{entry.designStatus}</i>
						</a>
					{/each}
				</section>
			{/each}
		</div>
	</aside>

	<div class="wiki-page">{@render children()}</div>
</div>

<style>
	:global(body) {
		background: #090805;
		color: #f3ead9;
	}
	.wiki-shell {
		--paper: #f3ead9;
		--muted: #aaa08e;
		--ember: #d4773d;
		--line: rgba(231, 206, 164, 0.14);
		min-height: 100svh;
		background:
			radial-gradient(circle at 78% 8%, rgba(155, 71, 34, 0.1), transparent 28rem), #090805;
	}
	.wiki-topbar {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		width: 100%;
		height: 4.5rem;
		padding: 0 1.5rem;
		border-bottom: 1px solid var(--line);
		background: rgba(9, 8, 5, 0.91);
		backdrop-filter: blur(18px);
	}
	.wordmark {
		display: flex;
		align-items: baseline;
		gap: 0;
		color: var(--paper);
		font-family: Georgia, serif;
		font-size: 1rem;
		letter-spacing: 0.16em;
		text-decoration: none;
	}
	.wordmark b {
		color: var(--ember);
		font-weight: 600;
	}
	.wordmark i {
		margin-left: 0.8rem;
		padding-left: 0.8rem;
		border-left: 1px solid var(--line);
		color: var(--muted);
		font-family: ui-monospace, monospace;
		font-size: 0.55rem;
		font-style: normal;
		letter-spacing: 0.2em;
	}
	.wiki-topbar > p {
		margin: 0 0 0 1.25rem;
		color: rgba(243, 234, 217, 0.38);
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.wiki-topbar nav {
		display: flex;
		align-items: center;
		gap: 1.2rem;
		margin-left: auto;
	}
	.wiki-topbar nav a,
	.wiki-topbar nav button {
		border: 0;
		background: transparent;
		color: var(--paper);
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.13em;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}
	.wiki-topbar nav button {
		display: none;
	}
	aside {
		position: fixed;
		top: 4.5rem;
		bottom: 0;
		left: 0;
		z-index: 20;
		width: 18rem;
		padding: 1.25rem 0 2rem;
		border-right: 1px solid var(--line);
		background: #0c0b08;
	}
	aside label {
		display: block;
		padding: 0 1.1rem 1rem;
	}
	aside label span {
		display: block;
		margin-bottom: 0.55rem;
		color: var(--muted);
		font:
			0.54rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	aside input {
		width: 100%;
		padding: 0.7rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: 0.2rem;
		background: rgba(255, 255, 255, 0.025);
		color: var(--paper);
		font-size: 0.75rem;
	}
	.nav-scroll {
		height: calc(100% - 4.5rem);
		overflow: auto;
		padding: 0 0.7rem 3rem;
	}
	aside section + section {
		margin-top: 1.25rem;
	}
	aside h2 {
		margin: 0 0 0.35rem;
		padding: 0 0.45rem;
		color: #8a694c;
		font:
			0.54rem ui-monospace,
			monospace;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	aside section a {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		justify-content: space-between;
		padding: 0.55rem 0.45rem;
		border-left: 2px solid transparent;
		color: rgba(243, 234, 217, 0.68);
		font-family: Georgia, serif;
		font-size: 0.76rem;
		line-height: 1.25;
		text-decoration: none;
	}
	aside section a:hover,
	aside section a[aria-current='page'] {
		border-left-color: var(--ember);
		color: var(--paper);
		background: linear-gradient(90deg, rgba(212, 119, 61, 0.09), transparent);
	}
	aside section a i {
		flex: 0 0 auto;
		color: rgba(243, 234, 217, 0.28);
		font:
			0.44rem ui-monospace,
			monospace;
		font-style: normal;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.wiki-page {
		min-height: 100svh;
		padding-top: 4.5rem;
		padding-left: 18rem;
	}
	@media (max-width: 860px) {
		.wiki-topbar {
			padding: 0 1rem;
		}
		.wiki-topbar > p,
		.wiki-topbar nav > a {
			display: none;
		}
		.wiki-topbar nav button {
			display: block;
		}
		aside {
			width: min(22rem, 88vw);
			transform: translateX(-102%);
			transition: transform 180ms ease;
			box-shadow: 1rem 0 4rem rgba(0, 0, 0, 0.55);
		}
		aside.open {
			transform: translateX(0);
		}
		.wiki-page {
			padding-left: 0;
		}
	}
</style>
