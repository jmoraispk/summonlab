<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let selectedId = $state<'hammer-line' | 'split-cooling' | 'full-quench'>('hammer-line');
	let selectedDefinition = $derived(
		data.report.definitions.find((definition) => definition.strategyId === selectedId)!
	);
	let selectedSummary = $derived(
		data.report.summaries.find((summary) => summary.strategyId === selectedId)!
	);
	let selectedTrial = $derived(
		data.report.trials.find((trial) => trial.runId === selectedSummary.representativeRunId)!
	);

	function short(hash: string) {
		return hash.slice(0, 12);
	}

	function title(value: string) {
		return value.replaceAll('-', ' ');
	}
</script>

<svelte:head>
	<title>The Living Foundry · strategy trials</title>
	<meta
		name="description"
		content="Three deterministic, replay-verified strategies through summonlab's fifth tower floor."
	/>
</svelte:head>

<main
	data-testid="foundry-trials"
	class:cooling={selectedId === 'split-cooling'}
	class:quenched={selectedId === 'full-quench'}
>
	<nav>
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div class="location">
			<span>Tower / Band I</span><strong>Floor 05 · The Living Foundry</strong>
		</div>
		<code>{data.report.engineContentVersion}</code>
	</nav>

	<header class="hero">
		<div class="eyebrow"><span>MIS-010</span><i></i><span>Deterministic strategy proof</span></div>
		<h1>Three ways<br />through <em>fire.</em></h1>
		<p>
			The engine owns every move, impact, and consequence. The company only chooses among legal
			actions—and discovers that preparation, memory, and trust produce radically different fights.
		</p>
		<div class="gate-stamp" aria-label="quality gate passed">
			<span>Quality gate</span><strong>24 / 24</strong><small>strict replays verified</small>
		</div>
	</header>

	<section class="arena" aria-label="Living Foundry tactical route map">
		<div class="arena-copy">
			<span>Authored topology</span>
			<strong>The furnace is the ruleset.</strong>
			<p>Route memory exposes the upper seam. Every other wall remains a wall.</p>
		</div>
		<svg viewBox="0 0 900 430" role="img" aria-label="The Living Foundry route diagram">
			<defs>
				<filter id="glow"
					><feGaussianBlur stdDeviation="7" result="blur" /><feMerge
						><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge
					></filter
				>
				<linearGradient id="heat" x1="0" x2="1"
					><stop stop-color="#7e2b18" /><stop offset="1" stop-color="#ef9c46" /></linearGradient
				>
			</defs>
			<path
				class="route direct"
				d="M80 340 C190 338 196 294 300 288 S430 286 522 250 S670 230 802 190"
			/>
			<path class="route secret" d="M300 288 C348 173 435 113 533 104 S674 127 802 190" />
			<path class="route-return" d="M533 104 C642 122 716 155 802 190" />
			<g class="node threshold" transform="translate(80 340)"
				><circle r="18" /><circle r="5" /><text y="38">THRESHOLD</text></g
			>
			<g class="node intake" transform="translate(300 288)"
				><circle r="18" /><circle r="5" /><text y="38">ASH INTAKE</text></g
			>
			<g class="node nave" transform="translate(522 250)"
				><circle r="22" /><path d="M-8 -8 8 8M8 -8-8 8" /><text y="43">FORGE NAVE</text></g
			>
			<g class="node control" transform="translate(533 104)"
				><circle r="23" /><path d="M0-11V11M-11 0H11" /><text y="44">COOLING CONTROL</text></g
			>
			<g class="node heart" transform="translate(802 190)" filter="url(#glow)"
				><circle class="pulse" r="48" /><circle r="25" /><path d="M0-13 11 8H-11Z" /><text y="68"
					>FURNACE HEART</text
				></g
			>
			<text class="route-label direct-label" x="414" y="320">DIRECT ASSAULT</text>
			<text class="route-label secret-label" x="355" y="168">REMEMBERED SEAM</text>
		</svg>
		<div class="furnace-state">
			<span>Warden armor state</span>
			<strong>{selectedDefinition.targetFurnaceState}</strong>
			<div><i></i><i></i><i></i></div>
		</div>
	</section>

	<section class="strategies">
		<header>
			<span>01 / Choose a doctrine</span>
			<h2>Same floor. Different truth.</h2>
		</header>
		<div class="strategy-grid">
			{#each data.report.definitions as definition, index (definition.strategyId)}
				{@const summary = data.report.summaries.find(
					(item) => item.strategyId === definition.strategyId
				)!}
				<button
					class:active={selectedId === definition.strategyId}
					onclick={() => (selectedId = definition.strategyId)}
					data-testid={`strategy-${definition.strategyId}`}
				>
					<div class="card-top">
						<span>0{index + 1}</span><i>{definition.targetFurnaceState}</i>
					</div>
					<h3>{definition.displayName}</h3>
					<p>{definition.thesis}</p>
					<dl>
						<div>
							<dt>Warden strikes</dt>
							<dd>{summary.wardenStrikeRange[0]}–{summary.wardenStrikeRange[1]}</dd>
						</div>
						<div>
							<dt>Mission rounds</dt>
							<dd>{summary.missionRoundRange[0]}</dd>
						</div>
						<div>
							<dt>Lowest hero HP</dt>
							<dd>{summary.minimumHeroHealth}</dd>
						</div>
					</dl>
					<footer>
						<span>{definition.requiresRouteMemory ? 'Schematic required' : 'No route memory'}</span
						><b>8 / 8 ✓</b>
					</footer>
				</button>
			{/each}
		</div>
	</section>

	<section class="run-detail" data-testid="representative-run">
		<header>
			<div>
				<span>02 / Representative action log</span>
				<h2>{selectedDefinition.displayName}</h2>
			</div>
			<code>run {short(selectedTrial.runId)}</code>
		</header>
		<div class="briefing">
			<article>
				<span>Preparation</span>
				<p>{selectedDefinition.preparation}</p>
			</article>
			<article>
				<span>Cost of the choice</span>
				<p>{selectedDefinition.tradeoff}</p>
			</article>
		</div>
		<div class="timeline">
			{#each selectedTrial.checkpoints as checkpoint (`${checkpoint.roundNumber}-${checkpoint.label}`)}
				<article>
					<div class="round">
						<span>R{String(checkpoint.roundNumber).padStart(2, '0')}</span><i></i>
					</div>
					<div class="event">
						<strong>{checkpoint.label}</strong><small
							>{title(checkpoint.furnaceState)} furnace · Warden {checkpoint.wardenVitality}/18</small
						>
					</div>
					<div class="vital">
						<span>Company floor</span><b>{checkpoint.minimumHeroHealth} HP</b>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="integrity">
		<div><span>Legal commands</span><strong>Only</strong></div>
		<div>
			<span>Replay mismatches</span><strong>{data.report.qualityGate.replayMismatches}</strong>
		</div>
		<div><span>Deaths</span><strong>{data.report.qualityGate.deaths}</strong></div>
		<div><span>Report hash</span><code>{short(data.report.reportHash)}</code></div>
	</section>

	<footer class="page-footer">
		<p>Fixed successful regression seeds—not a population win-rate estimate.</p>
		<span>{data.report.missionContentVersion} · {data.report.generatorVersion}</span>
	</footer>
</main>

<style>
	:global(body) {
		background: #090a0d;
		color: #ece8df;
	}
	:global(*) {
		box-sizing: border-box;
	}
	main {
		--ember: #e87536;
		--gold: #d8b067;
		--cyan: #77c8c2;
		--line: rgba(255, 255, 255, 0.1);
		min-height: 100vh;
		overflow: hidden;
		background:
			radial-gradient(circle at 74% 20%, rgba(196, 61, 24, 0.16), transparent 31rem),
			linear-gradient(145deg, #08090c, #101116 55%, #090a0d);
	}
	main.cooling {
		--ember: #d69747;
		--gold: #83c5b8;
	}
	main.quenched {
		--ember: #71bfc5;
		--gold: #a5d7cf;
	}
	nav,
	.hero,
	.arena,
	.strategies,
	.run-detail,
	.integrity,
	.page-footer {
		max-width: 1240px;
		margin-inline: auto;
	}
	nav {
		min-height: 72px;
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 0 34px;
		border-bottom: 1px solid var(--line);
	}
	.wordmark {
		color: #fff;
		font:
			24px Georgia,
			serif;
		text-decoration: none;
		margin-right: auto;
	}
	.location {
		display: grid;
		text-align: right;
	}
	.location span,
	section header > span,
	.eyebrow span,
	.arena-copy > span,
	.briefing span,
	.vital span,
	.integrity span,
	.furnace-state span {
		color: var(--gold);
		font:
			9px/1.4 ui-monospace,
			monospace;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	.location strong {
		font-size: 12px;
		font-weight: 500;
	}
	code {
		color: #8d929b;
		font:
			10px ui-monospace,
			monospace;
	}
	.hero {
		min-height: 440px;
		padding: 82px 54px 64px;
		position: relative;
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 11px;
	}
	.eyebrow i {
		width: 34px;
		height: 1px;
		background: var(--gold);
	}
	.hero h1 {
		font:
			clamp(58px, 8.6vw, 112px)/0.82 Georgia,
			serif;
		letter-spacing: -0.06em;
		margin: 22px 0 34px;
	}
	.hero h1 em {
		color: var(--ember);
		font-weight: 400;
	}
	.hero > p {
		max-width: 620px;
		color: #a9abb0;
		line-height: 1.75;
		margin: 0;
	}
	.gate-stamp {
		position: absolute;
		right: 80px;
		bottom: 72px;
		width: 188px;
		aspect-ratio: 1;
		border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
		border-radius: 50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-shadow:
			inset 0 0 55px color-mix(in srgb, var(--ember) 9%, transparent),
			0 0 80px color-mix(in srgb, var(--ember) 8%, transparent);
	}
	.gate-stamp span,
	.gate-stamp small {
		color: #97999e;
		font:
			9px ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.gate-stamp strong {
		font:
			34px Georgia,
			serif;
		color: var(--gold);
		margin: 8px 0 5px;
	}
	.arena {
		height: 530px;
		border: 1px solid var(--line);
		position: relative;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent),
			repeating-linear-gradient(90deg, transparent 0 99px, rgba(255, 255, 255, 0.022) 100px),
			repeating-linear-gradient(0deg, transparent 0 99px, rgba(255, 255, 255, 0.022) 100px);
	}
	.arena::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(
			circle at 88% 46%,
			color-mix(in srgb, var(--ember) 19%, transparent),
			transparent 21rem
		);
		pointer-events: none;
	}
	.arena-copy {
		position: absolute;
		z-index: 2;
		left: 34px;
		top: 30px;
		max-width: 260px;
	}
	.arena-copy strong {
		display: block;
		font:
			26px Georgia,
			serif;
		margin: 9px 0;
	}
	.arena-copy p {
		color: #858990;
		font-size: 12px;
		line-height: 1.6;
		margin: 0;
	}
	.arena svg {
		position: absolute;
		inset: 45px 15px 10px 270px;
		width: calc(100% - 285px);
		height: calc(100% - 55px);
		overflow: visible;
	}
	.route,
	.route-return {
		fill: none;
		stroke: rgba(255, 255, 255, 0.15);
		stroke-width: 2;
		stroke-dasharray: 5 8;
	}
	.route.direct {
		stroke: url(#heat);
		stroke-width: 3;
		opacity: 1;
	}
	.route.secret,
	.route-return {
		stroke: var(--cyan);
		opacity: 0.22;
	}
	.cooling .route.secret,
	.cooling .route-return,
	.quenched .route.secret,
	.quenched .route-return {
		opacity: 1;
		stroke-width: 3;
	}
	.node circle {
		fill: #101218;
		stroke: #858990;
		stroke-width: 1.5;
	}
	.node circle + circle,
	.node path {
		fill: none;
		stroke: #d9d4c8;
		stroke-width: 2;
	}
	.node text,
	.route-label {
		fill: #898d94;
		font:
			10px ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-anchor: middle;
	}
	.heart circle {
		stroke: var(--ember);
	}
	.heart .pulse {
		fill: color-mix(in srgb, var(--ember) 8%, transparent);
		opacity: 0.75;
		animation: pulse 2.8s ease-in-out infinite;
	}
	.heart path {
		fill: var(--ember);
		stroke: none;
	}
	.control circle {
		stroke: var(--cyan);
	}
	.route-label {
		font-size: 8px;
	}
	.furnace-state {
		position: absolute;
		right: 30px;
		top: 30px;
		text-align: right;
	}
	.furnace-state strong {
		display: block;
		color: var(--ember);
		font:
			20px Georgia,
			serif;
		text-transform: capitalize;
		margin: 5px 0 8px;
	}
	.furnace-state div {
		display: flex;
		justify-content: flex-end;
		gap: 5px;
	}
	.furnace-state i {
		width: 18px;
		height: 3px;
		background: var(--ember);
	}
	.cooling .furnace-state i:last-child,
	.quenched .furnace-state i:nth-last-child(-n + 2) {
		opacity: 0.16;
	}
	.strategies,
	.run-detail {
		padding: 90px 34px 0;
	}
	section header h2 {
		font:
			42px Georgia,
			serif;
		letter-spacing: -0.03em;
		margin: 10px 0 30px;
	}
	.strategy-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
	}
	.strategy-grid button {
		appearance: none;
		color: inherit;
		text-align: left;
		padding: 25px;
		min-height: 355px;
		border: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.018);
		cursor: pointer;
		transition: 0.25s ease;
	}
	.strategy-grid button:hover,
	.strategy-grid button.active {
		border-color: color-mix(in srgb, var(--gold) 58%, transparent);
		transform: translateY(-4px);
		background: linear-gradient(
			150deg,
			color-mix(in srgb, var(--ember) 9%, transparent),
			rgba(255, 255, 255, 0.025)
		);
		box-shadow: 0 22px 60px rgba(0, 0, 0, 0.22);
	}
	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #71757d;
		font:
			10px ui-monospace,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.card-top i {
		color: var(--gold);
		font-style: normal;
	}
	.strategy-grid h3 {
		font:
			32px Georgia,
			serif;
		margin: 42px 0 15px;
	}
	.strategy-grid p {
		color: #9a9da3;
		line-height: 1.65;
		min-height: 80px;
		font-size: 13px;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin: 28px 0;
	}
	dl div {
		border-left: 1px solid var(--line);
		padding-left: 10px;
	}
	dt {
		color: #777b83;
		font-size: 9px;
		line-height: 1.3;
	}
	dd {
		margin: 5px 0 0;
		font:
			18px Georgia,
			serif;
	}
	.strategy-grid footer {
		border-top: 1px solid var(--line);
		padding-top: 16px;
		display: flex;
		justify-content: space-between;
		color: #878a90;
		font:
			9px ui-monospace,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.strategy-grid footer b {
		color: var(--gold);
	}
	.run-detail > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
	}
	.briefing {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: var(--line);
		margin-top: 26px;
	}
	.briefing article {
		background: #0d0f13;
		padding: 25px 28px;
	}
	.briefing p {
		margin: 10px 0 0;
		color: #a3a5aa;
		line-height: 1.65;
		font-size: 13px;
	}
	.timeline {
		margin-top: 18px;
	}
	.timeline article {
		display: grid;
		grid-template-columns: 76px 1fr 130px;
		align-items: center;
		min-height: 76px;
		border-bottom: 1px solid var(--line);
	}
	.round {
		height: 100%;
		display: flex;
		align-items: center;
		gap: 13px;
		color: var(--gold);
		font:
			10px ui-monospace,
			monospace;
	}
	.round i {
		height: 100%;
		width: 1px;
		background: var(--line);
		position: relative;
	}
	.round i::after {
		content: '';
		position: absolute;
		width: 7px;
		height: 7px;
		border: 1px solid var(--gold);
		border-radius: 50%;
		background: #0c0e12;
		top: calc(50% - 4px);
		left: -4px;
	}
	.event {
		display: grid;
		gap: 5px;
	}
	.event strong {
		font:
			17px Georgia,
			serif;
	}
	.event small {
		color: #797d85;
	}
	.vital {
		text-align: right;
		display: grid;
		gap: 4px;
	}
	.vital b {
		font:
			16px Georgia,
			serif;
	}
	.integrity {
		margin-top: 90px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border: 1px solid var(--line);
	}
	.integrity div {
		min-height: 110px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 20px 25px;
		border-right: 1px solid var(--line);
	}
	.integrity div:last-child {
		border: 0;
	}
	.integrity strong {
		font:
			26px Georgia,
			serif;
		margin-top: 8px;
	}
	.integrity code {
		margin-top: 10px;
	}
	.page-footer {
		display: flex;
		justify-content: space-between;
		padding: 28px 34px 60px;
		color: #686c74;
		font:
			10px ui-monospace,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	@keyframes pulse {
		50% {
			transform: scale(1.16);
			opacity: 0.25;
		}
	}
	@media (max-width: 760px) {
		nav {
			padding: 0 18px;
		}
		.location {
			display: none;
		}
		.hero {
			min-height: 520px;
			padding: 68px 22px 180px;
		}
		.hero h1 {
			font-size: 62px;
		}
		.gate-stamp {
			left: 22px;
			right: auto;
			bottom: 35px;
			width: 130px;
		}
		.gate-stamp strong {
			font-size: 25px;
		}
		.arena {
			height: 460px;
			border-left: 0;
			border-right: 0;
		}
		.arena-copy {
			left: 22px;
			top: 24px;
		}
		.arena svg {
			inset: 115px 0 0 -35px;
			width: calc(100% + 60px);
			height: 330px;
		}
		.furnace-state {
			right: 18px;
			top: 24px;
		}
		.route-label {
			display: none;
		}
		.strategies,
		.run-detail {
			padding: 70px 18px 0;
		}
		section header h2 {
			font-size: 34px;
		}
		.strategy-grid {
			grid-template-columns: 1fr;
		}
		.strategy-grid button {
			min-height: 310px;
		}
		.strategy-grid p {
			min-height: auto;
		}
		.briefing {
			grid-template-columns: 1fr;
		}
		.timeline article {
			grid-template-columns: 58px 1fr;
			padding: 8px 0;
		}
		.vital {
			grid-column: 2;
			text-align: left;
			padding-bottom: 10px;
		}
		.integrity {
			margin: 70px 18px 0;
			grid-template-columns: 1fr 1fr;
		}
		.integrity div:nth-child(2) {
			border-right: 0;
		}
		.integrity div:nth-child(-n + 2) {
			border-bottom: 1px solid var(--line);
		}
		.page-footer {
			padding-inline: 18px;
			gap: 20px;
			line-height: 1.5;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.heart .pulse {
			animation: none;
		}
		.strategy-grid button {
			transition: none;
		}
	}
</style>
