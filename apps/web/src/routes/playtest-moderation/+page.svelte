<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const taskLabels: Record<string, string> = {
		'start-seeded-run': 'Start a seeded run',
		'complete-summoning-intro': 'Complete the summoning introduction',
		'read-three-hero-dossiers': 'Read three hero dossiers',
		'converse-and-direct': 'Converse and give a direction',
		'understand-autonomy': 'Explain what heroes choose themselves',
		'use-settlement-and-first-ember': 'Use the settlement and First Ember',
		'return-and-read-recap': 'Return and read the causal recap',
		'complete-iron-moon': 'Complete Iron Moon',
		'complete-tower-band': 'Complete tower floors 1–5',
		'recognize-hidden-route': 'Discover or miss the hidden route',
		'resolve-permanent-consequence': 'Resolve a permanent consequence',
		'inspect-replay-and-causality': 'Inspect replay and explain causality'
	};

	function readable(value: string) {
		return value.replaceAll('-', ' ');
	}
</script>

<svelte:head>
	<title>Moderated playtest · Summonlab</title>
	<meta
		name="description"
		content="A de-identified five-session protocol and release-severity gate for Summonlab's private moderated playtest."
	/>
</svelte:head>

<main data-testid="playtest-moderation">
	<nav>
		<a class="wordmark" href={resolve('/')}>SUMMON<span>LAB</span></a>
		<div>
			<a href={resolve('/playtest-report')}>Aggregate signal</a>
			<a href={resolve('/')}>Player title</a>
		</div>
	</nav>

	<header class="hero">
		<div>
			<p>FIN-007 · private local cohort</p>
			<h1>Observe the player.<br /><em>Do not invent them.</em></h1>
			<p class="lede">
				Five adult participants, five bounded tracks, and one explicit rule: automated journeys are
				preflight evidence, never substitutes for moderated human play.
			</p>
		</div>
		<section class="gate" class:complete={data.report.moderationStatus === 'complete'}>
			<span>Moderation gate</span>
			<strong data-testid="moderated-session-count"
				>{data.report.qualityGate.conductedSessionCount} / {data.report.qualityGate
					.requiredSessionCount}</strong
			>
			<p>{readable(data.report.moderationStatus)}</p>
			<small>Release: {readable(data.report.releaseRecommendation)}</small>
		</section>
	</header>

	<section class="boundary" aria-labelledby="boundary-title">
		<div>
			<span>Before each session</span>
			<h2 id="boundary-title">Consent remains participant-owned.</h2>
		</div>
		<ul>
			<li>Confirm adult participation and separate consent for paraphrased moderator notes.</li>
			<li>Do not record audio, video, identity, contact details, or direct quotations.</li>
			<li>Analytics sharing remains optional and independent from qualitative notes.</li>
			<li>Delete the participant’s retained note if they withdraw qualitative consent.</li>
		</ul>
	</section>

	<section class="cohort" aria-labelledby="cohort-title">
		<header>
			<div>
				<span>01 / Cohort map</span>
				<h2 id="cohort-title">Five anonymous sessions.</h2>
			</div>
			<p>
				Two phone sessions, three desktop sessions, and every definition-of-done behavior covered.
			</p>
		</header>
		<div class="slots">
			{#each data.report.recruitmentPlan as slot (slot.participantCode)}
				{@const recorded = data.report.sessions.find(
					(session) => session.participantCode === slot.participantCode
				)}
				<article data-testid="moderated-slot">
					<div class="slot-top">
						<strong>{slot.participantCode}</strong>
						<span class:recorded>{recorded ? 'recorded' : 'open slot'}</span>
					</div>
					<h3>{readable(slot.track)}</h3>
					<p>{slot.viewport} · {slot.requiredTaskIds.length} observed tasks</p>
					<ul>
						{#each slot.requiredTaskIds as taskId (taskId)}
							<li>{taskLabels[taskId]}</li>
						{/each}
					</ul>
					{#if recorded}
						<footer>
							<span>{recorded.attemptedTaskCount} attempted</span>
							<span>{recorded.moderatorPromptCount} prompts</span>
						</footer>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<section class="coverage" aria-labelledby="coverage-title">
		<header>
			<div>
				<span>02 / Observed coverage</span>
				<h2 id="coverage-title">The gate measures attempts, not optimism.</h2>
			</div>
			<strong
				>{data.report.qualityGate.coveredTaskCount} / {data.report.qualityGate
					.requiredTaskCount}</strong
			>
		</header>
		<div class="task-grid">
			{#each data.report.taskCoverage as task (task.taskId)}
				<article class:covered={task.attemptedSessionCount > 0}>
					<span>{task.attemptedSessionCount} observed</span>
					<h3>{taskLabels[task.taskId]}</h3>
					<p>
						{task.unassistedCompletionCount} unassisted · {task.promptedCompletionCount} prompted ·
						{task.notCompletedCount} incomplete
					</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="triage" aria-labelledby="triage-title">
		<header>
			<div>
				<span>03 / Release triage</span>
				<h2 id="triage-title">Severity determines the next move.</h2>
			</div>
			<strong>{data.report.qualityGate.openReleaseBlockerCount} open blockers</strong>
		</header>
		<div class="severity-grid">
			<article>
				<b>P0</b>
				<h3>Stop immediately</h3>
				<p>Privacy, consent, data loss, crash, or unsafe irreversible action.</p>
			</article>
			<article>
				<b>P1</b>
				<h3>Hold release</h3>
				<p>A core journey cannot be completed or understood without moderator rescue.</p>
			</article>
			<article>
				<b>P2</b>
				<h3>Schedule correction</h3>
				<p>Material friction with a discoverable workaround; does not block the cohort.</p>
			</article>
			<article>
				<b>P3</b>
				<h3>Record opportunity</h3>
				<p>Polish, preference, or expansion signal that does not invalidate the slice.</p>
			</article>
		</div>

		{#if data.report.findings.length > 0}
			<div class="findings">
				{#each data.report.findings as finding (finding.findingId)}
					<article>
						<b>{finding.severity}</b>
						<div>
							<span>{finding.findingId} · {readable(finding.area)}</span>
							<p>{finding.summary}</p>
						</div>
						<strong>{readable(finding.status)}</strong>
					</article>
				{/each}
			</div>
		{:else}
			<p class="empty">
				No human findings are recorded yet. The release recommendation must remain awaiting
				sessions.
			</p>
		{/if}
	</section>

	<footer class="page-footer">
		<div><span>Protocol</span><code>{data.report.protocolVersion}</code></div>
		<div><span>Evidence hash</span><code>{data.report.reportHash.slice(0, 16)}</code></div>
		<p>
			Sanitized summaries belong in the checked report. Raw moderator notes do not belong in Git.
		</p>
	</footer>
</main>

<style>
	:global(body) {
		background: #090b0d;
		color: #eee7d8;
	}
	:global(*) {
		box-sizing: border-box;
	}
	main {
		min-height: 100vh;
		background:
			radial-gradient(circle at 80% 5%, rgba(202, 112, 48, 0.17), transparent 32rem),
			linear-gradient(145deg, #08090b, #11151a);
	}
	nav {
		min-height: 4.5rem;
		padding: 1rem clamp(1.2rem, 5vw, 5rem);
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	nav div {
		display: flex;
		gap: 1.2rem;
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.wordmark {
		font-weight: 800;
		letter-spacing: 0.12em;
	}
	.wordmark span,
	em,
	section > header span,
	.boundary > div > span {
		color: #dd7d3e;
	}
	.hero {
		padding: clamp(3rem, 8vw, 7rem) clamp(1.2rem, 7vw, 8rem);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(15rem, 22rem);
		gap: 4rem;
		align-items: end;
	}
	.hero > div > p:first-child,
	section > header span,
	.boundary > div > span {
		font:
			0.7rem ui-monospace,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.16em;
	}
	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 1.5rem;
		font:
			clamp(2.8rem, 7vw, 7rem)/0.92 Georgia,
			serif;
		font-weight: 400;
		letter-spacing: -0.045em;
	}
	em {
		font-weight: 400;
	}
	.lede {
		max-width: 46rem;
		color: rgba(238, 231, 216, 0.7);
		font-size: 1.05rem;
		line-height: 1.7;
	}
	.gate {
		padding: 1.5rem;
		border: 1px solid rgba(221, 125, 62, 0.35);
		background: rgba(0, 0, 0, 0.24);
	}
	.gate > span,
	.gate small {
		display: block;
		color: rgba(238, 231, 216, 0.55);
		font:
			0.68rem ui-monospace,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.gate strong {
		display: block;
		margin: 0.7rem 0;
		font:
			3.4rem Georgia,
			serif;
	}
	.gate p {
		color: #dd7d3e;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.gate.complete {
		border-color: #7db79d;
	}
	.boundary {
		margin: 0 clamp(1.2rem, 5vw, 5rem);
		padding: 2rem;
		display: grid;
		grid-template-columns: minmax(14rem, 0.7fr) 1.3fr;
		gap: 3rem;
		background: #e8dfcd;
		color: #17191b;
	}
	.boundary h2,
	section h2 {
		font:
			clamp(1.8rem, 4vw, 3.2rem)/1 Georgia,
			serif;
		font-weight: 400;
	}
	.boundary ul {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.8rem;
		line-height: 1.5;
	}
	.cohort,
	.coverage,
	.triage {
		padding: 5rem clamp(1.2rem, 5vw, 5rem);
	}
	section > header {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: end;
		margin-bottom: 2rem;
	}
	section > header p {
		max-width: 34rem;
		color: rgba(238, 231, 216, 0.6);
		line-height: 1.5;
	}
	.slots {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.slots article,
	.task-grid article,
	.severity-grid article {
		border: 1px solid rgba(255, 255, 255, 0.11);
		background: rgba(255, 255, 255, 0.025);
		padding: 1.2rem;
	}
	.slot-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.slot-top strong {
		font:
			1.4rem ui-monospace,
			monospace;
		color: #dd7d3e;
	}
	.slot-top span {
		color: rgba(238, 231, 216, 0.45);
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	.slot-top span.recorded {
		color: #7db79d;
	}
	.slots h3,
	.task-grid h3,
	.severity-grid h3 {
		margin: 1.4rem 0 0.5rem;
		font:
			1.15rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.slots p,
	.task-grid p,
	.severity-grid p {
		color: rgba(238, 231, 216, 0.56);
		font-size: 0.82rem;
		line-height: 1.5;
	}
	.slots ul {
		padding-left: 1rem;
		color: rgba(238, 231, 216, 0.72);
		font-size: 0.8rem;
		line-height: 1.45;
	}
	.slots li + li {
		margin-top: 0.45rem;
	}
	.slots footer {
		display: flex;
		justify-content: space-between;
		color: #7db79d;
		font-size: 0.72rem;
	}
	.coverage {
		background: rgba(0, 0, 0, 0.18);
	}
	.coverage > header > strong,
	.triage > header > strong {
		color: #dd7d3e;
		font:
			1rem ui-monospace,
			monospace;
	}
	.task-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.task-grid article > span {
		color: rgba(238, 231, 216, 0.4);
		font:
			0.65rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.task-grid article.covered {
		border-color: rgba(125, 183, 157, 0.48);
	}
	.severity-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.severity-grid b {
		display: inline-grid;
		width: 2.2rem;
		height: 2.2rem;
		place-items: center;
		border: 1px solid #dd7d3e;
		color: #dd7d3e;
	}
	.empty {
		padding: 1.5rem;
		margin-top: 1rem;
		border-left: 3px solid #dd7d3e;
		background: rgba(221, 125, 62, 0.08);
		color: rgba(238, 231, 216, 0.72);
	}
	.findings article {
		display: grid;
		grid-template-columns: 3rem 1fr auto;
		gap: 1rem;
		padding: 1rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}
	.findings span {
		color: #dd7d3e;
		font:
			0.65rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.page-footer {
		padding: 2rem clamp(1.2rem, 5vw, 5rem) 4rem;
		display: flex;
		gap: 2rem;
		align-items: end;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}
	.page-footer span {
		display: block;
		color: rgba(238, 231, 216, 0.4);
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	.page-footer p {
		margin-left: auto;
		max-width: 34rem;
		color: rgba(238, 231, 216, 0.5);
		text-align: right;
	}
	@media (max-width: 980px) {
		.slots {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.task-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.severity-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 650px) {
		nav div {
			flex-direction: column;
			gap: 0.3rem;
			text-align: right;
		}
		.hero {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}
		.boundary {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		section > header {
			display: block;
		}
		.slots,
		.task-grid,
		.severity-grid {
			grid-template-columns: 1fr;
		}
		.page-footer {
			display: grid;
		}
		.page-footer p {
			margin-left: 0;
			text-align: left;
		}
	}
</style>
