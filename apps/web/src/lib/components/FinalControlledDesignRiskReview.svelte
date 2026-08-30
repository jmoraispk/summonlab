<script lang="ts">
	import {
		buildFinalControlledDesignRiskSubmission,
		createEmptyFinalControlledDesignRiskDrafts,
		EmptyFinalControlledDesignRiskAttestations,
		isFinalControlledDesignRiskFormComplete,
		readableDesignRiskLabel,
		type FinalControlledDesignRiskAttestations,
		type FinalControlledDesignRiskDrafts,
		type FinalControlledDesignRiskReviewProps
	} from './final-controlled-design-risk-review';

	let {
		ready,
		evidenceFingerprint,
		actionEndpoint,
		actor,
		risks,
		blockers = [],
		history = [],
		onRefresh
	}: FinalControlledDesignRiskReviewProps = $props();

	// Drafts are deliberately rebuilt by the fingerprint effect when the server-owned risk set changes.
	// svelte-ignore state_referenced_locally
	let drafts = $state<FinalControlledDesignRiskDrafts>(
		createEmptyFinalControlledDesignRiskDrafts(risks)
	);
	let attestations = $state<FinalControlledDesignRiskAttestations>({
		...EmptyFinalControlledDesignRiskAttestations
	});
	let submitting = $state(false);
	let submissionError = $state('');
	let submissionMessage = $state('');
	// svelte-ignore state_referenced_locally
	let observedFingerprint = $state(evidenceFingerprint);

	const formComplete = $derived(
		isFinalControlledDesignRiskFormComplete(risks, drafts, attestations)
	);
	const canSubmit = $derived(
		ready && Boolean(actor) && Boolean(evidenceFingerprint) && formComplete && !submitting
	);

	$effect(() => {
		if (evidenceFingerprint !== observedFingerprint) {
			resetDrafts();
			observedFingerprint = evidenceFingerprint;
			submissionMessage = '';
			submissionError = evidenceFingerprint
				? 'Evidence changed. Review all 16 risks again against the current evidence.'
				: 'Evidence is no longer ready. Draft decisions were cleared.';
		}
	});

	function resetDrafts() {
		drafts = createEmptyFinalControlledDesignRiskDrafts(risks);
		attestations = { ...EmptyFinalControlledDesignRiskAttestations };
	}

	function historyDecisionLabel(decision: string): string {
		return decision === 'replace-derived-target'
			? 'Replace derived target'
			: decision === 'replace-reference'
				? 'Replace reference'
				: 'Retain';
	}

	async function refreshSurface() {
		try {
			await onRefresh?.();
		} catch {
			// The authoritative response remains visible; a later page refresh can retry the projection.
		}
	}

	async function submitDecision(event: SubmitEvent) {
		event.preventDefault();
		const body = buildFinalControlledDesignRiskSubmission(
			evidenceFingerprint,
			risks,
			drafts,
			attestations
		);
		if (!body || !canSubmit) return;

		submitting = true;
		submissionError = '';
		submissionMessage = '';
		try {
			const response = await fetch(actionEndpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const result = (await response.json().catch(() => null)) as {
				created?: boolean;
				message?: string;
			} | null;

			if (response.status === 409) {
				resetDrafts();
				submissionError =
					result?.message ??
					'Evidence changed while you were deciding. All drafts were cleared; review the current evidence and try again.';
				await refreshSurface();
				return;
			}
			if (!response.ok) {
				throw new Error(result?.message ?? 'The design-risk decision could not be saved.');
			}

			resetDrafts();
			submissionMessage =
				result?.created === false
					? 'This exact decision was already recorded.'
					: 'The human decision was appended. No image was generated, staged, or activated.';
			await refreshSurface();
		} catch (error) {
			submissionError =
				error instanceof Error ? error.message : 'The design-risk decision could not be saved.';
		} finally {
			submitting = false;
		}
	}
</script>

<section class="design-risk-review" aria-labelledby="final-risk-review-heading">
	<header class="review-heading">
		<div>
			<p class="eyebrow">Final controlled activation · human gate</p>
			<h2 id="final-risk-review-heading">Resolve 16 design risks</h2>
		</div>
		<span class:ready class="readiness-badge">{ready ? 'Ready for decision' : 'Locked'}</span>
	</header>

	<div class="readiness" class:ready role="status">
		<div>
			<strong>{ready ? 'Evidence bindings are current' : 'Decision controls are locked'}</strong>
			<p>
				{ready
					? `Server-configured reviewer: ${actor ?? 'unavailable'}. Every choice starts blank.`
					: 'Complete the required evidence workflow before recording a human decision.'}
			</p>
		</div>
		{#if evidenceFingerprint}
			<code title={evidenceFingerprint}>Evidence {evidenceFingerprint.slice(0, 12)}…</code>
		{/if}
	</div>

	{#if blockers.length > 0}
		<ul class="blockers" aria-label="Readiness blockers">
			{#each blockers as blocker (blocker.code)}
				<li><code>{blocker.code}</code><span>{blocker.detail}</span></li>
			{/each}
		</ul>
	{/if}

	<form aria-label="Final controlled design-risk decision" onsubmit={submitDecision}>
		<div class="risk-grid">
			{#each risks as risk, index (risk.riskId)}
				<fieldset disabled={!ready || submitting} class:blocking={risk.severity === 'blocking'}>
					<legend>
						<span
							>{String(index + 1).padStart(2, '0')} · {readableDesignRiskLabel(
								risk.coordinate
							)}</span
						>
						<small>{risk.severity}</small>
					</legend>
					<p class="risk-name">{readableDesignRiskLabel(risk.riskId)}</p>
					<dl>
						<div>
							<dt>Coordinate</dt>
							<dd>{risk.coordinate}</dd>
						</div>
						<div>
							<dt>Source</dt>
							<dd>{risk.sourceTargetId}</dd>
						</div>
					</dl>

					<div class="choices" role="radiogroup" aria-label={`Resolution for ${risk.coordinate}`}>
						<label>
							<input
								type="radio"
								name={`risk-${risk.riskId}`}
								value="replace-derived-target"
								bind:group={drafts[risk.riskId].decision}
								required
							/>
							<span
								>Replace derived target<small>Create a new coordinate-owned target later</small
								></span
							>
						</label>
						<label>
							<input
								type="radio"
								name={`risk-${risk.riskId}`}
								value="replace-reference"
								bind:group={drafts[risk.riskId].decision}
								required
							/>
							<span>Replace reference<small>Choose a new reference source later</small></span>
						</label>
						<label class:unavailable={risk.severity === 'blocking'}>
							<input
								type="radio"
								name={`risk-${risk.riskId}`}
								value="retain"
								bind:group={drafts[risk.riskId].decision}
								disabled={risk.severity === 'blocking'}
								required
							/>
							<span
								>Retain<small
									>{risk.severity === 'blocking'
										? 'Unavailable for blocking risks'
										: 'Keep the current derived target'}</small
								></span
							>
						</label>
					</div>

					<label class="rationale">
						<span>Human rationale</span>
						<textarea
							bind:value={drafts[risk.riskId].humanRationale}
							required
							maxlength="2000"
							rows="3"
							placeholder="Explain the visual evidence behind this direction."></textarea>
					</label>
				</fieldset>
			{/each}
		</div>

		<fieldset class="attestations" disabled={!ready || submitting}>
			<legend>Five required attestations</legend>
			<label
				><input type="checkbox" bind:checked={attestations.producerDidNotResolveRisks} required /> I confirm
				the image producer did not resolve these risks.</label
			>
			<label
				><input
					type="checkbox"
					bind:checked={attestations.reviewedEligibleBlindEvidence}
					required
				/> I reviewed the eligible, current-hash blind evidence.</label
			>
			<label
				><input type="checkbox" bind:checked={attestations.reviewedCompleteSourceAudit} required /> I
				reviewed the complete source audit.</label
			>
			<label
				><input type="checkbox" bind:checked={attestations.deliberatelyResolvedAllRisks} required /> I
				deliberately resolved all 16 plan-owned risks.</label
			>
			<label
				><input
					type="checkbox"
					bind:checked={attestations.understandsActivationRequiresIndependentVerification}
					required
				/> I understand this decision does not generate, stage, or activate assets and still requires
				independent verification.</label
			>
		</fieldset>

		<footer class="submit-row">
			<div aria-live="polite">
				{#if submissionMessage}<p class="success" role="status">{submissionMessage}</p>{/if}
				{#if submissionError}<p class="error" role="alert">{submissionError}</p>{/if}
			</div>
			<button type="submit" disabled={!canSubmit}>
				{submitting
					? 'Appending decision…'
					: ready
						? 'Append human decision'
						: 'Waiting for evidence'}
			</button>
		</footer>
	</form>

	<section class="history" aria-labelledby="final-risk-history-heading">
		<header>
			<div>
				<p class="eyebrow">Append-only record</p>
				<h3 id="final-risk-history-heading">Decision history</h3>
			</div>
			<span>{history.length} record{history.length === 1 ? '' : 's'}</span>
		</header>
		{#if history.length === 0}
			<p class="empty-history">No human decision has been recorded for this actor and scope.</p>
		{:else}
			<div class="history-list">
				{#each [...history].reverse() as record, index (record.decisionId)}
					<details>
						<summary>
							<span><strong>{index === 0 ? 'Latest' : 'Superseded'}</strong> · {record.actor}</span>
							<time datetime={record.decidedAt}>{new Date(record.decidedAt).toLocaleString()}</time>
						</summary>
						<ol>
							{#each record.decisions as decision (decision.riskId)}
								<li>
									<strong>{readableDesignRiskLabel(decision.coordinate)}</strong>
									<span>{historyDecisionLabel(decision.decision)} · {decision.humanRationale}</span>
								</li>
							{/each}
						</ol>
						<code>{record.decisionId}</code>
					</details>
				{/each}
			</div>
		{/if}
	</section>
</section>

<style>
	.design-risk-review {
		--ink: #eee9df;
		--muted: #a49e91;
		--panel: #171916;
		--line: #34372f;
		--gold: #c4a96c;
		--warning: #d97765;
		color: var(--ink);
		background: #10120f;
		border: 1px solid var(--line);
		padding: clamp(1rem, 2.5vw, 2rem);
	}

	.review-heading,
	.readiness,
	.submit-row,
	.history > header,
	details summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font:
			500 clamp(1.7rem, 4vw, 3rem) / 1.05 Georgia,
			serif;
	}

	h3 {
		font:
			500 1.45rem/1.1 Georgia,
			serif;
	}

	.eyebrow {
		margin-bottom: 0.45rem;
		color: var(--gold);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.readiness-badge {
		border: 1px solid var(--warning);
		color: var(--warning);
		padding: 0.45rem 0.7rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.readiness-badge.ready {
		border-color: #6f9d72;
		color: #9bc49d;
	}

	.readiness {
		margin: 1.25rem 0;
		border-left: 3px solid var(--warning);
		background: #1c1715;
		padding: 1rem;
	}

	.readiness.ready {
		border-color: #6f9d72;
		background: #151b15;
	}

	.readiness p,
	.empty-history {
		margin-top: 0.3rem;
		color: var(--muted);
	}

	.readiness code,
	.blockers code,
	details > code {
		color: var(--gold);
		font-size: 0.7rem;
	}

	.blockers {
		display: grid;
		gap: 0.45rem;
		margin: 0 0 1.5rem;
		padding: 0;
		list-style: none;
	}

	.blockers li {
		display: grid;
		grid-template-columns: minmax(8rem, auto) 1fr;
		gap: 0.8rem;
		border: 1px solid #4a302b;
		padding: 0.7rem;
		color: #d6b4ad;
	}

	.risk-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 26rem), 1fr));
		gap: 0.9rem;
	}

	fieldset {
		min-width: 0;
		margin: 0;
		border: 1px solid var(--line);
		background: var(--panel);
		padding: 1rem;
	}

	fieldset.blocking {
		border-top: 3px solid var(--warning);
	}

	fieldset:disabled {
		opacity: 0.62;
	}

	legend {
		width: calc(100% - 0.4rem);
		padding: 0 0.2rem;
		font-weight: 700;
	}

	legend small {
		float: right;
		color: var(--warning);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.risk-name {
		margin: 0.6rem 0;
		color: #d8d2c6;
	}

	dl {
		margin: 0 0 0.85rem;
		font-size: 0.72rem;
	}

	dl div {
		display: grid;
		grid-template-columns: 5.2rem 1fr;
		gap: 0.5rem;
	}

	dt {
		color: var(--muted);
	}

	dd {
		min-width: 0;
		margin: 0;
		overflow-wrap: anywhere;
	}

	.choices {
		display: grid;
		gap: 0.4rem;
	}

	.choices label,
	.attestations label {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		cursor: pointer;
	}

	.choices label {
		border: 1px solid #3b3e36;
		padding: 0.65rem;
	}

	.choices label:has(input:checked) {
		border-color: var(--gold);
		background: #242217;
	}

	.choices label.unavailable {
		cursor: not-allowed;
		opacity: 0.48;
	}

	.choices small {
		display: block;
		margin-top: 0.18rem;
		color: var(--muted);
	}

	input {
		accent-color: var(--gold);
	}

	.rationale {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.8rem;
		color: var(--muted);
		font-size: 0.74rem;
		font-weight: 700;
	}

	textarea {
		box-sizing: border-box;
		width: 100%;
		resize: vertical;
		border: 1px solid #42463c;
		border-radius: 0;
		background: #0f110f;
		color: var(--ink);
		padding: 0.7rem;
		font: inherit;
		font-size: 0.88rem;
	}

	textarea:focus-visible,
	input:focus-visible,
	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 2px;
	}

	.attestations {
		display: grid;
		gap: 0.65rem;
		margin-top: 1rem;
	}

	.submit-row {
		margin-top: 1rem;
	}

	.submit-row button {
		border: 1px solid var(--gold);
		background: var(--gold);
		color: #11120f;
		padding: 0.8rem 1.1rem;
		font-weight: 800;
		cursor: pointer;
	}

	.submit-row button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.success {
		color: #9bc49d;
	}

	.error {
		color: #e39b8d;
	}

	.history {
		margin-top: 2rem;
		border-top: 1px solid var(--line);
		padding-top: 1.5rem;
	}

	.history > header > span,
	time {
		color: var(--muted);
		font-size: 0.76rem;
	}

	.history-list {
		display: grid;
		gap: 0.6rem;
		margin-top: 1rem;
	}

	details {
		border: 1px solid var(--line);
		background: var(--panel);
		padding: 0.8rem;
	}

	details summary {
		cursor: pointer;
	}

	details ol {
		display: grid;
		gap: 0.55rem;
		margin: 0.8rem 0;
		padding-left: 1.5rem;
	}

	details li strong,
	details li span {
		display: block;
	}

	details li span {
		margin-top: 0.15rem;
		color: var(--muted);
		font-size: 0.8rem;
	}

	@media (max-width: 640px) {
		.review-heading,
		.readiness,
		.submit-row,
		.history > header,
		details summary {
			align-items: flex-start;
			flex-direction: column;
		}

		.blockers li {
			grid-template-columns: 1fr;
		}

		.submit-row button {
			width: 100%;
		}
	}
</style>
