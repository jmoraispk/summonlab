<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import HeroRig from '$lib/components/HeroRig.svelte';
	import { deterministicIndex, drawApprovedIdentity } from '$lib/approved-summon-pool';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let approvedDraw = $state(data.initial);
	// svelte-ignore state_referenced_locally
	let stagedDraw = $state(data.packTwoStaged[0]!);
	let approvedDraws = $state(0);
	let stagedDraws = $state(0);
	let equipment = $state<'none' | 'practice-blade' | 'short-bow'>('none');
	let paletteMode = $state<'base' | 'night' | 'injured'>('base');
	let level = $state(1);
	let interactionMs = $state<number | null>(null);

	const maxLevel = $derived(stagedDraw.manifest.rarityStars * 10);
	const words = (value: string | undefined) => value?.replaceAll('-', ' ') ?? 'unset';

	async function measureInteraction(change: () => void) {
		const startedAt = performance.now();
		change();
		await tick();
		await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
		interactionMs = performance.now() - startedAt;
	}

	async function drawApproved() {
		await measureInteraction(() => {
			approvedDraws += 1;
			approvedDraw = drawApprovedIdentity(data.approvedPool, `approved-proof-${approvedDraws}`)!;
		});
	}

	async function drawStaged() {
		await measureInteraction(() => {
			stagedDraws += 1;
			stagedDraw =
				data.packTwoStaged[
					deterministicIndex(`pack-two-preview-${stagedDraws}`, data.packTwoStaged.length)
				]!;
			level = Math.min(level, stagedDraw.manifest.rarityStars * 10);
		});
	}

	function gainLevel() {
		level = Math.min(level + 1, maxLevel);
	}
</script>

<svelte:head>
	<title>Pack 2 real-time summon proof · Summonlab</title>
	<meta
		name="description"
		content="Approval-gated cached portrait drawing and interactive procedural Pack 2 representation."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a href={resolve('/forge/pack-2')}>← Pack 2 Forge</a>
		<strong>Hybrid summon proof</strong>
		<span>authoring generation: off</span>
	</header>

	<section class="intro">
		<p class="eyebrow">Procedural draw · cached premium reveal</p>
		<h1>Instant identity.<br /><em>No placeholder swap.</em></h1>
		<p>
			This proof keeps two boundaries visible. The production lane can draw only identities whose
			premium portrait is already approved and deployed. The Pack 2 lane proves its deterministic
			manifest and modular rig, but all 18 remain blocked from player summons pending your review.
		</p>
	</section>

	<section class="proof-grid">
		<article class="premium" data-testid="approved-summon-proof">
			<header>
				<div><span>Production lane</span><strong>{data.approvedPool.length} eligible</strong></div>
				<i>approved + cached</i>
			</header>
			<div class="portrait-shell">
				<img
					src={approvedDraw.portrait!.publicPath}
					width={approvedDraw.portrait!.width}
					height={approvedDraw.portrait!.height}
					alt={`${approvedDraw.manifest.displayName} approved first-reveal portrait`}
				/>
			</div>
			<footer>
				<div>
					<span>{'✦'.repeat(approvedDraw.manifest.rarityStars)}</span>
					<h2>{approvedDraw.manifest.displayName}</h2>
					<small>{approvedDraw.manifestHash.slice(0, 16)}…</small>
				</div>
				<button onclick={drawApproved}>Draw approved identity</button>
			</footer>
		</article>

		<article class="procedural" data-testid="pack-two-runtime-rig">
			<header>
				<div><span>Pack 2 staging lane</span><strong>0 of 18 eligible</strong></div>
				<i>candidate · blocked</i>
			</header>
			<div class="rig-shell">
				<HeroRig manifest={stagedDraw.manifest} {equipment} {paletteMode} walking />
			</div>
			<footer>
				<div>
					<span>{'✦'.repeat(stagedDraw.manifest.rarityStars)} · cap {maxLevel}</span>
					<h2>{stagedDraw.manifest.displayName}</h2>
					<small
						>{stagedDraw.manifest.heightCm} cm · {words(stagedDraw.manifest.bodyBuild)} · {words(
							stagedDraw.manifest.physiology?.proportions?.profile
						)}</small
					>
				</div>
				<button onclick={drawStaged}>Draw staged manifest</button>
			</footer>
		</article>
	</section>

	<section class="controls" aria-labelledby="controls-title">
		<div>
			<p class="eyebrow">Local procedural state</p>
			<h2 id="controls-title">Immediate, deterministic reactions</h2>
		</div>
		<div class="control-group">
			<span>Equipment</span>
			{#each ['none', 'practice-blade', 'short-bow'] as option (option)}
				<button
					class:active={equipment === option}
					onclick={() => (equipment = option as typeof equipment)}>{words(option)}</button
				>
			{/each}
		</div>
		<div class="control-group">
			<span>Treatment</span>
			{#each ['base', 'night', 'injured'] as option (option)}
				<button
					class:active={paletteMode === option}
					onclick={() => (paletteMode = option as typeof paletteMode)}>{option}</button
				>
			{/each}
		</div>
		<div class="level-control">
			<span>Level {level} / {maxLevel}</span>
			<button onclick={gainLevel} disabled={level === maxLevel}>Gain level</button>
			<button onclick={() => (level = maxLevel)}>Test cap</button>
		</div>
	</section>

	<section class="evidence" data-testid="runtime-proof-evidence">
		<div><span>Manifest algorithm</span><strong>FNV-1a seeded draw</strong></div>
		<div><span>Premium generation calls</span><strong>0</strong></div>
		<div>
			<span>Last interaction</span><strong
				>{interactionMs === null ? 'ready' : `${interactionMs.toFixed(1)} ms`}</strong
			>
		</div>
		<div><span>Pack 2 gate</span><strong>Human approval pending</strong></div>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #07090d;
		color: #f4efe5;
	}
	main {
		min-height: 100vh;
		background: radial-gradient(circle at 55% 24rem, #5376aa26, transparent 36rem), #080a0f;
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.topbar {
		display: flex;
		min-height: 4.5rem;
		align-items: center;
		justify-content: space-between;
		padding: 0 clamp(1rem, 4vw, 4rem);
		border-bottom: 1px solid #ffffff17;
		color: #f4efe579;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.topbar strong {
		color: #f4efe5;
	}
	.intro,
	.proof-grid,
	.controls,
	.evidence {
		max-width: 82rem;
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 5rem) clamp(1rem, 4vw, 4rem);
	}
	.eyebrow,
	article header span,
	.control-group > span,
	.level-control > span,
	.evidence span {
		color: #8aa7dd;
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.8rem 0 1.5rem;
		font:
			400 clamp(3.5rem, 8vw, 7rem)/0.87 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	h1 em {
		color: #8aa7dd;
		font-weight: 400;
	}
	.intro > p:last-child {
		max-width: 48rem;
		color: #f4efe58a;
		line-height: 1.7;
	}
	.proof-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		padding-top: 0;
	}
	article {
		overflow: hidden;
		border: 1px solid #ffffff18;
		background: #0a0d13;
	}
	article header,
	article footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.2rem;
	}
	article header strong,
	article header span {
		display: block;
	}
	article header i {
		color: #75cf9b;
		font-size: 0.55rem;
		font-style: normal;
		text-transform: uppercase;
	}
	.procedural header i {
		color: #edc980;
	}
	.portrait-shell,
	.rig-shell {
		display: grid;
		height: min(62vw, 42rem);
		place-items: end center;
		background: radial-gradient(circle at 50% 76%, #8aa7dd24, transparent 42%);
	}
	.portrait-shell img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center top;
	}
	.rig-shell :global(figure) {
		width: min(72%, 24rem);
	}
	article footer h2 {
		margin: 0.2rem 0;
		font:
			400 2rem Georgia,
			serif;
	}
	article footer span {
		color: #8aa7dd;
		font-size: 0.65rem;
	}
	article footer small {
		color: #f4efe55e;
		text-transform: capitalize;
	}
	button {
		border: 1px solid #8aa7dd77;
		padding: 0.7rem 1rem;
		color: #eaf0ff;
		background: #8aa7dd18;
		cursor: pointer;
		text-transform: uppercase;
	}
	.controls {
		display: grid;
		grid-template-columns: 1.4fr 1fr 1fr 1fr;
		gap: 2rem;
		align-items: end;
		border-top: 1px solid #ffffff13;
	}
	.controls h2 {
		margin: 0.4rem 0 0;
		font:
			400 2rem Georgia,
			serif;
	}
	.control-group,
	.level-control {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.control-group > span,
	.level-control > span {
		flex-basis: 100%;
		margin-bottom: 0.35rem;
	}
	.control-group button,
	.level-control button {
		padding: 0.45rem 0.6rem;
		border-color: #ffffff20;
		color: #f4efe573;
		background: transparent;
		font-size: 0.55rem;
	}
	.control-group button.active {
		border-color: #8aa7dd;
		color: #fff;
	}
	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.evidence {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		padding-top: 0;
	}
	.evidence div {
		padding: 1.2rem;
		background: #0a0d13;
	}
	.evidence span,
	.evidence strong {
		display: block;
	}
	.evidence strong {
		margin-top: 0.4rem;
		font:
			400 1rem Georgia,
			serif;
	}
	@media (max-width: 800px) {
		.proof-grid,
		.controls,
		.evidence {
			grid-template-columns: 1fr;
		}
		.portrait-shell,
		.rig-shell {
			height: 38rem;
		}
		.topbar span {
			display: none;
		}
	}
</style>
