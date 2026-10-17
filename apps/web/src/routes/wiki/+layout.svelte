<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';

	let { data, children } = $props();
	let navigationOpen = $state(false);
	let query = $state('');
	let indexToggle: HTMLButtonElement;

	type NavigationEntry = (typeof data.navigation)[number];
	type NavigationSection = {
		name: string;
		overview: NavigationEntry | undefined;
		entries: NavigationEntry[];
	};

	const sectionOrder = [
		'Systems',
		'Mechanics',
		'Monsters',
		'Art book',
		'Milestones',
		'Roadmap',
		'Principles'
	];

	const sections = $derived.by(() => {
		const term = query.trim().toLowerCase();
		const buckets = new SvelteMap<
			string,
			{ direct: NavigationEntry[]; groups: SvelteMap<string, NavigationEntry[]> }
		>();

		for (const entry of data.navigation) {
			const bucket = buckets.get(entry.section) ?? {
				direct: [] as NavigationEntry[],
				groups: new SvelteMap<string, NavigationEntry[]>()
			};
			if (entry.group) {
				const group = bucket.groups.get(entry.group) ?? [];
				group.push(entry);
				bucket.groups.set(entry.group, group);
			} else {
				bucket.direct.push(entry);
			}
			buckets.set(entry.section, bucket);
		}

		return [...buckets.entries()]
			.sort(([left], [right]) => {
				const leftIndex = sectionOrder.indexOf(left);
				const rightIndex = sectionOrder.indexOf(right);
				return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
			})
			.flatMap(([name, bucket]): NavigationSection[] => {
				const direct = bucket.direct
					.filter((entry) => matchesQuery(entry, term))
					.sort(compareEntries);
				const groups = [...bucket.groups.entries()]
					.map(([groupName, allEntries]): NavigationSection => {
						const overview = allEntries.find(
							(candidate) =>
								allEntries.length > 1 &&
								allEntries.every(
									(entry) => entry === candidate || entry.href.startsWith(`${candidate.href}/`)
								)
						);
						const entries = allEntries
							.filter((entry) => entry !== overview && matchesQuery(entry, term))
							.sort(compareEntries);
						return { name: groupName, overview, entries };
					})
					.filter(
						(group) =>
							group.entries.length > 0 || (group.overview && matchesQuery(group.overview, term))
					)
					.sort((left, right) => left.name.localeCompare(right.name));
				return [
					...(direct.length > 0 ? [{ name, overview: undefined, entries: direct }] : []),
					...groups
				];
			});
	});

	function matchesQuery(entry: NavigationEntry, term: string): boolean {
		return `${entry.section} ${entry.group ?? ''} ${entry.title} ${entry.searchTerms}`
			.toLowerCase()
			.includes(term);
	}

	function sectionEntries(section: NavigationSection): NavigationEntry[] {
		return section.overview ? [section.overview, ...section.entries] : section.entries;
	}

	function closeIndex(restoreFocus = false): void {
		navigationOpen = false;
		if (restoreFocus) indexToggle?.focus();
	}

	function containsCurrent(entries: NavigationEntry[]): boolean {
		return entries.some(
			(entry) =>
				page.url.pathname === entry.href ||
				(entry.href === '/wiki/creatures/monsters' &&
					page.url.pathname.startsWith(`${entry.href}/`))
		);
	}

	function compareEntries(left: NavigationEntry, right: NavigationEntry): number {
		const depthDifference = left.href.split('/').length - right.href.split('/').length;
		return depthDifference || left.title.localeCompare(right.title);
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && navigationOpen) closeIndex(true);
	}}
/>

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
				bind:this={indexToggle}
				aria-controls="wiki-index"
				aria-expanded={navigationOpen}
				onclick={() => (navigationOpen = !navigationOpen)}
			>
				{navigationOpen ? 'Close index' : 'Open index'}
			</button>
		</nav>
	</header>

	{#if navigationOpen}
		<button
			class="index-backdrop"
			type="button"
			aria-label="Dismiss wiki index"
			onclick={() => closeIndex(true)}
		></button>
	{/if}
	<aside id="wiki-index" class:open={navigationOpen} aria-label="Wiki index">
		<label>
			<span>Search the archive</span>
			<input bind:value={query} type="search" placeholder="Heroes, skills, monsters…" />
		</label>
		<div class="nav-scroll">
			<nav class="nav-shortcuts" aria-label="Wiki shortcuts">
				<a
					href={resolve('/wiki')}
					onclick={() => closeIndex()}
					aria-current={page.url.pathname === '/wiki' ? 'page' : undefined}
				>
					<span>Archive home</span><i>Start</i>
				</a>
				<a
					href={resolve('/wiki/heroes')}
					onclick={() => closeIndex()}
					aria-current={page.url.pathname === '/wiki/heroes' ? 'page' : undefined}
				>
					<span>Hero archive</span><i>736 identities</i>
				</a>
				<a href={resolve('/wiki/art/living-village-heroes')} onclick={() => closeIndex()}>
					<span>Living Village</span><i>Visual packet</i>
				</a>
				<a href={resolve('/wiki/creatures/monsters')} onclick={() => closeIndex()}>
					<span>Monster database</span><i>190 forms</i>
				</a>
			</nav>
			<p class="nav-label">Library</p>
			{#each sections as section (section.name)}
				<details
					class="nav-section"
					open={query.trim().length > 0 ||
						containsCurrent(sectionEntries(section)) ||
						(section.name === 'Systems' && page.url.pathname === '/wiki')}
				>
					<summary>
						<span>{section.name}</span><i>{sectionEntries(section).length}</i>
					</summary>
					<div class="section-entries">
						{#if section.overview}
							<a
								class="group-overview"
								href={section.overview.href}
								aria-label={`${section.name} overview`}
								aria-current={page.url.pathname === section.overview.href ? 'page' : undefined}
								onclick={() => closeIndex()}><span>Overview</span></a
							>
						{/if}
						{#each section.entries as entry (entry.href)}
							<a
								href={entry.href}
								aria-current={page.url.pathname === entry.href ? 'page' : undefined}
								onclick={() => closeIndex()}
							>
								<span>{entry.title}</span>
							</a>
						{/each}
					</div>
				</details>
			{/each}
			{#if sections.length === 0}<p class="nav-empty">No pages match “{query}”.</p>{/if}
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
		font-size: 1.12rem;
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
		font-size: 0.68rem;
		font-style: normal;
		letter-spacing: 0.2em;
	}
	.wiki-topbar > p {
		margin: 0 0 0 1.25rem;
		color: rgba(243, 234, 217, 0.38);
		font:
			0.68rem ui-monospace,
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
			0.72rem ui-monospace,
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
		display: flex;
		flex-direction: column;
		width: 22rem;
		padding: 1.25rem 0 0;
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
			0.66rem ui-monospace,
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
		font-size: 0.9rem;
	}
	.nav-scroll {
		min-height: 0;
		flex: 1;
		overflow: auto;
		overscroll-behavior: contain;
		padding: 0 0.7rem 3rem;
	}
	.nav-shortcuts {
		display: grid;
		gap: 0.2rem;
		margin-bottom: 1.35rem;
		padding-bottom: 1.1rem;
		border-bottom: 1px solid var(--line);
	}
	.nav-shortcuts a,
	.section-entries > a {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		justify-content: space-between;
		min-height: 2.75rem;
		padding: 0.65rem 0.65rem;
		color: rgba(243, 234, 217, 0.78);
		font-family: Georgia, serif;
		font-size: 0.96rem;
		line-height: 1.45;
		overflow-wrap: anywhere;
		text-decoration: none;
	}
	.nav-shortcuts a {
		padding: 0.65rem;
		border: 1px solid transparent;
		background: rgba(255, 255, 255, 0.018);
	}
	.nav-shortcuts a:first-child {
		border-color: rgba(212, 119, 61, 0.18);
	}
	.nav-shortcuts a:hover,
	.nav-shortcuts a[aria-current='page'],
	.section-entries > a:hover,
	.section-entries > a[aria-current='page'] {
		box-shadow: inset 2px 0 var(--ember);
		color: var(--paper);
		background: linear-gradient(90deg, rgba(212, 119, 61, 0.09), transparent);
	}
	.nav-shortcuts a i {
		flex: 0 0 auto;
		color: rgba(243, 234, 217, 0.28);
		font:
			0.56rem ui-monospace,
			monospace;
		font-style: normal;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.nav-label {
		margin: 0 0 0.6rem;
		padding: 0 0.45rem;
		color: #72563f;
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	.nav-section {
		border-top: 1px solid rgba(231, 206, 164, 0.08);
	}
	.nav-section:last-of-type {
		border-bottom: 1px solid rgba(231, 206, 164, 0.08);
	}
	.nav-section summary {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-height: 2.75rem;
		padding: 0.8rem 1.6rem 0.8rem 0.65rem;
		list-style: none;
		cursor: pointer;
		user-select: none;
	}
	.nav-section summary::-webkit-details-marker {
		display: none;
	}
	.nav-section > summary::after {
		position: absolute;
		right: 0.45rem;
		content: '›';
		color: #8a694c;
		font-size: 1rem;
		transform: rotate(0deg);
		transition: transform 140ms ease;
	}
	.nav-section[open] > summary::after {
		transform: rotate(90deg);
	}
	.nav-section > summary span {
		color: #aa7a53;
		font:
			0.7rem ui-monospace,
			monospace;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.nav-section summary i {
		margin-left: auto;
		color: rgba(243, 234, 217, 0.24);
		font:
			0.58rem ui-monospace,
			monospace;
		font-style: normal;
	}
	.section-entries {
		padding: 0 0 0.55rem;
	}
	.section-entries .group-overview {
		color: var(--muted);
		font:
			0.72rem ui-monospace,
			monospace;
		letter-spacing: 0.04em;
	}
	.section-entries a[aria-current='page'] {
		background: rgba(212, 119, 61, 0.14);
	}
	a:focus-visible,
	button:focus-visible,
	input:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--ember);
		outline-offset: -2px;
	}
	.index-backdrop {
		display: none;
	}
	.nav-empty {
		margin: 1.2rem 0.45rem;
		color: var(--muted);
		font-family: Georgia, serif;
		font-size: 0.95rem;
		font-style: italic;
	}
	.wiki-page {
		min-height: 100svh;
		padding-top: 4.5rem;
		padding-left: 22rem;
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
			display: none;
			width: min(22rem, 90vw);
			box-shadow: 1rem 0 4rem rgba(0, 0, 0, 0.55);
		}
		aside.open {
			display: flex;
		}
		.index-backdrop {
			position: fixed;
			inset: 4.5rem 0 0;
			z-index: 19;
			display: block;
			border: 0;
			background: rgba(0, 0, 0, 0.65);
		}
		.wiki-page {
			padding-left: 0;
		}
	}
</style>
