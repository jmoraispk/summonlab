<script lang="ts">
	import MonsterDatabase from '$lib/components/wiki/MonsterDatabase.svelte';
	import MonsterFamily from '$lib/components/wiki/MonsterFamily.svelte';
	import MonsterVisualMatrix from '$lib/components/wiki/MonsterVisualMatrix.svelte';
	import SkillTree from '$lib/components/wiki/SkillTree.svelte';
	import SkillVisualCatalog from '$lib/components/wiki/SkillVisualCatalog.svelte';

	let { data } = $props();
	const articleHtml = $derived(data.monsterVisual ? data.wikiPage.bodyHtml : data.wikiPage.html);
</script>

<svelte:head>
	<title>{data.wikiPage.title} · Summonlab Wiki</title>
</svelte:head>

<main>
	{#if data.monsterDatabase}
		<MonsterDatabase families={data.monsterDatabase} />
	{:else if data.monsterFamily}
		<MonsterFamily family={data.monsterFamily} />
	{:else if data.monsterVisual}
		<MonsterVisualMatrix monster={data.monsterVisual} />
	{/if}

	{#if data.visualPacket}
		<section class="packet-hero">
			<img
				src={data.visualPacket.environment}
				alt="The Hearth settlement and summoning gate"
				width="1536"
				height="1024"
				fetchpriority="high"
			/>
			<div></div>
			<header>
				<p>Visual production packet · Living Village v1</p>
				<h1>Six lives.<br />One recognizable company.</h1>
				<span>
					These six retained cutouts are the Living Village lab fixture. The approved summonable
					catalog contains the full 200-hero roster.
				</span>
			</header>
		</section>

		<section class="reference-cohort" aria-labelledby="cohort-heading">
			<header>
				<div>
					<p>Retained prototype cohort</p>
					<h2 id="cohort-heading">The Living Village six</h2>
				</div>
				<span>Lab fixture · canonical roster documented separately</span>
			</header>
			<div class="hero-grid">
				{#each data.visualPacket.heroes as hero, index (hero.name)}
					<figure>
						<img
							src={hero.image}
							alt={`${hero.name}, Summonlab visual reference candidate`}
							width="1024"
							height="1536"
							loading={index < 3 ? 'eager' : 'lazy'}
						/>
						<figcaption><strong>{hero.name}</strong><span>{hero.status}</span></figcaption>
					</figure>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.monsterDatabase || data.monsterFamily}
		<footer class="database-source">
			<span>Canonical source</span>
			<code>{data.wikiPage.sourcePath}</code>
		</footer>
	{:else}
		<article class:with-packet={data.visualPacket || data.monsterVisual} class="wiki-article">
			<header class="article-meta">
				<span>{data.wikiPage.section}</span>
				<i>Design · {data.wikiPage.designStatus}</i>
				<i>Implementation · {data.wikiPage.implementationStatus}</i>
				{#if !data.monsterVisual}<i>Visual · {data.wikiPage.visualStatus}</i>{/if}
			</header>
			{#if data.wikiPage.wikiId === 'skills.visual-catalog' && data.skillVisualCatalog}
				<SkillVisualCatalog records={data.skillVisualCatalog} />
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- canonical repository Markdown is rendered by the server with raw HTML escaped -->
				<div class="article-body">{@html data.wikiPage.bodyHtml}</div>
			{:else if data.wikiPage.wikiId === 'skills.index'}
				<div class="article-body article-title"><h1 id="skills">{data.wikiPage.title}</h1></div>
				<SkillTree />
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- canonical repository Markdown is rendered by the server with raw HTML escaped -->
				<div class="article-body">{@html data.wikiPage.bodyHtml}</div>
			{:else}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- canonical repository Markdown is rendered by the server with raw HTML escaped -->
				<div class="article-body">{@html articleHtml}</div>
			{/if}
			<footer>
				<span>Canonical source</span>
				<code>{data.wikiPage.sourcePath}</code>
			</footer>
		</article>
	{/if}
</main>

<style>
	main {
		min-height: calc(100svh - 4.5rem);
	}
	.packet-hero {
		position: relative;
		min-height: 38rem;
		display: flex;
		align-items: end;
		isolation: isolate;
	}
	.packet-hero > img {
		position: absolute;
		inset: 0;
		z-index: -3;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.7) brightness(0.68);
	}
	.packet-hero > div {
		position: absolute;
		inset: 0;
		z-index: -2;
		background:
			linear-gradient(90deg, rgba(7, 6, 4, 0.96), rgba(7, 6, 4, 0.36) 68%),
			linear-gradient(0deg, #090805, transparent 55%);
	}
	.packet-hero header {
		width: min(46rem, calc(100% - 2rem));
		padding: 7rem clamp(1rem, 7vw, 7rem) 5rem;
	}
	.packet-hero p,
	.reference-cohort header p {
		margin: 0 0 1rem;
		color: #d4773d;
		font:
			0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	.packet-hero h1 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(3.3rem, 6vw, 6rem);
		font-weight: 400;
		line-height: 0.9;
		letter-spacing: -0.055em;
	}
	.packet-hero header > span {
		display: block;
		max-width: 38rem;
		margin-top: 1.7rem;
		color: rgba(243, 234, 217, 0.66);
		font-family: Georgia, serif;
		font-size: 1.16rem;
		line-height: 1.65;
	}
	.reference-cohort {
		padding: clamp(4rem, 7vw, 7rem);
		background: #0c0b08;
	}
	.reference-cohort > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 2rem;
	}
	.reference-cohort h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(2.2rem, 4vw, 4rem);
		font-weight: 400;
		letter-spacing: -0.04em;
	}
	.reference-cohort > header > span {
		color: #8f8473;
		font:
			0.67rem ui-monospace,
			monospace;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
	.hero-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: rgba(231, 206, 164, 0.12);
		border: 1px solid rgba(231, 206, 164, 0.12);
	}
	.hero-grid figure {
		position: relative;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		background: #090805;
	}
	.hero-grid img {
		display: block;
		width: 100%;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		filter: saturate(0.72) contrast(1.03);
		transition:
			transform 350ms ease,
			filter 350ms ease;
	}
	.hero-grid figure:hover img {
		transform: scale(1.02);
		filter: saturate(0.88) contrast(1.03);
	}
	.hero-grid figcaption {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 4rem 1rem 1rem;
		background: linear-gradient(transparent, rgba(6, 5, 4, 0.95));
	}
	.hero-grid strong {
		font-family: Georgia, serif;
		font-size: 1.28rem;
		font-weight: 400;
	}
	.hero-grid span {
		color: #d4773d;
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.wiki-article {
		width: min(76rem, calc(100% - 2rem));
		margin: 0 auto;
		padding: clamp(4rem, 8vw, 8rem) 0;
	}
	.wiki-article.with-packet {
		padding-top: 5rem;
	}
	.article-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1.2rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid rgba(231, 206, 164, 0.14);
	}
	.article-meta span,
	.article-meta i {
		color: #a39887;
		font:
			0.66rem ui-monospace,
			monospace;
		font-style: normal;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.article-meta span {
		color: #d4773d;
	}
	.article-body {
		width: min(54rem, 100%);
		margin: 3rem auto 0;
	}
	.article-body :global(h1) {
		margin: 0 0 1.5rem;
		font-family: Georgia, serif;
		font-size: clamp(3rem, 6vw, 5.5rem);
		font-weight: 400;
		line-height: 0.94;
		letter-spacing: -0.05em;
	}
	.article-body :global(h2) {
		margin: 4rem 0 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(231, 206, 164, 0.13);
		font-family: Georgia, serif;
		font-size: clamp(2rem, 3.5vw, 3.2rem);
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: -0.035em;
	}
	.article-body :global(h3) {
		margin: 2.7rem 0 0.8rem;
		color: #e5aa73;
		font-family: Georgia, serif;
		font-size: 1.72rem;
		font-weight: 400;
	}
	.article-body :global(p),
	.article-body :global(li) {
		color: rgba(243, 234, 217, 0.72);
		font-family: Georgia, serif;
		font-size: 1.16rem;
		line-height: 1.75;
	}
	.article-body :global(strong) {
		color: #f3ead9;
	}
	.article-body :global(a) {
		color: #e09a68;
		text-underline-offset: 0.2em;
	}
	.article-body :global(blockquote) {
		margin: 2rem 0;
		padding: 0.2rem 0 0.2rem 1.5rem;
		border-left: 2px solid #d4773d;
	}
	.article-body :global(code) {
		padding: 0.14rem 0.3rem;
		border: 1px solid rgba(231, 206, 164, 0.14);
		border-radius: 0.18rem;
		background: rgba(255, 255, 255, 0.035);
		color: #edc69e;
		font-size: 0.82em;
	}
	.article-body :global(pre) {
		overflow: auto;
		padding: 1.25rem;
		border: 1px solid rgba(231, 206, 164, 0.13);
		background: #0d0c08;
	}
	.article-body :global(pre code) {
		padding: 0;
		border: 0;
		background: transparent;
	}
	.article-body :global(table) {
		display: block;
		width: 100%;
		margin: 2rem 0;
		overflow-x: auto;
		border-collapse: collapse;
		font-size: 1rem;
	}
	.article-body :global(th),
	.article-body :global(td) {
		min-width: 8rem;
		padding: 0.8rem;
		border: 1px solid rgba(231, 206, 164, 0.13);
		text-align: left;
		vertical-align: top;
	}
	.article-body :global(th) {
		color: #e5aa73;
		font:
			0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.article-body :global(td) {
		color: rgba(243, 234, 217, 0.68);
		line-height: 1.5;
	}
	.article-body :global(img) {
		display: block;
		width: 100%;
		height: auto;
		margin: 2.5rem 0;
		border: 1px solid rgba(231, 206, 164, 0.14);
	}
	.wiki-article > footer,
	.database-source {
		display: flex;
		gap: 1rem;
		align-items: center;
		width: min(54rem, 100%);
		margin: 4rem auto 0;
		padding-top: 1rem;
		border-top: 1px solid rgba(231, 206, 164, 0.13);
		color: #827767;
		font:
			0.64rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.database-source {
		width: min(76rem, calc(100% - 2rem));
		margin-top: 0;
		margin-bottom: 3rem;
	}
	.wiki-article > footer code,
	.database-source code {
		overflow: hidden;
		color: #bba995;
		text-overflow: ellipsis;
		text-transform: none;
	}
	@media (max-width: 700px) {
		.packet-hero {
			min-height: 34rem;
		}
		.reference-cohort {
			padding: 4rem 1rem;
		}
		.reference-cohort > header {
			align-items: start;
			flex-direction: column;
		}
		.hero-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.wiki-article {
			padding: 4rem 0;
		}
		.article-body {
			margin-top: 2rem;
		}
	}
</style>
