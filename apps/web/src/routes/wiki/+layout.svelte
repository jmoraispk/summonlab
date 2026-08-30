<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';

	let { data, children } = $props();
	let navigationOpen = $state(false);
	let query = $state('');

	type NavigationEntry = (typeof data.navigation)[number];
	type NavigationSection = {
		name: string;
		direct: NavigationEntry[];
		groups: { name: string; entries: NavigationEntry[] }[];
		allEntries: NavigationEntry[];
	};

	const sectionOrder = [
		'Systems',
		'Mechanics',
		'Creatures',
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
			const searchable = `${entry.section} ${entry.group ?? ''} ${entry.title}`.toLowerCase();
			if (term && !searchable.includes(term)) continue;

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
			.map(([name, bucket]): NavigationSection => ({
				name,
				direct: bucket.direct.sort(compareEntries),
				groups: [...bucket.groups.entries()]
					.map(([groupName, entries]) => ({
						name: groupName,
						entries: entries.sort(compareEntries)
					}))
					.sort((left, right) => left.name.localeCompare(right.name)),
				allEntries: [...bucket.direct, ...bucket.groups.values()].flat()
			}))
			.sort((left, right) => {
				const leftIndex = sectionOrder.indexOf(left.name);
				const rightIndex = sectionOrder.indexOf(right.name);
				return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
			});
	});

	function containsCurrent(entries: NavigationEntry[]): boolean {
		return entries.some((entry) => page.url.pathname === entry.href);
	}

	function compareEntries(left: NavigationEntry, right: NavigationEntry): number {
		const depthDifference = left.href.split('/').length - right.href.split('/').length;
		return depthDifference || left.title.localeCompare(right.title);
	}
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
			<nav class="nav-shortcuts" aria-label="Wiki shortcuts">
				<a
					href={resolve('/wiki')}
					aria-current={page.url.pathname === '/wiki' ? 'page' : undefined}
				>
					<span>Archive home</span><i>Start</i>
				</a>
				<a href={resolve('/wiki/art/living-village-heroes')}>
					<span>Living Village</span><i>Visual packet</i>
				</a>
			</nav>
			<p class="nav-label">Library</p>
			{#each sections as section (section.name)}
				<details
					class="nav-section"
					open={query.trim().length > 0 ||
						containsCurrent(section.allEntries) ||
						(section.name === 'Systems' && page.url.pathname === '/wiki')}
				>
					<summary>
						<span>{section.name}</span><i>{section.allEntries.length}</i>
					</summary>
					<div class="section-entries">
						{#each section.direct as entry (entry.href)}
							<a
								href={entry.href}
								aria-current={page.url.pathname === entry.href ? 'page' : undefined}
								onclick={() => (navigationOpen = false)}
							>
								<span>{entry.title}</span><i>{entry.designStatus}</i>
							</a>
						{/each}
						{#each section.groups as group (group.name)}
							<details
								class="nav-subsection"
								open={query.trim().length > 0 || containsCurrent(group.entries)}
							>
								<summary><span>{group.name}</span><i>{group.entries.length}</i></summary>
								<div>
									{#each group.entries as entry (entry.href)}
										<a
											href={entry.href}
											aria-current={page.url.pathname === entry.href ? 'page' : undefined}
											onclick={() => (navigationOpen = false)}
										>
											<span>{entry.title}</span><i>{entry.designStatus}</i>
										</a>
									{/each}
								</div>
							</details>
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
		width: 22rem;
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
		height: calc(100% - 4.5rem);
		overflow: auto;
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
	.section-entries > a,
	.nav-subsection a {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		justify-content: space-between;
		padding: 0.55rem 0.45rem;
		border-left: 2px solid transparent;
		color: rgba(243, 234, 217, 0.68);
		font-family: Georgia, serif;
		font-size: 0.9rem;
		line-height: 1.25;
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
	.section-entries > a[aria-current='page'],
	.nav-subsection a:hover,
	.nav-subsection a[aria-current='page'] {
		border-left-color: var(--ember);
		color: var(--paper);
		background: linear-gradient(90deg, rgba(212, 119, 61, 0.09), transparent);
	}
	.nav-shortcuts a i,
	.section-entries > a i,
	.nav-subsection a i {
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
	.nav-section summary,
	.nav-subsection summary {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.75rem 1.5rem 0.75rem 0.45rem;
		list-style: none;
		cursor: pointer;
		user-select: none;
	}
	.nav-section summary::-webkit-details-marker,
	.nav-subsection summary::-webkit-details-marker {
		display: none;
	}
	.nav-section > summary::after,
	.nav-subsection > summary::after {
		position: absolute;
		right: 0.45rem;
		content: '›';
		color: #8a694c;
		font-size: 1rem;
		transform: rotate(0deg);
		transition: transform 140ms ease;
	}
	.nav-section[open] > summary::after,
	.nav-subsection[open] > summary::after {
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
	.nav-subsection {
		margin: 0.15rem 0 0.15rem 0.4rem;
		border-left: 1px solid rgba(231, 206, 164, 0.1);
	}
	.nav-subsection > summary {
		padding-top: 0.55rem;
		padding-bottom: 0.55rem;
	}
	.nav-subsection > summary span {
		color: rgba(243, 234, 217, 0.52);
		font:
			0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.nav-subsection > div {
		padding: 0 0 0.4rem 0.25rem;
	}
	.nav-subsection a {
		font-size: 0.84rem;
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
