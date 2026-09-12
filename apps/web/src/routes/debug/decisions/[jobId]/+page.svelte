<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let report = $derived(data.report);
	let request = $derived(report.provider.request);
	let response = $derived(report.provider.response);
	let usage = $derived(report.provider.tokenMetadata.usage);
	let redactedPacket = $derived(JSON.stringify(report.context.redactedPacket, null, 2));

	function short(hash: string | null, length = 14) {
		return hash ? hash.slice(0, length) : '—';
	}

	function dateTime(value: string) {
		return new Date(value).toLocaleString();
	}
</script>

<svelte:head>
	<title>Decision trace {report.job.decisionJobId.slice(0, 8)} · summonlab</title>
	<meta
		name="description"
		content="A development-only, redacted audit of one Summonlab agent decision."
	/>
</svelte:head>

<main data-testid="decision-inspector">
	<nav>
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div>
			<span>Development instrument</span>
			<strong>Decision trace</strong>
		</div>
		<a href={resolve('/village')}>Return to Village</a>
	</nav>

	<header class="hero">
		<div>
			<p>Redacted execution record / {report.schemaVersion}</p>
			<h1>The choice,<br />without the secrets.</h1>
			<span>
				This is an audit artifact, not hidden chain-of-thought. It shows supplied evidence, request
				settings, output boundaries, and the engine commit.
			</span>
		</div>
		<div class:applied={report.job.status === 'applied'} class="status-seal">
			<i>{report.job.status === 'applied' ? '✓' : '◇'}</i>
			<strong>{report.job.status.replaceAll('_', ' ')}</strong>
			<span>{report.job.resolution ?? 'pending'}</span>
		</div>
	</header>

	<section class="hash-chain" aria-label="Decision integrity bindings">
		<div><span>Job</span><code>{short(report.job.decisionJobId)}</code></div>
		<i>→</i>
		<div><span>Packet</span><code>{short(report.binding.packetHash)}</code></div>
		<i>→</i>
		<div><span>Result</span><code>{short(report.binding.resultHash)}</code></div>
		<i>→</i>
		<div><span>Report</span><code>{short(report.reportHash)}</code></div>
	</section>

	<section class="privacy" data-testid="privacy-boundary">
		<header>
			<div>
				<span>Privacy boundary</span>
				<h2>Absent by construction</h2>
			</div>
			<code>{report.privacy.access}</code>
		</header>
		<div class="privacy-grid">
			<article>
				<i>00</i><strong>Credentials</strong><span>server process only</span>
			</article>
			<article>
				<i>00</i><strong>Raw private text</strong><span>digests only</span>
			</article>
			<article>
				<i>00</i><strong>Private reasoning</strong><span>never requested</span>
			</article>
		</div>
	</section>

	<div class="main-grid">
		<section class="panel context-panel">
			<header>
				<div>
					<span>01 / Supplied context</span>
					<h2>What the hero could know</h2>
				</div>
				<code>{report.context.contextPolicyVersion}</code>
			</header>
			<div class="counts">
				<div><strong>{report.context.counts.visibleEntities}</strong><span>visible</span></div>
				<div><strong>{report.context.counts.beliefs}</strong><span>beliefs</span></div>
				<div><strong>{report.context.counts.selectedMemories}</strong><span>memories</span></div>
				<div><strong>{report.context.counts.directives}</strong><span>directives</span></div>
				<div><strong>{report.context.counts.legalActions}</strong><span>legal moves</span></div>
			</div>
			<div class="sections">
				{#each report.context.suppliedSections as section (section)}
					<span>{section}</span>
				{/each}
			</div>
			<div class="evidence">
				<header>
					<span>Selected evidence</span><code
						>{report.context.counts.selectedMemoryCharacters} chars</code
					>
				</header>
				{#each report.context.selectedEvidence as memory (memory.memoryId)}
					<article>
						<div>
							<strong>{memory.kind.replaceAll('-', ' ')}</strong>
							<code>{short(memory.memoryId, 10)}</code>
						</div>
						<p>
							<span>score {memory.score.total}</span>
							{memory.reasons.join(' · ')}
						</p>
						<small>summary redacted · sha256 {short(memory.summary.sha256, 18)}</small>
					</article>
				{/each}
			</div>
		</section>

		<section class="panel provider-panel" data-testid="provider-boundary">
			<header>
				<div>
					<span>02 / Provider boundary</span>
					<h2>Independent request</h2>
				</div>
				<em>{report.provider.disposition.replaceAll('-', ' ')}</em>
			</header>
			{#if request}
				<div class="request-core">
					<div><span>provider</span><strong>{request.provider} responses</strong></div>
					<div><span>model</span><strong>{request.requestedModel}</strong></div>
					<div><span>prompt</span><strong>{request.promptVersion}</strong></div>
					<div><span>request hash</span><code>{short(request.requestHash, 18)}</code></div>
				</div>
				<div class="switches">
					<div><i>off</i><span>provider storage</span><code>store:false</code></div>
					<div><i>off</i><span>background mode</span><code>background:false</code></div>
					<div><i>none</i><span>prior response</span><code>null</code></div>
					<div><i>none</i><span>conversation</span><code>null</code></div>
					<div><i>00</i><span>tools</span><code>{request.toolCount}</code></div>
					<div><i>safe</i><span>credential</span><code>not persisted</code></div>
				</div>
				<div class="limits">
					<span>≤ {request.maxOutputTokens} output tokens</span>
					<span>{request.reasoningEffort} reasoning effort</span>
					<span>{request.textVerbosity} verbosity</span>
				</div>
			{:else}
				<p class="empty">This decision did not request an external model.</p>
			{/if}
			<div class="token-ledger">
				<header>
					<span>Token metadata</span><code>{report.provider.tokenMetadata.source}</code>
				</header>
				<div><strong>{usage?.inputTokens ?? '—'}</strong><span>input</span></div>
				<div><strong>{usage?.cachedInputTokens ?? '—'}</strong><span>cached</span></div>
				<div><strong>{usage?.outputTokens ?? '—'}</strong><span>output</span></div>
				<div><strong>{usage?.reasoningTokens ?? '—'}</strong><span>reasoning</span></div>
				<div><strong>{usage?.totalTokens ?? '—'}</strong><span>total</span></div>
			</div>
			{#if response}
				<footer>response {response.responseId} · resolved {response.resolvedModel}</footer>
			{/if}
		</section>
	</div>

	<section class="panel decision-panel">
		<header>
			<div>
				<span>03 / Validated output</span>
				<h2>One legal choice crossed the boundary</h2>
			</div>
			<code>{report.result?.policyId ?? 'pending'}</code>
		</header>
		{#if report.result}
			<div class="chosen-action">
				<span>selected action</span>
				<strong>{report.result.decision.actionId}</strong>
				<small
					>public intent redacted · {report.result.decision.publicIntent.characters} characters · {short(
						report.result.decision.publicIntent.sha256,
						18
					)}</small
				>
			</div>
		{/if}
		<div class="boundaries" data-testid="validation-boundaries">
			{#each report.validation as check, index (check.boundary)}
				<article
					class:passed={check.outcome === 'passed'}
					class:stopped={check.outcome === 'rejected'}
				>
					<i>{String(index + 1).padStart(2, '0')}</i>
					<div>
						<strong>{check.boundary.replaceAll('-', ' ')}</strong>
						<p>{check.evidence}</p>
					</div>
					<span>{check.outcome.replaceAll('-', ' ')}</span>
				</article>
			{/each}
		</div>
	</section>

	<div class="lower-grid">
		<section class="panel omitted-panel">
			<header>
				<div>
					<span>04 / Omitted state</span>
					<h2>What stayed outside</h2>
				</div>
			</header>
			{#each report.privacy.omitted as omission (omission.category)}
				<article>
					<div>
						<strong>{omission.category.replaceAll('-', ' ')}</strong><code>{omission.path}</code>
					</div>
					<p>{omission.reason}</p>
					<span>{omission.enforcedBy.replaceAll('-', ' ')}</span>
				</article>
			{/each}
		</section>

		<section class="panel lifecycle-panel">
			<header>
				<div>
					<span>05 / Durable lifecycle</span>
					<h2>From queue to commit</h2>
				</div>
			</header>
			<div class="lifecycle">
				{#each report.job.transitions as transition (transition.sequence)}
					<article>
						<i>{String(transition.sequence).padStart(2, '0')}</i>
						<div>
							<strong>{transition.toStatus.replaceAll('_', ' ')}</strong><span
								>{transition.reason}</span
							>
						</div>
						<time>{dateTime(transition.occurredAt)}</time>
					</article>
				{/each}
			</div>
			{#each report.job.attempts as attempt (attempt.attemptNumber)}
				<div class="attempt">
					<span>attempt {attempt.attemptNumber}</span>
					<strong>{attempt.policy} / {attempt.kind}</strong>
					<code>{attempt.latencyMs ?? '—'} ms</code>
				</div>
			{/each}
		</section>
	</div>

	<details class="packet" data-testid="redacted-packet">
		<summary>
			<div><span>Raw audit payload</span><strong>Open redacted packet JSON</strong></div>
			<code>{report.context.redactions.length} text fields replaced by digests</code>
		</summary>
		<pre>{redactedPacket}</pre>
	</details>

	<footer class="page-footer">
		<span>Generated from stored facts · no historical reconstruction</span>
		<code>{report.reportHash}</code>
	</footer>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #07090d;
		color: #eee9dd;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	:global(body::before) {
		content: '';
		position: fixed;
		inset: 0;
		pointer-events: none;
		opacity: 0.2;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
		background-size: 42px 42px;
		mask-image: linear-gradient(to bottom, black, transparent 75%);
	}
	main {
		--gold: #d3a24f;
		--cyan: #78d8e8;
		--green: #77d7ad;
		--red: #ee8b8b;
		min-height: 100vh;
		padding-bottom: 4rem;
		background:
			radial-gradient(circle at 78% 3%, rgba(50, 122, 137, 0.16), transparent 26rem),
			radial-gradient(circle at 7% 24%, rgba(180, 116, 39, 0.1), transparent 30rem);
	}
	nav {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 4.4rem;
		padding: 0 2rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(7, 9, 13, 0.8);
		backdrop-filter: blur(18px);
	}
	nav a {
		color: rgba(238, 233, 221, 0.5);
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-decoration: none;
		text-transform: uppercase;
	}
	nav > a:last-child {
		justify-self: end;
	}
	.wordmark {
		color: #f5f0e5;
		font:
			500 1rem Georgia,
			serif;
		letter-spacing: -0.02em;
		text-transform: none;
	}
	nav div {
		text-align: center;
	}
	nav span,
	nav strong {
		display: block;
	}
	nav span {
		color: var(--gold);
		font-size: 0.46rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	nav strong {
		margin-top: 0.18rem;
		font:
			400 0.8rem Georgia,
			serif;
	}
	.hero {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4rem;
		align-items: end;
		max-width: 88rem;
		margin: 0 auto;
		padding: clamp(4rem, 8vw, 7rem) 2rem 3rem;
	}
	.hero p,
	.panel header span,
	.privacy header span,
	.evidence header span,
	.token-ledger header span,
	.packet summary span {
		margin: 0 0 0.6rem;
		color: var(--gold);
		font-size: 0.52rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.hero h1 {
		margin: 0 0 1.2rem;
		max-width: 14ch;
		font:
			400 clamp(3.2rem, 7vw, 6.5rem)/0.88 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	.hero > div > span {
		display: block;
		max-width: 43rem;
		color: rgba(238, 233, 221, 0.5);
		font-size: 0.78rem;
		line-height: 1.7;
	}
	.status-seal {
		display: grid;
		place-items: center;
		width: 10rem;
		height: 10rem;
		border: 1px solid rgba(238, 139, 139, 0.4);
		border-radius: 50%;
		color: var(--red);
		text-align: center;
	}
	.status-seal.applied {
		border-color: rgba(119, 215, 173, 0.42);
		color: var(--green);
		box-shadow: 0 0 4rem rgba(119, 215, 173, 0.08);
	}
	.status-seal i,
	.status-seal strong,
	.status-seal span {
		display: block;
	}
	.status-seal i {
		font:
			normal 1.8rem Georgia,
			serif;
	}
	.status-seal strong {
		font:
			400 1rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.status-seal span {
		font-size: 0.45rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.hash-chain {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
		align-items: center;
		max-width: 88rem;
		margin: 0 auto 1rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(8, 10, 15, 0.76);
	}
	.hash-chain div {
		min-width: 0;
		padding: 1rem 1.2rem;
	}
	.hash-chain span,
	.hash-chain code {
		display: block;
	}
	.hash-chain span {
		color: rgba(238, 233, 221, 0.32);
		font-size: 0.45rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.hash-chain code {
		margin-top: 0.3rem;
		overflow: hidden;
		color: var(--cyan);
		font-size: 0.68rem;
		text-overflow: ellipsis;
	}
	.hash-chain i {
		color: rgba(238, 233, 221, 0.18);
		font-style: normal;
	}
	.privacy {
		max-width: 88rem;
		margin: 0 auto 1rem;
		border: 1px solid rgba(119, 215, 173, 0.2);
		background: linear-gradient(110deg, rgba(24, 83, 65, 0.16), rgba(7, 9, 13, 0.7));
	}
	.privacy > header,
	.panel > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.2rem 1.35rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}
	.privacy h2,
	.panel h2 {
		margin: 0;
		font:
			400 1.45rem Georgia,
			serif;
	}
	.privacy header code,
	.panel header code,
	.panel header em {
		color: rgba(119, 215, 173, 0.7);
		font-size: 0.54rem;
		font-style: normal;
		text-transform: uppercase;
	}
	.privacy-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: rgba(119, 215, 173, 0.12);
	}
	.privacy-grid article {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.15rem 0.8rem;
		padding: 1rem 1.35rem;
		background: #090d10;
	}
	.privacy-grid i {
		grid-row: 1 / 3;
		color: var(--green);
		font:
			normal 1.5rem ui-monospace,
			monospace;
	}
	.privacy-grid strong,
	.privacy-grid span {
		display: block;
	}
	.privacy-grid strong {
		font:
			400 0.8rem Georgia,
			serif;
	}
	.privacy-grid span {
		color: rgba(238, 233, 221, 0.35);
		font-size: 0.48rem;
		text-transform: uppercase;
	}
	.main-grid,
	.lower-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
		gap: 1rem;
		max-width: 88rem;
		margin: 1rem auto;
	}
	.panel {
		min-width: 0;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(8, 10, 15, 0.78);
	}
	.counts {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.07);
	}
	.counts div {
		padding: 0.85rem;
		background: #090c11;
	}
	.counts strong,
	.counts span {
		display: block;
	}
	.counts strong {
		color: var(--cyan);
		font:
			400 1.25rem Georgia,
			serif;
	}
	.counts span {
		margin-top: 0.2rem;
		color: rgba(238, 233, 221, 0.35);
		font-size: 0.42rem;
		text-transform: uppercase;
	}
	.sections {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		padding: 0.8rem 1.2rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.sections span {
		padding: 0.24rem 0.38rem;
		border: 1px solid rgba(120, 216, 232, 0.16);
		color: rgba(120, 216, 232, 0.62);
		font-size: 0.44rem;
	}
	.evidence > header,
	.token-ledger > header {
		display: flex;
		justify-content: space-between;
		padding: 0.8rem 1.2rem 0.25rem;
	}
	.evidence article {
		margin: 0.55rem 1.2rem;
		padding: 0.75rem;
		border-left: 2px solid rgba(211, 162, 79, 0.5);
		background: rgba(211, 162, 79, 0.05);
	}
	.evidence article > div {
		display: flex;
		justify-content: space-between;
	}
	.evidence strong {
		font:
			400 0.72rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.evidence code,
	.evidence small,
	.evidence p {
		color: rgba(238, 233, 221, 0.4);
		font-size: 0.48rem;
	}
	.evidence p {
		margin: 0.45rem 0;
		line-height: 1.5;
	}
	.evidence p span {
		margin-right: 0.5rem;
		color: var(--gold);
	}
	.request-core {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: rgba(255, 255, 255, 0.07);
	}
	.request-core div {
		min-width: 0;
		padding: 0.8rem 1rem;
		background: #090c11;
	}
	.request-core span,
	.request-core strong,
	.request-core code {
		display: block;
	}
	.request-core span {
		color: rgba(238, 233, 221, 0.32);
		font-size: 0.43rem;
		text-transform: uppercase;
	}
	.request-core strong,
	.request-core code {
		margin-top: 0.25rem;
		overflow: hidden;
		color: var(--cyan);
		font-size: 0.6rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.switches {
		padding: 0.8rem 1rem;
	}
	.switches div {
		display: grid;
		grid-template-columns: 2.5rem 1fr auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.48rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}
	.switches i {
		color: var(--green);
		font:
			normal 0.54rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.switches span,
	.switches code {
		color: rgba(238, 233, 221, 0.48);
		font-size: 0.5rem;
	}
	.switches code {
		color: rgba(119, 215, 173, 0.7);
	}
	.limits {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding: 0 1rem 1rem;
	}
	.limits span {
		padding: 0.3rem 0.45rem;
		border: 1px solid rgba(211, 162, 79, 0.2);
		color: rgba(211, 162, 79, 0.72);
		font-size: 0.46rem;
	}
	.empty {
		padding: 1rem 1.2rem;
		color: rgba(238, 233, 221, 0.45);
		font-size: 0.68rem;
	}
	.token-ledger {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.07);
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}
	.token-ledger header {
		grid-column: 1 / -1;
		background: #0b0e13;
	}
	.token-ledger > div {
		padding: 0.65rem;
		background: #090c11;
	}
	.token-ledger strong,
	.token-ledger span {
		display: block;
	}
	.token-ledger strong {
		color: var(--cyan);
		font:
			400 0.9rem Georgia,
			serif;
	}
	.token-ledger span {
		margin-top: 0.2rem;
		color: rgba(238, 233, 221, 0.3);
		font-size: 0.4rem;
		text-transform: uppercase;
	}
	.provider-panel footer {
		padding: 0.7rem 1rem;
		color: rgba(238, 233, 221, 0.35);
		font-size: 0.45rem;
	}
	.decision-panel {
		max-width: 88rem;
		margin: 1rem auto;
	}
	.chosen-action {
		padding: 1.1rem 1.3rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}
	.chosen-action span,
	.chosen-action strong,
	.chosen-action small {
		display: block;
	}
	.chosen-action span {
		color: var(--gold);
		font-size: 0.44rem;
		text-transform: uppercase;
	}
	.chosen-action strong {
		margin: 0.3rem 0;
		font:
			400 1.35rem Georgia,
			serif;
	}
	.chosen-action small {
		color: rgba(238, 233, 221, 0.38);
		font-size: 0.48rem;
	}
	.boundaries {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
	}
	.boundaries article {
		display: grid;
		grid-template-columns: 2rem 1fr auto;
		gap: 0.75rem;
		padding: 0.8rem 1rem;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.boundaries article i {
		color: rgba(238, 233, 221, 0.25);
		font:
			normal 0.5rem ui-monospace,
			monospace;
	}
	.boundaries article strong {
		font:
			400 0.7rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.boundaries article p {
		margin: 0.22rem 0 0;
		color: rgba(238, 233, 221, 0.36);
		font-size: 0.46rem;
		line-height: 1.4;
	}
	.boundaries article > span {
		color: rgba(238, 233, 221, 0.3);
		font-size: 0.42rem;
		text-transform: uppercase;
	}
	.boundaries article.passed > span {
		color: var(--green);
	}
	.boundaries article.stopped > span {
		color: var(--red);
	}
	.omitted-panel article {
		display: grid;
		grid-template-columns: minmax(10rem, 0.8fr) 1.2fr auto;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.omitted-panel article div strong,
	.omitted-panel article div code {
		display: block;
	}
	.omitted-panel article strong {
		font:
			400 0.68rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.omitted-panel article code {
		margin-top: 0.22rem;
		color: var(--cyan);
		font-size: 0.44rem;
	}
	.omitted-panel article p {
		margin: 0;
		color: rgba(238, 233, 221, 0.4);
		font-size: 0.48rem;
		line-height: 1.45;
	}
	.omitted-panel article > span {
		color: var(--green);
		font-size: 0.4rem;
		text-transform: uppercase;
	}
	.lifecycle article {
		display: grid;
		grid-template-columns: 2rem 1fr auto;
		gap: 0.7rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.lifecycle article i {
		color: var(--gold);
		font:
			normal 0.5rem ui-monospace,
			monospace;
	}
	.lifecycle article strong,
	.lifecycle article span {
		display: block;
	}
	.lifecycle article strong {
		font:
			400 0.7rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.lifecycle article span,
	.lifecycle article time {
		margin-top: 0.15rem;
		color: rgba(238, 233, 221, 0.35);
		font-size: 0.42rem;
	}
	.attempt {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.5rem;
		padding: 0.8rem 1rem;
		background: rgba(120, 216, 232, 0.05);
		font-size: 0.48rem;
	}
	.attempt span {
		color: var(--cyan);
		text-transform: uppercase;
	}
	.attempt code {
		color: rgba(238, 233, 221, 0.45);
	}
	.packet {
		max-width: 88rem;
		margin: 1rem auto;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: #080a0f;
	}
	.packet summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.2rem;
		cursor: pointer;
		list-style: none;
	}
	.packet summary strong,
	.packet summary span {
		display: block;
	}
	.packet summary strong {
		font:
			400 1rem Georgia,
			serif;
	}
	.packet summary code {
		color: rgba(120, 216, 232, 0.55);
		font-size: 0.48rem;
	}
	.packet pre {
		max-height: 38rem;
		margin: 0;
		padding: 1.2rem;
		overflow: auto;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		color: rgba(176, 214, 219, 0.7);
		font:
			0.56rem/1.6 ui-monospace,
			monospace;
	}
	.page-footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		max-width: 88rem;
		margin: 1rem auto;
		padding: 1rem 0;
		color: rgba(238, 233, 221, 0.25);
		font-size: 0.48rem;
	}
	.page-footer code {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	@media (max-width: 900px) {
		.main-grid,
		.lower-grid {
			grid-template-columns: 1fr;
			margin: 1rem;
		}
		.privacy,
		.decision-panel,
		.packet,
		.hash-chain,
		.page-footer {
			margin-right: 1rem;
			margin-left: 1rem;
		}
	}
	@media (max-width: 680px) {
		nav {
			grid-template-columns: 1fr auto;
			padding: 0 1rem;
		}
		nav div {
			display: none;
		}
		.hero {
			grid-template-columns: 1fr;
			gap: 2rem;
			padding: 3rem 1rem 2rem;
		}
		.status-seal {
			width: 7rem;
			height: 7rem;
		}
		.hash-chain {
			grid-template-columns: 1fr 1fr;
		}
		.hash-chain i {
			display: none;
		}
		.privacy-grid,
		.boundaries {
			grid-template-columns: 1fr;
		}
		.counts {
			grid-template-columns: repeat(3, 1fr);
		}
		.omitted-panel article {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}
		.packet summary {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.6rem;
		}
		.page-footer {
			flex-direction: column;
		}
	}
</style>
