<script lang="ts">
	import { resolve } from '$app/paths';
	import HeroRig from '$lib/components/HeroRig.svelte';

	let { data } = $props();

	function downloadAudit() {
		const audit = {
			generationVersion: data.generationVersion,
			seedPattern: 'cohort-{0..99}',
			summary: data.summary,
			characters: data.drafts.map((draft) => ({
				recipe: draft.recipe,
				manifest: draft.manifest,
				manifestHash: draft.manifestHash,
				mind: draft.mind
			}))
		};
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' })
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'summonlab-human-v2-100-seed-audit.json';
		anchor.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>100-seed contact sheet · summonlab</title>
	<meta
		name="description"
		content="A deterministic, printable 100-seed human-v2 diversity contact sheet for Summonlab."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Character Forge</span><strong>100-seed audit</strong></div>
		<nav>
			<a href={resolve('/visual-lab')}>Visual lab</a>
			<a href={resolve('/forge')}>Forge</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{data.generationVersion} · cohort-0…99</p>
			<h1>Variation<br />without drift.</h1>
		</div>
		<div class="intro-copy">
			<p>
				One hundred deterministic adult manifests expose distribution problems before generated art
				makes them expensive. Appearance, mind, habit, and rarity retain separate entropy streams.
			</p>
			<div class="actions">
				<button type="button" onclick={() => window.print()}>Print / save PDF</button>
				<button type="button" onclick={downloadAudit}>Download audit JSON</button>
			</div>
		</div>
	</section>

	<section class="summary" aria-label="Cohort distribution summary">
		<article>
			<span>People</span><strong data-testid="contact-count">{data.drafts.length}</strong>
		</article>
		<article>
			<span>Unique names</span><strong data-testid="unique-name-count"
				>{data.summary.uniqueNames}</strong
			>
		</article>
		<article><span>Mean age</span><strong>{data.summary.meanAge}</strong></article>
		<article><span>Mean height</span><strong>{data.summary.meanHeightCm} cm</strong></article>
		<article>
			<span>Presentation</span>
			<strong
				>{Object.entries(data.summary.presentations)
					.map(([key, value]) => `${key} ${value}`)
					.join(' · ')}</strong
			>
		</article>
		<article>
			<span>Skin tones</span><strong
				>{Object.keys(data.summary.skinTones).length} represented</strong
			>
		</article>
		<article>
			<span>Hair textures</span><strong
				>{Object.keys(data.summary.hairTextures).length} represented</strong
			>
		</article>
	</section>

	<section class="contact-sheet" aria-label="One hundred deterministic hero manifests">
		{#each data.drafts as draft, index (draft.manifest.characterId)}
			<article data-testid="contact-card">
				<header>
					<span>{String(index + 1).padStart(3, '0')}</span><code>{draft.recipe.seed}</code>
				</header>
				<div class="rig"><HeroRig manifest={draft.manifest} compact /></div>
				<h2>{draft.manifest.displayName}</h2>
				<p>
					{draft.manifest.adultAge} · {draft.manifest.heightCm} cm · {draft.manifest
						.genderPresentation}
				</p>
				<p>{draft.manifest.phenotype.skinTone} · {draft.manifest.phenotype.hairTexture}</p>
				<footer>
					<span>{'✦'.repeat(draft.manifest.rarityStars)}</span><code
						>{draft.manifestHash.slice(0, 8)}</code
					>
				</footer>
			</article>
		{/each}
	</section>

	<footer class="page-footer">
		<p>
			Manifest bytes are authoritative. These code-native rigs are distribution diagnostics, not
			approved portrait art.
		</p>
		<code>{data.generationVersion} · cohort-0…99 · deterministic export</code>
	</footer>
</main>

<style>
	:global(body) {
		background: #080a0f;
	}
	main {
		min-height: 100vh;
		color: #f6f1e7;
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 5rem;
		padding: 0 clamp(1.2rem, 3vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.09);
	}
	.wordmark {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}
	.topbar > div {
		text-align: center;
	}
	.topbar span,
	.topbar strong {
		display: block;
	}
	.topbar span {
		color: #d2a04d;
		font-size: 0.5rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.topbar strong {
		margin-top: 0.2rem;
		font:
			400 1rem Georgia,
			serif;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1rem;
		color: rgba(246, 241, 231, 0.48);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.intro {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: end;
		gap: 3rem;
		max-width: 100rem;
		margin: 0 auto;
		padding: clamp(3rem, 7vw, 7rem) clamp(1.2rem, 3vw, 3rem) 3rem;
	}
	.eyebrow {
		margin: 0 0 0.7rem;
		color: #d2a04d;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font:
			400 clamp(3.5rem, 7vw, 7rem)/0.87 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	.intro-copy > p {
		max-width: 40rem;
		color: rgba(246, 241, 231, 0.56);
		font-size: 0.86rem;
		line-height: 1.75;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 1.5rem;
	}
	.actions button {
		min-height: 2.8rem;
		padding: 0 1rem;
		border: 1px solid rgba(210, 160, 77, 0.4);
		background: #15130f;
		color: #e5bd77;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.summary {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		max-width: 100rem;
		margin: 0 auto 1px;
		padding: 1px clamp(1.2rem, 3vw, 3rem);
		gap: 1px;
		background: transparent;
	}
	.summary article {
		min-width: 0;
		padding: 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: #0d1017;
	}
	.summary span,
	.summary strong {
		display: block;
	}
	.summary span {
		color: rgba(246, 241, 231, 0.32);
		font-size: 0.46rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.summary strong {
		margin-top: 0.35rem;
		overflow-wrap: anywhere;
		color: #7fd8e9;
		font-size: 0.62rem;
		line-height: 1.45;
	}
	.contact-sheet {
		display: grid;
		grid-template-columns: repeat(10, minmax(7.5rem, 1fr));
		gap: 1px;
		max-width: 100rem;
		margin: 0 auto;
		padding: 0 clamp(1.2rem, 3vw, 3rem) 4rem;
		overflow-x: auto;
	}
	.contact-sheet > article {
		min-width: 0;
		padding: 0.55rem;
		border: 1px solid rgba(255, 255, 255, 0.07);
		background: #0a0d13;
		break-inside: avoid;
	}
	.contact-sheet header,
	.contact-sheet footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.3rem;
	}
	.contact-sheet header span {
		color: #d2a04d;
		font-size: 0.45rem;
	}
	.contact-sheet code {
		color: #55737b;
		font-size: 0.4rem;
	}
	.rig {
		height: 8rem;
		margin: 0.35rem 0;
		overflow: hidden;
	}
	.rig :global(figure) {
		width: 100%;
		height: 100%;
	}
	.rig :global(svg) {
		width: 100%;
		height: 100%;
	}
	.contact-sheet h2 {
		margin: 0.35rem 0;
		overflow: hidden;
		font:
			400 0.68rem Georgia,
			serif;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.contact-sheet p {
		margin: 0.15rem 0;
		overflow: hidden;
		color: rgba(246, 241, 231, 0.43);
		font-size: 0.42rem;
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.contact-sheet footer {
		margin-top: 0.4rem;
		padding-top: 0.35rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
	.contact-sheet footer span {
		color: #d2a04d;
		font-size: 0.45rem;
	}
	.page-footer {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		max-width: 94rem;
		margin: 0 auto;
		padding: 1.5rem 3rem 4rem;
		color: rgba(246, 241, 231, 0.38);
		font-size: 0.58rem;
	}
	.page-footer p {
		margin: 0;
	}
	.page-footer code {
		color: #6e919a;
	}
	@media (max-width: 850px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.intro {
			grid-template-columns: 1fr;
		}
		.summary {
			grid-template-columns: 1fr 1fr;
		}
		.contact-sheet {
			grid-template-columns: repeat(5, minmax(7.5rem, 1fr));
		}
	}
	@page {
		size: A3 landscape;
		margin: 8mm;
	}
	@media print {
		:global(body) {
			background: #fff;
		}
		main {
			color: #111;
		}
		.topbar,
		.intro,
		.actions,
		.page-footer {
			display: none;
		}
		.summary {
			grid-template-columns: repeat(7, 1fr);
			max-width: none;
			padding: 0 0 3mm;
		}
		.summary article {
			padding: 2mm;
			border-color: #bbb;
			background: #fff;
		}
		.summary span {
			color: #666;
		}
		.summary strong {
			color: #111;
		}
		.contact-sheet {
			grid-template-columns: repeat(10, 1fr);
			max-width: none;
			padding: 0;
			overflow: visible;
		}
		.contact-sheet > article {
			height: 24mm;
			padding: 1mm;
			border-color: #bbb;
			background: #fff;
		}
		.rig {
			float: left;
			width: 12mm;
			height: 18mm;
			margin: 0 1mm 0 0;
		}
		.contact-sheet h2 {
			margin-top: 2mm;
			color: #111;
			font-size: 6pt;
		}
		.contact-sheet p {
			color: #444;
			font-size: 4.5pt;
		}
		.contact-sheet header span,
		.contact-sheet footer span {
			color: #7a5a21;
		}
		.contact-sheet code {
			color: #555;
		}
	}
</style>
