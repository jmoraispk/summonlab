<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	const report = $derived(data.report);
	const stages = $derived([
		['Title viewed', report.funnel.titleViewedSessions],
		['Campaign started', report.funnel.campaignStartedSessions],
		['Onboarding complete', report.funnel.onboardingCompletedSessions],
		['Hearth entered', report.funnel.hearthEnteredSessions]
	] as const);
	const eventLabels: Record<keyof typeof report.eventCounts, string> = {
		route_viewed: 'Route viewed',
		campaign_started: 'Campaign started',
		onboarding_step_completed: 'Onboarding step',
		hearth_entered: 'Hearth entered',
		pause_opened: 'Pause opened',
		campaign_restarted: 'Campaign restarted',
		reconnect_completed: 'Reconnect complete'
	};
</script>

<svelte:head>
	<title>Playtest signal · Summonlab</title>
	<meta
		name="description"
		content="Aggregate, consent-bound journey analytics for private Summonlab playtests."
	/>
</svelte:head>

<main data-testid="playtest-report">
	<header>
		<a href={resolve('/')}>SUMMON<span>LAB</span></a>
		<code>{report.schemaVersion}</code>
	</header>

	<section class="hero">
		<p>FIN-006 · aggregate signal only</p>
		<h1>Observe the journey.<br /><em>Keep the player private.</em></h1>
		<p>
			This development view contains counts, never individual histories. Declines never reach the
			server; withdrawal removes retained sessions and events.
		</p>
	</section>

	<section class="metrics" aria-label="Retained analytics totals">
		<article><strong>{report.consents.granted}</strong><span>active consents</span></article>
		<article><strong>{report.retainedSessionCount}</strong><span>retained sessions</span></article>
		<article><strong>{report.retainedEventCount}</strong><span>typed events</span></article>
		<article><strong>{report.consents.withdrawn}</strong><span>withdrawn records</span></article>
	</section>

	<section class="grid">
		<article class="panel funnel">
			<header><span>Journey funnel</span><small>Distinct consenting sessions</small></header>
			<ol>
				{#each stages as stage, index (stage[0])}
					<li>
						<div><span>0{index + 1}</span><strong>{stage[0]}</strong></div>
						<b>{stage[1]}</b>
					</li>
				{/each}
			</ol>
		</article>

		<article class="panel events">
			<header><span>Allowlisted events</span><small>No extensible property bag</small></header>
			<dl>
				{#each Object.entries(report.eventCounts) as entry (entry[0])}
					<div>
						<dt>{eventLabels[entry[0] as keyof typeof eventLabels]}</dt>
						<dd>{entry[1]}</dd>
					</div>
				{/each}
			</dl>
		</article>

		<article class="panel privacy">
			<header><span>Enforced boundary</span><small>{report.privacy.noticeVersion}</small></header>
			<ul>
				<li><b>30 days</b><span>Consent and data expiry</span></li>
				<li><b>None</b><span>Raw dialogue, seeds, names</span></li>
				<li><b>None</b><span>IP and user-agent storage</span></li>
				<li><b>Immediate</b><span>Withdrawal deletion</span></li>
			</ul>
		</article>
	</section>

	<footer>
		<span>Generated {new Date(report.generatedAt).toLocaleString()}</span>
		<a href={resolve('/playtest-moderation')}>Open moderation gate →</a>
		<a href={resolve('/api/dev/playtest-report')}>Open machine-readable report →</a>
	</footer>
</main>

<style>
	:global(body) {
		background: #090807;
		color: #f4ead6;
	}
	main {
		min-height: 100svh;
		padding: 0 clamp(1rem, 5vw, 5rem) 3rem;
		background:
			radial-gradient(circle at 78% 0%, rgba(177, 76, 31, 0.15), transparent 35rem),
			linear-gradient(180deg, #0d0a08, #070707);
	}
	main > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 0;
		border-bottom: 1px solid rgba(239, 201, 129, 0.14);
	}
	main > header a {
		color: #f4ead6;
		font-family: Georgia, serif;
		letter-spacing: 0.16em;
		text-decoration: none;
	}
	main > header a span,
	.hero em {
		color: #dc8b4b;
	}
	main > header code,
	.panel small,
	main > footer {
		color: rgba(244, 234, 214, 0.42);
		font-size: 0.62rem;
	}
	.hero {
		padding: clamp(3rem, 8vh, 6rem) 0;
	}
	.hero > p:first-child,
	.panel header span {
		color: #d0733b;
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.hero h1 {
		max-width: 60rem;
		margin: 0.6rem 0 1.4rem;
		font-family: Georgia, serif;
		font-size: clamp(2.8rem, 7vw, 6.4rem);
		font-weight: 400;
		line-height: 0.92;
		letter-spacing: -0.055em;
	}
	.hero h1 em {
		font-weight: 400;
	}
	.hero > p:last-child {
		max-width: 47rem;
		color: rgba(244, 234, 214, 0.58);
		font-family: Georgia, serif;
		line-height: 1.7;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border: 1px solid rgba(239, 201, 129, 0.16);
	}
	.metrics article {
		padding: 1.3rem;
		border-right: 1px solid rgba(239, 201, 129, 0.12);
	}
	.metrics article:last-child {
		border: 0;
	}
	.metrics strong {
		display: block;
		font-family: Georgia, serif;
		font-size: 2.8rem;
		font-weight: 400;
	}
	.metrics span {
		color: rgba(244, 234, 214, 0.45);
		font-size: 0.61rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.grid {
		display: grid;
		grid-template-columns: 1.1fr 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}
	.panel {
		border: 1px solid rgba(239, 201, 129, 0.14);
		background: rgba(255, 255, 255, 0.018);
	}
	.panel > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid rgba(239, 201, 129, 0.1);
	}
	.panel ol,
	.panel ul,
	.panel dl {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.funnel li,
	.events dl div,
	.privacy li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid rgba(239, 201, 129, 0.08);
	}
	.funnel li div {
		display: flex;
		gap: 0.7rem;
		align-items: center;
	}
	.funnel li span {
		color: rgba(244, 234, 214, 0.3);
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
	}
	.funnel li strong,
	.privacy li span,
	.events dt {
		color: rgba(244, 234, 214, 0.68);
		font-size: 0.72rem;
		font-weight: 400;
	}
	.funnel li b,
	.events dd {
		color: #e7a56c;
		font-family: Georgia, serif;
		font-size: 1.3rem;
	}
	.events dd {
		margin: 0;
	}
	.privacy li {
		align-items: flex-start;
		flex-direction: column;
		gap: 0.2rem;
	}
	.privacy li b {
		color: #82d5a2;
		font-size: 0.72rem;
	}
	main > footer {
		display: flex;
		justify-content: space-between;
		margin-top: 1.5rem;
	}
	main > footer a {
		color: #e0a66e;
	}
	@media (max-width: 800px) {
		.metrics {
			grid-template-columns: 1fr 1fr;
		}
		.metrics article:nth-child(2) {
			border-right: 0;
		}
		.metrics article:nth-child(-n + 2) {
			border-bottom: 1px solid rgba(239, 201, 129, 0.12);
		}
		.grid {
			grid-template-columns: 1fr;
		}
		main > footer {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.6rem;
		}
	}
</style>
