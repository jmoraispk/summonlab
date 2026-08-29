<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	type CohortFilter = 'all' | 'controlled' | 'breadth' | 'regression';
	type Cell = (typeof data.rows)[number]['cells'][number];
	const speciesOptions = [
		{ id: 'death-knight', name: 'Death Knight' },
		{ id: 'elemental', name: 'Bound Vanguard Elemental' },
		{ id: 'grey-wolf', name: 'Grey Wolf' },
		{ id: 'cave-bear', name: 'Cave Bear' },
		{ id: 'goblin', name: 'Goblin' },
		{ id: 'tunnel-boar', name: 'Tunnel Boar' },
		{ id: 'cave-drake', name: 'Cave Drake' },
		{ id: 'tower-basilisk', name: 'Tower Basilisk' }
	] as const;
	const affinityOptions = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;
	const scoreFields = [
		{ id: 'speciesIdentity', label: 'Species identity' },
		{ id: 'affinityReadability', label: 'Affinity readability' },
		{ id: 'silhouetteAndDuty', label: 'Silhouette and duty' },
		{ id: 'materialCredibility', label: 'Material credibility' },
		{ id: 'anatomyAndGroundContact', label: 'Anatomy and ground contact' },
		{ id: 'affinityIntegration', label: 'Affinity integration' },
		{ id: 'styleCohesion', label: 'Style cohesion' }
	] as const;

	let cohortFilter = $state<CohortFilter>('all');
	let selectedCellId = $state<string | null>(null);
	let speciesGuess = $state('');
	let affinityGuess = $state('');
	$effect(() => {
		if (form?.reviewSaved && data.blind && data.activeReviewer) {
			selectedCellId = data.nextUnreviewedCellId;
		}
	});

	const filteredRows = $derived(
		data.rows.filter((row) => data.blind || cohortFilter === 'all' || row.cohort === cohortFilter)
	);
	const selectedCell = $derived(
		data.rows.flatMap((row) => row.cells).find((cell) => cell.id === selectedCellId) ?? null
	);
	const pendingCount = $derived(
		data.rows.flatMap((row) => row.cells).filter((cell) => cell.status === 'pending').length
	);

	function inspect(cell: Cell) {
		selectedCellId = cell.id;
		speciesGuess = '';
		affinityGuess = '';
	}

	function closeInspector() {
		selectedCellId = null;
	}

	function formatDuration(milliseconds: number) {
		return milliseconds >= 1000
			? `${(milliseconds / 1000).toFixed(1)} s`
			: `${milliseconds.toLocaleString()} ms`;
	}

	function formatBytes(bytes: number) {
		return `${(bytes / 1_000_000).toFixed(2)} MB`;
	}

	function mediaId(mediaUrl: string) {
		return mediaUrl.split('/').at(-1)?.split('?')[0] ?? '';
	}

	function blindQuery(scope = data.scope, round = data.controlledRound.id) {
		const reviewer = data.activeReviewer
			? `&reviewer=${encodeURIComponent(data.activeReviewer)}`
			: '';
		return `mode=blind&scope=${scope}&round=${round}${reviewer}`;
	}
</script>

<svelte:head>
	<title>Affinity workflow · Creature Forge</title>
	<meta
		name="description"
		content="Review the unpromoted affinity image-production experiment across controlled and breadth cohorts."
	/>
</svelte:head>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') closeInspector();
	}}
/>

<main>
	{#if form?.reviewMessage}
		<div class="review-feedback success" role="status">{form.reviewMessage}</div>
	{:else if form?.reviewError}
		<div class="review-feedback error" role="alert">{form.reviewError}</div>
	{/if}
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Creature Forge</span><strong>Affinity workflow lab</strong></div>
		<nav>
			<a href={resolve('/forge/enemies/all')}>All enemies</a>
			<a href={resolve('/forge/enemies/pack-2')}>Pack 2 grades</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{data.experimentId} · experimental</p>
			<h1>Recognize the creature.<br /><em>Then read its affinity.</em></h1>
		</div>
		<div class="intro-copy">
			<p>
				This is an isolated review surface. Every retained image remains an unapproved candidate;
				approval here never promotes it into a shared catalog.
			</p>
			<div class="totals" aria-label="Affinity experiment totals">
				<span><b>{data.targetCount}</b>Targets</span>
				<span><b>{data.resultCount}</b>Results</span>
				<span><b>{data.verifiedCandidateCount}</b>Verified</span>
				<span><b>{pendingCount}</b>Pending</span>
			</div>
		</div>
	</section>

	<section class="mode" aria-label="Review mode">
		<div>
			<p class="eyebrow">Review mode</p>
			<strong>{data.blind ? 'Blind recognition' : 'Label-visible inspection'}</strong>
			<p>
				{data.blind
					? 'Targets, prompts, filenames, source identifiers, and semantic alt text are absent from this server response. Row and affinity order are deterministically shuffled.'
					: 'Labels and retained-output generation provenance are available for production audit.'}
			</p>
		</div>
		<div class="mode-switch">
			{#if !data.blind || data.remainingCandidateCount === 0}
				<a
					class:active={!data.blind}
					href="{resolve('/forge/enemies/affinity-workflow')}?round={data.controlledRound.id}"
					aria-current={!data.blind ? 'page' : undefined}>Labels visible</a
				>
			{/if}
			{#if !data.blind}
				<form method="GET" action={resolve('/forge/enemies/affinity-workflow')}>
					<input type="hidden" name="mode" value="blind" />
					<input type="hidden" name="scope" value="controlled" />
					<input type="hidden" name="round" value={data.controlledRound.id} />
					<button type="submit">Start blind review</button>
				</form>
			{:else if data.activeReviewer}
				<strong>Reviewer-bound · {data.activeReviewer}</strong>
			{/if}
		</div>
	</section>
	<section class="round-controls" aria-label="Controlled review round">
		<p class="eyebrow">Controlled round</p>
		{#each data.availableControlledRounds as round (round.id)}
			<a
				class:active={round.id === data.controlledRound.id}
				href="{resolve('/forge/enemies/affinity-workflow')}?{data.blind
					? blindQuery(data.scope, round.id)
					: `round=${round.id}`}">{round.label}</a
			>
		{/each}
	</section>
	{#if data.blind}
		<section class="blind-progress" aria-label="Blind review scope and progress">
			{#if !data.activeReviewer}
				<form
					method="GET"
					action={resolve('/forge/enemies/affinity-workflow')}
					class="reviewer-start"
				>
					<input type="hidden" name="mode" value="blind" />
					<input type="hidden" name="scope" value="controlled" />
					<input type="hidden" name="round" value={data.controlledRound.id} />
					<label
						><span>Reviewer identity</span><input name="reviewer" required maxlength="80" /></label
					>
					<button type="submit">Begin reviewer-bound session</button>
				</form>
			{:else}
				<div>
					<p class="eyebrow">Controlled review progress</p>
					<strong>{data.reviewedCandidateCount} / {data.reviewableCount}</strong>
					<span
						>{data.activeReviewer} · {data.remainingCandidateCount} remaining · {data.reviseCount} revision-only</span
					>
					{#if data.nextUnreviewedCellId}
						<button type="button" onclick={() => (selectedCellId = data.nextUnreviewedCellId)}
							>Review next unreviewed</button
						>
					{/if}
				</div>
				<nav aria-label="Blind review scope">
					<a
						class:active={data.scope === 'controlled'}
						href="{resolve('/forge/enemies/affinity-workflow')}?{blindQuery('controlled')}"
						>Controlled · 21 candidates + 3 revise</a
					>
					<a
						class:active={data.scope === 'all'}
						href="{resolve('/forge/enemies/affinity-workflow')}?{blindQuery('all')}">All evidence</a
					>
				</nav>
			{/if}
		</section>
	{/if}

	{#if !data.blind}
		<section class="controls" aria-label="Affinity cohort filters">
			<p class="eyebrow">Cohort</p>
			{#each [{ id: 'all', label: 'All rows' }, { id: 'controlled', label: 'Controlled · 4' }, { id: 'breadth', label: 'Breadth · 4' }, { id: 'regression', label: 'Regression · 6' }] as option (option.id)}
				<button
					type="button"
					class:active={cohortFilter === option.id}
					onclick={() => (cohortFilter = option.id as CohortFilter)}>{option.label}</button
				>
			{/each}
			<p class="scope-note">Partial cohorts are expected; missing cells stay explicitly pending.</p>
		</section>
	{/if}

	<section class="matrix" aria-labelledby="matrix-title">
		<header class="section-heading">
			<div>
				<span>01</span>
				<h2 id="matrix-title">Species × affinity matrix</h2>
			</div>
			<p>{filteredRows.length} rows · six variants per row</p>
		</header>

		<div class="matrix-scroll">
			<div class="matrix-grid" class:blind={data.blind}>
				<div class="corner">Species</div>
				{#each data.blind ? ['Sample A', 'Sample B', 'Sample C', 'Sample D', 'Sample E', 'Sample F'] : ['Normal', 'Wood', 'Fire', 'Metal', 'Water', 'Wind'] as heading (heading)}
					<div class="column-heading">{heading}</div>
				{/each}
				{#each filteredRows as row (row.id)}
					<div class="row-heading">
						{#if row.cohort}<span>{row.cohort}</span>{/if}
						<strong>{row.rowLabel}</strong>
					</div>
					{#each row.cells as cell (cell.id)}
						<article
							class:ready={cell.status === 'candidate'}
							class:reviewed={cell.status === 'candidate' && cell.reviewState.count > 0}
							data-testid="affinity-cell"
						>
							<header>
								<span>{cell.columnLabel}</span>
								<i class:ready={cell.status === 'candidate'}
									>{cell.status === 'candidate' && cell.reviewState.count > 0
										? 'Reviewed'
										: cell.statusLabel}</i
								>
							</header>
							{#if cell.mediaUrl}
								<button
									class="thumbnail"
									type="button"
									disabled={data.blind && !data.activeReviewer}
									onclick={() => inspect(cell)}
									aria-label={data.blind
										? 'Inspect unlabeled candidate'
										: `Inspect ${cell.labels?.species}, ${cell.labels?.affinity} affinity`}
								>
									<img src={cell.mediaUrl} alt={cell.alt} loading="lazy" decoding="async" />
								</button>
							{:else}
								<div class="empty" aria-label={cell.statusLabel}>
									<span>∅</span><small>{cell.statusLabel}</small>
								</div>
							{/if}
						</article>
					{/each}
				{/each}
			</div>
		</div>
	</section>

	<section class="governance" aria-labelledby="governance-title">
		<header class="section-heading">
			<div>
				<span>02</span>
				<h2 id="governance-title">Experiment state</h2>
			</div>
			<p>No automatic promotion</p>
		</header>
		<div class="governance-grid">
			<article class="gate-state">
				<p class="eyebrow">Breadth release gate</p>
				<strong
					>{data.gateReadiness.attainableWithExistingControlledCohort
						? 'Awaiting evidence'
						: 'Final controlled rerun required'}</strong
				>
				<dl>
					{#each data.gateReadiness.criteria as criterion (criterion.label)}
						<div>
							<dt>{criterion.label}</dt>
							<dd>
								{criterion.current} current · {criterion.maximum} max · {criterion.threshold} required
							</dd>
						</div>
					{/each}
				</dl>
			</article>
			<article>
				<p class="eyebrow">Catalog</p>
				<strong>{data.catalog?.status ?? 'Not available'}</strong>
				<dl>
					<div>
						<dt>Entries</dt>
						<dd>{data.catalog?.entryCount ?? 0}</dd>
					</div>
					<div>
						<dt>Generated</dt>
						<dd>{data.catalog?.generatedAt ?? 'Pending'}</dd>
					</div>
				</dl>
			</article>
			<article>
				<p class="eyebrow">Evaluation</p>
				<strong>{data.evaluation?.status ?? 'Not available'}</strong>
				<dl>
					<div>
						<dt>Recommended safe concurrency</dt>
						<dd>{data.evaluation?.recommendedSafeConcurrency ?? 'Pending evidence'}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>{data.evaluation?.generatedAt ?? 'Pending'}</dd>
					</div>
				</dl>
			</article>
			<article class="pending-api">
				<p class="eyebrow">Decision recording</p>
				<strong
					>{data.reviewPersistenceAvailable
						? 'Hash-bound reviews enabled'
						: 'Persistence unavailable'}</strong
				>
				<p>
					{data.reviewPersistenceAvailable
						? 'Use server-stripped blind mode to record recognition evidence. Label-visible inspection is read-only, and decisions never promote experiment assets.'
						: data.reviewPersistenceMessage}
				</p>
				<a
					href="{resolve('/forge/enemies/affinity-workflow')}?{data.blind
						? blindQuery('controlled')
						: `mode=blind&scope=controlled&round=${data.controlledRound.id}`}"
					>Start controlled blind review</a
				>
			</article>
		</div>
		{#if data.evaluation?.completionNotes?.length}
			<ul class="notes">
				{#each data.evaluation.completionNotes as note (note)}<li>{note}</li>{/each}
			</ul>
		{/if}
	</section>
</main>

{#if selectedCell}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.currentTarget === event.target) closeInspector();
		}}
		onkeydown={() => {}}
	>
		<div class="inspector" role="dialog" aria-modal="true" aria-label="Candidate inspector">
			<header>
				<div>
					<p class="eyebrow">
						{data.blind ? 'Blind full-size inspection' : 'Candidate provenance'}
					</p>
					<h2>
						{data.blind
							? 'Unlabeled candidate'
							: `${selectedCell.labels?.species} · ${selectedCell.labels?.affinity}`}
					</h2>
				</div>
				<button type="button" onclick={closeInspector} aria-label="Close inspector">×</button>
			</header>
			{#if selectedCell.mediaUrl}
				<img src={selectedCell.mediaUrl} alt={selectedCell.alt} />
			{/if}
			{#if selectedCell.mediaUrl && selectedCell.status === 'revise'}
				<p class="revision-evidence-note">
					Revision evidence · inspectable, but not eligible for human acceptance until a producer
					candidate exists.
				</p>
			{/if}
			{#if !data.blind && selectedCell.metadata}
				<div class="provenance">
					<div class="facts">
						<div><span>Status</span><strong>{selectedCell.statusLabel}</strong></div>
						<div>
							<span>Attempt</span><strong
								>{selectedCell.metadata.attemptNumber} / {selectedCell.metadata
									.attemptCount}</strong
							>
						</div>
						<div>
							<span>Generation</span><strong
								>{formatDuration(selectedCell.metadata.generationDurationMs)}</strong
							>
						</div>
						<div>
							<span>Inspection</span><strong
								>{formatDuration(selectedCell.metadata.inspectionDurationMs)}</strong
							>
						</div>
						<div>
							<span>Total wall time</span><strong
								>{formatDuration(selectedCell.metadata.totalWallTimeMs)}</strong
							>
						</div>
						<div>
							<span>Dimensions</span><strong
								>{selectedCell.metadata.width} × {selectedCell.metadata.height}</strong
							>
						</div>
						<div>
							<span>Format / size</span><strong
								>{selectedCell.metadata.mediaType} · {formatBytes(
									selectedCell.metadata.bytes
								)}</strong
							>
						</div>
						<div>
							<span>Persistence</span><strong>{selectedCell.metadata.persistenceOperation}</strong>
						</div>
					</div>
					<dl class="ids">
						<div>
							<dt>Target</dt>
							<dd>{selectedCell.labels?.targetId}</dd>
						</div>
						<div>
							<dt>Result</dt>
							<dd>{selectedCell.metadata.resultId}</dd>
						</div>
						<div>
							<dt>Selected attempt</dt>
							<dd>{selectedCell.metadata.selectedAttemptId}</dd>
						</div>
						<div>
							<dt>Retained output</dt>
							<dd>{selectedCell.metadata.outputPath}</dd>
						</div>
						<div>
							<dt>Source output</dt>
							<dd>{selectedCell.metadata.sourceOutputId}</dd>
						</div>
						<div>
							<dt>Content SHA-256</dt>
							<dd>{selectedCell.metadata.contentHash}</dd>
						</div>
						<div>
							<dt>Prompt SHA-256</dt>
							<dd>{selectedCell.metadata.promptHash}</dd>
						</div>
						<div>
							<dt>Requested</dt>
							<dd>{selectedCell.metadata.requestStartedAt}</dd>
						</div>
						<div>
							<dt>Generated</dt>
							<dd>{selectedCell.metadata.generationCompletedAt}</dd>
						</div>
						<div>
							<dt>Inspected</dt>
							<dd>{selectedCell.metadata.inspectionCompletedAt}</dd>
						</div>
					</dl>
					<details>
						<summary>Exact prompt</summary>
						<pre>{selectedCell.metadata.exactPrompt}</pre>
					</details>
					<details>
						<summary>Reference provenance · {selectedCell.metadata.references.length}</summary>
						<ul>
							{#each selectedCell.metadata.references as reference (reference.path)}
								<li><code>{reference.path}</code><small>{reference.contentHash}</small></li>
							{/each}
						</ul>
					</details>
					<details>
						<summary>Producer findings · {selectedCell.metadata.findings.length}</summary>
						<ul>
							{#each selectedCell.metadata.findings as finding, index (`${finding.category}-${index}`)}
								<li class:failed={finding.outcome === 'fail'}>
									<strong>{finding.outcome} · {finding.category}</strong><span
										>{finding.observation}</span
									>
								</li>
							{/each}
						</ul>
					</details>
				</div>
			{/if}
			{#if selectedCell.mediaUrl && selectedCell.status === 'candidate' && data.blind}
				<form
					method="POST"
					class="review-form"
					aria-label={data.blind ? 'Review unlabeled candidate' : 'Review candidate'}
				>
					<input type="hidden" name="reviewId" value={data.reviewId} />
					<input type="hidden" name="opaqueMediaId" value={mediaId(selectedCell.mediaUrl)} />
					<input type="hidden" name="controlledRound" value={data.controlledRound.id} />
					<header>
						<div>
							<p class="eyebrow">Human review</p>
							<h3>{data.blind ? 'Commit your unaided read' : 'Record candidate evidence'}</h3>
						</div>
						<p>
							{selectedCell.reviewState.count} prior review{selectedCell.reviewState.count === 1
								? ''
								: 's'}{selectedCell.reviewState.latestAt
								? ` · latest ${selectedCell.reviewState.latestAt}`
								: ''}
						</p>
					</header>
					{#if !data.blind && 'latest' in selectedCell.reviewState && selectedCell.reviewState.latest}
						<div class="latest-review">
							<strong>{selectedCell.reviewState.latest.verdict}</strong>
							<span>by {selectedCell.reviewState.latest.reviewer}</span>
							<p>{selectedCell.reviewState.latest.note}</p>
						</div>
					{/if}
					{#if data.blind}
						<p class="blind-note">
							No target, source, prompt, filename, content hash, or answer label is present in this
							page. Your guesses are bound server-side to the opaque image after submission.
						</p>
					{/if}
					<div class="review-fields">
						<div class="bound-reviewer">
							<span>Reviewer</span><strong>{data.activeReviewer}</strong><small
								>Bound by this session URL and verified by the server.</small
							>
						</div>
						<label>
							<span>Species guess</span>
							<select name="identifiedSpeciesId" bind:value={speciesGuess} required>
								<option value="" disabled>Select a species</option>
								{#each speciesOptions as option (option.id)}
									<option value={option.id}>{option.name}</option>
								{/each}
							</select>
						</label>
						<label>
							<span>Affinity guess</span>
							<select name="identifiedAffinity" bind:value={affinityGuess} required>
								<option value="" disabled>Select an affinity</option>
								{#each affinityOptions as option (option)}
									<option value={option}>{option[0]!.toUpperCase() + option.slice(1)}</option>
								{/each}
							</select>
						</label>
					</div>
					<fieldset class="scores">
						<legend>Scores · 1 weak, 5 excellent</legend>
						{#each scoreFields as scoreField (scoreField.id)}
							<label>
								<span>{scoreField.label}</span>
								<select name={scoreField.id} required>
									{#each [1, 2, 3, 4, 5] as value (value)}
										<option {value} selected={value === 3}>{value}</option>
									{/each}
								</select>
							</label>
						{/each}
					</fieldset>
					<fieldset class="verdicts">
						<legend>Verdict</legend>
						<label><input type="radio" name="verdict" value="candidate" required /> Candidate</label
						>
						<label><input type="radio" name="verdict" value="revise" required /> Revise</label>
					</fieldset>
					<label class="note-field">
						<span>Review note</span>
						<textarea name="note" required maxlength="1000"></textarea>
					</label>
					<div class="review-actions">
						<p>This stores review evidence only. It cannot promote an asset.</p>
						<button type="submit" disabled={!data.reviewPersistenceAvailable}>
							{data.reviewPersistenceAvailable ? 'Save review' : 'Persistence unavailable'}
						</button>
						{#if data.blind && data.remainingCandidateCount === 0}
							<a
								href="{resolve('/forge/enemies/affinity-workflow')}?round={data.controlledRound.id}"
								>Reveal all labels</a
							>
						{/if}
					</div>
				</form>
			{:else if selectedCell.mediaUrl && selectedCell.status === 'candidate'}
				<p class="blind-review-required">
					Review entry is disabled while labels are visible. Open the
					<a
						href="{resolve(
							'/forge/enemies/affinity-workflow'
						)}?mode=blind&scope=controlled&round={data.controlledRound.id}"
						>server-stripped controlled blind review</a
					>
					to record recognition evidence.
				</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		background: #07090d;
	}
	:global(button),
	:global(input),
	:global(select),
	:global(textarea) {
		font: inherit;
	}
	main {
		min-height: 100vh;
		color: #f4efe5;
		background:
			radial-gradient(circle at 65% 18rem, #477d8a18, transparent 38rem),
			linear-gradient(#080a0f, #0b0d12);
	}
	.review-feedback {
		position: sticky;
		top: 0;
		z-index: 30;
		padding: 0.9rem clamp(1rem, 3vw, 3rem);
		border-bottom: 1px solid;
		font-size: 0.72rem;
		text-align: center;
	}
	.review-feedback.success {
		border-color: #70b7c455;
		color: #bfe7dd;
		background: #102823f2;
	}
	.review-feedback.error {
		border-color: #e88d7655;
		color: #ffd2c8;
		background: #351511f2;
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
		color: #70b7c4;
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
	.mode,
	.round-controls,
	.controls,
	.matrix,
	.governance {
		max-width: 112rem;
		margin: 0 auto;
		padding-inline: clamp(1rem, 3vw, 3rem);
	}
	.intro {
		display: grid;
		grid-template-columns: 1.35fr 1fr;
		gap: 4rem;
		align-items: end;
		padding-block: clamp(3rem, 7vw, 7rem);
	}
	.eyebrow {
		margin: 0;
		color: #70b7c4;
	}
	h1 {
		margin: 0.8rem 0 0;
		font:
			400 clamp(3.2rem, 7vw, 7.5rem) / 0.85 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	h1 em {
		color: #70b7c4;
		font-weight: 400;
	}
	.intro-copy > p {
		color: #f4efe5a0;
		line-height: 1.75;
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-top: 2rem;
	}
	.totals span {
		color: #f4efe56b;
		font-size: 0.56rem;
		text-transform: uppercase;
	}
	.totals b {
		display: block;
		color: #f4efe5;
		font:
			400 1.8rem Georgia,
			serif;
	}
	.mode {
		display: flex;
		justify-content: space-between;
		gap: 3rem;
		align-items: center;
		padding-block: 1.5rem;
		border-block: 1px solid #ffffff14;
		background: #0c1117;
	}
	.blind-progress {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
		max-width: 112rem;
		margin: 0 auto;
		padding: 1rem clamp(1rem, 3vw, 3rem);
		border-bottom: 1px solid #ffffff14;
		background: #090d12;
	}
	.blind-progress strong,
	.blind-progress span {
		display: inline-block;
		margin-top: 0.35rem;
	}
	.blind-progress button,
	.reviewer-start button {
		margin-left: 0.75rem;
		border: 1px solid #70b7c455;
		padding: 0.55rem 0.75rem;
		color: #bfe7dd;
		background: #102823;
		cursor: pointer;
	}
	.reviewer-start {
		display: flex;
		align-items: end;
		gap: 0.75rem;
	}
	.reviewer-start label,
	.bound-reviewer {
		display: grid;
		gap: 0.35rem;
	}
	.blind-progress strong {
		margin-right: 0.6rem;
		color: #f4efe5;
		font:
			400 1.5rem Georgia,
			serif;
	}
	.blind-progress span {
		color: #f4efe56f;
		font-size: 0.68rem;
	}
	.blind-progress nav {
		display: flex;
		border: 1px solid #ffffff20;
		padding: 0.25rem;
	}
	.blind-progress nav a {
		padding: 0.7rem 0.9rem;
		color: #f4efe570;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.blind-progress nav a.active {
		color: #071015;
		background: #70b7c4;
	}
	.mode > div:first-child {
		max-width: 52rem;
	}
	.mode strong {
		display: block;
		margin-top: 0.35rem;
		font:
			400 1.65rem Georgia,
			serif;
	}
	.mode p:last-child {
		margin-bottom: 0;
		color: #f4efe57c;
		font-size: 0.72rem;
		line-height: 1.6;
	}
	.mode-switch {
		display: flex;
		border: 1px solid #ffffff20;
		padding: 0.25rem;
	}
	.mode-switch a,
	.mode-switch button,
	.controls button {
		border: 0;
		padding: 0.75rem 1rem;
		color: #f4efe570;
		background: transparent;
		font-size: 0.62rem;
		text-transform: uppercase;
		cursor: pointer;
	}
	.mode-switch form {
		margin: 0;
	}
	.mode-switch input {
		display: none;
	}
	.mode-switch a.active,
	.round-controls a.active,
	.controls button.active {
		color: #071015;
		background: #70b7c4;
	}
	.round-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-block: 0.85rem;
		border-bottom: 1px solid #ffffff14;
	}
	.round-controls .eyebrow {
		margin-right: 0.75rem;
	}
	.round-controls a {
		border: 1px solid #ffffff17;
		padding: 0.65rem 0.9rem;
		color: #f4efe570;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-block: 1rem;
	}
	.controls .eyebrow {
		margin-right: 0.75rem;
	}
	.controls button {
		border: 1px solid #ffffff17;
	}
	.scope-note {
		margin-left: auto;
		color: #f4efe560;
		font-size: 0.66rem;
	}
	.matrix,
	.governance {
		padding-block: clamp(2rem, 5vw, 5rem);
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
		color: #70b7c4;
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
	.matrix-scroll {
		overflow-x: auto;
		border: 1px solid #ffffff18;
		background: #080b10;
	}
	.matrix-grid {
		display: grid;
		grid-template-columns: minmax(10rem, 0.8fr) repeat(6, minmax(11rem, 1fr));
		min-width: 78rem;
	}
	.corner,
	.column-heading,
	.row-heading {
		border-right: 1px solid #ffffff12;
		border-bottom: 1px solid #ffffff12;
		padding: 0.85rem;
		background: #0d1118;
	}
	.corner,
	.column-heading {
		position: sticky;
		top: 0;
		z-index: 2;
		color: #70b7c4;
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-align: center;
		text-transform: uppercase;
	}
	.corner {
		left: 0;
		z-index: 3;
		text-align: left;
	}
	.row-heading {
		position: sticky;
		left: 0;
		z-index: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.row-heading span {
		color: #70b7c4;
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.row-heading strong {
		margin-top: 0.3rem;
		font:
			400 1.05rem Georgia,
			serif;
	}
	.matrix-grid article {
		min-width: 0;
		border-right: 1px solid #ffffff12;
		border-bottom: 1px solid #ffffff12;
		background: #090c12;
	}
	.matrix-grid article.ready {
		background: #0a1117;
	}
	.matrix-grid article.reviewed {
		box-shadow: inset 0 0 0 2px #70b7c466;
	}
	.matrix-grid article header {
		display: flex;
		justify-content: space-between;
		gap: 0.4rem;
		padding: 0.55rem 0.65rem;
	}
	.matrix-grid article header span,
	.matrix-grid article header i {
		font-size: 0.46rem;
		font-style: normal;
		text-transform: uppercase;
	}
	.matrix-grid article header span {
		color: #f4efe578;
	}
	.matrix-grid article header i {
		color: #9c8e7a;
		text-align: right;
	}
	.matrix-grid article header i.ready {
		color: #70b7c4;
	}
	.thumbnail {
		display: block;
		width: 100%;
		border: 0;
		padding: 0;
		background: #06080c;
		cursor: zoom-in;
	}
	.thumbnail img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		object-position: center top;
		transition: opacity 160ms ease;
	}
	.thumbnail:hover img,
	.thumbnail:focus-visible img {
		opacity: 0.78;
	}
	.empty {
		display: grid;
		place-content: center;
		min-height: 8.5rem;
		color: #f4efe530;
		text-align: center;
	}
	.empty span {
		font:
			400 2rem Georgia,
			serif;
	}
	.empty small {
		margin-top: 0.4rem;
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.governance {
		border-top: 1px solid #ffffff14;
	}
	.governance-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}
	.governance-grid article {
		border: 1px solid #ffffff16;
		padding: 1.25rem;
		background: #090c12;
	}
	.governance-grid article > strong {
		display: block;
		margin-top: 0.55rem;
		font:
			400 1.45rem Georgia,
			serif;
	}
	.governance-grid dl,
	.ids {
		margin: 1rem 0 0;
	}
	.governance-grid dl div,
	.ids div {
		padding: 0.55rem 0;
		border-top: 1px solid #ffffff10;
	}
	dt {
		color: #f4efe555;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	dd {
		margin: 0.25rem 0 0;
		color: #f4efe5a8;
		font-size: 0.65rem;
		line-height: 1.45;
	}
	.pending-api p:not(.eyebrow),
	.gate-state p:not(.eyebrow),
	.notes {
		color: #f4efe575;
		font-size: 0.7rem;
		line-height: 1.6;
	}
	.pending-api a {
		display: inline-block;
		border: 1px solid #ffffff18;
		padding: 0.7rem 0.9rem;
		color: #70b7c4;
		background: #ffffff05;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.notes {
		margin-top: 1rem;
	}
	.modal-backdrop {
		position: fixed;
		z-index: 20;
		inset: 0;
		overflow-y: auto;
		padding: clamp(1rem, 3vw, 3rem);
		background: #020306e8;
		backdrop-filter: blur(8px);
	}
	.inspector {
		max-width: 90rem;
		margin: 0 auto;
		border: 1px solid #ffffff24;
		color: #f4efe5;
		background: #090c12;
		box-shadow: 0 2rem 7rem #000;
	}
	.inspector > header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #ffffff16;
	}
	.inspector > header h2 {
		margin-top: 0.3rem;
		font-size: 2rem;
	}
	.inspector > header button {
		border: 0;
		color: #f4efe5;
		background: transparent;
		font-size: 2rem;
		cursor: pointer;
	}
	.inspector > img {
		display: block;
		width: 100%;
		max-height: 80vh;
		object-fit: contain;
		background: #040609;
	}
	.revision-evidence-note {
		margin: 0;
		border-block: 1px solid #e5a45b33;
		padding: 0.85rem clamp(1rem, 3vw, 2rem);
		color: #f2c98f;
		background: #e5a45b0a;
		font-size: 0.68rem;
		line-height: 1.55;
	}
	.blind-review-required {
		margin: 0;
		border-top: 1px solid #70b7c433;
		padding: 1rem clamp(1rem, 3vw, 2rem);
		color: #f4efe58f;
		background: #70b7c40a;
		font-size: 0.68rem;
		line-height: 1.6;
	}
	.blind-review-required a {
		color: #9fd5de;
		text-decoration: underline;
	}
	.provenance,
	.review-form {
		padding: clamp(1rem, 3vw, 2rem);
	}
	.review-form {
		border-top: 1px solid #ffffff20;
	}
	.review-form > header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
	}
	.review-form h3 {
		margin: 0.4rem 0 0;
		font:
			400 1.55rem Georgia,
			serif;
	}
	.review-form > header > p,
	.blind-note,
	.review-actions p {
		margin: 0;
		color: #f4efe56f;
		font-size: 0.65rem;
		line-height: 1.55;
	}
	.blind-note {
		margin-top: 1rem;
		border-left: 2px solid #70b7c4;
		padding: 0.7rem 0.9rem;
		background: #70b7c40a;
	}
	.latest-review {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.65rem;
		margin-top: 1rem;
		border-left: 2px solid #70b7c4;
		padding: 0.7rem 0.9rem;
		background: #70b7c40a;
	}
	.latest-review strong {
		color: #70b7c4;
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	.latest-review span {
		color: #f4efe56f;
		font-size: 0.65rem;
	}
	.latest-review p {
		grid-column: 1 / -1;
		margin: 0.25rem 0 0;
		color: #f4efe5a0;
		font-size: 0.72rem;
		line-height: 1.5;
	}
	.review-fields {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-top: 1rem;
	}
	.bound-reviewer span,
	.bound-reviewer small {
		color: #70b7c4;
		font-size: 0.52rem;
	}
	.review-form label {
		display: grid;
		gap: 0.35rem;
	}
	.review-form label > span,
	.review-form legend {
		color: #70b7c4;
		font-size: 0.52rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.review-form input,
	.review-form select,
	.review-form textarea {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #ffffff20;
		padding: 0.68rem;
		color: #f4efe5;
		background: #06080c;
	}
	.review-form fieldset {
		margin: 1rem 0 0;
		border: 1px solid #ffffff16;
		padding: 1rem;
	}
	.scores {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.7rem;
	}
	.scores legend,
	.verdicts legend {
		padding: 0 0.35rem;
	}
	.verdicts {
		display: flex;
		gap: 1.5rem;
	}
	.verdicts label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: #f4efe5b8;
		font-size: 0.75rem;
	}
	.verdicts input {
		width: auto;
	}
	.note-field {
		margin-top: 1rem;
	}
	.note-field textarea {
		min-height: 7rem;
		resize: vertical;
	}
	.review-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
	}
	.review-actions p {
		margin-right: auto;
	}
	.review-actions button,
	.review-actions a {
		border: 1px solid #70b7c466;
		padding: 0.75rem 1rem;
		color: #071015;
		background: #70b7c4;
		font-size: 0.64rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	.review-actions button:disabled {
		border-color: #ffffff16;
		color: #f4efe548;
		background: #ffffff05;
	}
	.review-actions a {
		color: #70b7c4;
		background: transparent;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: #ffffff14;
	}
	.facts div {
		padding: 0.8rem;
		background: #0d1118;
	}
	.facts span {
		display: block;
		color: #70b7c4;
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.facts strong {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.72rem;
	}
	.ids {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 1rem;
	}
	.ids dd,
	.provenance code,
	.provenance small {
		overflow-wrap: anywhere;
		font-family: ui-monospace, monospace;
	}
	details {
		margin-top: 1rem;
		border: 1px solid #ffffff16;
		padding: 0.9rem;
	}
	summary {
		color: #70b7c4;
		font-size: 0.62rem;
		text-transform: uppercase;
		cursor: pointer;
	}
	pre {
		max-height: 28rem;
		overflow: auto;
		white-space: pre-wrap;
		color: #f4efe5a5;
		font-size: 0.67rem;
		line-height: 1.5;
	}
	details ul {
		padding-left: 1.1rem;
	}
	details li {
		margin-top: 0.7rem;
		color: #f4efe5a0;
		font-size: 0.68rem;
		line-height: 1.5;
	}
	details li small,
	details li span {
		display: block;
		margin-top: 0.2rem;
		color: #f4efe55c;
	}
	details li.failed strong {
		color: #e88d76;
	}
	@media (max-width: 900px) {
		.topbar,
		.intro,
		.governance-grid {
			grid-template-columns: 1fr;
		}
		.topbar {
			gap: 0.75rem;
			padding-block: 1rem;
		}
		.topbar > div {
			text-align: left;
		}
		.topbar nav {
			justify-self: start;
		}
		.intro {
			gap: 2rem;
		}
		.mode,
		.round-controls,
		.controls {
			align-items: stretch;
			flex-direction: column;
		}
		.scope-note {
			margin-left: 0;
		}
		.facts,
		.ids,
		.review-fields {
			grid-template-columns: 1fr 1fr;
		}
		.scores {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	@media (max-width: 560px) {
		.totals,
		.facts,
		.ids {
			grid-template-columns: 1fr 1fr;
		}
		h1 {
			font-size: 3rem;
		}
		.mode-switch,
		.round-controls,
		.controls,
		.review-actions {
			flex-wrap: wrap;
		}
		.review-fields,
		.scores {
			grid-template-columns: 1fr;
		}
	}
</style>
