<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let selectedProposalIndex = $state(0);
	let selectedFloorIndex = $state(0);
	const selected = $derived(data.report.proposals[selectedProposalIndex]!);
	const floor = $derived(selected.proposal.floors[selectedFloorIndex]!);

	function label(value: string) {
		return value.replaceAll('-', ' ');
	}

	function chooseProposal(index: number) {
		selectedProposalIndex = index;
		selectedFloorIndex = 0;
	}
</script>

<svelte:head>
	<title>Story workshop · Summonlab</title>
	<meta
		name="description"
		content="A development-only editorial desk for bounded, versioned five-floor story proposals."
	/>
</svelte:head>

<main data-testid="story-workshop">
	<nav>
		<a class="wordmark" href={resolve('/')}>SUMMON<span>LAB</span></a>
		<div>
			<a href={resolve('/story-envelope')}>Band 01 envelope</a>
			<a href={resolve('/story-patch')}>Runtime patch</a>
		</div>
	</nav>

	<header class="hero">
		<div class="hero-copy">
			<p class="eyebrow">FIN-009 · development narrative systems</p>
			<h1>Propose widely.<br /><em>Canonize nothing.</em></h1>
			<p class="lede">
				A stronger configured model may draft inside this brief. Every candidate remains a versioned
				editorial proposal until a developer reviews it and the accepted beats compile into a strict
				story envelope.
			</p>
		</div>
		<section class="workshop-status">
			<span>Workshop status</span>
			<strong
				>{data.report.summary.validForReviewCount} / {data.report.summary.proposalCount}</strong
			>
			<p>reviewable proposals</p>
			<small>{data.report.summary.readyForCompilationCount} ready for compilation</small>
		</section>
	</header>

	<section class="boundary" aria-labelledby="boundary-title">
		<div>
			<span>Authority boundary</span>
			<h2 id="boundary-title">The workshop writes options, not history.</h2>
		</div>
		<div class="boundary-grid">
			<article>
				<b>01</b>
				<p>Development-only input and output</p>
			</article>
			<article>
				<b>02</b>
				<p>Explicit human editorial review</p>
			</article>
			<article>
				<b>03</b>
				<p>Strict envelope compilation after acceptance</p>
			</article>
			<article>
				<b>04</b>
				<p>No runtime or canonical mutation</p>
			</article>
		</div>
	</section>

	<section class="brief" aria-labelledby="brief-title">
		<header>
			<div>
				<span>01 / Versioned brief</span>
				<h2 id="brief-title">Band 02 · floors 06–10</h2>
			</div>
			<code>{data.report.brief.briefVersion} · {data.report.briefHash.slice(0, 12)}</code>
		</header>
		<div class="brief-layout">
			<article class="question">
				<span>Target emotional question</span>
				<blockquote>{data.report.brief.emotionalQuestion}</blockquote>
				<p>{data.report.brief.desiredSettlementConsequence}</p>
			</article>
			<div class="catalogs">
				<article>
					<span>Enemy family</span>
					<h3>{data.report.brief.enemyFamily.displayName}</h3>
					<p>{data.report.brief.enemyFamily.theme}</p>
				</article>
				<article>
					<span>Bounded input</span>
					<div class="counts">
						<div>
							<strong>{data.report.brief.worldBible.laws.length}</strong><small>world laws</small>
						</div>
						<div>
							<strong>{data.report.brief.mechanicCatalog.length}</strong><small>mechanics</small>
						</div>
						<div>
							<strong>{data.report.brief.enemyFamily.dutyCatalog.length}</strong><small
								>enemy duties</small
							>
						</div>
						<div>
							<strong>{data.report.brief.rewardBudgetPoints}</strong><small>reward ceiling</small>
						</div>
					</div>
				</article>
			</div>
		</div>
	</section>

	<section class="desk" aria-labelledby="desk-title">
		<header>
			<div>
				<span>02 / Editorial comparison</span>
				<h2 id="desk-title">Two routes through one question.</h2>
			</div>
			<p>
				The checked fixture proves the workflow without claiming a paid provider run. Replace it
				with a provenance-complete model record before evaluating model quality.
			</p>
		</header>

		<div class="proposal-tabs" role="tablist" aria-label="Story arc proposals">
			{#each data.report.proposals as candidate, index (candidate.proposal.proposalId)}
				<button
					type="button"
					role="tab"
					aria-selected={selectedProposalIndex === index}
					class:active={selectedProposalIndex === index}
					onclick={() => chooseProposal(index)}
					data-testid="story-workshop-proposal"
				>
					<div><code>0{index + 1}</code><span>{candidate.reviewStatus}</span></div>
					<h3>{candidate.proposal.title}</h3>
					<p>{candidate.proposal.thesis}</p>
					<footer>
						<span>{candidate.productionWarnings.length} production warnings</span>
						<strong>{candidate.validForReview ? '10 / 10 checks' : 'blocked'}</strong>
					</footer>
				</button>
			{/each}
		</div>

		<article class="proposal-detail" data-testid="selected-story-workshop-proposal">
			<header>
				<div>
					<span>{selected.proposal.proposalId}</span>
					<h3>{selected.proposal.title}</h3>
					<p>{selected.proposal.logline}</p>
				</div>
				<div class="version-seal">
					<span>proposal version</span>
					<strong>{selected.proposal.proposalVersion}</strong>
					<code>{selected.proposalHash.slice(0, 12)}</code>
				</div>
			</header>

			<div class="floor-rail" role="tablist" aria-label="Five-floor arc">
				{#each selected.proposal.floors as item, index (item.floor)}
					<button
						type="button"
						role="tab"
						aria-selected={selectedFloorIndex === index}
						class:active={selectedFloorIndex === index}
						onclick={() => (selectedFloorIndex = index)}
						data-testid={`workshop-floor-${item.floor}`}
					>
						<code>{String(item.floor).padStart(2, '0')}</code>
						<span>{item.narrativeJob}</span>
						<strong>{item.title}</strong>
					</button>
				{/each}
			</div>

			<section class="floor-detail" data-testid="story-workshop-floor-detail">
				<div class="floor-mark">
					<span>FLOOR</span><strong>{String(floor.floor).padStart(2, '0')}</strong><small
						>{floor.narrativeJob}</small
					>
				</div>
				<div class="floor-copy">
					<span>{label(floor.primaryObjectiveKind)}</span>
					<h4>{floor.title}</h4>
					<p>{floor.narrativeTurn}</p>
					<div class="mechanical-job">
						<small>Mechanical job</small>
						<p>{floor.mechanicalJob}</p>
					</div>
				</div>
				<div class="anchor">
					<span>Immutable anchor</span>
					<code>{floor.requiredAnchor.anchorId}</code>
					<p>{floor.requiredAnchor.immutableFact}</p>
					<hr />
					<span>Optional aperture</span>
					<p>{floor.optionalBeat}</p>
				</div>
			</section>
		</article>
	</section>

	<section class="validation" aria-labelledby="validation-title">
		<header>
			<div>
				<span>03 / Machine boundary</span>
				<h2 id="validation-title">References before rhetoric.</h2>
			</div>
			<strong>{selected.validationChecks.filter((check) => check.passed).length} / 10 pass</strong>
		</header>
		<div class="check-grid">
			{#each selected.validationChecks as check (check.checkId)}
				<article class:failed={!check.passed}>
					<b>{check.passed ? '✓' : '×'}</b>
					<div>
						<span>{label(check.checkId)}</span>
						<p>{check.detail}</p>
					</div>
				</article>
			{/each}
		</div>
		{#if selected.productionWarnings.length > 0}
			<div class="warnings">
				<span>Production hold</span>
				{#each selected.productionWarnings as warning (warning)}<p>{warning}</p>{/each}
			</div>
		{/if}
	</section>

	<section class="review" aria-labelledby="review-title">
		<header>
			<div>
				<span>04 / Human decision</span>
				<h2 id="review-title">A schema cannot judge whether it matters.</h2>
			</div>
			<p>
				Review the exact proposal version across all six dimensions. Revise, reject, or accept it in
				the checked source; acceptance still authorizes only envelope compilation.
			</p>
		</header>
		<div class="rubric" data-testid="story-workshop-rubric">
			{#each ['causality', 'mechanical fit', 'emotional arc', 'character agency', 'production scope', 'envelope compile'] as criterion, index (criterion)}
				<article><code>0{index + 1}</code><strong>{criterion}</strong><span>pending</span></article>
			{/each}
		</div>
		<div class="editorial-notes">
			<article>
				<span>Production risks</span>
				{#each selected.proposal.productionRisks as risk (risk)}<p>{risk}</p>{/each}
			</article>
			<article>
				<span>Open questions</span>
				{#each selected.proposal.openQuestions as question (question)}<p>{question}</p>{/each}
			</article>
		</div>
	</section>

	<section class="payoff">
		<div>
			<span>Proposed settlement consequence</span>
			<h2>{selected.proposal.settlementConsequence}</h2>
		</div>
		<ol>
			{#each selected.proposal.finaleConstraints as constraint (constraint)}<li>
					{constraint}
				</li>{/each}
		</ol>
	</section>

	<footer class="page-footer">
		<div><span>Brief hash</span><code>{data.report.briefHash.slice(0, 16)}</code></div>
		<div><span>Report hash</span><code>{data.report.reportHash.slice(0, 16)}</code></div>
		<div><span>Generation</span><code>{data.report.generation.mode}</code></div>
		<p>Generated proposals are not accepted content and never mutate a run.</p>
	</footer>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #07090c;
		color: #eee9df;
	}
	:global(button) {
		font: inherit;
	}
	main {
		--paper: #eee9df;
		--muted: #929797;
		--line: #ffffff16;
		--gold: #d8ac63;
		--cyan: #74c4c8;
		--ember: #d65d30;
		min-height: 100vh;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
		background:
			radial-gradient(circle at 82% 8%, #17383f77, transparent 32rem),
			radial-gradient(circle at 8% 28%, #471d184d, transparent 36rem), #07090c;
	}
	nav {
		height: 72px;
		padding: 0 5vw;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	nav div {
		display: flex;
		gap: 24px;
	}
	a {
		color: #949999;
		text-decoration: none;
	}
	.wordmark {
		color: var(--paper);
		font:
			18px Georgia,
			serif;
		letter-spacing: 0.12em;
	}
	.wordmark span,
	em {
		color: var(--gold);
	}
	.hero {
		display: grid;
		grid-template-columns: 1fr minmax(250px, 340px);
		gap: 8vw;
		padding: 100px 6vw 70px;
		align-items: end;
	}
	.eyebrow,
	section > header span,
	.boundary > div > span,
	.question > span,
	.catalogs article > span,
	.proposal-detail > header span,
	.floor-copy > span,
	.anchor > span,
	.editorial-notes span,
	.payoff span {
		color: var(--gold);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	h1 {
		margin: 22px 0 30px;
		font:
			400 clamp(58px, 8vw, 116px)/0.86 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	h1 em {
		font-weight: 400;
	}
	.lede {
		max-width: 760px;
		color: #a6aaa7;
		font:
			18px/1.7 Georgia,
			serif;
	}
	.workshop-status {
		padding: 28px;
		border: 1px solid #72c0c455;
		background: #0c1418cc;
	}
	.workshop-status span,
	.workshop-status small {
		display: block;
		color: #7f8b8e;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.workshop-status strong {
		display: block;
		margin: 15px 0 0;
		color: var(--cyan);
		font:
			62px/0.9 Georgia,
			serif;
	}
	.workshop-status p {
		margin: 8px 0 26px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 10px;
	}
	.boundary {
		padding: 55px 6vw;
		display: grid;
		grid-template-columns: minmax(280px, 0.7fr) 1fr;
		gap: 7vw;
		border-block: 1px solid var(--line);
		background: #ffffff03;
	}
	.boundary h2 {
		max-width: 520px;
		margin: 12px 0 0;
		font:
			400 36px/1.05 Georgia,
			serif;
	}
	.boundary-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
	}
	.boundary-grid article {
		display: flex;
		gap: 15px;
		padding: 18px;
		border: 1px solid var(--line);
	}
	.boundary-grid b {
		color: var(--cyan);
		font:
			12px ui-monospace,
			monospace;
	}
	.boundary-grid p {
		margin: 0;
		color: #a8aaa5;
		font-size: 12px;
		line-height: 1.5;
	}
	.brief,
	.desk,
	.validation,
	.review {
		padding: 105px 6vw;
		border-bottom: 1px solid var(--line);
	}
	section > header {
		display: flex;
		justify-content: space-between;
		gap: 5vw;
		align-items: end;
		margin-bottom: 55px;
	}
	section > header h2 {
		margin: 13px 0 0;
		font:
			400 clamp(40px, 5vw, 70px)/0.94 Georgia,
			serif;
		letter-spacing: -0.045em;
	}
	section > header > p {
		max-width: 500px;
		margin: 0;
		color: #8c9291;
		line-height: 1.7;
	}
	section > header > code {
		color: var(--cyan);
	}
	.brief-layout {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		border: 1px solid var(--line);
	}
	.question {
		padding: clamp(28px, 5vw, 70px);
		background: linear-gradient(145deg, #171416, #0b1013);
	}
	.question blockquote {
		margin: 20px 0 35px;
		color: #d8d3c8;
		font:
			30px/1.35 Georgia,
			serif;
	}
	.question p {
		color: var(--cyan);
		line-height: 1.65;
	}
	.catalogs {
		display: grid;
	}
	.catalogs article {
		padding: 30px;
		border-left: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.catalogs article:last-child {
		border-bottom: 0;
	}
	.catalogs h3 {
		margin: 12px 0;
		font:
			30px Georgia,
			serif;
	}
	.catalogs p {
		color: #929696;
		line-height: 1.6;
	}
	.counts {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-top: 18px;
	}
	.counts div {
		border-right: 1px solid var(--line);
	}
	.counts div:last-child {
		border: 0;
	}
	.counts strong,
	.counts small {
		display: block;
	}
	.counts strong {
		color: var(--gold);
		font:
			29px Georgia,
			serif;
	}
	.counts small {
		margin-top: 7px;
		color: #777;
		font-size: 8px;
		text-transform: uppercase;
	}
	.proposal-tabs {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
		margin-bottom: 26px;
	}
	.proposal-tabs button {
		padding: 28px;
		border: 1px solid var(--line);
		background: #ffffff03;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.proposal-tabs button.active {
		border-color: #d8ac6377;
		background: linear-gradient(130deg, #2a1b13, #0d1518);
	}
	.proposal-tabs button > div,
	.proposal-tabs footer {
		display: flex;
		justify-content: space-between;
		color: #7f8584;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.13em;
	}
	.proposal-tabs code {
		color: var(--gold);
	}
	.proposal-tabs h3 {
		margin: 20px 0 10px;
		font:
			32px Georgia,
			serif;
	}
	.proposal-tabs p {
		min-height: 48px;
		color: #969a97;
		line-height: 1.55;
	}
	.proposal-tabs footer {
		margin-top: 25px;
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}
	.proposal-tabs footer strong {
		color: var(--cyan);
	}
	.proposal-detail {
		border: 1px solid var(--line);
		background: #0a0d10;
	}
	.proposal-detail > header {
		padding: 42px;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 50px;
	}
	.proposal-detail h3 {
		margin: 12px 0;
		font:
			42px Georgia,
			serif;
	}
	.proposal-detail > header p {
		max-width: 770px;
		color: #9fa3a0;
		line-height: 1.65;
	}
	.version-seal {
		min-width: 160px;
		padding: 20px;
		border-left: 1px solid var(--line);
	}
	.version-seal strong,
	.version-seal code {
		display: block;
	}
	.version-seal strong {
		margin: 15px 0;
		color: var(--gold);
		font:
			31px Georgia,
			serif;
	}
	.version-seal code {
		color: var(--cyan);
	}
	.floor-rail {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		border-block: 1px solid var(--line);
	}
	.floor-rail button {
		min-height: 130px;
		padding: 22px;
		border: 0;
		border-right: 1px solid var(--line);
		background: transparent;
		color: #777;
		text-align: left;
		cursor: pointer;
	}
	.floor-rail button:last-child {
		border: 0;
	}
	.floor-rail button.active {
		color: var(--paper);
		box-shadow: inset 0 3px var(--gold);
		background: #ffffff05;
	}
	.floor-rail code,
	.floor-rail span,
	.floor-rail strong {
		display: block;
	}
	.floor-rail code {
		color: var(--gold);
		font:
			25px Georgia,
			serif;
	}
	.floor-rail span {
		margin: 12px 0 8px;
		font-size: 8px;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.floor-rail strong {
		font:
			15px Georgia,
			serif;
	}
	.floor-detail {
		display: grid;
		grid-template-columns: 180px 1fr 1fr;
		min-height: 360px;
	}
	.floor-mark {
		display: grid;
		place-content: center;
		text-align: center;
		border-right: 1px solid var(--line);
	}
	.floor-mark span,
	.floor-mark small {
		color: #737a7b;
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.floor-mark strong {
		color: var(--cyan);
		font:
			78px/0.95 Georgia,
			serif;
	}
	.floor-copy,
	.anchor {
		padding: 42px;
	}
	.floor-copy h4 {
		margin: 13px 0 20px;
		font:
			36px Georgia,
			serif;
	}
	.floor-copy p,
	.anchor p {
		color: #9ca09d;
		line-height: 1.65;
	}
	.mechanical-job {
		margin-top: 30px;
		padding-top: 22px;
		border-top: 1px solid var(--line);
	}
	.mechanical-job small {
		color: var(--cyan);
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}
	.anchor {
		border-left: 1px solid var(--line);
		background: #ffffff02;
	}
	.anchor code {
		display: block;
		margin: 13px 0;
		color: var(--cyan);
	}
	.anchor hr {
		margin: 28px 0;
		border: 0;
		border-top: 1px solid var(--line);
	}
	.validation > header > strong {
		color: var(--cyan);
		font:
			38px Georgia,
			serif;
	}
	.check-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
	}
	.check-grid article {
		display: grid;
		grid-template-columns: 30px 1fr;
		gap: 14px;
		padding: 22px;
		border: 1px solid var(--line);
	}
	.check-grid b {
		color: var(--cyan);
		font-size: 20px;
	}
	.check-grid article.failed b {
		color: var(--ember);
	}
	.check-grid span {
		color: var(--gold);
		font-size: 9px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.check-grid p {
		margin: 7px 0 0;
		color: #858b89;
		font-size: 12px;
		line-height: 1.5;
	}
	.warnings {
		margin-top: 20px;
		padding: 24px;
		border: 1px solid #d65d3066;
	}
	.warnings span {
		color: var(--ember);
		text-transform: uppercase;
		font-size: 9px;
		letter-spacing: 0.15em;
	}
	.warnings p {
		color: #c6a392;
	}
	.rubric {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
	}
	.rubric article {
		padding: 24px;
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 15px;
		border: 1px solid var(--line);
	}
	.rubric code {
		color: var(--gold);
	}
	.rubric strong {
		text-transform: capitalize;
	}
	.rubric span {
		color: #777;
		text-transform: uppercase;
		font-size: 8px;
		letter-spacing: 0.13em;
	}
	.editorial-notes {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		margin-top: 28px;
	}
	.editorial-notes article {
		padding: 30px;
		border: 1px solid var(--line);
	}
	.editorial-notes p {
		padding-left: 18px;
		color: #979b98;
		line-height: 1.6;
		border-left: 1px solid #ffffff22;
	}
	.payoff {
		padding: 90px 6vw;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8vw;
		background: linear-gradient(125deg, #241711, #0b1114);
	}
	.payoff h2 {
		max-width: 760px;
		font:
			400 clamp(34px, 4vw, 58px)/1.08 Georgia,
			serif;
	}
	.payoff ol {
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: finale;
	}
	.payoff li {
		counter-increment: finale;
		padding: 20px 0 20px 48px;
		position: relative;
		border-bottom: 1px solid var(--line);
		color: #a8aaa5;
		line-height: 1.55;
	}
	.payoff li::before {
		content: '0' counter(finale);
		position: absolute;
		left: 0;
		color: var(--gold);
		font:
			17px Georgia,
			serif;
	}
	.page-footer {
		padding: 35px 6vw;
		display: grid;
		grid-template-columns: repeat(3, auto) 1fr;
		gap: 35px;
		align-items: end;
	}
	.page-footer span,
	.page-footer code {
		display: block;
	}
	.page-footer span {
		color: #676d6d;
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}
	.page-footer code {
		margin-top: 8px;
		color: var(--cyan);
	}
	.page-footer p {
		margin: 0;
		text-align: right;
		color: #686e6c;
		font-size: 11px;
	}
	@media (max-width: 800px) {
		nav {
			padding: 0 18px;
		}
		nav div {
			gap: 12px;
		}
		.hero,
		.boundary,
		.brief-layout,
		.payoff {
			grid-template-columns: 1fr;
		}
		.hero {
			padding: 65px 20px 42px;
		}
		h1 {
			font-size: clamp(50px, 16vw, 76px);
		}
		.lede {
			font-size: 16px;
		}
		.boundary,
		.brief,
		.desk,
		.validation,
		.review,
		.payoff {
			padding: 70px 20px;
		}
		section > header {
			display: block;
		}
		section > header > p,
		section > header > code {
			display: block;
			margin-top: 22px;
		}
		.catalogs article {
			border-left: 0;
			border-top: 1px solid var(--line);
		}
		.counts {
			grid-template-columns: repeat(2, 1fr);
			gap: 20px 0;
		}
		.proposal-tabs,
		.check-grid,
		.editorial-notes {
			grid-template-columns: 1fr;
		}
		.proposal-tabs p {
			min-height: 0;
		}
		.proposal-detail > header {
			grid-template-columns: 1fr;
			padding: 28px;
			gap: 22px;
		}
		.version-seal {
			border-left: 0;
			border-top: 1px solid var(--line);
		}
		.floor-rail {
			grid-template-columns: 1fr;
		}
		.floor-rail button {
			min-height: 0;
			border-right: 0;
			border-bottom: 1px solid var(--line);
			display: grid;
			grid-template-columns: 40px 90px 1fr;
			align-items: center;
			gap: 10px;
		}
		.floor-rail button.active {
			box-shadow: inset 3px 0 var(--gold);
		}
		.floor-rail span {
			margin: 0;
		}
		.floor-detail {
			grid-template-columns: 1fr;
		}
		.floor-mark {
			min-height: 150px;
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
		.floor-copy,
		.anchor {
			padding: 28px;
		}
		.anchor {
			border-left: 0;
			border-top: 1px solid var(--line);
		}
		.rubric {
			grid-template-columns: 1fr;
		}
		.page-footer {
			grid-template-columns: 1fr;
			padding: 35px 20px;
		}
		.page-footer p {
			text-align: left;
		}
	}
	@media (max-width: 470px) {
		nav div a:last-child {
			display: none;
		}
		.boundary-grid {
			grid-template-columns: 1fr;
		}
		.question {
			padding: 28px;
		}
		.question blockquote {
			font-size: 24px;
		}
		.proposal-tabs footer {
			display: grid;
			gap: 8px;
		}
	}
</style>
