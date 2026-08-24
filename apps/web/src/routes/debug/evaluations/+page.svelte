<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let scripted = $derived(data.report.baselines[0]);
	let random = $derived(data.report.baselines[1]);
	let model = $derived(data.report.modelCandidate);

	function percent(rate: number) {
		return `${Math.round(rate * 100)}%`;
	}

	function money(value: number) {
		return `$${value.toFixed(value < 0.01 ? 5 : 3)}`;
	}

	function short(hash: string) {
		return hash.slice(0, 14);
	}
</script>

<svelte:head>
	<title>Agency evaluation bench · summonlab</title>
	<meta
		name="description"
		content="A deterministic quality, safety, token, cost, and evidence gate for summoned hero policies."
	/>
</svelte:head>

<main data-testid="evaluation-bench">
	<nav>
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Development instrument</span><strong>Agency evaluation</strong></div>
		<code>{data.corpus.schemaVersion}</code>
	</nav>

	<header class="hero">
		<div class="hero-copy">
			<p>AGT-009 / repeatable evidence</p>
			<h1>Earn the right<br />to think aloud.</h1>
			<span>
				Ten fixed situations test whether autonomy stays legal, contextual, distinct, and
				affordable. No provider call happens on this page.
			</span>
		</div>
		<div class="gate" data-testid="model-gate">
			<i>◇</i>
			<span>Model gate</span>
			<strong>Evidence required</strong>
			<small>{model.gateReason.replaceAll('-', ' ')}</small>
		</div>
	</header>

	<section class="integrity" aria-label="Evaluation integrity chain">
		<div><span>Corpus</span><code>{short(data.corpus.corpusHash)}</code></div>
		<i>→</i>
		<div><span>Prompt</span><code>{data.corpus.promptVersion}</code></div>
		<i>→</i>
		<div><span>Report</span><code>{short(data.report.reportHash)}</code></div>
	</section>

	<section class="scoreboard">
		<header>
			<div>
				<span>01 / Baseline proof</span>
				<h2>Safety before intelligence</h2>
			</div>
			<code>{scripted.coverage.evaluated}/{scripted.coverage.total} packets</code>
		</header>
		<div class="score-grid">
			<article class="candidate scripted">
				<div><span>Personality script</span><i>baseline pass</i></div>
				<strong>{percent(scripted.rates.expectedAction)}</strong>
				<small>expected action fit</small>
				<ul>
					<li><span>Structural safety</span><b>{percent(scripted.rates.structuralSafety)}</b></li>
					<li><span>Pair distinction</span><b>{percent(scripted.rates.pairDistinctness)}</b></li>
					<li><span>Witnessed memory</span><b>{percent(scripted.rates.memoryUse)}</b></li>
					<li>
						<span>Language repetition</span><b>{percent(scripted.rates.repetitiveLanguage)}</b>
					</li>
				</ul>
			</article>
			<article class="candidate random">
				<div><span>Seeded random</span><i>negative control</i></div>
				<strong>{percent(random.rates.expectedAction)}</strong>
				<small>expected action fit</small>
				<ul>
					<li><span>Structural safety</span><b>{percent(random.rates.structuralSafety)}</b></li>
					<li><span>Pair distinction</span><b>{percent(random.rates.pairDistinctness)}</b></li>
					<li><span>Witnessed memory</span><b>{percent(random.rates.memoryUse)}</b></li>
					<li><span>Language repetition</span><b>{percent(random.rates.repetitiveLanguage)}</b></li>
				</ul>
			</article>
		</div>
	</section>

	<section class="model-panel">
		<header>
			<div>
				<span>02 / Planned live candidate</span>
				<h2>gpt-5-nano, still unproven</h2>
			</div>
			<i>{model.coverage.evaluated}/{model.coverage.total} recorded</i>
		</header>
		<div class="budget-grid">
			<article>
				<span>Worst-case estimate</span><strong
					>{money(model.tokenEstimate.estimatedCostPerDecisionUsd)}</strong
				><small>per decision</small>
			</article>
			<article>
				<span>Daily projection</span><strong
					>{money(model.tokenEstimate.estimated100DecisionsPerDayUsd)}</strong
				><small>100 decisions</small>
			</article>
			<article>
				<span>Input estimate</span><strong
					>{model.tokenEstimate.estimatedInputTokens.toLocaleString()}</strong
				><small>corpus tokens</small>
			</article>
			<article><span>Latency</span><strong>—</strong><small>unmeasured · 0 samples</small></article>
		</div>
		<p>
			Cost uses the published model page snapshot ({model.pricing.observedAt}), four characters per
			input token, and the full 800-token output cap. Approval remains blocked until every packet
			has a recorded provider result.
		</p>
	</section>

	<section class="corpus">
		<header>
			<div>
				<span>03 / Fixed corpus</span>
				<h2>Same trials, every time</h2>
			</div>
			<code>{data.corpus.cases.length} cases · 6 dimensions</code>
		</header>
		<div class="case-list">
			{#each data.corpus.cases as item, index (item.caseId)}
				{@const grade = scripted.grades[index]}
				<article>
					<div class="case-number">{String(index + 1).padStart(2, '0')}</div>
					<div class="case-copy">
						<span>{item.dimension.replaceAll('-', ' ')}</span>
						<strong>{item.title}</strong>
						<small
							>{item.packet.identity.profile.displayName} · {item.packet.decisionKind.replaceAll(
								'-',
								' '
							)}</small
						>
					</div>
					<div class="choice">
						<i class:pass={grade?.passed}>{grade?.passed ? '✓' : '!'}</i>
						<span>{grade?.result.decision.actionId.replace('eval.', '')}</span>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<footer>
		<span>Offline baselines · zero paid calls · no credentials</span>
		<a href={model.pricing.sourceUrl}>Pricing source ↗</a>
	</footer>
</main>

<style>
	:global(body) {
		background:
			radial-gradient(circle at 78% 8%, rgba(206, 149, 65, 0.12), transparent 31rem),
			linear-gradient(145deg, #080b12, #0d1018 48%, #080a0f);
	}

	main {
		--gold: #d4a354;
		--ink: #0a0c12;
		--line: rgba(255, 255, 255, 0.11);
		max-width: 1180px;
		margin: auto;
		padding: 26px 32px 70px;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 20px;
		min-height: 58px;
		border-bottom: 1px solid var(--line);
	}
	nav .wordmark {
		color: #fff;
		font-family: Georgia, serif;
		font-size: 22px;
		text-decoration: none;
		margin-right: auto;
	}
	nav div {
		display: grid;
		text-align: right;
	}
	nav span,
	section header span,
	.hero p {
		color: var(--gold);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	nav strong {
		font-size: 12px;
		font-weight: 500;
	}
	code {
		color: #9aa1ad;
		font:
			10px ui-monospace,
			monospace;
	}
	.hero {
		display: grid;
		grid-template-columns: 1fr 260px;
		gap: 60px;
		align-items: end;
		min-height: 370px;
		padding: 64px 40px 50px;
	}
	.hero h1 {
		font:
			clamp(50px, 7.5vw, 88px)/0.88 Georgia,
			serif;
		letter-spacing: -0.055em;
		margin: 15px 0 26px;
	}
	.hero-copy > span {
		display: block;
		color: #aeb3bd;
		max-width: 610px;
		line-height: 1.7;
	}
	.gate {
		aspect-ratio: 1;
		border: 1px solid rgba(212, 163, 84, 0.4);
		border-radius: 50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		box-shadow:
			inset 0 0 60px rgba(212, 163, 84, 0.06),
			0 0 90px rgba(212, 163, 84, 0.06);
	}
	.gate i {
		color: var(--gold);
		font-size: 34px;
		font-style: normal;
	}
	.gate span {
		color: #888f9b;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		margin-top: 10px;
	}
	.gate strong {
		font:
			21px Georgia,
			serif;
		margin: 7px 0;
	}
	.gate small {
		color: #726f6a;
		font-size: 9px;
	}
	.integrity {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 25px;
		background: rgba(255, 255, 255, 0.025);
		border: 1px solid var(--line);
		padding: 17px;
	}
	.integrity div {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.integrity span {
		color: #6e7480;
		font-size: 9px;
		text-transform: uppercase;
	}
	.integrity i {
		color: #424751;
	}
	section:not(.integrity) {
		margin-top: 76px;
	}
	section > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
		padding-bottom: 18px;
		margin-bottom: 26px;
	}
	section h2 {
		font:
			34px Georgia,
			serif;
		margin: 8px 0 0;
	}
	.score-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.candidate {
		padding: 28px;
		border: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.025);
	}
	.candidate.scripted {
		border-color: rgba(212, 163, 84, 0.34);
		background: linear-gradient(145deg, rgba(212, 163, 84, 0.09), rgba(255, 255, 255, 0.018));
	}
	.candidate > div {
		display: flex;
		justify-content: space-between;
	}
	.candidate > div span {
		font:
			19px Georgia,
			serif;
	}
	.candidate > div i {
		color: #8d948f;
		font-size: 9px;
		font-style: normal;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.candidate > strong {
		display: block;
		font:
			60px Georgia,
			serif;
		margin-top: 25px;
	}
	.candidate > small {
		color: #737a86;
	}
	ul {
		list-style: none;
		padding: 18px 0 0;
		margin: 24px 0 0;
		border-top: 1px solid var(--line);
	}
	li {
		display: flex;
		justify-content: space-between;
		padding: 7px 0;
		color: #969ca7;
		font-size: 12px;
	}
	li b {
		color: #e6e0d6;
	}
	.model-panel {
		border: 1px solid rgba(212, 163, 84, 0.3);
		padding: 30px;
		background: rgba(212, 163, 84, 0.035);
	}
	.model-panel > header {
		margin: 0 0 28px;
	}
	.model-panel header i {
		color: #e1b96e;
		font-size: 11px;
		font-style: normal;
		text-transform: uppercase;
		letter-spacing: 0.15em;
	}
	.budget-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: var(--line);
	}
	.budget-grid article {
		background: #10131a;
		padding: 22px;
	}
	.budget-grid span,
	.budget-grid small {
		display: block;
		color: #737a86;
		font-size: 10px;
	}
	.budget-grid strong {
		display: block;
		font:
			28px Georgia,
			serif;
		margin: 11px 0 5px;
	}
	.model-panel > p {
		color: #858c97;
		max-width: 780px;
		line-height: 1.6;
		font-size: 12px;
		margin: 24px 0 0;
	}
	.case-list {
		border-top: 1px solid var(--line);
	}
	.case-list article {
		display: grid;
		grid-template-columns: 52px 1fr minmax(180px, auto);
		align-items: center;
		gap: 18px;
		border-bottom: 1px solid var(--line);
		padding: 18px 4px;
	}
	.case-number {
		color: #4e535d;
		font:
			12px ui-monospace,
			monospace;
	}
	.case-copy {
		display: grid;
		gap: 5px;
	}
	.case-copy span {
		color: #b28a49;
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 0.16em;
	}
	.case-copy strong {
		font:
			16px Georgia,
			serif;
	}
	.case-copy small {
		color: #696f79;
		font-size: 10px;
	}
	.choice {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 12px;
		color: #9ba1ab;
		font:
			10px ui-monospace,
			monospace;
	}
	.choice i {
		display: grid;
		place-items: center;
		width: 25px;
		height: 25px;
		border: 1px solid #714d48;
		border-radius: 50%;
		color: #c47a70;
		font-style: normal;
	}
	.choice i.pass {
		border-color: #4a6d5d;
		color: #71b28f;
	}
	footer {
		display: flex;
		justify-content: space-between;
		padding-top: 25px;
		margin-top: 30px;
		border-top: 1px solid var(--line);
		color: #5f6570;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.13em;
	}
	footer a {
		color: #b28a49;
		text-decoration: none;
	}

	@media (max-width: 720px) {
		main {
			padding: 18px 16px 50px;
		}
		nav code {
			display: none;
		}
		.hero {
			grid-template-columns: 1fr;
			min-height: 0;
			padding: 56px 6px 34px;
			gap: 35px;
		}
		.hero h1 {
			font-size: 54px;
		}
		.gate {
			width: 210px;
			justify-self: center;
		}
		.integrity {
			gap: 8px;
			overflow: hidden;
		}
		.integrity div {
			display: grid;
			gap: 4px;
		}
		.integrity code {
			font-size: 8px;
		}
		section:not(.integrity) {
			margin-top: 54px;
		}
		section h2 {
			font-size: 28px;
		}
		.score-grid,
		.budget-grid {
			grid-template-columns: 1fr;
		}
		.model-panel {
			padding: 22px 18px;
		}
		.case-list article {
			grid-template-columns: 34px 1fr;
		}
		.choice {
			grid-column: 2;
			justify-content: flex-start;
		}
		footer {
			gap: 20px;
			line-height: 1.5;
		}
	}
</style>
