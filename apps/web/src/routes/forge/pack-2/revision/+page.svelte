<script lang="ts">
	import { resolve } from '$app/paths';
	import type { VisualReviewRecord, VisualReviewVerdict } from '@summonlab/contracts';
	import monsterGrades from '../../../../../../../assets/enemies/review/pack-2/monster-grade-escalation-v1.png';
	import faceAttire from '../../../../../../../assets/heroes/visuals/forge-v2/revisions/human-v5-face-attire-proof-v1.png';
	import faceGrammar from '../../../../../../../assets/heroes/visuals/forge-v2/revisions/human-v5-face-grammar-proof-v1.png';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let reviewHistory = $state(data.reviewHistory);
	// svelte-ignore state_referenced_locally
	let selectedAssetKey = $state(data.catalog.assets[0]!.assetKey);
	let reviewVerdict = $state<VisualReviewVerdict>('approved');
	let reviewer = $state('');
	let reviewNote = $state('');
	let reviewBusy = $state(false);
	let reviewMessage = $state('');
	let reviewError = $state('');

	const images: Record<string, string> = {
		'human-v5-face-attire-proof-v1': faceAttire,
		'human-v5-face-grammar-proof-v1': faceGrammar,
		'monster-grade-escalation-v1': monsterGrades
	};
	const selectedAsset = $derived(
		data.catalog.assets.find((asset) => asset.assetKey === selectedAssetKey) ??
			data.catalog.assets[0]!
	);
	const currentReview = $derived(reviewHistory.latestByAsset[selectedAsset.assetKey] ?? null);

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
	<title>Pack 2 revision proofs · Summoning Forge</title>
	<meta
		name="description"
		content="Review the exact human-v5 face and attire proofs plus Pack 2 monster grade escalation."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Character Forge</span><strong>Pack 2 revision proofs</strong></div>
		<nav>
			<a href={resolve('/forge/pack-2')}>Original cohort</a>
			<a href={resolve('/forge/contact-sheet')}>Human v5 audit</a>
			<a href={resolve('/forge/enemies/pack-2')}>Monster grades</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{data.catalog.catalogVersion}</p>
			<h1>Review the<br /><em>actual correction.</em></h1>
		</div>
		<div>
			<p>
				These three generated plates answer the accepted face, clothing, and grade-escalation
				feedback. Each decision is bound to the exact SHA-256 hash shown below. Accepting a plate
				does not promote it automatically.
			</p>
			<strong>{reviewHistory.reviews.length} recorded revision decisions</strong>
		</div>
	</section>

	<section class="proofs" aria-label="Pack 2 revision proof assets">
		{#each data.catalog.assets as asset, index (asset.assetKey)}
			<article data-testid="revision-proof">
				<header>
					<div>
						<span>0{index + 1}</span>
						<h2>{asset.kind.replaceAll('-', ' ')}</h2>
					</div>
					<strong class:concern={asset.authoringInspection === 'concern'}
						>{reviewHistory.latestByAsset[asset.assetKey]?.verdict ??
							`candidate · ${asset.authoringInspection}`}</strong
					>
				</header>
				<img src={images[asset.assetKey]} alt={asset.reviewFocus} />
				<div class="proof-meta">
					<p>{asset.reviewFocus}</p>
					<dl>
						<div>
							<dt>Generator</dt>
							<dd>{asset.generationMode}</dd>
						</div>
						<div>
							<dt>Wall clock</dt>
							<dd>{(asset.elapsedMs / 1_000).toFixed(1)} s</dd>
						</div>
						<div>
							<dt>Dimensions</dt>
							<dd>{asset.width} × {asset.height}</dd>
						</div>
						<div>
							<dt>Candidate state</dt>
							<dd>{asset.humanStatus}</dd>
						</div>
					</dl>
					<code>{asset.contentHash}</code>
					<button onclick={() => (selectedAssetKey = asset.assetKey)}>Review exact proof</button>
				</div>
			</article>
		{/each}
	</section>

	<section class="review" aria-labelledby="revision-review-title">
		<header>
			<p class="eyebrow">Hash-bound decision</p>
			<h2 id="revision-review-title">{selectedAsset.assetKey}</h2>
		</header>
		<div class="review-grid">
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void submitReview();
				}}
			>
				<label>
					<span>Exact proof</span>
					<select bind:value={selectedAssetKey}>
						{#each data.catalog.assets as asset (asset.assetKey)}
							<option value={asset.assetKey}>{asset.assetKey}</option>
						{/each}
					</select>
				</label>
				<code>{selectedAsset.contentHash}</code>
				<div class="verdict" role="radiogroup" aria-label="Revision proof verdict">
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
					<p class="review-error">Start the local stack with <code>pnpm dev</code> to record.</p>
				{:else if reviewError}
					<p class="review-error" role="alert">{reviewError}</p>
				{:else if reviewMessage}
					<p class="review-success" data-testid="revision-review-result">{reviewMessage}</p>
				{/if}
			</form>
			<article class="decision">
				<p class="eyebrow">Current decision</p>
				{#if currentReview}
					<strong class:revise={currentReview.verdict === 'revise'}>{currentReview.verdict}</strong>
					<blockquote>{currentReview.note}</blockquote>
					<small
						>{currentReview.reviewer} · {new Date(currentReview.createdAt).toLocaleString()}</small
					>
				{:else}
					<strong>Unreviewed</strong>
					<p>No human decision is bound to this exact hash.</p>
				{/if}
				<p>Promotion remains a separate catalog mutation after all required reviews pass.</p>
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
		background: radial-gradient(circle at 50% 18rem, #9b683317, transparent 38rem), #080a0f;
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
		text-transform: uppercase;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1rem;
		color: #f4efe580;
		font-size: 0.56rem;
		text-transform: uppercase;
	}
	.intro,
	.proofs,
	.review {
		max-width: 96rem;
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 5rem) clamp(1rem, 3vw, 3rem);
	}
	.intro {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 4rem;
		align-items: end;
	}
	.eyebrow {
		color: #d7a85f;
	}
	h1 {
		margin: 0.8rem 0 0;
		font:
			400 clamp(3.2rem, 8vw, 7rem)/0.86 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	h1 em {
		color: #d7a85f;
		font-weight: 400;
	}
	.intro > div:last-child p {
		color: #f4efe594;
		line-height: 1.7;
	}
	.intro > div:last-child strong {
		color: #d7a85f;
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	.proofs {
		display: grid;
		gap: 3rem;
		border-top: 1px solid #ffffff14;
	}
	.proofs article {
		border: 1px solid #ffffff16;
		background: #090c12;
	}
	.proofs article > header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
	}
	.proofs article > header div {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}
	.proofs article > header span {
		color: #d7a85f;
		font-size: 0.6rem;
	}
	h2 {
		margin: 0;
		font:
			400 clamp(1.7rem, 4vw, 3rem) Georgia,
			serif;
		text-transform: capitalize;
	}
	.proofs article > header strong {
		color: #7fd6a1;
		font-size: 0.55rem;
		text-transform: uppercase;
	}
	.proofs article > header strong.concern {
		color: #edc980;
	}
	.proofs img {
		display: block;
		width: 100%;
		border-block: 1px solid #ffffff16;
	}
	.proof-meta {
		padding: 1rem;
	}
	.proof-meta > p {
		color: #f4efe58c;
		line-height: 1.6;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}
	dl div {
		padding-top: 0.6rem;
		border-top: 1px solid #ffffff12;
	}
	dt {
		color: #f4efe550;
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	dd {
		margin: 0.25rem 0 0;
		font-size: 0.65rem;
	}
	.proof-meta code,
	form > code {
		display: block;
		margin-top: 1rem;
		overflow-wrap: anywhere;
		color: #f4efe54f;
		font-size: 0.55rem;
	}
	button {
		border: 1px solid #ffffff20;
		padding: 0.7rem;
		color: #f4efe5;
		background: transparent;
		cursor: pointer;
		text-transform: uppercase;
	}
	.proof-meta button {
		margin-top: 1rem;
		border-color: #d7a85f;
	}
	.review {
		border-top: 1px solid #ffffff14;
	}
	.review > header {
		margin-bottom: 2rem;
	}
	.review-grid {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 1rem;
	}
	.review form,
	.decision {
		border: 1px solid #ffffff16;
		padding: clamp(1.2rem, 3vw, 2rem);
		background: #090c12;
	}
	label {
		display: grid;
		gap: 0.35rem;
		margin-top: 1rem;
	}
	label span {
		color: #d7a85f;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	select,
	input,
	textarea {
		border: 1px solid #ffffff20;
		padding: 0.65rem;
		color: #f4efe5;
		background: #07090d;
	}
	textarea {
		min-height: 7rem;
		resize: vertical;
	}
	.verdict {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
		margin-top: 1rem;
	}
	.verdict button.active {
		border-color: #d7a85f;
		background: #d7a85f18;
	}
	.record-review {
		width: 100%;
		margin-top: 1rem;
		border-color: #d7a85f;
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
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.intro,
		.review-grid {
			grid-template-columns: 1fr;
		}
		dl {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
