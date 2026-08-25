<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let committedView = $state<typeof data.view | null>(null);
	const view = $derived(committedView ?? data.view);
	let busyPatchId = $state('');
	let errorMessage = $state('');
	const passedCount = $derived(
		view.options[0]?.validation.checks.filter((check) => check.status === 'passed').length ??
			view.appliedPatch?.validation.checks.filter((check) => check.status === 'passed').length ??
			0
	);
	const activeValidation = $derived(
		view.appliedPatch?.validation ?? view.options[0]?.validation ?? null
	);

	function short(value: string) {
		return value.slice(0, 12);
	}
	function label(value: string) {
		return value.replaceAll('-', ' ');
	}
	function heroLabel(heroId: string) {
		const member = view.cast.find((entry) => entry.heroId === heroId);
		return member?.role === 'route holder'
			? `ROUTEBEARER—${heroId.slice(-4).toUpperCase()}`
			: `COUNTERVOICE—${heroId.slice(-4).toUpperCase()}`;
	}

	async function apply(candidate: (typeof view.options)[number]['candidate']) {
		busyPatchId = candidate.patchId;
		errorMessage = '';
		try {
			const response = await fetch(`/api/runs/${view.runId}/story-patch`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(candidate)
			});
			const body = (await response.json()) as { view?: typeof view; message?: string };
			if (!response.ok || !body.view) throw new Error(body.message ?? 'Patch commit failed.');
			committedView = body.view;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Patch commit failed.';
		} finally {
			busyPatchId = '';
		}
	}
</script>

<svelte:head>
	<title>Floor 04 Story Aperture · summonlab</title>
	<meta
		name="description"
		content="A live, engine-validated runtime story patch at the Needle Bridge."
	/>
</svelte:head>

<main data-testid="runtime-story-patch">
	<nav>
		<a href={resolve('/')} class="wordmark">summonlab</a>
		<span>STORYDIRECTOR / FLOOR 04</span>
		<code>CURSOR {String(view.eventCursor).padStart(4, '0')}</code>
	</nav>

	<header>
		<div class="eyebrow"><span>MIS—015</span><i></i><span>one bounded aperture</span></div>
		<div class="heading-row">
			<div>
				<h1>The bridge<br /><em>remembers.</em></h1>
				<p>{view.envelope.emotionalQuestion}</p>
			</div>
			<div class="floor-orbit"><small>FLOOR</small><strong>04</strong><span>OF 100</span></div>
		</div>
		<div class="hashline">
			<span>ENVELOPE</span><code>{short(view.envelope.contentHash)}</code><i></i><span>HISTORY</span
			><code>{short(view.checkpoint.historyHash)}</code><i></i><span>STATE</span><code
				>{short(view.stateHash)}</code
			>
		</div>
	</header>

	<section class="bridge" aria-label="The Needle Bridge story checkpoint">
		<div class="chamber left">
			<span>LEFT RELAY</span><i class="relay"></i><small>pressure anchor complete</small>
		</div>
		<div class="span">
			<div class="cable top"></div>
			<div class="deck"></div>
			<div class="cable bottom"></div>
			<div class="crossing">
				<span>PATCH APERTURE</span><strong>{view.appliedPatch ? 'SEALED' : 'OPEN'}</strong>
			</div>
		</div>
		<div class="chamber right">
			<span>RIGHT RELAY</span><i class="relay"></i><small>opposition anchor waits</small>
		</div>
	</section>

	<section class="checkpoint-strip">
		<div><span>Completed spine</span><strong>{view.checkpoint.completedBeatCount}</strong></div>
		<div><span>After</span><strong>{view.checkpoint.afterBeat.title}</strong></div>
		<div><span>Before</span><strong>{view.checkpoint.beforeBeat.title}</strong></div>
		<div class="open"><span>Selection bound</span><strong>1 / 1</strong></div>
	</section>

	{#if view.appliedPatch}
		<section class="committed" data-testid="story-patch-committed">
			<div class="seal">✓</div>
			<div>
				<span>Canonical story patch · event {view.eventCursor}</span>
				<h2>{label(view.appliedPatch.validation.activatedBeatIds[0]!)}</h2>
				<p>{view.appliedPatch.candidate.publicIntent}</p>
			</div>
			<div class="commit-proof">
				<small>PATCH</small><code>{short(view.appliedPatch.patchHash)}</code><small>RESULT</small
				><code>{short(view.appliedPatch.validation.resultingHistoryHash!)}</code>
			</div>
		</section>
	{:else}
		<section class="choice-section">
			<div class="section-title">
				<span>StoryDirector proposals</span>
				<h2>Choose how truth enters the room.</h2>
				<p>
					The authored confrontation remains next. The agent may activate one catalogued route into
					it.
				</p>
			</div>
			<div class="choices">
				{#each view.options as option, index (option.candidate.patchId)}
					<article
						class:role={option.proposal.kind === 'role-expression'}
						data-testid="story-patch-option"
					>
						<div class="number">0{index + 1}</div>
						<div class="kind">
							<span>{label(option.proposal.kind)}</span><code
								>{short(option.candidate.patchId)}</code
							>
						</div>
						<h3>{option.beat.title}</h3>
						<p>{option.proposal.summary}</p>
						{#if option.boundHeroId}<div class="binding">
								<span>Bound voice</span><strong>{heroLabel(option.boundHeroId)}</strong><small
									>holds: foundry maintenance route</small
								>
							</div>{:else}<div class="binding unbound">
								<span>Cast binding</span><strong>NONE REQUIRED</strong><small
									>complication changes pressure, not knowledge</small
								>
							</div>{/if}
						<button
							disabled={busyPatchId !== '' || !option.validation.accepted}
							onclick={() => apply(option.candidate)}
							data-testid={`apply-story-patch-${option.proposal.kind}`}
						>
							{busyPatchId === option.candidate.patchId ? 'Committing…' : 'Commit this expression'}
						</button>
					</article>
				{/each}
			</div>
		</section>
	{/if}

	<section class="validator" data-testid="story-patch-validator">
		<div class="validator-head">
			<div>
				<span>Runtime authority boundary</span>
				<h2>{passedCount} / 17 checks pass.</h2>
			</div>
			<div class:accepted={activeValidation?.accepted}>
				{activeValidation?.accepted ? 'ACCEPTABLE' : 'REJECTED'}
			</div>
		</div>
		<div class="check-grid">
			{#each activeValidation?.checks ?? [] as check, index (check.code)}
				<article class:rejected={check.status === 'rejected'}>
					<code>{String(index + 1).padStart(2, '0')}</code>
					<div>
						<strong>{label(check.code)}</strong>
						<p>{check.summary}</p>
					</div>
					<span>{check.status === 'passed' ? '✓' : '×'}</span>
				</article>
			{/each}
		</div>
	</section>

	<section class="fixed">
		<div>
			<span>Outside agent authority</span>
			<h2>The gold rail does not move.</h2>
		</div>
		<div class="fixed-metrics">
			<article><strong>{view.envelope.worldLawCount}</strong><span>world laws</span></article>
			<article><strong>{view.envelope.anchorCount}</strong><span>fixed anchors</span></article>
			<article>
				<strong>{view.envelope.rewardDeclaredCost}/{view.envelope.rewardBudgetPoints}</strong><span
					>reward ledger</span
				>
			</article>
			<article>
				<strong>{view.envelope.finaleConstraintCount}</strong><span>finale constraints</span>
			</article>
		</div>
	</section>

	<footer>
		<span>{view.contentVersion}</span><code>{view.runId}</code><strong
			>{view.appliedPatch ? 'REPLAY-BOUND' : 'AWAITING CHOICE'}</strong
		>
	</footer>
	{#if errorMessage}<div class="error" role="alert">{errorMessage}</div>{/if}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #05080a;
		color: #eee8dc;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	:global(button) {
		font: inherit;
	}
	main {
		min-height: 100vh;
		background:
			radial-gradient(circle at 50% 26rem, rgba(49, 159, 160, 0.1), transparent 32rem),
			repeating-linear-gradient(
				90deg,
				transparent 0 7.5rem,
				rgba(184, 151, 85, 0.025) 7.5rem 7.56rem
			),
			#05080a;
		overflow: hidden;
	}
	nav {
		height: 3rem;
		border-bottom: 1px solid #2d393c;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 clamp(1rem, 4vw, 4rem);
		color: #778281;
		font: 0.58rem monospace;
		letter-spacing: 0.15em;
	}
	nav code {
		justify-self: end;
		color: #b19562;
	}
	.wordmark {
		color: #eee8dc;
		text-decoration: none;
		font: 700 0.75rem Inter;
	}
	header {
		padding: clamp(2rem, 5vw, 4.5rem) clamp(1.2rem, 6vw, 6rem) 2rem;
		max-width: 96rem;
		margin: auto;
	}
	.eyebrow {
		display: flex;
		gap: 1rem;
		align-items: center;
		color: #d9a74e;
		font-size: 0.6rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	.eyebrow i {
		width: 5rem;
		height: 1px;
		background: #856a3d;
	}
	.heading-row {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: center;
	}
	h1 {
		margin: 1.1rem 0 1.5rem;
		font:
			400 clamp(4.5rem, 9vw, 8.8rem)/0.77 Georgia,
			serif;
		letter-spacing: -0.07em;
		text-transform: uppercase;
	}
	h1 em {
		color: transparent;
		font-style: normal;
		-webkit-text-stroke: 1px #cdbd9a;
	}
	.heading-row p {
		max-width: 38rem;
		color: #9aa3a0;
		line-height: 1.6;
	}
	.floor-orbit {
		flex: 0 0 clamp(7.5rem, 14vw, 11rem);
		aspect-ratio: 1;
		border: 1px solid #428e8b;
		border-radius: 50%;
		display: grid;
		place-content: center;
		text-align: center;
		box-shadow:
			inset 0 0 0 0.55rem #070c0e,
			inset 0 0 0 calc(0.55rem + 1px) #244746,
			0 0 4rem rgba(50, 154, 151, 0.12);
		animation: pulse 4s ease-in-out infinite;
	}
	.floor-orbit small,
	.floor-orbit span {
		font: 0.52rem monospace;
		letter-spacing: 0.2em;
		color: #62bdb8;
	}
	.floor-orbit strong {
		font: 3.3rem Georgia;
		color: #6dd2cc;
	}
	.hashline {
		border-block: 1px solid #273134;
		padding: 0.7rem 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: #657270;
		font: 0.55rem monospace;
		letter-spacing: 0.12em;
		overflow: hidden;
	}
	.hashline code {
		color: #a99a7d;
	}
	.hashline i {
		flex: 1;
		height: 1px;
		background: #263134;
		min-width: 1rem;
	}
	.bridge {
		height: 16rem;
		display: grid;
		grid-template-columns: 1fr minmax(18rem, 42rem) 1fr;
		align-items: center;
		position: relative;
		background: linear-gradient(180deg, transparent, rgba(31, 76, 80, 0.08), transparent);
	}
	.chamber {
		height: 9rem;
		border-block: 1px solid #354447;
		display: grid;
		place-content: center;
		text-align: center;
		gap: 0.6rem;
		background: #0b1113;
		color: #899592;
		font-size: 0.55rem;
		letter-spacing: 0.2em;
	}
	.chamber.left {
		border-right: 1px solid #465759;
	}
	.chamber.right {
		border-left: 1px solid #465759;
	}
	.chamber small {
		color: #53605f;
	}
	.relay {
		width: 3rem;
		height: 3rem;
		margin: auto;
		border: 1px solid #54aaa5;
		border-radius: 50%;
		box-shadow: 0 0 1.8rem #267b78;
		position: relative;
	}
	.relay:after {
		content: '';
		position: absolute;
		inset: 0.55rem;
		border: 1px solid #ac884b;
		transform: rotate(45deg);
	}
	.span {
		height: 12rem;
		position: relative;
		display: grid;
		place-items: center;
	}
	.deck {
		width: 100%;
		height: 0.42rem;
		background: repeating-linear-gradient(90deg, #806a43 0 1.8rem, #282f30 1.8rem 2rem);
		box-shadow: 0 0.3rem 1rem #000;
	}
	.cable {
		position: absolute;
		left: 0;
		width: 100%;
		height: 1px;
		background: #3b6261;
	}
	.cable.top {
		top: 2.2rem;
		transform: skewY(-7deg);
	}
	.cable.bottom {
		bottom: 2.2rem;
		transform: skewY(7deg);
	}
	.crossing {
		position: absolute;
		width: 6rem;
		aspect-ratio: 1;
		border: 1px solid #d3a351;
		background: #090e10;
		transform: rotate(45deg);
		display: grid;
		place-content: center;
		text-align: center;
		box-shadow: 0 0 3rem rgba(210, 161, 75, 0.18);
	}
	.crossing > * {
		transform: rotate(-45deg);
	}
	.crossing span {
		font-size: 0.42rem;
		letter-spacing: 0.14em;
		color: #9a8157;
	}
	.crossing strong {
		font-size: 0.75rem;
		color: #e2b35e;
		margin-top: 0.2rem;
	}
	.checkpoint-strip {
		display: grid;
		grid-template-columns: 0.6fr 1fr 1fr 0.6fr;
		border-block: 1px solid #303b3e;
	}
	.checkpoint-strip > div {
		padding: 1rem 1.2rem;
		border-right: 1px solid #303b3e;
		display: grid;
		gap: 0.4rem;
	}
	.checkpoint-strip > div:last-child {
		border: 0;
	}
	.checkpoint-strip span,
	.fixed > div > span,
	.section-title > span,
	.validator-head span,
	.committed span {
		color: #7e8b89;
		font-size: 0.55rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	.checkpoint-strip strong {
		font: 0.85rem Georgia;
	}
	.checkpoint-strip .open strong {
		color: #62c8c2;
	}
	.choice-section,
	.validator,
	.fixed,
	.committed {
		max-width: 88rem;
		margin: 0 auto;
		padding: clamp(3rem, 6vw, 6rem) clamp(1.2rem, 4vw, 4rem);
	}
	.section-title {
		display: grid;
		grid-template-columns: 1fr 2fr;
		align-items: end;
		gap: 1rem;
	}
	.section-title h2,
	.validator-head h2,
	.fixed h2,
	.committed h2 {
		margin: 0.5rem 0 0;
		font:
			400 clamp(2.1rem, 4.5vw, 4.2rem)/0.92 Georgia,
			serif;
		letter-spacing: -0.04em;
	}
	.section-title p {
		color: #84908e;
		max-width: 30rem;
		line-height: 1.6;
		justify-self: end;
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		margin-top: 2rem;
		border: 1px solid #354043;
	}
	.choices article {
		min-height: 29rem;
		padding: 1.5rem;
		border-right: 1px solid #354043;
		display: flex;
		flex-direction: column;
		background: linear-gradient(140deg, rgba(36, 99, 98, 0.09), transparent 55%);
	}
	.choices article:last-child {
		border: 0;
	}
	.choices article.role {
		background: linear-gradient(140deg, rgba(205, 157, 75, 0.1), transparent 55%);
	}
	.number {
		color: #30403f;
		font: 4rem Georgia;
	}
	.kind {
		display: flex;
		justify-content: space-between;
		color: #62c8c2;
		font-size: 0.56rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	.kind code {
		color: #687573;
	}
	.choices h3 {
		margin: 1rem 0 0.6rem;
		font: 2rem Georgia;
	}
	.choices p {
		color: #8e9997;
		line-height: 1.55;
	}
	.binding {
		border-left: 2px solid #d4a24b;
		margin: auto 0 1.3rem;
		padding: 0.75rem 1rem;
		display: grid;
		gap: 0.35rem;
		background: #0b1113;
	}
	.binding span {
		color: #8d7a58;
		font-size: 0.52rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	.binding strong {
		color: #e2b765;
		font: 0.75rem monospace;
	}
	.binding small {
		color: #667370;
	}
	.binding.unbound {
		border-color: #4da6a2;
	}
	.choices button {
		border: 1px solid #c99c4c;
		background: transparent;
		color: #e2b763;
		padding: 1rem;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.choices button:hover {
		background: #d5a34c;
		color: #171007;
	}
	.choices button:disabled {
		opacity: 0.45;
		cursor: wait;
	}
	.committed {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 2rem;
		border-bottom: 1px solid #303b3e;
	}
	.seal {
		width: 6rem;
		aspect-ratio: 1;
		border: 1px solid #51b8b2;
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: #61d2cb;
		font-size: 2rem;
		box-shadow:
			inset 0 0 0 0.5rem #070c0e,
			inset 0 0 0 calc(0.5rem + 1px) #285452;
	}
	.committed p {
		color: #8b9694;
	}
	.commit-proof {
		display: grid;
		gap: 0.35rem;
	}
	.commit-proof small {
		color: #687573;
		font: 0.5rem monospace;
	}
	.commit-proof code {
		color: #d1a552;
	}
	.validator {
		max-width: none;
		background: #0a0f11;
		border-block: 1px solid #2e393b;
	}
	.validator-head {
		max-width: 80rem;
		margin: 0 auto 2rem;
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}
	.validator-head > div:last-child {
		border: 1px solid #8b4e43;
		color: #ed8d79;
		padding: 0.65rem 0.8rem;
		font: 0.58rem monospace;
		letter-spacing: 0.13em;
	}
	.validator-head > div.accepted {
		border-color: #3b8f8a;
		color: #64cec8;
	}
	.check-grid {
		max-width: 80rem;
		margin: auto;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		border: 1px solid #303b3d;
	}
	.check-grid article {
		min-height: 6.4rem;
		padding: 1rem;
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.8rem;
		align-items: start;
		border-right: 1px solid #303b3d;
		border-bottom: 1px solid #303b3d;
	}
	.check-grid article:nth-child(2n) {
		border-right: 0;
	}
	.check-grid article:nth-last-child(-n + 2) {
		border-bottom: 0;
	}
	.check-grid code {
		color: #586563;
	}
	.check-grid strong {
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.check-grid p {
		color: #747f7d;
		font-size: 0.68rem;
		line-height: 1.45;
		margin: 0.35rem 0 0;
	}
	.check-grid article > span {
		color: #5cc9c3;
	}
	.check-grid article.rejected > span {
		color: #ec806d;
	}
	.fixed {
		display: grid;
		grid-template-columns: 1fr 1.5fr;
		align-items: end;
		gap: 3rem;
	}
	.fixed-metrics {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		border: 1px solid #423a2b;
	}
	.fixed-metrics article {
		min-height: 7rem;
		padding: 1rem;
		border-right: 1px solid #423a2b;
		border-bottom: 1px solid #423a2b;
		display: grid;
		align-content: space-between;
	}
	.fixed-metrics article:nth-child(2n) {
		border-right: 0;
	}
	.fixed-metrics article:nth-last-child(-n + 2) {
		border-bottom: 0;
	}
	.fixed-metrics strong {
		color: #dfad56;
		font: 2rem Georgia;
	}
	.fixed-metrics span {
		color: #82755f;
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	footer {
		border-top: 1px solid #303b3d;
		padding: 1rem clamp(1rem, 4vw, 4rem);
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		color: #626f6d;
		font: 0.55rem monospace;
	}
	footer strong {
		color: #5fc7c1;
	}
	.error {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		background: #2a1210;
		border: 1px solid #9c4c3e;
		color: #ff9b87;
		padding: 1rem;
	}
	@keyframes pulse {
		50% {
			box-shadow:
				inset 0 0 0 0.55rem #070c0e,
				inset 0 0 0 calc(0.55rem + 1px) #32615f,
				0 0 6rem rgba(50, 154, 151, 0.2);
		}
	}
	@media (max-width: 760px) {
		nav {
			grid-template-columns: 1fr 1fr;
		}
		nav span {
			display: none;
		}
		.heading-row {
			align-items: end;
		}
		.floor-orbit {
			flex-basis: 6rem;
		}
		.hashline {
			flex-wrap: wrap;
		}
		.bridge {
			grid-template-columns: 1fr minmax(8rem, 1.5fr) 1fr;
		}
		.chamber span,
		.chamber small {
			font-size: 0.42rem;
		}
		.checkpoint-strip {
			grid-template-columns: 1fr 1fr;
		}
		.checkpoint-strip > div:nth-child(2) {
			border-right: 0;
		}
		.section-title,
		.fixed {
			grid-template-columns: 1fr;
		}
		.section-title p {
			justify-self: start;
		}
		.choices,
		.check-grid {
			grid-template-columns: 1fr;
		}
		.choices article,
		.check-grid article {
			border-right: 0;
			border-bottom: 1px solid #303b3d;
		}
		.committed {
			grid-template-columns: auto 1fr;
		}
		.commit-proof {
			grid-column: 2;
		}
		.validator-head {
			align-items: start;
		}
		.fixed-metrics {
			grid-template-columns: 1fr 1fr;
		}
		footer {
			flex-direction: column;
		}
	}
</style>
