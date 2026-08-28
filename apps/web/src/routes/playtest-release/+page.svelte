<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const labels: Record<string, string> = {
		'evidence-integrity': 'Evidence integrity',
		'owner-playtest': 'Owner playtest',
		'required-journey-coverage': 'Required journey coverage',
		'release-findings': 'Release findings'
	};
</script>

<svelte:head>
	<title>Playtest release gate · Summonlab</title>
	<meta
		name="description"
		content="A fail-closed release gate for Summonlab's private playtest package."
	/>
</svelte:head>

<main data-testid="playtest-release">
	<nav>
		<a class="wordmark" href={resolve('/')}>SUMMON<span>LAB</span></a>
		<div>
			<a href={resolve('/playtest-moderation')}>Owner review</a>
			<a href={resolve('/')}>Player title</a>
		</div>
	</nav>

	<header class="hero">
		<div>
			<p>FIN-008 · private release boundary</p>
			<h1>The archive waits<br /><em>for evidence.</em></h1>
			<p class="lede">
				Production assembly cannot outrun the owner playtest. Every prerequisite below is derived
				from the hash-bound FIN-007 report; held means no archive is permitted.
			</p>
		</div>
		<section class:ready={data.report.status === 'ready-to-package'} class="status-card">
			<span>Release status</span>
			<strong data-testid="release-status">{data.report.status}</strong>
			<small>{data.report.blockers.length} active blockers</small>
		</section>
	</header>

	<section class="checks" aria-labelledby="checks-title">
		<header>
			<div>
				<span>01 / Gate ledger</span>
				<h2 id="checks-title">Four claims. No shortcuts.</h2>
			</div>
			<code>{data.report.generatedFrom.ownerPlaytestReportHash.slice(0, 16)}</code>
		</header>
		<div class="check-grid">
			{#each data.report.checks as check, index (check.checkId)}
				<article class:pass={check.status === 'pass'} data-testid="release-check">
					<div><span>0{index + 1}</span><b>{check.status}</b></div>
					<h3>{labels[check.checkId]}</h3>
					<p>{check.detail}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="package" aria-labelledby="package-title">
		<div class="package-copy">
			<span>02 / Assembly contract</span>
			<h2 id="package-title">One acknowledged, receipted artifact.</h2>
			<p>
				When every check passes, the operator runs the explicit command. Packaging must produce the
				named private archive and a SHA-256 receipt bound to the packaged commit.
			</p>
			<pre><code>{data.report.packagePlan.command}</code></pre>
			<p class="archive">Planned archive · {data.report.packagePlan.archiveName}</p>
		</div>
		<div class="manifest">
			<div>
				<h3>Include</h3>
				<ul>
					{#each data.report.packagePlan.contents as item (item)}<li>{item}</li>{/each}
				</ul>
			</div>
			<div>
				<h3>Never include</h3>
				<ul>
					{#each data.report.packagePlan.excludes as item (item)}<li>{item}</li>{/each}
				</ul>
			</div>
		</div>
	</section>

	<section class="hold" aria-labelledby="hold-title">
		<span>03 / Current decision</span>
		<h2 id="hold-title">No package has been produced.</h2>
		{#if data.report.blockers.length > 0}
			<ol>
				{#each data.report.blockers as blocker (blocker)}<li>{blocker}</li>{/each}
			</ol>
		{:else}
			<p>The human gate is clear. The acknowledged packaging command may now run.</p>
		{/if}
	</section>

	<footer>
		<div><span>Release ID</span><code>{data.report.releaseId}</code></div>
		<div><span>Report hash</span><code>{data.report.reportHash.slice(0, 16)}</code></div>
		<p>
			Readiness evidence is not an artifact receipt. FIN-008 remains open until packaging succeeds.
		</p>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0b0d0f;
		color: #eee8dc;
	}
	:global(*) {
		box-sizing: border-box;
	}
	main {
		min-height: 100vh;
		background:
			linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px) 0 0 / 100% 4rem,
			radial-gradient(circle at 78% 4%, rgba(192, 84, 49, 0.2), transparent 29rem),
			#0b0d0f;
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	nav {
		min-height: 4.5rem;
		padding: 1rem clamp(1.2rem, 5vw, 5rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #2a2d2e;
	}
	nav div {
		display: flex;
		gap: 1.3rem;
	}
	.wordmark {
		font-weight: 900;
		letter-spacing: 0.13em;
	}
	.wordmark span,
	em,
	section > span,
	section > header span,
	.package-copy > span {
		color: #d66d3e;
	}
	.hero {
		padding: clamp(3rem, 8vw, 7rem) clamp(1.2rem, 7vw, 8rem);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
		gap: clamp(2rem, 6vw, 6rem);
		align-items: end;
	}
	.hero > div > p:first-child,
	section > span,
	section > header span,
	.package-copy > span {
		font:
			0.72rem ui-monospace,
			monospace;
		letter-spacing: 0.16em;
		text-transform: uppercase;
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
			400 clamp(3rem, 7vw, 7.2rem)/0.9 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	em {
		font-weight: 400;
	}
	.lede {
		max-width: 45rem;
		color: #aaa69d;
		font-size: 1.05rem;
		line-height: 1.7;
	}
	.status-card {
		padding: 1.6rem;
		border: 1px solid #a84832;
		background: rgba(72, 22, 17, 0.45);
	}
	.status-card.ready {
		border-color: #739d72;
		background: rgba(26, 69, 43, 0.45);
	}
	.status-card span,
	.status-card small,
	.status-card strong {
		display: block;
	}
	.status-card span,
	.status-card small {
		font:
			0.72rem ui-monospace,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.status-card strong {
		margin: 1rem 0;
		font:
			400 2rem Georgia,
			serif;
	}
	.checks,
	.package,
	.hold,
	footer {
		padding: clamp(3rem, 7vw, 6rem) clamp(1.2rem, 7vw, 8rem);
		border-top: 1px solid #2a2d2e;
	}
	.checks > header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 2rem;
		margin-bottom: 2rem;
	}
	h2 {
		margin-bottom: 0;
		font:
			400 clamp(2rem, 4vw, 4rem) Georgia,
			serif;
		letter-spacing: -0.035em;
	}
	.check-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1px;
		background: #353737;
		border: 1px solid #353737;
	}
	.check-grid article {
		min-height: 15rem;
		padding: 1.4rem;
		background: #151719;
		border-top: 3px solid #a84832;
	}
	.check-grid article.pass {
		border-color: #739d72;
	}
	.check-grid article > div {
		display: flex;
		justify-content: space-between;
		font:
			0.72rem ui-monospace,
			monospace;
		text-transform: uppercase;
		color: #9d9991;
	}
	.check-grid h3 {
		margin-top: 3rem;
		font:
			400 1.4rem Georgia,
			serif;
	}
	.check-grid p,
	.package p,
	li {
		color: #aaa69d;
		line-height: 1.55;
	}
	.package {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(20rem, 1.2fr);
		gap: clamp(3rem, 8vw, 8rem);
	}
	.package-copy h2 {
		margin: 0.5rem 0 1.5rem;
	}
	pre {
		padding: 1rem;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
		background: #070809;
		border: 1px solid #343635;
		color: #e1b28d;
	}
	.archive {
		font:
			0.74rem ui-monospace,
			monospace;
	}
	.manifest {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: #343635;
		border: 1px solid #343635;
	}
	.manifest > div {
		padding: 1.5rem;
		background: #121416;
	}
	.manifest ul,
	.hold ol {
		padding-left: 1.2rem;
	}
	.hold {
		background: #151210;
	}
	.hold h2 {
		margin: 0.5rem 0 1.5rem;
	}
	.hold li + li {
		margin-top: 0.65rem;
	}
	footer {
		display: flex;
		gap: 3rem;
		align-items: start;
		font-size: 0.78rem;
		color: #8e8b84;
	}
	footer span,
	footer code {
		display: block;
	}
	footer p {
		margin-left: auto;
		max-width: 30rem;
	}
	@media (max-width: 850px) {
		nav div a:last-child {
			display: none;
		}
		.hero,
		.package {
			grid-template-columns: 1fr;
		}
		.check-grid {
			grid-template-columns: 1fr 1fr;
		}
		footer {
			flex-direction: column;
			gap: 1rem;
		}
		footer p {
			margin-left: 0;
		}
	}
	@media (max-width: 520px) {
		.check-grid,
		.manifest {
			grid-template-columns: 1fr;
		}
		.check-grid article {
			min-height: 12rem;
		}
	}
</style>
