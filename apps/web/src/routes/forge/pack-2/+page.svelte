<script lang="ts">
	import { resolve } from '$app/paths';
	import HeroRig from '$lib/components/HeroRig.svelte';
	import remyEquipped from '../../../../../../assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png';
	import remyEvolved from '../../../../../../assets/heroes/visuals/forge-v2/benchmarks/remy-esen-evolution-3star-v1.png';
	import brynAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/bryn-vale-anchor-v1.png';
	import caelAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/cael-hale-anchor-v1.png';
	import daraAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/dara-aster-anchor-v1.png';
	import eddaAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/edda-kade-anchor-v1.png';
	import elianAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/elian-vale-anchor-v1.png';
	import faraAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/fara-pell-anchor-v1.png';
	import galenAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/galen-arden-anchor-v1.png';
	import lioPellAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/lio-pell-anchor-v1.png';
	import maraAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/mara-rook-anchor-v1.png';
	import neriAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/neri-arden-anchor-v1.png';
	import noaAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/noa-saye-anchor-v1.png';
	import remyNorAnchor from '../../../../../../assets/heroes/visuals/forge-v2/cohort/remy-nor-anchor-v1.png';
	import ivenAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/iven-orra-anchor-v1.png';
	import ivenContinuity from '../../../../../../assets/heroes/visuals/forge-v2/pilot/iven-orra-continuity-v1.png';
	import kiraAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/kira-toren-anchor-v1.png';
	import kiraContinuity from '../../../../../../assets/heroes/visuals/forge-v2/pilot/kira-toren-continuity-v1.png';
	import lioDaeAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/lio-dae-anchor-v1.png';
	import lioDaeContinuity from '../../../../../../assets/heroes/visuals/forge-v2/pilot/lio-dae-continuity-v1.png';
	import lioJunoAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/lio-juno-anchor-v1.png';
	import lioJunoContinuity from '../../../../../../assets/heroes/visuals/forge-v2/pilot/lio-juno-continuity-v1.png';
	import remyAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/remy-esen-anchor-v1.png';
	import remyContinuity from '../../../../../../assets/heroes/visuals/forge-v2/pilot/remy-esen-continuity-v1.png';
	import taviAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/tavi-daro-anchor-v1.png';
	import taviContinuity from '../../../../../../assets/heroes/visuals/forge-v2/pilot/tavi-daro-continuity-v1.png';

	let { data } = $props();
	let selectedHash = $state<string>();
	let presentation = $state('all');

	const images: Record<string, string> = {
		'bryn-vale-anchor-v1': brynAnchor,
		'cael-hale-anchor-v1': caelAnchor,
		'dara-aster-anchor-v1': daraAnchor,
		'edda-kade-anchor-v1': eddaAnchor,
		'elian-vale-anchor-v1': elianAnchor,
		'fara-pell-anchor-v1': faraAnchor,
		'galen-arden-anchor-v1': galenAnchor,
		'iven-orra-anchor-v1': ivenAnchor,
		'iven-orra-continuity-v1': ivenContinuity,
		'kira-toren-anchor-v1': kiraAnchor,
		'kira-toren-continuity-v1': kiraContinuity,
		'lio-dae-anchor-v1': lioDaeAnchor,
		'lio-dae-continuity-v1': lioDaeContinuity,
		'lio-juno-anchor-v1': lioJunoAnchor,
		'lio-juno-continuity-v1': lioJunoContinuity,
		'lio-pell-anchor-v1': lioPellAnchor,
		'mara-rook-anchor-v1': maraAnchor,
		'neri-arden-anchor-v1': neriAnchor,
		'noa-saye-anchor-v1': noaAnchor,
		'remy-esen-anchor-v1': remyAnchor,
		'remy-esen-continuity-v1': remyContinuity,
		'remy-nor-anchor-v1': remyNorAnchor,
		'tavi-daro-anchor-v1': taviAnchor,
		'tavi-daro-continuity-v1': taviContinuity
	};
	const presentations = ['all', 'feminine', 'masculine', 'androgynous'];
	const filtered = $derived(
		data.cohort.filter(
			(entry) => presentation === 'all' || entry.draft.manifest.genderPresentation === presentation
		)
	);
	const selected = $derived(
		data.cohort.find((entry) => entry.draft.manifestHash === selectedHash) ?? data.cohort[0]!
	);
	const selectedAnchor = $derived(
		selected.assets.find((asset) => asset.role === 'full-body-anchor')!
	);
	const selectedContinuity = $derived(
		selected.assets.find((asset) => asset.role === 'continuity-sheet')
	);
	const remy = $derived(
		data.cohort.find((entry) => entry.draft.manifest.displayName === 'Remy Esen')!
	);
	const remyAnchorAsset = $derived(remy.assets.find((asset) => asset.role === 'full-body-anchor')!);
	const humanBenchmark = $derived(
		data.benchmark.categories.find((entry) => entry.assetType === 'human-full-body-anchor')!
	);
	const words = (value: string | undefined) => value?.replaceAll('-', ' ') ?? 'unset';
	const seconds = (milliseconds: number) => `${(milliseconds / 1000).toFixed(1)} s`;
</script>

<svelte:head>
	<title>Character Pack 2 cohort · Summoning Forge</title>
	<meta
		name="description"
		content="Review 18 deterministic Character Pack 2 humans across anchors, continuity, roster, true height, and settlement scale."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Character Forge</span><strong>Pack 2 full cohort</strong></div>
		<nav>
			<a href={resolve('/forge')}>Pack 1</a><a href={resolve('/forge/enemies/pack-2')}>Monsters</a
			><a href={resolve('/forge/contact-sheet')}>Seed audit</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{data.catalog.catalogVersion} · 18 manifest-bound adults</p>
			<h1>Different bodies.<br /><em>One shared world.</em></h1>
		</div>
		<div class="intro-copy">
			<p>
				Every portrait is permanent-first-reveal quality. Stars change construction and resonance,
				not rendering care. Generated pixels remain candidates until a human approves them.
			</p>
			<div class="summary">
				<span><b>18</b> anchors</span><span><b>6</b> continuity sheets</span><span
					><b>0</b> approved</span
				>
			</div>
		</div>
	</section>

	<section class="browser" aria-labelledby="browser-title">
		<header class="section-heading">
			<div>
				<span>01</span>
				<h2 id="browser-title">Full cohort</h2>
			</div>
			<div class="filters" aria-label="Presentation filter">
				{#each presentations as option (option)}
					<button class:active={presentation === option} onclick={() => (presentation = option)}
						>{option}</button
					>
				{/each}
			</div>
		</header>
		<div class="candidate-grid">
			{#each filtered as entry (entry.draft.manifestHash)}
				{@const manifest = entry.draft.manifest}
				{@const anchor = entry.assets.find((asset) => asset.role === 'full-body-anchor')!}
				<button
					class:selected={selected.draft.manifestHash === entry.draft.manifestHash}
					onclick={() => (selectedHash = entry.draft.manifestHash)}
					data-testid="pack-two-candidate"
				>
					<img src={images[anchor.assetKey]} alt={`${manifest.displayName} full-body anchor`} />
					<div>
						<span>{'✦'.repeat(manifest.rarityStars)} · {manifest.heightCm} cm</span><strong
							>{manifest.displayName}</strong
						><small
							>{words(manifest.bodyBuild)} · {words(
								manifest.physiology?.proportions?.profile
							)}</small
						>
					</div>
					<i>{entry.human.summonEligibility.replaceAll('-', ' ')}</i>
					<em>{entry.human.cohortStage}</em>
				</button>
			{/each}
		</div>
	</section>

	<section class="inspection" aria-labelledby="inspection-title">
		<header class="section-heading">
			<div>
				<span>02</span>
				<h2 id="inspection-title">Identity & continuity</h2>
			</div>
			<p>
				{selected.draft.manifest.displayName} · exact hash {selected.draft.manifestHash.slice(
					0,
					12
				)}…
			</p>
		</header>
		<div class="inspection-grid">
			<article class="anchor-panel">
				<img
					src={images[selectedAnchor.assetKey]}
					alt={`${selected.draft.manifest.displayName} identity anchor`}
				/>
				<footer><span>Full-body anchor</span><b>{selectedAnchor.humanStatus}</b></footer>
			</article>
			<article class="continuity-panel" class:empty={!selectedContinuity}>
				{#if selectedContinuity}
					<img
						src={images[selectedContinuity.assetKey]}
						alt={`${selected.draft.manifest.displayName} six-panel continuity sheet`}
					/>
					<footer>
						<span>Front · profile · back · expression · action</span><b
							class:concern={selectedContinuity.authoringInspection === 'concern'}
							>{selectedContinuity.authoringInspection}</b
						>
					</footer>
				{:else}
					<div class="not-authored">
						<span>Expansion scope</span>
						<strong>Anchor only</strong>
						<p>Continuity sheets follow only after anchor approval.</p>
					</div>
				{/if}
			</article>
			<aside class="manifest-panel">
				<p class="eyebrow">Manifest truth</p>
				<h3>{selected.draft.manifest.displayName}</h3>
				<dl>
					<div>
						<dt>Presentation</dt>
						<dd>{selected.draft.manifest.genderPresentation}</dd>
					</div>
					<div>
						<dt>Height</dt>
						<dd>
							{selected.draft.manifest.heightCm} cm · {selected.draft.manifest.physiology
								?.heightBand}
						</dd>
					</div>
					<div>
						<dt>Body</dt>
						<dd>
							{selected.draft.manifest.bodyFrame} · {selected.draft.manifest.bodyBuild} · {selected
								.draft.manifest.physiology?.massKg} kg
						</dd>
					</div>
					<div>
						<dt>Proportions</dt>
						<dd>{words(selected.draft.manifest.physiology?.proportions?.profile)}</dd>
					</div>
					<div>
						<dt>Hair</dt>
						<dd>
							{selected.draft.manifest.phenotype.hairStyle} · {selected.draft.manifest.phenotype
								.hairSilhouette}
						</dd>
					</div>
					<div>
						<dt>Role</dt>
						<dd>{selected.draft.manifest.visualRole}</dd>
					</div>
					<div>
						<dt>Evolution</dt>
						<dd>
							{selected.draft.manifest.rarityStars}★ · level cap {selected.draft.manifest
								.rarityStars * 10}
						</dd>
					</div>
				</dl>
				<div class="gate">
					<span>Human approval</span><strong>Candidate only</strong><small
						>Not eligible for player-facing summons.</small
					>
				</div>
			</aside>
		</div>
	</section>

	<section class="scale" aria-labelledby="scale-title">
		<header class="section-heading">
			<div>
				<span>03</span>
				<h2 id="scale-title">True-height lineup</h2>
			</div>
			<p>Shared floor, fixed image treatment, ordered by generated centimeters.</p>
		</header>
		<div class="lineup" data-testid="pack-two-lineup">
			{#each [...data.cohort].sort((a, b) => a.draft.manifest.heightCm - b.draft.manifest.heightCm) as entry (entry.draft.manifestHash)}
				{@const anchor = entry.assets.find((asset) => asset.role === 'full-body-anchor')!}
				<div class="lineup-person">
					<div class="height-rule"><span>{entry.draft.manifest.heightCm}</span></div>
					<img
						style={`height:${entry.draft.manifest.heightCm * 1.75}px`}
						src={images[anchor.assetKey]}
						alt={`${entry.draft.manifest.displayName} at true relative height`}
					/>
					<strong>{entry.draft.manifest.displayName}</strong><small
						>{entry.draft.manifest.bodyBuild}</small
					>
				</div>
			{/each}
		</div>
	</section>

	<section class="survival" aria-labelledby="survival-title">
		<header class="section-heading">
			<div>
				<span>04</span>
				<h2 id="survival-title">Scale survival</h2>
			</div>
			<p>
				Roster proves face and palette; settlement claims silhouette, hair, posture, and accent—not
				facial recognition.
			</p>
		</header>
		<div class="survival-grid">
			{#each data.cohort as entry (entry.draft.manifestHash)}
				{@const anchor = entry.assets.find((asset) => asset.role === 'full-body-anchor')!}
				<article data-testid="scale-survival-card">
					<div class="roster">
						<img
							src={images[anchor.assetKey]}
							alt={`${entry.draft.manifest.displayName} roster crop`}
						/>
					</div>
					<div class="settlement"><HeroRig manifest={entry.draft.manifest} compact /></div>
					<footer>
						<strong>{entry.draft.manifest.displayName}</strong><span>roster · settlement</span>
					</footer>
				</article>
			{/each}
		</div>
	</section>

	<section class="benchmark" aria-labelledby="benchmark-title">
		<header class="section-heading">
			<div>
				<span>05</span>
				<h2 id="benchmark-title">Equipment is not evolution</h2>
			</div>
			<p>One identity, two progression systems, measured authoring latency.</p>
		</header>
		<div class="progression-grid" data-testid="pack-two-progression">
			<article>
				<img src={images[remyAnchorAsset.assetKey]} alt="Remy Esen at the initial two-star state" />
				<footer><span>Initial · 2★ · cap 20</span><b>Identity locked</b></footer>
				<p>Modest workwear, baseline physique, permanent first-reveal quality.</p>
			</article>
			<article>
				<img src={remyEquipped} alt="Remy Esen with upgraded equipment at two stars" />
				<footer><span>Equipped · 2★ · cap 20</span><b>No body change</b></footer>
				<p>Hammer, apron, and heat guard improve. Star state and physiology stay fixed.</p>
			</article>
			<article>
				<img src={remyEvolved} alt="Remy Esen evolved to three stars" />
				<footer><span>Evolved · 3★ · cap 30</span><b>Physical change</b></footer>
				<p>Functional mass, stance, styling, and restrained resonance advance together.</p>
			</article>
		</div>
		<div class="timing-card">
			<div>
				<p class="eyebrow">Measured Pack 2 pipeline</p>
				<strong>{seconds(humanBenchmark.requestMedianMs)}</strong>
				<span>median premium human request</span>
			</div>
			<dl>
				<div>
					<dt>Request p95</dt>
					<dd>{seconds(humanBenchmark.requestP95Ms)}</dd>
				</div>
				<div>
					<dt>Candidate p95</dt>
					<dd>{seconds(humanBenchmark.candidateP95Ms)}</dd>
				</div>
				<div>
					<dt>Approval</dt>
					<dd>{data.benchmark.humanApproval}</dd>
				</div>
				<div>
					<dt>Cost</dt>
					<dd>Unavailable in built-in path</dd>
				</div>
			</dl>
			<p>
				<strong>Not real-time artwork.</strong> The random manifest is procedural and can appear immediately;
				the first reveal should select an already approved cached portrait. New premium art, equipment
				edits, and evolution variants stay in the asynchronous authoring pipeline.
			</p>
			<a class="proof-note" href={resolve('/forge/pack-2/runtime')}
				>Open procedural runtime proof →</a
			>
		</div>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #07090d;
		color: #f4efe5;
	}
	main {
		min-height: 100vh;
		background:
			radial-gradient(circle at 50% 22rem, rgba(58, 89, 126, 0.2), transparent 34rem),
			linear-gradient(#080a0f, #0b0d12);
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
		border-bottom: 1px solid #ffffff14;
		background: #06080cd9;
	}
	.wordmark,
	.eyebrow {
		font-size: 0.63rem;
		font-weight: 800;
		letter-spacing: 0.18em;
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
		color: #8aa7dd;
		font-size: 0.5rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1.2rem;
		color: #f4efe580;
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	.intro,
	.browser,
	.inspection,
	.scale,
	.survival {
		max-width: 96rem;
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 5rem) clamp(1rem, 3vw, 3rem);
	}
	.benchmark {
		max-width: 96rem;
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 5rem) clamp(1rem, 3vw, 3rem);
	}
	.intro {
		display: grid;
		grid-template-columns: 1.25fr 1fr;
		gap: 4rem;
		align-items: end;
	}
	.eyebrow {
		color: #8aa7dd;
	}
	h1 {
		margin: 0.8rem 0 0;
		font:
			400 clamp(3.4rem, 8vw, 7.5rem)/0.82 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	h1 em {
		color: #8aa7dd;
		font-weight: 400;
	}
	.intro-copy > p {
		max-width: 38rem;
		color: #f4efe5a6;
		line-height: 1.7;
	}
	.summary {
		display: flex;
		gap: 1.5rem;
		margin-top: 2rem;
	}
	.summary span {
		color: #f4efe56b;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.summary b {
		display: block;
		color: #f4efe5;
		font:
			400 1.8rem Georgia,
			serif;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 2rem;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #ffffff17;
	}
	.section-heading > div:first-child {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}
	.section-heading > div:first-child > span {
		color: #8aa7dd;
		font-size: 0.65rem;
	}
	h2 {
		margin: 0;
		font:
			400 clamp(2rem, 4vw, 3.5rem) Georgia,
			serif;
	}
	.section-heading > p {
		color: #f4efe575;
		font-size: 0.7rem;
	}
	.filters {
		display: flex;
		gap: 0.35rem;
	}
	.filters button {
		border: 1px solid #ffffff1f;
		padding: 0.55rem 0.8rem;
		color: #f4efe57a;
		background: transparent;
		text-transform: capitalize;
		cursor: pointer;
	}
	.filters button.active {
		border-color: #8aa7dd;
		color: #e9f0ff;
		background: #8aa7dd1a;
	}
	.candidate-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.candidate-grid button {
		position: relative;
		overflow: hidden;
		border: 1px solid #ffffff16;
		padding: 0;
		color: inherit;
		text-align: left;
		background: #0b0e14;
		cursor: pointer;
	}
	.candidate-grid button.selected {
		border-color: #8aa7dd;
		box-shadow: 0 0 0 1px #8aa7dd55;
	}
	.candidate-grid img {
		display: block;
		width: 100%;
		aspect-ratio: 2/3;
		object-fit: cover;
	}
	.candidate-grid button > div {
		padding: 0.9rem;
	}
	.candidate-grid span,
	.candidate-grid small,
	.candidate-grid strong {
		display: block;
	}
	.candidate-grid span {
		color: #8aa7dd;
		font-size: 0.56rem;
	}
	.candidate-grid strong {
		margin: 0.25rem 0;
		font:
			400 1.1rem Georgia,
			serif;
	}
	.candidate-grid small {
		color: #f4efe56e;
		text-transform: capitalize;
	}
	.candidate-grid i {
		position: absolute;
		top: 0.6rem;
		left: 0.6rem;
		padding: 0.35rem;
		color: #edc980;
		background: #080a0fe8;
		font-size: 0.45rem;
		font-style: normal;
		text-transform: uppercase;
	}
	.candidate-grid em {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		color: #f4efe56b;
		font-size: 0.45rem;
		font-style: normal;
		text-transform: uppercase;
	}
	.inspection-grid {
		display: grid;
		grid-template-columns: minmax(15rem, 0.72fr) minmax(26rem, 1.45fr) minmax(15rem, 0.7fr);
		gap: 1rem;
		align-items: start;
	}
	.anchor-panel,
	.continuity-panel,
	.manifest-panel {
		margin: 0;
		border: 1px solid #ffffff16;
		background: #090c12;
	}
	.anchor-panel img,
	.continuity-panel img {
		display: block;
		width: 100%;
	}
	article footer {
		display: flex;
		justify-content: space-between;
		padding: 0.8rem;
		color: #f4efe56e;
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	article footer b {
		color: #7fd6a1;
	}
	article footer b.concern {
		color: #edc980;
	}
	.continuity-panel.empty {
		display: grid;
		min-height: 24rem;
		place-items: center;
		background: repeating-linear-gradient(
			135deg,
			#0a0d13,
			#0a0d13 12px,
			#0d1017 12px,
			#0d1017 24px
		);
	}
	.not-authored {
		max-width: 15rem;
		text-align: center;
	}
	.not-authored span,
	.not-authored strong {
		display: block;
	}
	.not-authored span {
		color: #8aa7dd;
		font-size: 0.55rem;
		text-transform: uppercase;
	}
	.not-authored strong {
		margin: 0.6rem;
		font:
			400 2rem Georgia,
			serif;
	}
	.not-authored p {
		color: #f4efe566;
		font-size: 0.7rem;
		line-height: 1.5;
	}
	.manifest-panel {
		padding: 1.4rem;
	}
	.manifest-panel h3 {
		margin: 0.5rem 0 1.5rem;
		font:
			400 2.1rem Georgia,
			serif;
	}
	dl {
		display: grid;
		gap: 0.8rem;
		margin: 0;
	}
	dl div {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		gap: 0.6rem;
		padding-bottom: 0.6rem;
		border-bottom: 1px solid #ffffff0d;
	}
	dt {
		color: #f4efe55f;
		font-size: 0.55rem;
		text-transform: uppercase;
	}
	dd {
		margin: 0;
		color: #f4efe5bd;
		font-size: 0.72rem;
		text-transform: capitalize;
	}
	.gate {
		margin-top: 1.5rem;
		padding: 1rem;
		border: 1px solid #edc98044;
		background: #edc9800b;
	}
	.gate span,
	.gate strong,
	.gate small {
		display: block;
	}
	.gate span {
		color: #edc980;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.gate strong {
		margin: 0.3rem 0;
	}
	.gate small {
		color: #f4efe566;
	}
	.lineup {
		display: flex;
		min-height: 29rem;
		align-items: end;
		justify-content: center;
		gap: clamp(0.2rem, 1vw, 1rem);
		padding: 2rem 1rem 0;
		border-bottom: 1px solid #8aa7dd55;
		background: linear-gradient(90deg, #ffffff05 1px, transparent 1px) 0 0/4rem 100%;
	}
	.lineup-person {
		position: relative;
		display: grid;
		width: min(14vw, 10rem);
		justify-items: center;
	}
	.lineup-person img {
		display: block;
		width: auto;
		max-width: 100%;
		object-fit: contain;
		object-position: bottom;
	}
	.lineup-person strong {
		margin-top: 0.7rem;
		font:
			400 0.85rem Georgia,
			serif;
	}
	.lineup-person small {
		color: #f4efe55c;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.height-rule {
		position: absolute;
		top: 0.2rem;
		right: 0;
		z-index: 2;
		color: #8aa7dd;
		font-size: 0.55rem;
	}
	.survival-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.8rem;
	}
	.survival-grid article {
		display: grid;
		grid-template-columns: 1fr 1fr;
		overflow: hidden;
		border: 1px solid #ffffff16;
		background: #090c12;
	}
	.roster {
		overflow: hidden;
		aspect-ratio: 4/5;
	}
	.roster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 16%;
		transform: scale(1.45);
	}
	.settlement {
		display: grid;
		place-items: end center;
		padding: 1rem;
		background: radial-gradient(circle at 50% 85%, #8aa7dd20, transparent 45%);
	}
	.settlement :global(figure) {
		width: 3rem;
	}
	.survival-grid footer {
		grid-column: 1/-1;
	}
	.progression-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}
	.progression-grid article {
		border: 1px solid #ffffff16;
		background: #090c12;
	}
	.progression-grid img {
		display: block;
		width: 100%;
		aspect-ratio: 2/3;
		object-fit: cover;
	}
	.progression-grid article > p {
		margin: 0;
		padding: 0 0.8rem 1rem;
		color: #f4efe566;
		font-size: 0.68rem;
		line-height: 1.55;
	}
	.timing-card {
		display: grid;
		grid-template-columns: 0.8fr 1fr 1.4fr;
		gap: 2rem;
		align-items: center;
		margin-top: 1rem;
		padding: clamp(1.2rem, 3vw, 2.5rem);
		border: 1px solid #8aa7dd44;
		background: linear-gradient(110deg, #8aa7dd12, #090c12 50%);
	}
	.timing-card > div > strong,
	.timing-card > div > span {
		display: block;
	}
	.timing-card > div > strong {
		font:
			400 clamp(2.8rem, 5vw, 5rem) Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	.timing-card > div > span,
	.timing-card > p {
		color: #f4efe575;
		font-size: 0.72rem;
		line-height: 1.65;
	}
	.timing-card > p strong {
		color: #edc980;
	}
	.proof-note {
		grid-column: 3;
		color: #8aa7dd;
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	@media (max-width: 900px) {
		.intro,
		.inspection-grid,
		.progression-grid,
		.timing-card {
			grid-template-columns: 1fr;
		}
		.proof-note {
			grid-column: auto;
		}
		.candidate-grid,
		.survival-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.lineup {
			overflow-x: auto;
			justify-content: start;
		}
		.lineup-person {
			min-width: 7rem;
		}
	}
</style>
