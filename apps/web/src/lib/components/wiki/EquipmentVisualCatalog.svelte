<script lang="ts">
	import { tick } from 'svelte';
	import type { EquipmentWikiRecord } from '$lib/server/equipment-wiki-catalog';

	import {
		EQUIPMENT_RANKS,
		equipmentCatalogPage,
		type EquipmentCatalogFilters
	} from './equipment-visual-catalog-model';

	let { records }: { records: readonly EquipmentWikiRecord[] } = $props();
	let filters = $state<EquipmentCatalogFilters>({
		view: 'sets',
		q: '',
		rank: '',
		equipmentClass: ''
	});
	let requestedPage = $state(1);
	let resultCount: HTMLParagraphElement | undefined;
	const result = $derived(equipmentCatalogPage(records, filters, requestedPage));
	const classes = $derived([
		...new Map(
			records
				.filter((record) => (record.role === 'armor-set-reference') === (filters.view === 'sets'))
				.map((record) => [record.equipmentClass, record.className])
		).entries()
	]);
	const groups = $derived(
		EQUIPMENT_RANKS.map((rank) => ({
			rank,
			records: result.records.filter((record) => record.rank === rank)
		})).filter((group) => group.records.length)
	);
	const rankNames: Record<string, string> = {
		F: 'Common',
		E: 'Uncommon',
		D: 'Rare',
		C: 'Epic',
		B: 'Mythic',
		A: 'Fabled',
		S: 'Legendary'
	};
	const hasFilters = $derived(Boolean(filters.q || filters.rank || filters.equipmentClass));

	function update(next: Partial<EquipmentCatalogFilters>): void {
		filters = { ...filters, ...next };
		requestedPage = 1;
	}

	function changeView(view: EquipmentCatalogFilters['view']): void {
		update({ view, q: '', equipmentClass: '' });
	}

	async function revealResults(): Promise<void> {
		await tick();
		resultCount?.focus({ preventScroll: true });
		resultCount?.scrollIntoView({ block: 'start' });
	}

	async function showPiece(assetKey: string): Promise<void> {
		const piece = records.find((record) => record.assetKey === assetKey);
		if (!piece) return;
		update({ view: 'items', q: piece.name, rank: '', equipmentClass: '' });
		await revealResults();
	}

	async function showPage(page: number): Promise<void> {
		requestedPage = page;
		await revealResults();
	}
</script>

<section class="equipment-catalog" aria-label="Equipment artwork">
	<header class="catalog-intro">
		<p>Approved equipment archive · 168 images</p>
		<h1>Equipment</h1>
		<div class="intro-copy">
			<p>
				Explore the complete armor sets, then inspect the weapons, armor pieces, shields, and staffs
				behind each rank.
			</p>
			<p>21 complete sets · 140 runtime items · 7 Greatsword artwork references</p>
		</div>
	</header>

	<div class="view-controls" role="group" aria-label="Equipment gallery view">
		<button type="button" aria-pressed={filters.view === 'sets'} onclick={() => changeView('sets')}
			>Complete armor sets · 21</button
		>
		<button
			type="button"
			aria-pressed={filters.view === 'items'}
			onclick={() => changeView('items')}>Individual items · 147</button
		>
	</div>
	<form class="catalog-controls" onsubmit={(event) => event.preventDefault()}>
		<label class="search-control">
			<span>Search equipment</span>
			<input
				type="search"
				placeholder="Material, item, armor class…"
				value={filters.q}
				oninput={(event) => update({ q: event.currentTarget.value })}
			/>
		</label>
		<label>
			<span>Rank</span>
			<select
				aria-label="Rank"
				value={filters.rank}
				onchange={(event) => update({ rank: event.currentTarget.value })}
			>
				<option value="">All ranks</option>
				{#each EQUIPMENT_RANKS as rank (rank)}<option value={rank}
						>{rank} · {rankNames[rank]}</option
					>{/each}
			</select>
		</label>
		<label>
			<span>Equipment class</span>
			<select
				aria-label="Equipment class"
				value={filters.equipmentClass}
				onchange={(event) => update({ equipmentClass: event.currentTarget.value })}
			>
				<option value="">All classes</option>
				{#each classes as [id, name] (id)}<option value={id}>{name}</option>{/each}
			</select>
		</label>
		{#if hasFilters}
			<button
				class="clear-filters"
				type="button"
				onclick={() => update({ q: '', rank: '', equipmentClass: '' })}>Clear filters</button
			>
		{/if}
	</form>
	<p
		class="result-count"
		role="status"
		aria-live="polite"
		aria-atomic="true"
		tabindex="-1"
		bind:this={resultCount}
	>
		{result.total}
		{filters.view === 'sets' ? 'complete sets' : 'individual items'}
		{#if filters.view === 'items' && result.total > 0}
			· Showing {(result.page - 1) * 24 + 1}–{Math.min(result.page * 24, result.total)}{/if}
	</p>

	{#if filters.view === 'sets'}
		<p class="archive-note">
			Complete-set images show the approved visual direction. Head, Torso, Legs, and Boots are
			separate equipment items; set bonuses remain design material.
		</p>
	{:else}
		<p class="archive-note">
			Greatswords have approved artwork. Their gameplay integration is pending.
		</p>
	{/if}

	{#if result.total === 0}
		<p class="empty-state">
			No equipment matches these filters. Try another material, rank, or class.
		</p>
	{/if}

	{#each groups as group (group.rank)}
		<section class="rank-group" aria-labelledby={`equipment-rank-${group.rank}`}>
			<header class="rank-heading">
				<h2 id={`equipment-rank-${group.rank}`}>Rank {group.rank}</h2>
				<span>{rankNames[group.rank]}</span>
			</header>
			<div class="equipment-grid" class:set-grid={filters.view === 'sets'}>
				{#each group.records as record (record.assetKey)}
					<article class="equipment-card">
						<div class="image-well" class:portrait={record.role === 'armor-set-reference'}>
							<img
								src={record.image.publicPath}
								alt={`${record.name}, approved equipment artwork`}
								width={record.image.width}
								height={record.image.height}
								loading="lazy"
								decoding="async"
							/>
						</div>
						<div class="card-copy">
							<p class="class-label">{record.className} · Rank {record.rank}</p>
							<h3>{record.name}</h3>
							{#if record.integration === 'pending'}
								<p class="pending-status">Approved artwork · gameplay integration pending</p>
							{/if}
							{#if record.pieces.length}
								<div
									class="piece-links"
									role="group"
									aria-label={`${record.material} ${record.className} individual pieces`}
								>
									{#each record.pieces as piece (piece.assetKey)}
										<button type="button" onclick={() => showPiece(piece.assetKey)}
											>{piece.slot[0].toUpperCase() + piece.slot.slice(1)}</button
										>
									{/each}
								</div>
							{/if}
							<a
								class="source-link"
								href={`https://github.com/jmoraispk/summonlab/blob/main/${record.sourcePath}`}
								>Original approved PNG ↗</a
							>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/each}
	{#if result.pageCount > 1}
		<nav class="pagination" aria-label="Equipment image pages">
			<button type="button" disabled={result.page === 1} onclick={() => showPage(result.page - 1)}
				>Previous page</button
			>
			<span>Page {result.page} of {result.pageCount}</span>
			<button
				type="button"
				disabled={result.page === result.pageCount}
				onclick={() => showPage(result.page + 1)}>Next page</button
			>
		</nav>
	{/if}
</section>

<style>
	.equipment-catalog {
		--line: rgba(231, 206, 164, 0.14);
		--muted: #aaa08e;
		--accent: #e5aa73;
		container-type: inline-size;
		color: #f3ead9;
	}
	.catalog-intro {
		padding: 2.8rem 0 2rem;
		border-bottom: 1px solid var(--line);
	}
	.catalog-intro > p,
	.class-label,
	label > span,
	.result-count,
	.rank-heading span,
	.source-link {
		font-family: ui-monospace, monospace;
		font-size: 0.67rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.catalog-intro > p {
		margin: 0 0 0.85rem;
		color: #d4773d;
	}
	h1 {
		margin: 0;
		font:
			400 clamp(3rem, 6vw, 5.4rem)/0.94 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	.intro-copy {
		max-width: 47rem;
		margin-top: 1.4rem;
	}
	.intro-copy p,
	.archive-note {
		color: var(--muted);
		font:
			1.08rem/1.6 Georgia,
			serif;
	}
	.intro-copy p {
		margin: 0.4rem 0;
	}
	.intro-copy p + p {
		color: var(--accent);
		font-size: 0.94rem;
	}
	.view-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin: 2rem 0 1rem;
	}
	button {
		min-height: 2.75rem;
		padding: 0.65rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 0.2rem;
		background: #090805;
		color: var(--accent);
		font:
			0.74rem/1.4 ui-monospace,
			monospace;
		cursor: pointer;
	}
	button:hover,
	button[aria-pressed='true'] {
		border-color: #bb7746;
		background: #21180f;
		color: #f3ead9;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.catalog-controls {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: 1px;
		border: 1px solid var(--line);
		background: var(--line);
	}
	label {
		min-width: 0;
		padding: 0.75rem;
		background: #0c0b08;
	}
	label > span {
		display: block;
		margin-bottom: 0.5rem;
		color: var(--muted);
		font-size: 0.61rem;
	}
	input,
	select {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: 2.75rem;
		padding: 0.6rem;
		border: 1px solid var(--line);
		border-radius: 0.2rem;
		background: #090805;
		color: #f3ead9;
		font:
			0.8rem ui-monospace,
			monospace;
	}
	.clear-filters {
		grid-column: 1 / -1;
		border: 0;
	}
	.result-count {
		scroll-margin-top: 6rem;
		margin: 1.3rem 0 0.5rem;
		color: var(--accent);
	}
	.archive-note {
		max-width: 56rem;
		margin: 0.7rem 0 1.5rem;
		font-size: 0.98rem;
	}
	.rank-group {
		margin: 2rem 0;
	}
	.rank-heading {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		margin-bottom: 0.85rem;
	}
	h2 {
		margin: 0;
		font:
			400 2rem Georgia,
			serif;
		letter-spacing: -0.035em;
	}
	.rank-heading span {
		color: var(--muted);
	}
	.equipment-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1px;
		border: 1px solid var(--line);
		background: var(--line);
	}
	.set-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.equipment-card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: #0c0b08;
	}
	.image-well {
		aspect-ratio: 1;
		background: #090805;
	}
	.image-well.portrait {
		aspect-ratio: 2 / 3;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.card-copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		padding: 1rem;
		border-top: 1px solid var(--line);
	}
	.class-label {
		margin: 0;
		color: #d4773d;
		font-size: 0.6rem;
	}
	h3 {
		margin: 0.5rem 0 0.8rem;
		font:
			400 1.4rem/1.15 Georgia,
			serif;
		overflow-wrap: anywhere;
	}
	.piece-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 1rem;
	}
	.piece-links button {
		min-height: 2.5rem;
		padding: 0.4rem 0.6rem;
		font-size: 0.63rem;
	}
	.pending-status {
		margin: 0 0 1rem;
		color: var(--accent);
		font:
			0.72rem/1.5 ui-monospace,
			monospace;
	}
	.source-link {
		align-self: start;
		margin-top: auto;
		color: var(--muted);
		font-size: 0.57rem;
		text-underline-offset: 0.25em;
	}
	.pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 1.5rem 0;
	}
	.pagination span {
		color: var(--muted);
		font:
			0.72rem/1.5 ui-monospace,
			monospace;
		text-align: center;
	}
	.empty-state {
		padding: 2rem 1rem;
		border: 1px solid var(--line);
		color: var(--muted);
		text-align: center;
	}
	button:focus-visible,
	input:focus-visible,
	select:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	@container (max-width: 52rem) {
		.equipment-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.set-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.card-copy {
			padding: 0.75rem;
		}
	}
	@container (max-width: 36rem) {
		.catalog-controls,
		.set-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		h1 {
			font-size: 3.8rem;
		}
		.pagination {
			gap: 0.35rem;
		}
		.pagination button {
			padding: 0.6rem;
			font-size: 0.65rem;
		}
	}
</style>
