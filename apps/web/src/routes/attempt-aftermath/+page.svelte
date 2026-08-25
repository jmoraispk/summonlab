<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	const source = $derived(data.report.sourceAttempt);
	const active = $derived(data.report.activeAttempt);
	const consequence = $derived(data.report.archivedConsequences[0]);
	const boundaryIndex = $derived(
		data.report.timeline.findIndex(
			(event) => event.eventType === 'mission.preparation.started' && event.sequence > 2
		)
	);

	function short(value: string) {
		return value.slice(0, 8);
	}

	function title(value: string) {
		return value.replaceAll('.', ' / ').replaceAll('-', ' ');
	}
</script>

<svelte:head>
	<title>The Unbroken Ledger · summonlab</title>
	<meta
		name="description"
		content="A strict replay proof that mission consequences remain bound to their source attempt."
	/>
</svelte:head>

<main data-testid="attempt-aftermath-proof">
	<nav>
		<a href={resolve('/')} class="wordmark">summonlab</a>
		<span>Mission systems / aftermath boundary</span>
		<code>{data.report.engineContentVersion}</code>
	</nav>

	<header>
		<div class="kicker"><span>MIS-010A</span><i></i><span>strict replay proof</span></div>
		<h1>Scars travel.<br /><em>Attempts do not.</em></h1>
		<p>
			Floor 04 wounded the Master. Floor 05 begins with that bodily truth intact—without mistaking
			an old wound for a new mission event.
		</p>
		<div class="seal">
			<strong>✓</strong><span>replay verified</span><small>{data.report.eventCount} events</small>
		</div>
	</header>

	<section class="boundary" aria-label="Attempt aftermath transition">
		<article class="attempt archived" data-testid="archived-attempt">
			<div class="floor"><span>04</span><small>The Brass Relay</small></div>
			<div class="attempt-copy">
				<span>Attempt {source.ordinal} / {short(source.attemptId)}</span>
				<h2>Retreated,<br />not erased.</h2>
				<dl>
					<div>
						<dt>Resolved rounds</dt>
						<dd>{source.roundNumber}</dd>
					</div>
					<div>
						<dt>Outcome</dt>
						<dd>{source.outcome}</dd>
					</div>
					<div>
						<dt>Consequences</dt>
						<dd>{source.consequenceCount}</dd>
					</div>
				</dl>
			</div>
			<div class="wound">
				<span>Persistent bodily consequence</span>
				<strong>{consequence?.healthBefore} → {consequence?.healthAfter} HP</strong>
				<p>{consequence?.summary}</p>
				<small>Round {consequence?.roundNumber} · {title(consequence?.nodeId ?? '')}</small>
			</div>
		</article>

		<div class="gate" aria-label="versioned attempt boundary">
			<div><i></i><i></i><i></i></div>
			<span>archive</span>
			<strong>BOUNDARY</strong>
			<small>sourceAttemptId required</small>
		</div>

		<article class="attempt active" data-testid="active-attempt">
			<div class="floor"><span>05</span><small>The Living Foundry</small></div>
			<div class="attempt-copy">
				<span>Attempt {active.ordinal} / {short(active.attemptId)}</span>
				<h2>Prepared,<br />cleanly owned.</h2>
				<dl>
					<div>
						<dt>Current round</dt>
						<dd>{active.roundNumber}</dd>
					</div>
					<div>
						<dt>Status</dt>
						<dd>{active.status}</dd>
					</div>
					<div>
						<dt>Current consequences</dt>
						<dd>{active.consequenceCount}</dd>
					</div>
				</dl>
			</div>
			<div class="clean-ledger">
				<span>Active attempt ledger</span>
				<strong>0 inherited records</strong>
				<p>The wound remains on the Master and in the archive. It is not relabeled as Floor 05.</p>
				<small>activeAttemptId {short(active.attemptId)}</small>
			</div>
		</article>
	</section>

	<section class="timeline">
		<div class="section-copy">
			<span>Append-only event stream</span>
			<h2>One history.<br />Two provenances.</h2>
			<p>Every state transition below was recomputed from the seed and action log.</p>
		</div>
		<div class="events">
			{#each data.report.timeline as event, index (event.sequence)}
				<article class:after-boundary={index >= boundaryIndex}>
					<code>{String(event.sequence).padStart(2, '0')}</code>
					<div>
						<strong>{title(event.eventType)}</strong>
						<p>{event.summary}</p>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<footer>
		<div><span>State hash</span><code>{data.report.stateHash.slice(0, 16)}</code></div>
		<div><span>Event log</span><code>{data.report.eventLogHash.slice(0, 16)}</code></div>
		<div><span>Archive count</span><strong>{data.report.archiveCount}</strong></div>
		<div><span>Replay mismatches</span><strong>0</strong></div>
	</footer>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #080b0e;
		color: #e9e5dc;
	}
	main {
		--gold: #d1a75e;
		--ember: #d85d2a;
		--cyan: #68b9bd;
		min-height: 100vh;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
		background:
			radial-gradient(circle at 14% 24%, rgba(194, 69, 31, 0.13), transparent 31rem),
			radial-gradient(circle at 86% 34%, rgba(59, 151, 160, 0.12), transparent 32rem),
			linear-gradient(145deg, #080a0d, #111317 52%, #080b0e);
	}
	nav {
		height: 72px;
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 0 5vw;
		border-bottom: 1px solid #ffffff14;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-size: 10px;
	}
	nav span {
		margin-right: auto;
		color: #8b8d91;
	}
	nav code {
		color: var(--cyan);
	}
	.wordmark {
		color: #f1ede4;
		text-decoration: none;
		font-family: Georgia, serif;
		font-size: 18px;
		letter-spacing: -0.02em;
		text-transform: lowercase;
	}
	header {
		position: relative;
		padding: 88px 8vw 74px;
		max-width: 1120px;
	}
	.kicker {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 10px;
	}
	.kicker i {
		width: 48px;
		height: 1px;
		background: var(--gold);
	}
	h1 {
		margin: 24px 0;
		font:
			400 clamp(60px, 9vw, 124px)/0.84 Georgia,
			serif;
		letter-spacing: -0.065em;
	}
	h1 em {
		color: transparent;
		-webkit-text-stroke: 1px #dbd4c6;
	}
	header > p {
		max-width: 650px;
		margin: 0;
		color: #a8a6a1;
		font:
			16px/1.7 Georgia,
			serif;
	}
	.seal {
		position: absolute;
		right: 3vw;
		bottom: 68px;
		width: 146px;
		height: 146px;
		border: 1px solid #d1a75e66;
		border-radius: 50%;
		display: grid;
		place-content: center;
		text-align: center;
		transform: rotate(5deg);
	}
	.seal strong {
		color: var(--gold);
		font-size: 25px;
	}
	.seal span,
	.seal small {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 9px;
	}
	.seal small {
		color: #777;
		margin-top: 5px;
	}
	.boundary {
		display: grid;
		grid-template-columns: 1fr 100px 1fr;
		gap: 0;
		padding: 0 5vw 110px;
		align-items: stretch;
	}
	.attempt {
		min-width: 0;
		border: 1px solid #ffffff16;
		background: #101216cc;
		box-shadow: 0 24px 60px #0005;
	}
	.archived {
		border-top: 2px solid var(--ember);
	}
	.active {
		border-top: 2px solid var(--cyan);
	}
	.floor {
		padding: 22px 28px;
		display: flex;
		align-items: baseline;
		gap: 15px;
		border-bottom: 1px solid #ffffff12;
	}
	.floor span {
		font:
			50px/0.9 Georgia,
			serif;
	}
	.archived .floor span {
		color: var(--ember);
	}
	.active .floor span {
		color: var(--cyan);
	}
	.floor small {
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: #818386;
	}
	.attempt-copy {
		padding: 34px 38px;
	}
	.attempt-copy > span,
	.wound > span,
	.clean-ledger > span,
	.section-copy > span {
		color: #777b80;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.16em;
	}
	h2 {
		margin: 13px 0 28px;
		font:
			400 44px/1 Georgia,
			serif;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin: 0;
	}
	dl div {
		border-left: 1px solid #ffffff17;
		padding-left: 13px;
	}
	dt {
		color: #75787b;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	dd {
		margin: 7px 0 0;
		font-family: Georgia, serif;
		text-transform: capitalize;
	}
	.wound,
	.clean-ledger {
		min-height: 172px;
		padding: 26px 38px;
		border-top: 1px solid #ffffff12;
		background: #080a0c88;
	}
	.wound strong,
	.clean-ledger strong {
		display: block;
		margin: 12px 0 8px;
		font:
			25px Georgia,
			serif;
	}
	.wound strong {
		color: #e7855b;
	}
	.clean-ledger strong {
		color: #83ccd0;
	}
	.wound p,
	.clean-ledger p {
		min-height: 42px;
		margin: 0 0 14px;
		color: #9a9995;
		font:
			13px/1.55 Georgia,
			serif;
	}
	.wound small,
	.clean-ledger small {
		color: #666b70;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.gate {
		position: relative;
		display: grid;
		place-content: center;
		text-align: center;
		border-block: 1px solid #ffffff16;
		background: linear-gradient(90deg, #d85d2a09, #68b9bd09);
	}
	.gate::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		border-left: 1px dashed #ffffff29;
	}
	.gate > * {
		position: relative;
		z-index: 1;
		background: #0c0f12;
	}
	.gate div {
		display: flex;
		justify-content: center;
		gap: 4px;
		padding: 8px;
	}
	.gate i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--gold);
		box-shadow: 0 0 12px var(--gold);
	}
	.gate span,
	.gate small {
		padding: 4px 6px;
		color: #73777b;
		text-transform: uppercase;
		letter-spacing: 0.13em;
		font-size: 8px;
	}
	.gate strong {
		padding: 5px;
		color: var(--gold);
		font-size: 10px;
		letter-spacing: 0.14em;
	}
	.timeline {
		display: grid;
		grid-template-columns: 0.72fr 1.28fr;
		gap: 7vw;
		padding: 100px 8vw;
		border-top: 1px solid #ffffff12;
		background: #0b0d10;
	}
	.section-copy {
		position: sticky;
		top: 40px;
		align-self: start;
	}
	.section-copy p {
		color: #838589;
		max-width: 330px;
		line-height: 1.6;
	}
	.events article {
		display: grid;
		grid-template-columns: 48px 1fr;
		gap: 18px;
		padding: 17px 0;
		border-top: 1px solid #ffffff12;
	}
	.events article.after-boundary {
		border-left: 2px solid var(--cyan);
		padding-left: 18px;
	}
	.events code {
		color: var(--gold);
	}
	.events strong {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.events p {
		margin: 6px 0 0;
		color: #7f8184;
		font:
			12px/1.5 Georgia,
			serif;
	}
	footer {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		padding: 30px 5vw 44px;
		border-top: 1px solid #ffffff12;
	}
	footer div {
		padding-left: 20px;
		border-left: 1px solid #ffffff15;
	}
	footer span {
		display: block;
		color: #6e7276;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 8px;
	}
	footer code,
	footer strong {
		display: block;
		margin-top: 8px;
		color: #c9c5bc;
		font-size: 12px;
	}
	@media (max-width: 850px) {
		.seal {
			display: none;
		}
		.boundary {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.gate {
			min-height: 90px;
		}
		.timeline {
			grid-template-columns: 1fr;
		}
		.section-copy {
			position: static;
		}
		footer {
			grid-template-columns: 1fr 1fr;
			gap: 24px;
		}
	}
	@media (max-width: 520px) {
		nav span {
			display: none;
		}
		header {
			padding: 62px 6vw;
		}
		.boundary {
			padding-inline: 4vw;
		}
		.attempt-copy,
		.wound,
		.clean-ledger {
			padding-inline: 25px;
		}
		dl {
			grid-template-columns: 1fr;
		}
		footer {
			grid-template-columns: 1fr;
		}
	}
</style>
