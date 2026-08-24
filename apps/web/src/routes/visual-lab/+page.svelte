<script lang="ts">
	import { resolve } from '$app/paths';
	import maraAnchor from '../../../../../assets/heroes/ember-01-anchor-v1.png';
	import maraContinuity from '../../../../../assets/heroes/visuals/ember-01-continuity-v1.png';
	import remyAnchor from '../../../../../assets/heroes/visuals/hearth-02-anchor-v1.png';
	import remyContinuity from '../../../../../assets/heroes/visuals/hearth-02-continuity-v1.png';
	import rosterPair from '../../../../../assets/heroes/visuals/hearth-roster-pair-v1.png';
	import settlementScale from '../../../../../assets/heroes/visuals/hearth-settlement-scale-v1.png';
	import HeroRig from '$lib/components/HeroRig.svelte';
	import type { VisualReviewRecord, VisualReviewVerdict } from '@summonlab/contracts';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let selectedId = $state(data.characters[0]!.manifest.characterId);
	// svelte-ignore state_referenced_locally
	let reviewHistory = $state(data.reviewHistory);
	// svelte-ignore state_referenced_locally
	let reviewAssetKey = $state(
		data.catalog.assets.find((asset) => asset.status === 'approval-candidate')?.assetKey ??
			data.catalog.assets[0]!.assetKey
	);
	let reviewVerdict = $state<VisualReviewVerdict>('approved');
	let reviewNote = $state('');
	let reviewer = $state('project-lead');
	let reviewBusy = $state(false);
	let reviewMessage = $state('');
	let reviewError = $state('');

	const selected = $derived(
		data.characters.find((character) => character.manifest.characterId === selectedId) ??
			data.characters[0]!
	);
	const selectedProfile = $derived(
		data.catalog.profiles.find((profile) => profile.characterId === selectedId)!
	);
	const selectedAnchor = $derived(
		selected.manifest.artKey === 'ember-01-anchor-v1' ? maraAnchor : remyAnchor
	);
	const selectedContinuity = $derived(
		selected.manifest.artKey === 'ember-01-anchor-v1' ? maraContinuity : remyContinuity
	);
	const selectedAsset = $derived(
		data.catalog.assets.find((asset) => asset.assetKey === selected.manifest.artKey)!
	);
	const settlementAsset = $derived(
		data.catalog.assets.find((asset) => asset.assetKey === 'hearth-settlement-scale-v1')!
	);
	const reviewAsset = $derived(
		data.catalog.assets.find((asset) => asset.assetKey === reviewAssetKey)!
	);
	const currentReview = $derived(reviewHistory.latestByAsset[reviewAssetKey] ?? null);
	const rigStates = [
		{ label: 'Neutral', expression: 'neutral', equipment: 'none', palette: 'base' },
		{ label: 'Night watch', expression: 'alert', equipment: 'short-bow', palette: 'night' },
		{ label: 'Training', expression: 'exertion', equipment: 'practice-blade', palette: 'base' },
		{ label: 'Injured', expression: 'injured', equipment: 'practice-blade', palette: 'injured' }
	] as const;

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
					assetKey: reviewAsset.assetKey,
					catalogVersion: data.catalog.catalogVersion,
					assetContentHash: reviewAsset.contentHash,
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
			reviewMessage = `${body.verdict === 'approved' ? 'Accepted' : 'Revision requested'} · ${body.assetKey}`;
			reviewNote = '';
		} catch (error) {
			reviewError = error instanceof Error ? error.message : 'Review was not saved.';
		} finally {
			reviewBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Visual continuity lab · summonlab</title>
	<meta
		name="description"
		content="Review original Summonlab character anchors, continuity views, roster composition, and settlement-scale recognition."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Phase 3</span><strong>Visual continuity lab</strong></div>
		<nav aria-label="Visual lab links">
			<a href={resolve('/visual-lab/recognition')}>Recognition audit</a>
			<a href={resolve('/visual-lab/summon-card')}>Summon-card request</a>
			<a href={resolve('/visual-lab/runtime-bundles')}>Runtime bundles</a>
			<a href={resolve('/forge/contact-sheet')}>100-seed sheet</a>
			<a href={resolve('/forge')}>Return to forge</a>
		</nav>
	</header>

	<section class="opening">
		<div class="opening-copy">
			<p class="eyebrow">Approval gate · visual-catalog-v1</p>
			<h1>One person.<br />Every distance.</h1>
			<p>
				The manifest defines the body. The profile locks identity. Generated art must remain an
				expression of those facts across portraits, equipment, injury, group scenes, and settlement
				scale.
			</p>
			<div class="catalog-status">
				<span>{data.catalog.status}</span>
				<strong
					>{data.catalog.assets.length} versioned assets · {data.catalog.profiles.length} people</strong
				>
			</div>
		</div>
		<figure class="roster-hero">
			<img
				src={rosterPair}
				alt="Mara Vey and Remy Nahl standing together before the summoning gate"
				width="1536"
				height="1024"
			/>
			<figcaption>Roster composition · height and silhouette remain distinct</figcaption>
		</figure>
	</section>

	<section class="identity" aria-labelledby="identity-heading">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Representative humans</p>
				<h2 id="identity-heading">Choose an identity to stress</h2>
			</div>
			<div class="character-tabs" role="radiogroup" aria-label="Character under review">
				{#each data.characters as character (character.manifest.characterId)}
					<button
						type="button"
						class:selected={selectedId === character.manifest.characterId}
						role="radio"
						aria-checked={selectedId === character.manifest.characterId}
						onclick={() => (selectedId = character.manifest.characterId)}
					>
						<span>{character.manifest.displayName}</span>
						<small
							>{character.manifest.adultAge} · {character.manifest.heightCm} cm · {character
								.manifest.genderPresentation}</small
						>
					</button>
				{/each}
			</div>
		</header>

		<div class="identity-grid">
			<figure class="anchor">
				<img
					src={selectedAnchor}
					alt={`${selected.manifest.displayName}, canonical full-body identity anchor`}
					width="1024"
					height="1536"
				/>
				<figcaption>
					<span>{selectedAsset.status}</span>
					<strong>{selectedAsset.assetKey}</strong>
				</figcaption>
			</figure>

			<div class="manifest">
				<div class="nameplate">
					<p>
						{'✦'.repeat(selected.manifest.rarityStars)}
						{selected.manifest.rarityStars}-star visual seed
					</p>
					<h3>{selected.manifest.displayName}</h3>
					<code>{selected.manifestHash.slice(0, 16)}</code>
				</div>
				<dl>
					<div>
						<dt>Body</dt>
						<dd>{selected.manifest.bodyFrame} · {selected.manifest.bodyBuild}</dd>
					</div>
					<div>
						<dt>Physiology</dt>
						<dd>
							{selected.manifest.physiology?.massKg} kg · tone {selected.manifest.physiology
								?.muscleTone}/10
						</dd>
					</div>
					<div>
						<dt>Face</dt>
						<dd>
							{selected.manifest.phenotype.faceShape} · {selected.manifest.phenotype.noseProfile}
						</dd>
					</div>
					<div>
						<dt>Hair</dt>
						<dd>
							{selected.manifest.phenotype.hairTexture} · {selected.manifest.phenotype.hairStyle}
						</dd>
					</div>
					<div>
						<dt>Bearing</dt>
						<dd>{selected.manifest.posture} · {selected.manifest.handedness}-handed</dd>
					</div>
					<div>
						<dt>Proportions</dt>
						<dd>
							{selected.manifest.physiology?.limbProportion} limbs · hand {selected.manifest
								.physiology?.handScale}
						</dd>
					</div>
				</dl>

				<div class="locks">
					<span>Identity locks</span>
					<ul>
						{#each selectedProfile.identityLocks as lock (lock)}<li>{lock}</li>{/each}
					</ul>
				</div>

				<div class="palette">
					{#each Object.entries(selectedProfile.paletteSwaps) as [state, colors] (state)}
						<div>
							<span>{state}</span>
							<i
								>{#each colors as color (color)}<b style={`--color:${color}`} title={color}
									></b>{/each}</i
							>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="continuity">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Expression · equipment · injury</p>
				<h2>Does the person survive the state?</h2>
			</div>
			<strong data-testid="continuity-score">5 / 5 identity cues retained</strong>
		</header>
		<figure>
			<img
				src={selectedContinuity}
				alt={`${selected.manifest.displayName} across front, profile, back, expression, equipment, and injury views`}
				width="1536"
				height="1024"
				loading="lazy"
			/>
		</figure>
		<div class="expressions">
			{#each selectedProfile.expressions as expression (expression)}<span>{expression}</span>{/each}
		</div>
	</section>

	<section class="settlement">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Gameplay camera · Hearth 01</p>
				<h2>Recognition without a close-up</h2>
			</div>
			<strong data-testid="settlement-score">4 / 5 cues retained</strong>
		</header>
		<figure>
			<img
				src={settlementScale}
				alt="Mara and Remy moving through a compact walled settlement at gameplay scale"
				width="1536"
				height="1024"
				loading="lazy"
			/>
		</figure>
		<div class="recognition">
			<div><span>Hair</span><strong>retained</strong></div>
			<div><span>Silhouette</span><strong>retained</strong></div>
			<div><span>Palette</span><strong>retained</strong></div>
			<div><span>Signature clothing</span><strong>retained</strong></div>
			<div class="limited"><span>Face</span><strong>not claimed at this scale</strong></div>
		</div>
		<p class="scale-note">{settlementAsset.productionNote}</p>
	</section>

	<section class="runtime-rig">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Code-native runtime layers</p>
				<h2>One rig, state applied</h2>
			</div>
			<strong>expression + anchor + palette</strong>
		</header>
		<div class="rig-grid" data-testid="runtime-rig-states">
			{#each rigStates as state (state.label)}
				<article>
					<HeroRig
						manifest={selected.manifest}
						profile={selectedProfile}
						expression={state.expression}
						equipment={state.equipment}
						paletteMode={state.palette}
						walking={state.label === 'Night watch'}
						compact
					/>
					<div>
						<span>{state.label}</span><code>{state.expression} · {state.equipment}</code>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="ledger">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Provenance</p>
				<h2>Versioned asset ledger</h2>
			</div>
			<strong>SHA-256 checked locally and in CI</strong>
		</header>
		<div class="asset-table">
			{#each data.catalog.assets as asset (asset.assetKey)}
				{@const review = reviewHistory.latestByAsset[asset.assetKey]}
				<article>
					<div><span>{asset.role}</span><strong>{asset.assetKey}</strong></div>
					<code>{asset.contentHash.slice(0, 12)}</code>
					<small>{asset.width}×{asset.height} · {(asset.bytes / 1_000_000).toFixed(2)} MB</small>
					<i
						class:approved={(review?.verdict ?? asset.status) === 'approved'}
						class:revise={review?.verdict === 'revise'}
						data-testid={`asset-status-${asset.assetKey}`}>{review?.verdict ?? asset.status}</i
					>
				</article>
			{/each}
		</div>
	</section>

	<section class="review-gate" aria-labelledby="review-heading">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Append-only human gate</p>
				<h2 id="review-heading">Bind the decision to the pixels.</h2>
			</div>
			<strong
				>{reviewHistory.reviews.length} durable decision{reviewHistory.reviews.length === 1
					? ''
					: 's'}</strong
			>
		</header>
		<div class="review-grid">
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void submitReview();
				}}
			>
				<label>
					<span>Exact asset</span>
					<select bind:value={reviewAssetKey} disabled={reviewBusy}>
						{#each data.catalog.assets as asset (asset.assetKey)}
							<option value={asset.assetKey}>{asset.assetKey} · {asset.role}</option>
						{/each}
					</select>
				</label>
				<div class="verdict" role="radiogroup" aria-label="Visual verdict">
					<button
						type="button"
						class:selected={reviewVerdict === 'approved'}
						aria-pressed={reviewVerdict === 'approved'}
						onclick={() => (reviewVerdict = 'approved')}>Accept</button
					>
					<button
						type="button"
						class:selected={reviewVerdict === 'revise'}
						aria-pressed={reviewVerdict === 'revise'}
						onclick={() => (reviewVerdict = 'revise')}>Revise</button
					>
				</div>
				<label>
					<span>Reviewer</span>
					<input bind:value={reviewer} maxlength="80" required />
				</label>
				<label>
					<span>Decision note</span>
					<textarea
						bind:value={reviewNote}
						maxlength="1000"
						required
						placeholder="What survives? What must change? Be specific enough for the next art pass."
					></textarea>
					<small>{reviewNote.length}/1000</small>
				</label>
				<button
					class="record-review"
					type="submit"
					disabled={!data.reviewPersistenceAvailable ||
						reviewBusy ||
						!reviewNote.trim() ||
						!reviewer.trim()}>{reviewBusy ? 'Recording…' : 'Record hash-bound decision'}</button
				>
				{#if !data.reviewPersistenceAvailable}
					<p class="review-error" role="alert">
						Start with <code>pnpm dev</code> to record reviews.
					</p>
				{:else if reviewError}
					<p class="review-error" role="alert">{reviewError}</p>
				{:else if reviewMessage}
					<p class="review-success" data-testid="review-result">{reviewMessage}</p>
				{/if}
			</form>

			<article class="current-decision" data-testid="current-review">
				<p class="eyebrow">Current decision</p>
				<h3>{reviewAsset.assetKey}</h3>
				<code>{reviewAsset.contentHash}</code>
				{#if currentReview}
					<strong class:revise={currentReview.verdict === 'revise'}>{currentReview.verdict}</strong>
					<blockquote>{currentReview.note}</blockquote>
					<small
						>{currentReview.reviewer} · {new Date(currentReview.createdAt).toLocaleString()}</small
					>
				{:else}
					<strong>unreviewed</strong>
					<p>No human decision is bound to this exact asset hash yet.</p>
				{/if}
				<a href={resolve('/forge/contact-sheet')}>Open 100-seed Forge contact sheet →</a>
			</article>
		</div>
	</section>

	<section class="questions">
		<p class="eyebrow">Feedback gate</p>
		<h2>Before twelve become expensive.</h2>
		<ol>
			<li>Do Mara and Remy feel like specific people rather than polished genre defaults?</li>
			<li>Do their faces, proportions, and bearing survive the continuity sheets?</li>
			<li>
				At settlement scale, is silhouette-level identity enough—or should characters render larger?
			</li>
			<li>
				Should the next pass keep this dark restraint or push linework and expressions closer to
				manhwa panels?
			</li>
		</ol>
	</section>
</main>

<style>
	:global(body) {
		background: #07090e;
	}
	main {
		min-height: 100vh;
		background:
			radial-gradient(circle at 85% 5%, rgba(50, 99, 118, 0.2), transparent 34rem),
			linear-gradient(180deg, #080a0f, #0b0d13 54%, #07080c);
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
		padding: 0 clamp(1.2rem, 4vw, 4rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(5, 7, 11, 0.9);
	}
	.wordmark {
		font-size: 0.76rem;
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
		font-size: 0.48rem;
		letter-spacing: 0.15em;
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
	}
	.topbar nav a {
		justify-self: end;
		color: rgba(246, 241, 231, 0.48);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
	}
	.opening,
	.identity,
	.continuity,
	.settlement,
	.runtime-rig,
	.ledger,
	.review-gate,
	.questions {
		max-width: 96rem;
		margin: 0 auto;
	}
	.opening {
		display: grid;
		grid-template-columns: minmax(19rem, 0.58fr) minmax(0, 1.42fr);
		align-items: center;
		gap: 2rem;
		padding: clamp(3rem, 7vw, 7rem) clamp(1.2rem, 3vw, 3rem) 3rem;
	}
	.eyebrow {
		margin: 0 0 0.65rem;
		color: #d2a04d;
		font-size: 0.58rem;
		font-weight: 750;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 1.2rem;
		font:
			400 clamp(3.5rem, 7vw, 7rem)/0.86 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	.opening-copy > p:not(.eyebrow) {
		max-width: 34rem;
		color: rgba(246, 241, 231, 0.56);
		font-size: 0.84rem;
		line-height: 1.75;
	}
	.catalog-status {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.09);
	}
	.catalog-status span {
		color: #d2a04d;
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.catalog-status strong {
		color: #7fd8e9;
		font:
			500 0.62rem ui-monospace,
			monospace;
	}
	figure {
		margin: 0;
	}
	.roster-hero,
	.continuity figure,
	.settlement figure {
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: #05070b;
	}
	.roster-hero img,
	.continuity img,
	.settlement img {
		display: block;
		width: 100%;
		height: auto;
	}
	.roster-hero figcaption {
		padding: 0.7rem 1rem;
		color: rgba(246, 241, 231, 0.4);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.identity,
	.continuity,
	.settlement,
	.runtime-rig,
	.ledger,
	.review-gate {
		padding: clamp(3rem, 6vw, 6rem) clamp(1.2rem, 3vw, 3rem);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.5rem;
	}
	.section-heading h2,
	.questions h2 {
		margin: 0;
		font:
			400 clamp(2rem, 4vw, 4rem)/0.95 Georgia,
			serif;
		letter-spacing: -0.045em;
	}
	.section-heading > strong {
		color: #78d7af;
		font:
			500 0.62rem ui-monospace,
			monospace;
	}
	.character-tabs {
		display: flex;
		gap: 0.5rem;
	}
	.character-tabs button {
		min-width: 13rem;
		padding: 0.75rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.character-tabs button.selected {
		border-color: #d2a04d;
		background: rgba(210, 160, 77, 0.08);
	}
	.character-tabs span,
	.character-tabs small {
		display: block;
	}
	.character-tabs span {
		font:
			400 0.9rem Georgia,
			serif;
	}
	.character-tabs small {
		margin-top: 0.25rem;
		color: rgba(246, 241, 231, 0.35);
		font-size: 0.52rem;
		text-transform: capitalize;
	}
	.identity-grid {
		display: grid;
		grid-template-columns: minmax(18rem, 0.72fr) minmax(24rem, 1.28fr);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.anchor {
		position: relative;
		min-height: 48rem;
		overflow: hidden;
		background:
			radial-gradient(circle at 50% 32%, rgba(67, 78, 130, 0.28), transparent 55%), #06080d;
	}
	.anchor img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.anchor figcaption {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		display: flex;
		justify-content: space-between;
		padding: 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(5, 7, 11, 0.78);
		backdrop-filter: blur(12px);
	}
	.anchor figcaption span {
		color: #d2a04d;
		font-size: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.anchor figcaption strong {
		font:
			500 0.58rem ui-monospace,
			monospace;
	}
	.manifest {
		padding: clamp(1.5rem, 3vw, 3rem);
		background: rgba(10, 12, 18, 0.94);
	}
	.nameplate {
		padding-bottom: 1.4rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.nameplate p {
		margin-bottom: 0.35rem;
		color: #d2a04d;
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.nameplate h3 {
		margin-bottom: 0.35rem;
		font:
			400 clamp(2.5rem, 4vw, 4.8rem)/0.95 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	.nameplate code {
		color: #7fd8e9;
		font-size: 0.58rem;
	}
	dl {
		display: grid;
		grid-template-columns: 1fr 1fr;
		margin: 1.5rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		border-left: 1px solid rgba(255, 255, 255, 0.07);
	}
	dl div {
		min-width: 0;
		padding: 0.85rem;
		border-right: 1px solid rgba(255, 255, 255, 0.07);
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}
	dt,
	.locks > span,
	.palette > div > span {
		margin-bottom: 0.3rem;
		color: rgba(246, 241, 231, 0.32);
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	dd {
		margin: 0;
		color: rgba(246, 241, 231, 0.76);
		font-size: 0.64rem;
		text-transform: capitalize;
	}
	.locks {
		padding: 1rem;
		border: 1px solid rgba(210, 160, 77, 0.16);
		background: rgba(210, 160, 77, 0.035);
	}
	.locks > span {
		display: block;
		color: #d2a04d;
	}
	.locks ul {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem 1rem;
		margin: 0.8rem 0 0;
		padding: 0;
		list-style: none;
	}
	.locks li {
		color: rgba(246, 241, 231, 0.54);
		font-size: 0.6rem;
	}
	.locks li::before {
		content: '◇';
		margin-right: 0.45rem;
		color: #d2a04d;
	}
	.palette {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.palette > div {
		padding: 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.07);
	}
	.palette span {
		display: block;
	}
	.palette i {
		display: flex;
		height: 1.25rem;
		margin-top: 0.4rem;
	}
	.palette b {
		flex: 1;
		background: var(--color);
	}
	.continuity figure,
	.settlement figure {
		box-shadow: 0 2rem 6rem rgba(0, 0, 0, 0.25);
	}
	.expressions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 1rem;
	}
	.expressions span {
		padding: 0.5rem 0.75rem;
		border: 1px solid rgba(127, 216, 233, 0.18);
		color: #7fd8e9;
		font-size: 0.52rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.recognition {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1px;
		margin-top: 1rem;
		background: rgba(255, 255, 255, 0.07);
	}
	.recognition div {
		padding: 0.8rem;
		background: #0a0c12;
	}
	.recognition span,
	.recognition strong {
		display: block;
	}
	.recognition span {
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.48rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.recognition strong {
		margin-top: 0.3rem;
		color: #78d7af;
		font-size: 0.6rem;
	}
	.recognition .limited strong {
		color: #f2938f;
	}
	.scale-note {
		margin: 1rem 0 0;
		color: rgba(246, 241, 231, 0.43);
		font-size: 0.65rem;
		line-height: 1.6;
	}
	.rig-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.rig-grid article {
		min-width: 0;
		padding: 1rem;
		background:
			radial-gradient(circle at 50% 35%, rgba(67, 78, 130, 0.22), transparent 60%), #090b11;
	}
	.rig-grid article > :global(figure) {
		max-height: 24rem;
		margin: 0 auto;
	}
	.rig-grid article > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 0.7rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}
	.rig-grid span {
		font:
			400 0.78rem Georgia,
			serif;
	}
	.rig-grid code {
		color: #6e919a;
		font-size: 0.48rem;
	}
	.asset-table {
		border: 1px solid rgba(255, 255, 255, 0.09);
	}
	.asset-table article {
		display: grid;
		grid-template-columns: 1.4fr 0.6fr 0.55fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}
	.asset-table article:last-child {
		border: 0;
	}
	.asset-table span,
	.asset-table strong {
		display: block;
	}
	.asset-table span {
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.46rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
	}
	.asset-table strong {
		margin-top: 0.18rem;
		font:
			400 0.78rem Georgia,
			serif;
	}
	.asset-table code,
	.asset-table small {
		color: #6e919a;
		font-size: 0.55rem;
	}
	.asset-table i {
		padding: 0.35rem 0.5rem;
		border: 1px solid rgba(210, 160, 77, 0.3);
		color: #d2a04d;
		font-size: 0.48rem;
		font-style: normal;
		text-transform: uppercase;
	}
	.asset-table i.approved {
		border-color: rgba(120, 215, 175, 0.35);
		color: #78d7af;
	}
	.asset-table i.revise {
		border-color: rgba(242, 147, 143, 0.4);
		color: #f2938f;
	}
	.review-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.7fr);
		gap: 1px;
		padding: 1px;
		background: rgba(255, 255, 255, 0.09);
	}
	.review-grid form,
	.current-decision {
		padding: clamp(1.2rem, 3vw, 2.2rem);
		background: #0a0c12;
	}
	.review-grid form {
		display: grid;
		gap: 1rem;
	}
	.review-grid label,
	.review-grid label > span {
		display: grid;
		gap: 0.45rem;
	}
	.review-grid label > span {
		color: rgba(246, 241, 231, 0.42);
		font-size: 0.53rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.review-grid input,
	.review-grid select,
	.review-grid textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0;
		background: #07090e;
		color: #f6f1e7;
		font: inherit;
	}
	.review-grid input,
	.review-grid select {
		min-height: 2.8rem;
		padding: 0 0.8rem;
	}
	.review-grid textarea {
		min-height: 7rem;
		padding: 0.8rem;
		resize: vertical;
	}
	.review-grid label small {
		justify-self: end;
		color: rgba(246, 241, 231, 0.32);
		font-size: 0.55rem;
	}
	.verdict {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: rgba(255, 255, 255, 0.1);
	}
	.verdict button,
	.record-review {
		min-height: 2.9rem;
		border: 0;
		background: #11141c;
		color: rgba(246, 241, 231, 0.58);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.verdict button.selected {
		background: #1b362f;
		color: #9ce8c8;
	}
	.verdict button:last-child.selected {
		background: #422425;
		color: #f7aaa6;
	}
	.record-review {
		background: #d2a04d;
		color: #08090d;
	}
	.record-review:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}
	.review-success,
	.review-error {
		margin: 0;
		font-size: 0.68rem;
	}
	.review-success {
		color: #78d7af;
	}
	.review-error {
		color: #f2938f;
	}
	.current-decision > code {
		display: block;
		overflow-wrap: anywhere;
		color: #6e919a;
		font-size: 0.55rem;
		line-height: 1.5;
	}
	.current-decision > strong {
		display: block;
		margin-top: 2rem;
		color: #78d7af;
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.current-decision > strong.revise {
		color: #f2938f;
	}
	.current-decision blockquote {
		margin: 1rem 0;
		padding-left: 1rem;
		border-left: 2px solid #d2a04d;
		color: rgba(246, 241, 231, 0.65);
		font:
			400 1rem/1.5 Georgia,
			serif;
	}
	.current-decision > p:not(.eyebrow),
	.current-decision > small {
		color: rgba(246, 241, 231, 0.42);
		font-size: 0.62rem;
		line-height: 1.6;
	}
	.current-decision > a {
		display: inline-block;
		margin-top: 2rem;
		color: #7fd8e9;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.questions {
		padding: clamp(4rem, 8vw, 8rem) clamp(1.2rem, 3vw, 3rem) 8rem;
	}
	.questions ol {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin: 2rem 0 0;
		padding: 1px;
		background: rgba(255, 255, 255, 0.08);
		list-style-position: inside;
	}
	.questions li {
		padding: 1.2rem;
		background: #0a0c12;
		color: rgba(246, 241, 231, 0.58);
		font:
			400 0.86rem/1.5 Georgia,
			serif;
	}
	@media (max-width: 850px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.opening,
		.identity-grid {
			grid-template-columns: 1fr;
		}
		.section-heading {
			align-items: flex-start;
			flex-direction: column;
		}
		.character-tabs {
			width: 100%;
		}
		.character-tabs button {
			flex: 1;
			min-width: 0;
		}
		.anchor {
			min-height: 42rem;
		}
		.recognition {
			grid-template-columns: 1fr 1fr;
		}
		.rig-grid {
			grid-template-columns: 1fr 1fr;
		}
		.review-grid {
			grid-template-columns: 1fr;
		}
		.asset-table article {
			grid-template-columns: 1fr auto;
		}
		.asset-table code,
		.asset-table small {
			display: none;
		}
		.questions ol {
			grid-template-columns: 1fr;
		}
	}
</style>
