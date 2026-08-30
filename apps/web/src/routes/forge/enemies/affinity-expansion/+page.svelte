<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let familyFilter = $state('all');
	let query = $state('');
	let completedOnly = $state(false);

	const familyOptions = $derived(
		Array.from(new Map(data.rows.map((row) => [row.familyId, row.familyName])).entries()).map(
			([id, name]) => ({ id, name })
		)
	);
	const visibleRows = $derived(
		data.rows.filter((row) => {
			const normalizedQuery = query.trim().toLocaleLowerCase();
			return (
				(familyFilter === 'all' || row.familyId === familyFilter) &&
				(!completedOnly || row.cells.some((cell) => cell.available)) &&
				(!normalizedQuery ||
					[row.name, row.familyName, row.role, row.speciesId]
						.join(' ')
						.toLocaleLowerCase()
						.includes(normalizedQuery))
			);
		})
	);
</script>

<svelte:head>
	<title>Affinity expansion · Creature Forge</title>
	<meta
		name="description"
		content="Review Normal, Wood, Fire, Metal, Water, and Wind image-production variants for 34 canonical Summonlab enemies."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Creature Forge</span><strong>Affinity expansion</strong></div>
		<nav>
			<a href={resolve('/forge/enemies/all')}>All enemies</a>
			<a href={resolve('/forge/enemies/affinity-workflow')}>Original affinity lab</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{data.experimentId} · live production index</p>
			<h1>Thirty-four species.<br /><em>Six readable forms each.</em></h1>
		</div>
		<div class="intro-copy">
			<p>
				Every remaining canonical enemy is linked here as a Normal baseline plus Wood, Fire, Metal,
				Water, and Wind construction. Images appear as soon as their production receipt is present;
				candidate status is not final art approval.
			</p>
			<div class="totals" aria-label="Expansion production totals">
				<span><b data-testid="expansion-species-count">{data.speciesCount}</b>Species</span>
				<span><b data-testid="expansion-target-count">{data.targetCount}</b>Targets</span>
				<span><b data-testid="expansion-completed-count">{data.completedCount}</b>Rendered</span>
				<span><b>{data.reviseCount}</b>Revise</span>
			</div>
		</div>
	</section>

	<section class="controls" aria-label="Affinity expansion filters">
		<label>
			<span>Family</span>
			<select bind:value={familyFilter} aria-label="Expansion family">
				<option value="all">All families</option>
				{#each familyOptions as family (family.id)}
					<option value={family.id}>{family.name}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Search</span>
			<input bind:value={query} type="search" placeholder="Species, family, or combat duty" />
		</label>
		<label class="check">
			<input bind:checked={completedOnly} type="checkbox" />
			<span>Show rows with rendered work only</span>
		</label>
		<p><strong>{visibleRows.length}</strong> species visible</p>
	</section>

	<section class="matrix" aria-label="Enemy affinity expansion matrix">
		{#each visibleRows as row (row.speciesId)}
			<article id={`affinity-${row.speciesId}`} data-testid="affinity-expansion-row">
				<header>
					<div>
						<p>{row.familyName}</p>
						<h2>{row.name}</h2>
					</div>
					<div class="row-meta">
						<span>{row.role}</span>
						<strong>{row.cells.filter((cell) => cell.available).length}/6 rendered</strong>
					</div>
				</header>
				<div class="affinity-grid">
					{#each row.cells as cell (cell.affinity)}
						<figure class:pending={!cell.available} data-testid="affinity-expansion-cell">
							<div class="image-frame">
								{#if cell.mediaUrl}
									<img
										src={cell.mediaUrl}
										alt={`${cell.affinityName} ${row.name} production candidate`}
										loading="lazy"
									/>
								{:else}
									<div class="placeholder" aria-label={`${cell.affinityName} ${row.name} pending`}>
										<span>Queued</span>
									</div>
								{/if}
							</div>
							<figcaption>
								<strong>{cell.affinityName}</strong>
								<span class:revise={cell.status === 'revise'}>{cell.status}</span>
							</figcaption>
						</figure>
					{/each}
				</div>
			</article>
		{/each}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #07090d;
	}
	main {
		min-height: 100vh;
		color: #f4efe5;
		background:
			radial-gradient(circle at 50% 12rem, rgba(44, 110, 122, 0.18), transparent 38rem),
			linear-gradient(#080a0f, #0b0d12 70%, #07080b);
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		min-height: 5rem;
		padding: 0 clamp(1rem, 3vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(6, 8, 12, 0.88);
	}
	.wordmark,
	.eyebrow {
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	.topbar > div {
		text-align: center;
	}
	.topbar > div span,
	.topbar > div strong {
		display: block;
	}
	.topbar > div span {
		color: #76d2e3;
		font-size: 0.5rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1rem;
		color: rgba(244, 239, 229, 0.56);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.intro,
	.controls,
	.matrix {
		max-width: 112rem;
		margin-inline: auto;
		padding-inline: clamp(1rem, 3vw, 3rem);
	}
	.intro {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		align-items: end;
		gap: clamp(2rem, 6vw, 6rem);
		padding-block: clamp(4rem, 8vw, 8rem) 4rem;
	}
	.eyebrow {
		margin: 0 0 0.8rem;
		color: #76d2e3;
	}
	h1,
	h2,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 0;
		font:
			400 clamp(3rem, 7vw, 7rem) / 0.9 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	h1 em {
		color: #76d2e3;
		font-weight: 400;
	}
	.intro-copy > p {
		color: rgba(244, 239, 229, 0.62);
		line-height: 1.7;
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-top: 2rem;
		border-block: 1px solid rgba(255, 255, 255, 0.1);
	}
	.totals span {
		padding: 0.9rem 0.5rem;
		color: rgba(244, 239, 229, 0.45);
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.totals span + span {
		border-left: 1px solid rgba(255, 255, 255, 0.1);
	}
	.totals b {
		display: block;
		color: #f4efe5;
		font:
			400 1.8rem Georgia,
			serif;
	}
	.controls {
		display: grid;
		grid-template-columns: minmax(12rem, 0.7fr) minmax(16rem, 1fr) auto auto;
		align-items: end;
		gap: 0.9rem;
		padding-block: 1rem;
		border-block: 1px solid rgba(255, 255, 255, 0.1);
	}
	.controls label:not(.check) {
		display: grid;
		gap: 0.35rem;
	}
	.controls label > span,
	.controls > p {
		margin: 0;
		color: rgba(244, 239, 229, 0.46);
		font-size: 0.5rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	select,
	input[type='search'] {
		box-sizing: border-box;
		width: 100%;
		min-height: 2.6rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 0;
		color: #f4efe5;
		background: #0a0d13;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.6rem;
	}
	.controls > p {
		padding-bottom: 0.85rem;
		text-align: right;
	}
	.controls > p strong {
		color: #76d2e3;
		font-size: 0.8rem;
	}
	.matrix {
		padding-block: 3rem 8rem;
	}
	.matrix > article {
		scroll-margin-top: 1rem;
		padding-block: 2.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.matrix article > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1rem;
	}
	.matrix header p {
		margin-bottom: 0.3rem;
		color: #76d2e3;
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	h2 {
		margin-bottom: 0;
		font:
			400 clamp(1.8rem, 4vw, 3.5rem) Georgia,
			serif;
		letter-spacing: -0.03em;
	}
	.row-meta {
		max-width: 30rem;
		text-align: right;
	}
	.row-meta span,
	.row-meta strong {
		display: block;
	}
	.row-meta span {
		color: rgba(244, 239, 229, 0.48);
		font-size: 0.66rem;
	}
	.row-meta strong {
		margin-top: 0.35rem;
		color: #76d2e3;
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	.affinity-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.55rem;
	}
	figure {
		margin: 0;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: #090c12;
	}
	.image-frame {
		aspect-ratio: 3 / 2;
		overflow: hidden;
		background: #050609;
	}
	.image-frame img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.placeholder {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		background:
			linear-gradient(135deg, transparent 49.5%, rgba(255, 255, 255, 0.05) 50%, transparent 50.5%),
			#080a0e;
	}
	.placeholder span {
		color: rgba(244, 239, 229, 0.25);
		font-size: 0.5rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	figcaption {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.65rem 0.7rem;
	}
	figcaption strong {
		font:
			400 0.8rem Georgia,
			serif;
	}
	figcaption span {
		color: #76d2e3;
		font-size: 0.42rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	figcaption span.revise {
		color: #efb36a;
	}
	.pending {
		opacity: 0.62;
	}
	@media (max-width: 1100px) {
		.affinity-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.controls {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 720px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.intro {
			grid-template-columns: 1fr;
		}
		.controls,
		.affinity-grid {
			grid-template-columns: 1fr 1fr;
		}
		.matrix article > header {
			align-items: start;
			flex-direction: column;
			gap: 0.7rem;
		}
		.row-meta {
			text-align: left;
		}
	}
</style>
