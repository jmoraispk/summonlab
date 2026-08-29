<script lang="ts">
	import { resolve } from '$app/paths';
	import HeroRig from '$lib/components/HeroRig.svelte';

	let { data } = $props();

	function downloadAudit() {
		const audit = {
			generationVersion: data.generationVersion,
			seedPattern: 'pack-two-cohort-{0..999}',
			summary: data.summary,
			characters: data.auditDrafts.map((draft) => ({
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
		anchor.download = 'summonlab-human-v4-1000-seed-audit.json';
		anchor.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Pack 2 cohort audit · summonlab</title>
	<meta
		name="description"
		content="A deterministic human-v4 Pack 2 diversity and independence audit for Summonlab."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Character Forge · Pack 2</span><strong>1,000-seed audit</strong></div>
		<nav>
			<a href={resolve('/visual-lab')}>Visual lab</a>
			<a href={resolve('/forge')}>Forge</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{data.generationVersion} · pack-two-cohort-0…999</p>
			<h1>Variation<br />without drift.</h1>
		</div>
		<div class="intro-copy">
			<p>
				One thousand deterministic adult manifests test body, presentation, phenotype, role, and
				rarity independence before generated art makes mistakes expensive. The first hundred remain
				printable below for visual inspection.
			</p>
			<div class="actions">
				<button type="button" onclick={() => window.print()}>Print / save PDF</button>
				<button type="button" onclick={downloadAudit}>Download audit JSON</button>
			</div>
		</div>
	</section>

	<section class="summary" aria-label="Cohort distribution summary">
		<article>
			<span>Audited</span><strong data-testid="audit-count">{data.auditSize}</strong>
		</article>
		<article>
			<span>Displayed</span><strong data-testid="contact-count">{data.displaySize}</strong>
		</article>
		<article><span>Mean age</span><strong>{data.summary.meanAge}</strong></article>
		<article>
			<span>Height span</span><strong
				>{data.summary.minimumHeightCm}–{data.summary.maximumHeightCm} cm</strong
			>
		</article>
		<article>
			<span>Builds</span>
			<strong
				>{Object.entries(data.summary.builds)
					.map(([key, value]) => `${key} ${value}`)
					.join(' · ')}</strong
			>
		</article>
		<article>
			<span>Proportions</span><strong
				>{Object.entries(data.summary.proportionProfiles)
					.map(([key, value]) => `${key} ${value}`)
					.join(' · ')}</strong
			>
		</article>
		<article>
			<span>Roles</span><strong
				>{Object.keys(data.summary.visualRoles).length} medieval vocabularies</strong
			>
		</article>
	</section>

	<section class="independence" aria-labelledby="independence-heading">
		<header>
			<div>
				<p class="eyebrow">Distribution gate</p>
				<h2 id="independence-heading">Independence is tested, not assumed.</h2>
			</div>
			<p>
				Every cross-tab is calculated from all {data.auditSize} manifests. A green gate means the cohort
				contains evidence for every required crossing—not that the final art has been approved.
			</p>
		</header>
		<div class="checks">
			{#each data.summary.independenceChecks as check (check.id)}
				<article class:passed={check.passed} data-testid="independence-check">
					<span>{check.passed ? 'Pass' : 'Revise'}</span><strong>{check.label}</strong>
				</article>
			{/each}
		</div>
		<div class="matrices">
			<article>
				<h3>Presentation × build</h3>
				<table>
					<thead>
						<tr
							><th>Presentation</th>{#each Object.keys(data.summary.builds) as build}<th>{build}</th
								>{/each}</tr
						>
					</thead>
					<tbody>
						{#each Object.entries(data.summary.presentationByBuild) as [presentation, columns]}
							<tr
								><th>{presentation}</th>{#each Object.keys(data.summary.builds) as build}<td
										>{columns[build]}</td
									>{/each}</tr
							>
						{/each}
					</tbody>
				</table>
			</article>
			<article>
				<h3>Presentation × height</h3>
				<table>
					<thead>
						<tr
							><th>Presentation</th>{#each Object.keys(data.summary.heightBands) as band}<th
									>{band}</th
								>{/each}</tr
						>
					</thead>
					<tbody>
						{#each Object.entries(data.summary.presentationByHeight) as [presentation, columns]}
							<tr
								><th>{presentation}</th>{#each Object.keys(data.summary.heightBands) as band}<td
										>{columns[band]}</td
									>{/each}</tr
							>
						{/each}
					</tbody>
				</table>
			</article>
		</div>
	</section>

	<section class="scale-lineup" aria-labelledby="scale-heading">
		<header>
			<div>
				<p class="eyebrow">Common floor study</p>
				<h2 id="scale-heading">Height must survive the lineup.</h2>
			</div>
			<p>Three deterministic examples per band share one floor and are sized by centimeters.</p>
		</header>
		<div class="lineup-stage">
			{#each data.lineup as draft (draft.manifest.characterId)}
				<article style={`--height:${draft.manifest.heightCm}`}>
					<div class="lineup-rig"><HeroRig manifest={draft.manifest} compact /></div>
					<strong>{draft.manifest.heightCm}</strong>
					<span>{draft.manifest.physiology?.heightBand} · {draft.manifest.bodyBuild}</span>
				</article>
			{/each}
		</div>
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
					{draft.manifest.adultAge} · {draft.manifest.heightCm} cm · {draft.manifest.bodyBuild}
				</p>
				<p>
					{draft.manifest.genderPresentation} · {draft.manifest.physiology?.proportions?.profile}
				</p>
				<p>{draft.manifest.visualRole} · {draft.manifest.phenotype.hairSilhouette}</p>
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
		<code>{data.generationVersion} · 1,000 audited · 100 displayed · deterministic export</code>
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
	.independence,
	.scale-lineup {
		max-width: 100rem;
		margin: 4rem auto;
		padding: 0 clamp(1.2rem, 3vw, 3rem);
	}
	.independence > header,
	.scale-lineup > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 3rem;
		margin-bottom: 1.2rem;
	}
	.independence h2,
	.scale-lineup h2 {
		margin: 0;
		font:
			400 clamp(1.8rem, 3vw, 3.2rem) Georgia,
			serif;
	}
	.independence > header > p,
	.scale-lineup > header > p {
		max-width: 38rem;
		margin: 0;
		color: rgba(246, 241, 231, 0.45);
		font-size: 0.72rem;
		line-height: 1.7;
		text-align: right;
	}
	.checks {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1px;
	}
	.checks article {
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: #0d1017;
	}
	.checks span,
	.checks strong {
		display: block;
	}
	.checks span {
		color: #e28b7d;
		font-size: 0.5rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.checks .passed span {
		color: #72d1b5;
	}
	.checks strong {
		margin-top: 0.45rem;
		font-size: 0.72rem;
		line-height: 1.5;
	}
	.matrices {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		gap: 1rem;
		margin-top: 1rem;
	}
	.matrices article {
		min-width: 0;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: #0a0d13;
		overflow-x: auto;
	}
	.matrices h3 {
		margin: 0 0 0.8rem;
		font:
			400 1.1rem Georgia,
			serif;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.58rem;
	}
	th,
	td {
		padding: 0.55rem;
		border: 1px solid rgba(255, 255, 255, 0.07);
		text-align: right;
	}
	th:first-child {
		text-align: left;
	}
	thead th {
		color: #7fd8e9;
		font-weight: 700;
	}
	.lineup-stage {
		display: flex;
		align-items: end;
		min-height: 28rem;
		padding: 2rem 1rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: linear-gradient(transparent 95%, rgba(210, 160, 77, 0.35) 95%), #090c12;
		overflow-x: auto;
	}
	.lineup-stage article {
		display: grid;
		flex: 1 0 7rem;
		min-width: 7rem;
		place-items: center;
	}
	.lineup-rig {
		width: 6.5rem;
		height: calc(var(--height) * 1.8px);
	}
	.lineup-rig :global(figure),
	.lineup-rig :global(svg) {
		width: 100%;
		height: 100%;
	}
	.lineup-stage strong,
	.lineup-stage span {
		display: block;
	}
	.lineup-stage strong {
		margin-top: 0.5rem;
		color: #d2a04d;
		font:
			400 0.9rem Georgia,
			serif;
	}
	.lineup-stage span {
		color: rgba(246, 241, 231, 0.4);
		font-size: 0.48rem;
		text-align: center;
		text-transform: capitalize;
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
		.independence > header,
		.scale-lineup > header {
			display: block;
		}
		.independence > header > p,
		.scale-lineup > header > p {
			margin-top: 1rem;
			text-align: left;
		}
		.checks,
		.matrices {
			grid-template-columns: 1fr;
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
		.independence,
		.scale-lineup,
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
