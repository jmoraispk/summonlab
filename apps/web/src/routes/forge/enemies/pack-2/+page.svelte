<script lang="ts">
	import { resolve } from '$app/paths';
	import type { VisualReviewRecord, VisualReviewVerdict } from '@summonlab/contracts';
	import {
		PACK_TWO_MONSTER_ARCHETYPES,
		PACK_TWO_MONSTER_FAMILIES,
		PACK_TWO_MONSTER_GRADES,
		PACK_TWO_MONSTER_GRADE_VERSION,
		PACK_TWO_MONSTER_ROSTER_VERSION,
		createPackTwoMonsterVariant,
		type PackTwoMonsterId
	} from '@summonlab/content';
	import arachnids from '../../../../../../../assets/enemies/review/pack-2/arachnids-v1.png';
	import arcaneHostiles from '../../../../../../../assets/enemies/review/pack-2/arcane-hostiles-v1.png';
	import draconic from '../../../../../../../assets/enemies/review/pack-2/draconic-v1.png';
	import dungeonPredators from '../../../../../../../assets/enemies/review/pack-2/dungeon-predators-v1.png';
	import elementals from '../../../../../../../assets/enemies/review/pack-2/elementals-v1.png';
	import gradeEscalationProof from '../../../../../../../assets/enemies/review/pack-2/monster-grade-escalation-v1.png';
	import stoneBreakerAnchor from '../../../../../../../assets/enemies/review/pack-2/benchmarks/stone-breaker-anchor-v1.png';
	import undead from '../../../../../../../assets/enemies/review/pack-2/undead-v1.png';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let reviewHistory = $state(data.reviewHistory);
	let selectedPlateKey = $state('');
	let reviewVerdict = $state<VisualReviewVerdict>('approved');
	let reviewer = $state('');
	let reviewNote = $state('');
	let reviewBusy = $state(false);
	let reviewMessage = $state('');
	let reviewError = $state('');
	let selectedMonsterId = $state<PackTwoMonsterId>('death-knight');

	const plates: Record<string, string> = {
		'elementals-v1': elementals,
		'arachnids-v1': arachnids,
		'arcane-hostiles-v1': arcaneHostiles,
		'undead-v1': undead,
		'draconic-v1': draconic,
		'dungeon-predators-v1': dungeonPredators
	};
	const monsterById = new Map(PACK_TWO_MONSTER_ARCHETYPES.map((monster) => [monster.id, monster]));
	const monster = (id: PackTwoMonsterId) => monsterById.get(id)!;
	const reviewableAssets = $derived([...data.catalog.plates, ...data.benchmarkAssets]);
	const selectedAsset = $derived(
		reviewableAssets.find((asset) => asset.assetKey === selectedPlateKey) ?? reviewableAssets[0]!
	);
	const currentReview = $derived(reviewHistory.latestByAsset[selectedAsset.assetKey] ?? null);
	const gradeVariants = $derived(
		PACK_TWO_MONSTER_GRADES.map((profile) =>
			createPackTwoMonsterVariant(selectedMonsterId, profile.grade, 'forge-grade-ladder')
		)
	);

	async function submitReview() {
		if (!reviewNote.trim() || !reviewer.trim() || reviewBusy) return;
		reviewBusy = true;
		reviewMessage = '';
		reviewError = '';
		try {
			const response = await fetch('/api/dev/visual-reviews', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					reviewId: crypto.randomUUID(),
					assetKey: selectedAsset.assetKey,
					catalogVersion: data.catalog.catalogVersion,
					assetContentHash: selectedAsset.contentHash,
					verdict: reviewVerdict,
					note: reviewNote.trim(),
					reviewer: reviewer.trim()
				})
			});
			const body = (await response.json()) as VisualReviewRecord & { message?: string };
			if (!response.ok || !body.reviewId) throw new Error(body.message ?? 'Review was not saved.');
			reviewHistory = {
				reviews: [...reviewHistory.reviews, body],
				latestByAsset: { ...reviewHistory.latestByAsset, [body.assetKey]: body }
			};
			reviewMessage = `${body.verdict === 'approved' ? 'Accepted for promotion' : 'Revision requested'} · ${body.assetKey}`;
			reviewNote = '';
		} catch (error) {
			reviewError = error instanceof Error ? error.message : 'Review was not saved.';
		} finally {
			reviewBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Pack 2 monsters · Summoning Forge</title>
	<meta
		name="description"
		content="Review 24 Character Pack 2 monster archetypes and deterministic grade 1–10 escalation by family, silhouette, battlefield duty, telegraph, and weak point."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Creature Forge</span><strong>Pack 2 threat language</strong></div>
		<nav>
			<a href={resolve('/forge/enemies')}>Pack 1 monsters</a>
			<a href={resolve('/forge/pack-2')}>Pack 2 humans</a>
			<a href={resolve('/forge/pack-2/revision')}>Revision proofs</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{PACK_TWO_MONSTER_ROSTER_VERSION} · 24 canonical archetypes</p>
			<h1>Read the duty.<br /><em>Then survive it.</em></h1>
		</div>
		<div class="intro-copy">
			<p>
				Monster variation lives between species, duties, ranks, ages, and subtypes—not through the
				human body randomizer. These six plates are taxonomy candidates; production anchors follow
				only after human approval.
			</p>
			<div>
				<span><b>6</b> families</span><span><b>24</b> species</span><span
					><b>10</b> grades each</span
				>
			</div>
		</div>
	</section>

	<section class="families" aria-labelledby="families-title">
		<header class="section-heading">
			<div>
				<span>01</span>
				<h2 id="families-title">Battlefield taxonomy</h2>
			</div>
			<p>Each lineup runs left to right in the same order as its duty cards.</p>
		</header>

		{#each PACK_TWO_MONSTER_FAMILIES as family, familyIndex (family.id)}
			<article class="family" data-testid="pack-two-monster-family">
				<header>
					<div>
						<span>{String(familyIndex + 1).padStart(2, '0')}</span>
						<h3>{family.name}</h3>
					</div>
					<div class="family-review">
						<strong
							>{reviewHistory.latestByAsset[family.plate]?.verdict ??
								'Candidate · human review required'}</strong
						>
						<button onclick={() => (selectedPlateKey = family.plate)}>Review exact plate</button>
					</div>
				</header>
				<img src={plates[family.plate]} alt={`${family.name}: four battlefield-duty concepts`} />
				<div class="duties">
					{#each family.monsterIds as monsterId (monsterId)}
						{@const entry = monster(monsterId)}
						<div data-testid="pack-two-monster-duty">
							<span>{entry.sizeBand} · {entry.duty} · G1–G10</span>
							<h4>{entry.name}</h4>
							<p>{entry.dutyCue}</p>
							<dl>
								<div>
									<dt>Tell</dt>
									<dd>{entry.telegraph}</dd>
								</div>
								<div>
									<dt>Counter</dt>
									<dd>{entry.weakPoint}</dd>
								</div>
							</dl>
						</div>
					{/each}
				</div>
			</article>
		{/each}
	</section>

	<section class="grade-lab" aria-labelledby="grade-lab-title">
		<header class="section-heading">
			<div>
				<span>02</span>
				<h2 id="grade-lab-title">Ten grades. One readable species.</h2>
			</div>
			<p>{PACK_TWO_MONSTER_GRADE_VERSION} · deterministic preview seed</p>
		</header>
		<div class="grade-controls">
			<label for="grade-monster">Inspect a species across all grades</label>
			<select id="grade-monster" bind:value={selectedMonsterId}>
				{#each PACK_TWO_MONSTER_ARCHETYPES as entry (entry.id)}
					<option value={entry.id}>{entry.name} · {entry.duty}</option>
				{/each}
			</select>
			<p>
				Adjacent level bands overlap, but their means rise decisively. Physical species gain scale
				and mass; casters gain controlled glow; weapon-bearing duties gain weapon scale.
			</p>
		</div>
		<div class="grade-track">
			{#each gradeVariants as variant (variant.grade)}
				<article data-testid="monster-grade">
					<header><span>Grade {variant.grade}</span><strong>{variant.gradeTitle}</strong></header>
					<div class="threat-meter">
						<div style={`--threat:${variant.sizeScale}`}></div>
					</div>
					<dl>
						<div>
							<dt>Level band</dt>
							<dd>{variant.levelBand.min}–{variant.levelBand.max}</dd>
						</div>
						<div>
							<dt>Mean</dt>
							<dd>{variant.levelBand.mean}</dd>
						</div>
						<div>
							<dt>Size</dt>
							<dd>×{variant.sizeScale}</dd>
						</div>
						<div>
							<dt>Muscle</dt>
							<dd>×{variant.musculatureScale}</dd>
						</div>
						<div>
							<dt>Glow</dt>
							<dd>×{variant.magicGlowScale}</dd>
						</div>
						<div>
							<dt>Weapon</dt>
							<dd>×{variant.weaponScale}</dd>
						</div>
					</dl>
					<p>{variant.escalationCues.at(-1)}</p>
				</article>
			{/each}
		</div>
		<figure class="grade-proof">
			<img
				src={gradeEscalationProof}
				alt="Death Knight and Tower Archmage visual progressions at grades four, seven, and ten"
			/>
			<figcaption>
				<strong>Generated escalation proof · not promoted</strong>
				<span
					>Death Knight demonstrates scale, mass, and weapon growth; Tower Archmage demonstrates
					controlled glow and spell-geometry growth.</span
				>
			</figcaption>
		</figure>
	</section>

	<section class="benchmark-anchor" aria-labelledby="monster-anchor-title">
		<div>
			<p class="eyebrow">Individual-anchor benchmark</p>
			<h2 id="monster-anchor-title">Stone Breaker</h2>
			<p>
				The family plate establishes taxonomy. This retained single-creature candidate tests the
				next production step: full-body identity, ground contact, siege silhouette, and exposed
				impact seams.
			</p>
			<button onclick={() => (selectedPlateKey = data.benchmarkAssets[0]!.assetKey)}
				>Review exact anchor</button
			>
		</div>
		<img src={stoneBreakerAnchor} alt="Individual Stone Breaker production-anchor candidate" />
	</section>

	<section class="review" aria-labelledby="monster-review-title">
		<header class="section-heading">
			<div>
				<span>03</span>
				<h2 id="monster-review-title">Hash-bound monster review</h2>
			</div>
			<p>
				{reviewHistory.reviews.length} recorded monster decision{reviewHistory.reviews.length === 1
					? ''
					: 's'}
			</p>
		</header>
		<div class="review-grid">
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void submitReview();
				}}
			>
				<label>
					<span>Exact monster asset</span>
					<select bind:value={selectedPlateKey}>
						{#each reviewableAssets as asset (asset.assetKey)}
							<option value={asset.assetKey}>{asset.assetKey}</option>
						{/each}
					</select>
				</label>
				<code>{selectedAsset.contentHash}</code>
				<div class="verdict" role="radiogroup" aria-label="Monster plate verdict">
					<button
						type="button"
						class:active={reviewVerdict === 'approved'}
						onclick={() => (reviewVerdict = 'approved')}>Accept</button
					>
					<button
						type="button"
						class:active={reviewVerdict === 'revise'}
						onclick={() => (reviewVerdict = 'revise')}>Revise</button
					>
				</div>
				<label><span>Reviewer</span><input bind:value={reviewer} maxlength="80" required /></label>
				<label
					><span>Decision note</span><textarea bind:value={reviewNote} maxlength="1000" required
					></textarea></label
				>
				<button
					class="record-review"
					type="submit"
					disabled={!data.reviewPersistenceAvailable ||
						reviewBusy ||
						!reviewer.trim() ||
						!reviewNote.trim()}>{reviewBusy ? 'Recording…' : 'Record decision'}</button
				>
				{#if !data.reviewPersistenceAvailable}
					<p class="review-error">
						Start the local stack with <code>pnpm dev</code> to record decisions.
					</p>
				{:else if reviewError}
					<p class="review-error" role="alert">{reviewError}</p>
				{:else if reviewMessage}
					<p class="review-success" data-testid="monster-review-result">{reviewMessage}</p>
				{/if}
			</form>
			<article class="decision">
				<p class="eyebrow">Current decision</p>
				<h3>{selectedAsset.assetKey}</h3>
				{#if currentReview}
					<strong class:revise={currentReview.verdict === 'revise'}>{currentReview.verdict}</strong>
					<blockquote>{currentReview.note}</blockquote>
					<small
						>{currentReview.reviewer} · {new Date(currentReview.createdAt).toLocaleString()}</small
					>
				{:else}
					<strong>Unreviewed</strong>
					<p>No decision is bound to this exact plate hash.</p>
				{/if}
				<p>Accept records judgment only. Catalog promotion remains a separate audited step.</p>
			</article>
		</div>
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
			radial-gradient(circle at 50% 18rem, #9b683317, transparent 36rem),
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
		color: #d7a85f;
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
	.families,
	.grade-lab,
	.benchmark-anchor,
	.review {
		max-width: 96rem;
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 5rem) clamp(1rem, 3vw, 3rem);
	}
	.benchmark-anchor {
		display: grid;
		grid-template-columns: minmax(0, 0.75fr) minmax(18rem, 1.25fr);
		gap: clamp(1rem, 4vw, 4rem);
		align-items: center;
		border-top: 1px solid #ffffff14;
	}
	.benchmark-anchor h2 {
		margin: 0.35rem 0 1rem;
		font:
			400 clamp(2rem, 5vw, 4.5rem) Georgia,
			serif;
	}
	.benchmark-anchor p {
		color: #f4efe56b;
		line-height: 1.7;
	}
	.benchmark-anchor button {
		margin-top: 1rem;
		border: 1px solid #d7a85f;
		padding: 0.75rem 1rem;
		color: #fff;
		background: #d7a85f18;
		cursor: pointer;
		text-transform: uppercase;
	}
	.benchmark-anchor img {
		display: block;
		width: 100%;
		max-height: 52rem;
		object-fit: contain;
		background: #090c12;
	}
	.intro {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 4rem;
		align-items: end;
	}
	.eyebrow {
		color: #d7a85f;
	}
	h1 {
		margin: 0.8rem 0 0;
		font:
			400 clamp(3.4rem, 8vw, 7.5rem)/0.82 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	h1 em {
		color: #d7a85f;
		font-weight: 400;
	}
	.intro-copy > p {
		color: #f4efe5a6;
		line-height: 1.7;
	}
	.intro-copy > div {
		display: flex;
		gap: 1.5rem;
		margin-top: 2rem;
	}
	.intro-copy span {
		color: #f4efe56b;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.intro-copy b {
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
	.section-heading > div {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}
	.section-heading > div > span {
		color: #d7a85f;
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
	.family {
		margin: 0 0 5rem;
		border: 1px solid #ffffff16;
		background: #090c12;
	}
	.family > header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.2rem;
	}
	.family > header div {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}
	.family > header span {
		color: #d7a85f;
		font-size: 0.6rem;
	}
	.family > header h3 {
		margin: 0;
		font:
			400 2rem Georgia,
			serif;
	}
	.family-review strong {
		color: #edc980;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.family > header .family-review {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.family-review button,
	.verdict button,
	.record-review {
		border: 1px solid #ffffff20;
		padding: 0.65rem;
		color: #f4efe57a;
		background: transparent;
		cursor: pointer;
		text-transform: uppercase;
	}
	.family > img {
		display: block;
		width: 100%;
		border-block: 1px solid #ffffff16;
	}
	.duties {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
	}
	.duties > div {
		padding: 1.2rem;
		border-right: 1px solid #ffffff12;
	}
	.duties > div:last-child {
		border: 0;
	}
	.duties span {
		color: #d7a85f;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	h4 {
		margin: 0.35rem 0 0.7rem;
		font:
			400 1.25rem Georgia,
			serif;
	}
	.duties p {
		min-height: 3.6rem;
		color: #f4efe58c;
		font-size: 0.68rem;
		line-height: 1.5;
	}
	.grade-lab {
		border-top: 1px solid #ffffff14;
	}
	.grade-controls {
		display: grid;
		grid-template-columns: auto minmax(18rem, 0.8fr) minmax(20rem, 1fr);
		gap: 1rem;
		align-items: center;
		margin-bottom: 2rem;
	}
	.grade-controls label {
		color: #d7a85f;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.grade-controls select {
		border: 1px solid #ffffff20;
		padding: 0.75rem;
		color: #f4efe5;
		background: #090c12;
	}
	.grade-controls p {
		margin: 0;
		color: #f4efe575;
		font-size: 0.7rem;
		line-height: 1.6;
	}
	.grade-track {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		border-top: 1px solid #ffffff16;
		border-left: 1px solid #ffffff16;
	}
	.grade-track > article {
		min-width: 0;
		border-right: 1px solid #ffffff16;
		border-bottom: 1px solid #ffffff16;
		padding: 1rem;
		background: #090c12;
	}
	.grade-track header span,
	.grade-track header strong {
		display: block;
	}
	.grade-track header span {
		color: #d7a85f;
		font-size: 0.52rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	.grade-track header strong {
		margin-top: 0.25rem;
		font:
			400 1.15rem Georgia,
			serif;
	}
	.threat-meter {
		display: flex;
		align-items: end;
		height: 6rem;
		margin: 0.8rem 0;
		border-bottom: 1px solid #ffffff20;
		background: linear-gradient(transparent, #d7a85f08);
	}
	.threat-meter div {
		width: calc(1.1rem * var(--threat));
		height: calc(2.5rem * var(--threat));
		max-height: 5.8rem;
		margin: 0 auto;
		border-radius: 50% 50% 24% 24%;
		background: linear-gradient(#edc980, #7f392c);
		box-shadow: 0 0 calc(0.4rem * var(--threat)) #d7a85f66;
	}
	.grade-track dl {
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem 0.6rem;
	}
	.grade-track dl div {
		padding-top: 0.35rem;
	}
	.grade-track > article > p {
		min-height: 2.8rem;
		color: #f4efe56b;
		font-size: 0.6rem;
		line-height: 1.45;
	}
	.grade-proof {
		margin: 2rem 0 0;
		border: 1px solid #ffffff16;
		background: #090c12;
	}
	.grade-proof img {
		display: block;
		width: 100%;
	}
	.grade-proof figcaption {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		padding: 1rem;
		border-top: 1px solid #ffffff16;
	}
	.grade-proof figcaption strong {
		color: #d7a85f;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.grade-proof figcaption span {
		max-width: 42rem;
		color: #f4efe56b;
		font-size: 0.65rem;
		line-height: 1.5;
	}
	dl {
		display: grid;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}
	dl div {
		padding-top: 0.6rem;
		border-top: 1px solid #ffffff10;
	}
	dt {
		color: #f4efe550;
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	dd {
		margin: 0.25rem 0 0;
		color: #f4efe5b0;
		font-size: 0.62rem;
		line-height: 1.4;
	}
	.review-grid {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 1rem;
	}
	.review form,
	.decision {
		margin: 0;
		border: 1px solid #ffffff16;
		padding: clamp(1.2rem, 3vw, 2rem);
		background: #090c12;
	}
	.review form label {
		display: grid;
		gap: 0.35rem;
		margin-top: 1rem;
	}
	.review form label span {
		color: #d7a85f;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.review select,
	.review input,
	.review textarea {
		border: 1px solid #ffffff20;
		padding: 0.65rem;
		color: #f4efe5;
		background: #07090d;
	}
	.review textarea {
		min-height: 7rem;
		resize: vertical;
	}
	.review form > code {
		display: block;
		margin-top: 0.7rem;
		overflow-wrap: anywhere;
		color: #f4efe54f;
		font-size: 0.55rem;
	}
	.verdict {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
		margin-top: 1rem;
	}
	.verdict button.active {
		border-color: #d7a85f;
		color: #fff;
		background: #d7a85f18;
	}
	.record-review {
		width: 100%;
		margin-top: 1rem;
		border-color: #d7a85f;
		color: #fff;
	}
	.record-review:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.review-error {
		color: #edc980;
	}
	.review-success {
		color: #7fd6a1;
	}
	.decision h3 {
		font:
			400 2rem Georgia,
			serif;
	}
	.decision > strong {
		display: block;
		margin: 1rem 0;
		color: #7fd6a1;
		font:
			400 2rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.decision > strong.revise {
		color: #edc980;
	}
	.decision blockquote,
	.decision > p,
	.decision > small {
		color: #f4efe56b;
		line-height: 1.6;
	}
	@media (max-width: 850px) {
		.intro,
		.benchmark-anchor,
		.review-grid {
			grid-template-columns: 1fr;
		}
		.grade-controls {
			grid-template-columns: 1fr;
		}
		.grade-track {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.duties {
			grid-template-columns: repeat(2, 1fr);
		}
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.family > header,
		.section-heading {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
