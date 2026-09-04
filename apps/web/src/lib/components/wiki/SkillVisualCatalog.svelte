<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { tick } from 'svelte';

	import type { SkillVisualCatalogRecord } from '$lib/server/skill-visual-catalog';

	import {
		EMPTY_SKILL_CATALOG_FILTERS,
		SKILL_CATALOG_PAGE_SIZE,
		compatibleSkillCatalogOptions,
		filterSkillVisualCatalog,
		normalizeSkillCatalogFilters,
		parseSkillCatalogQuery,
		serializeSkillCatalogQuery,
		type SkillCatalogFilters
	} from './skill-visual-catalog-model';

	let { records }: { records: readonly SkillVisualCatalogRecord[] } = $props();

	let filters = $state<SkillCatalogFilters>({ ...EMPTY_SKILL_CATALOG_FILTERS });
	let visibleCount = $state(SKILL_CATALOG_PAGE_SIZE);
	let searchInput: HTMLInputElement;
	let focusTargetId = $state<string | null>(null);
	let queryInitialized = false;

	const filterOptions = $derived(compatibleSkillCatalogOptions(records, filters));
	const matchingRecords = $derived(filterSkillVisualCatalog(records, filters));
	const visibleRecords = $derived(matchingRecords.slice(0, visibleCount));
	const hasFilters = $derived(serializeSkillCatalogQuery(filters) !== '');
	const remainingCount = $derived(matchingRecords.length - visibleRecords.length);
	const nextBatchCount = $derived(Math.min(SKILL_CATALOG_PAGE_SIZE, remainingCount));

	function replaceQuery(nextFilters: SkillCatalogFilters): void {
		if (!browser) return;
		const query = serializeSkillCatalogQuery(nextFilters);
		const pathname = resolve('/wiki/[...slug]', { slug: 'mechanics/skills/visual-catalog' });
		const url = `${pathname}${query ? `?${query}` : ''}${window.location.hash}`;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the route pathname is resolved above before query and hash state are appended
		replaceState(url, page.state);
	}

	function applyFilters(nextFilters: SkillCatalogFilters): void {
		focusTargetId = null;
		filters = normalizeSkillCatalogFilters(records, nextFilters);
		visibleCount = SKILL_CATALOG_PAGE_SIZE;
		replaceQuery(filters);
	}

	function updateSearch(q: string): void {
		focusTargetId = null;
		filters = { ...filters, q };
		visibleCount = SKILL_CATALOG_PAGE_SIZE;
		replaceQuery(filters);
	}

	function clearSearch(): void {
		updateSearch('');
		searchInput.focus();
	}

	function clearFilters(): void {
		applyFilters({ ...EMPTY_SKILL_CATALOG_FILTERS });
	}

	function skillHeadingId(targetId: string): string {
		return `skill-catalog-${targetId.replaceAll(':', '-')}`;
	}

	async function loadMore(): Promise<void> {
		const firstAppended = matchingRecords[visibleRecords.length];
		if (!firstAppended) return;
		focusTargetId = firstAppended.targetId;
		visibleCount = Math.min(visibleCount + SKILL_CATALOG_PAGE_SIZE, matchingRecords.length);
		await tick();
		document.getElementById(skillHeadingId(firstAppended.targetId))?.focus({ preventScroll: true });
	}

	afterNavigate(() => {
		if (queryInitialized) return;
		queryInitialized = true;
		filters = parseSkillCatalogQuery(window.location.search, records);
		visibleCount = SKILL_CATALOG_PAGE_SIZE;
	});
</script>

<section class="skill-catalog" aria-labelledby="skill-catalog-heading">
	<header class="catalog-intro">
		<p>Canonical archive · 456 candidate emblems</p>
		<h1 id="skill-catalog-heading">Skill visual catalog</h1>
		<div>
			<span>
				Domain → Family owns each skill; optional labels narrow compatibility without creating a
				second hierarchy.
			</span>
			<a href={resolve('/wiki/mechanics/skills')}>Explore the interactive skill tree</a>
		</div>
	</header>

	<form class="catalog-controls" onsubmit={(event) => event.preventDefault()}>
		<label class="search-control">
			<span>Search skills</span>
			<div>
				<input
					bind:this={searchInput}
					type="search"
					value={filters.q}
					placeholder="Name, label, effect…"
					oninput={(event) => updateSearch(event.currentTarget.value)}
				/>
				{#if filters.q}
					<button type="button" class="clear-search" onclick={clearSearch} aria-label="Clear search"
						>×</button
					>
				{/if}
			</div>
		</label>

		<label>
			<span>Domain</span>
			<select
				value={filters.domain}
				onchange={(event) =>
					applyFilters({
						...filters,
						domain: event.currentTarget.value as SkillCatalogFilters['domain']
					})}
			>
				<option value="">All domains</option>
				<option value="Martial">Martial</option>
				<option value="Magical">Magical</option>
				<option value="Craft">Craft</option>
			</select>
		</label>

		<label>
			<span>Family</span>
			<select
				value={filters.family}
				onchange={(event) => applyFilters({ ...filters, family: event.currentTarget.value })}
			>
				<option value="">All families</option>
				{#each filterOptions.families as family (family)}
					<option value={family}>{family}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Motif family</span>
			<select
				value={filters.motif}
				onchange={(event) => applyFilters({ ...filters, motif: event.currentTarget.value })}
			>
				<option value="">All motifs</option>
				{#each filterOptions.motifs as motif (motif)}
					<option value={motif}>{motif}</option>
				{/each}
			</select>
		</label>

		{#if hasFilters}
			<button type="button" class="clear-filters" onclick={clearFilters}>Clear filters</button>
		{/if}
	</form>

	<p class="result-count" role="status" aria-live="polite" aria-atomic="true">
		{matchingRecords.length}
		{matchingRecords.length === 1 ? 'skill' : 'skills'}
		· {matchingRecords.length === 0
			? 'Showing 0'
			: visibleRecords.length === 1
				? 'Showing 1'
				: `Showing 1–${visibleRecords.length}`}
	</p>

	{#if matchingRecords.length === 0}
		<div class="no-results">
			<p>No skills match these filters.</p>
			<button type="button" onclick={clearFilters}>Clear filters</button>
		</div>
	{:else}
		<div class="skill-grid">
			{#each visibleRecords as skill (skill.targetId)}
				<article class="skill-card">
					<div class="image-well">
						<img
							src={skill.image.publicPath}
							alt={`${skill.name} skill emblem`}
							width="512"
							height="512"
							loading="lazy"
							decoding="async"
						/>
					</div>
					<header>
						<p>{skill.domain} <span aria-hidden="true">→</span> {skill.family}</p>
						<!-- Deliberate programmatic focus target after incremental reveal. -->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<h2
							id={skillHeadingId(skill.targetId)}
							tabindex={skill.targetId === focusTargetId ? -1 : undefined}
						>
							{skill.name}
						</h2>
						{#if skill.labels.length > 0}
							<ul aria-label="Compatibility labels">
								{#each skill.labels as label (`${label.namespace}:${label.value}`)}
									<li>{label.namespace}: {label.value}</li>
								{/each}
							</ul>
						{/if}
					</header>
					<p class="skill-type">{skill.type}</p>
					<dl class="skill-definitions">
						<div>
							<dt>Acquisition</dt>
							<dd>{skill.acquisition}</dd>
						</div>
						<div>
							<dt>Effect</dt>
							<dd>{skill.effect.replaceAll('**', '')}</dd>
						</div>
						<div>
							<dt>Motif family</dt>
							<dd><code>{skill.motifFamily}</code></dd>
						</div>
						{#if skill.primaryVisualParent}
							<div>
								<dt>Visual parent</dt>
								<dd>{skill.primaryVisualParent.name}</dd>
							</div>
						{/if}
					</dl>
					<details>
						<summary>Production provenance</summary>
						<dl>
							<div>
								<dt>Target ID</dt>
								<dd><code>{skill.targetId}</code></dd>
							</div>
							<div>
								<dt>Status</dt>
								<dd>{skill.provenance.status}</dd>
							</div>
							<div>
								<dt>Source PNG</dt>
								<dd><code>{skill.provenance.sourcePath}</code></dd>
							</div>
							<div>
								<dt>Runtime derivative</dt>
								<dd><code>{skill.provenance.runtimePath}</code></dd>
							</div>
						</dl>
					</details>
				</article>
			{/each}
		</div>
	{/if}

	{#if visibleRecords.length < matchingRecords.length}
		<button type="button" class="load-more" onclick={loadMore}>
			Load {nextBatchCount} more · {remainingCount} skills remaining
		</button>
	{/if}
</section>

<style>
	.skill-catalog {
		--catalog-background: #090805;
		--catalog-surface: #0c0b08;
		--catalog-paper: #f3ead9;
		--catalog-muted: #aaa08e;
		--catalog-ember: #d4773d;
		--catalog-focus: #e5aa73;
		--catalog-line: rgba(231, 206, 164, 0.14);
		container-type: inline-size;
		color: var(--catalog-paper);
	}

	.catalog-intro {
		padding: 2.8rem 0 2rem;
		border-bottom: 1px solid var(--catalog-line);
	}

	.catalog-intro > p,
	.catalog-controls label > span,
	.result-count,
	.skill-card header > p,
	.skill-card header li,
	.skill-type,
	dt,
	summary,
	button {
		font-family: ui-monospace, monospace;
	}

	.catalog-intro > p {
		margin: 0 0 0.85rem;
		color: var(--catalog-ember);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.catalog-intro h1 {
		margin: 0;
		font:
			400 clamp(3rem, 6vw, 5.4rem) / 0.94 Georgia,
			serif;
		letter-spacing: -0.05em;
	}

	.catalog-intro > div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1.5rem;
		margin-top: 1.35rem;
	}

	.catalog-intro span {
		max-width: 43rem;
		color: rgba(243, 234, 217, 0.72);
		font:
			1.08rem/1.6 Georgia,
			serif;
	}

	.catalog-intro a {
		flex: 0 0 auto;
		color: var(--catalog-focus);
		font:
			0.7rem/1.4 ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-underline-offset: 0.25em;
		text-transform: uppercase;
	}

	.catalog-controls {
		display: grid;
		grid-template-columns: minmax(12rem, 1.7fr) repeat(3, minmax(9rem, 1fr));
		gap: 1px;
		margin-top: 2rem;
		border: 1px solid var(--catalog-line);
		background: var(--catalog-line);
	}

	.catalog-controls label {
		min-width: 0;
		padding: 0.7rem;
		background: var(--catalog-surface);
	}

	.catalog-controls label > span {
		display: block;
		margin-bottom: 0.5rem;
		color: var(--catalog-muted);
		font-size: 0.61rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.search-control > div {
		position: relative;
	}

	input,
	select {
		width: 100%;
		min-height: 2.5rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--catalog-line);
		border-radius: 0.2rem;
		background: var(--catalog-background);
		color: var(--catalog-paper);
		font:
			0.82rem ui-monospace,
			monospace;
	}

	.search-control input {
		padding-right: 2.7rem;
	}

	.clear-search {
		position: absolute;
		top: 0;
		right: 0;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--catalog-muted);
		font-size: 1.25rem;
	}

	button {
		min-height: 2.5rem;
		border: 1px solid var(--catalog-line);
		border-radius: 0.2rem;
		background: var(--catalog-background);
		color: var(--catalog-focus);
		cursor: pointer;
	}

	button:hover {
		border-color: rgba(229, 170, 115, 0.55);
		color: var(--catalog-paper);
	}

	input:focus-visible,
	select:focus-visible,
	button:focus-visible,
	summary:focus-visible,
	.catalog-intro a:focus-visible {
		outline: 2px solid var(--catalog-focus);
		outline-offset: 2px;
	}

	.clear-filters {
		grid-column: 1 / -1;
		min-height: 2.5rem;
		border: 0;
		border-top: 1px solid var(--catalog-line);
		border-radius: 0;
		text-decoration: underline;
		text-underline-offset: 0.22em;
	}

	.result-count {
		margin: 1.15rem 0;
		color: var(--catalog-muted);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.skill-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1px;
		border: 1px solid var(--catalog-line);
		background: var(--catalog-line);
	}

	.skill-card {
		display: flex;
		min-width: 0;
		flex-direction: column;
		background: var(--catalog-surface);
	}

	.image-well {
		aspect-ratio: 1;
		background: #090805;
	}

	.image-well img {
		display: block;
		width: 100%;
		height: 100%;
		aspect-ratio: 1;
		object-fit: contain;
	}

	.skill-card > header,
	.skill-card > .skill-type,
	.skill-card > .skill-definitions,
	.skill-card > details {
		margin: 0;
		padding: 0.9rem;
		border-top: 1px solid var(--catalog-line);
	}

	.skill-card header > p {
		margin: 0;
		color: var(--catalog-ember);
		font-size: 0.6rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.skill-card h2 {
		margin: 0.35rem 0 0;
		font:
			400 1.32rem/1.08 Georgia,
			serif;
		letter-spacing: -0.025em;
	}

	.skill-card header ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.65rem;
		margin: 0.65rem 0 0;
		padding: 0;
		list-style: none;
	}

	.skill-card header li {
		color: var(--catalog-muted);
		font-size: 0.58rem;
		line-height: 1.4;
	}

	.skill-type {
		color: var(--catalog-focus);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.skill-definitions,
	details dl {
		display: grid;
		gap: 0.75rem;
	}

	.skill-definitions > div,
	details dl > div {
		min-width: 0;
	}

	dt {
		margin-bottom: 0.2rem;
		color: var(--catalog-muted);
		font-size: 0.57rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	dd {
		margin: 0;
		color: rgba(243, 234, 217, 0.75);
		font:
			0.88rem/1.5 Georgia,
			serif;
		overflow-wrap: anywhere;
	}

	code {
		color: rgba(243, 234, 217, 0.68);
		font:
			0.68rem/1.45 ui-monospace,
			monospace;
	}

	.skill-card details {
		margin-top: auto;
		color: var(--catalog-muted);
	}

	summary {
		min-height: 2.5rem;
		padding: 0.65rem 0;
		font-size: 0.61rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	details dl {
		margin: 0.75rem 0 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--catalog-line);
	}

	.no-results {
		padding: 3rem 1rem;
		border: 1px solid var(--catalog-line);
		background: var(--catalog-surface);
		text-align: center;
	}

	.no-results p {
		margin: 0 0 1rem;
		color: var(--catalog-muted);
		font:
			1rem Georgia,
			serif;
	}

	.no-results button,
	.load-more {
		padding: 0.65rem 1rem;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.load-more {
		display: block;
		width: 100%;
		margin-top: 1rem;
	}

	@container (max-width: 64rem) {
		.catalog-controls {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.skill-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@container (max-width: 52rem) {
		.catalog-intro > div {
			align-items: flex-start;
			flex-direction: column;
		}

		.skill-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@container (max-width: 30rem) {
		.catalog-intro h1 {
			font-size: clamp(2.7rem, 14vw, 3.5rem);
		}

		.catalog-controls,
		.skill-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			transition-duration: 0.01ms !important;
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
		}
	}
</style>
