<script lang="ts">
	import { onMount } from 'svelte';
	import CombatStage from '$lib/components/living-village/combat/CombatStage.svelte';
	import {
		PROXY_COMBAT_RECEIPT,
		projectCombatPlayback,
		type CombatPlaybackSnapshot
	} from '$lib/components/living-village/combat/combat-playback';
	import LabBackLink from '$lib/components/living-village/LabBackLink.svelte';
	import { PLAYER_SETTINGS_EVENT } from '$lib/player-settings';

	let command = $state<{ sequence: number; kind: 'ready' | 'replay' | 'skip' }>({
		sequence: 0,
		kind: 'ready'
	});
	let paused = $state(true);
	let speed = $state(1);
	let reducedMotion = $state(false);
	let hydrated = $state(false);
	let snapshot = $state<CombatPlaybackSnapshot>(
		projectCombatPlayback(PROXY_COMBAT_RECEIPT, 0, { started: false })
	);

	const actorById = new Map(
		PROXY_COMBAT_RECEIPT.actorsBefore.map((actor) => [actor.id, actor] as const)
	);
	const started = $derived(command.kind !== 'ready');
	const beatLabel = $derived(
		snapshot.beat === 'ready'
			? 'Choose an action'
			: snapshot.beat === 'complete'
				? 'Resolution settled'
				: `${snapshot.beat[0]!.toUpperCase()}${snapshot.beat.slice(1)}`
	);

	onMount(() => {
		hydrated = true;
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => {
			const playerPreference = document.documentElement.dataset.playerMotion ?? 'system';
			reducedMotion =
				playerPreference === 'reduced' || (playerPreference !== 'full' && media.matches);
			if (reducedMotion && started) {
				command = { sequence: command.sequence + 1, kind: 'skip' };
				paused = true;
			}
		};
		sync();
		media.addEventListener('change', sync);
		window.addEventListener(PLAYER_SETTINGS_EVENT, sync);
		return () => {
			media.removeEventListener('change', sync);
			window.removeEventListener(PLAYER_SETTINGS_EVENT, sync);
		};
	});

	function playAction(): void {
		command = { sequence: command.sequence + 1, kind: 'replay' };
		paused = false;
		snapshot = projectCombatPlayback(PROXY_COMBAT_RECEIPT, 0, {
			started: true,
			reducedMotion
		});
	}

	function skipAction(): void {
		command = { sequence: command.sequence + 1, kind: 'skip' };
		paused = true;
		snapshot = projectCombatPlayback(PROXY_COMBAT_RECEIPT, Number.POSITIVE_INFINITY, {
			started: true,
			reducedMotion
		});
	}

	function togglePlayback(): void {
		if (!started || snapshot.complete) {
			playAction();
			return;
		}
		paused = !paused;
	}
</script>

<svelte:head>
	<title>Combat art and motion laboratory · Summonlab</title>
	<meta
		name="description"
		content="Review the painted observatory art pilot and accepted focus, movement, impact, and settle cadence."
	/>
</svelte:head>

<main>
	<LabBackLink placement="top" />
	<header class="combat-header">
		<div>
			<p>Living Village · observatory art pilot v2</p>
			<h1>The ruined observatory</h1>
		</div>
		<div class="receipt-binding">
			<span>Immutable presentation receipt</span>
			<code>{PROXY_COMBAT_RECEIPT.receiptId}</code>
		</div>
	</header>

	<section class="combat-shell" aria-labelledby="combat-heading">
		<h2 id="combat-heading" class="sr-only">Observatory combat art and motion playback</h2>
		<div class="battlefield" data-testid="combat-stage">
			<CombatStage
				receipt={PROXY_COMBAT_RECEIPT}
				{command}
				{paused}
				{speed}
				{reducedMotion}
				onSnapshot={(next) => (snapshot = next)}
				onComplete={() => (paused = true)}
			/>

			<div class="initiative" aria-label="Initiative order" data-testid="initiative-rail">
				<div class="now-marker"><i aria-hidden="true"></i><strong>Now</strong></div>
				<ol>
					{#each snapshot.initiativeOrder as actorId (actorId)}
						{@const actor = actorById.get(actorId)!}
						<li
							class:ready={actorId === snapshot.readyActorId}
							class:hostile={actor.kind === 'monster'}
						>
							<span aria-hidden="true">{actor.label.slice(0, 1)}</span>
							<small>{actor.label}</small>
						</li>
					{/each}
				</ol>
			</div>

			<div class="beat-status" data-testid="combat-beat">
				<span>{beatLabel}</span>
				<progress value={snapshot.elapsedMs} max={snapshot.totalDurationMs}></progress>
			</div>

			<div class="mobile-feed">
				<div class="feed-lines" aria-live="polite" aria-label="Latest combat activity">
					{#each snapshot.feed as entry, index (entry.id)}
						<p
							class:system={entry.tone === 'system'}
							style={`--age:${snapshot.feed.length - index - 1}`}
						>
							{#if entry.actorLabel}<strong>{entry.actorLabel}:</strong>{/if}
							{entry.message}
						</p>
					{/each}
				</div>
			</div>

			<div class="command-bar">
				<div class="ownership" aria-label="Control ownership">
					<button type="button" class="active" aria-pressed="true">Manual</button>
					<button type="button" disabled title="Assist arrives after the proxy motion slice"
						>Assist</button
					>
					<button type="button" disabled title="Auto arrives after the proxy motion slice"
						>Auto</button
					>
				</div>
				<div class="skills" aria-label="Available actions">
					<button type="button" class="selected" aria-pressed="true">
						<i aria-hidden="true">↗</i><span>Fleeting Step</span>
					</button>
					<button type="button" disabled><i aria-hidden="true">✦</i><span>Skill 02</span></button>
					<button type="button" disabled><i aria-hidden="true">◌</i><span>Skill 03</span></button>
				</div>
				<button
					class="commit"
					type="button"
					onclick={playAction}
					disabled={!hydrated}
					data-testid="commit-combat-action"
				>
					{snapshot.complete ? 'Replay' : started ? (paused ? 'Resume' : 'Restart') : 'Commit'}
				</button>
			</div>
		</div>

		<aside aria-label="Combat playback and activity">
			<div class="aside-heading">
				<p>Authoritative playback</p>
				<h2>{PROXY_COMBAT_RECEIPT.actionLabel}</h2>
				<span>One resolved receipt. Presentation cannot change the outcome.</span>
			</div>

			<div class="playback-controls" aria-label="Playback controls">
				<button type="button" onclick={togglePlayback} data-testid="toggle-combat-playback">
					{!started || snapshot.complete ? 'Play action' : paused ? 'Resume' : 'Pause'}
				</button>
				<button type="button" onclick={playAction}>Replay</button>
				<button type="button" onclick={skipAction} disabled={!started || snapshot.complete}
					>Skip</button
				>
				<div role="group" aria-label="Playback speed">
					{#each [0.5, 1, 2] as candidate (candidate)}
						<button
							type="button"
							class:active={speed === candidate}
							aria-pressed={speed === candidate}
							onclick={() => (speed = candidate)}>{candidate}×</button
						>
					{/each}
				</div>
			</div>

			<div class="desktop-feed">
				<header><span>Party channel</span><small>Latest three</small></header>
				<div class="feed-lines" aria-live="polite" aria-label="Latest combat activity">
					{#each snapshot.feed as entry, index (entry.id)}
						<p
							class:system={entry.tone === 'system'}
							style={`--age:${snapshot.feed.length - index - 1}`}
						>
							{#if entry.actorLabel}<strong>{entry.actorLabel}:</strong>{/if}
							{entry.message}
						</p>
					{/each}
				</div>
			</div>

			<dl class="receipt-state">
				<div>
					<dt>Beat</dt>
					<dd>{beatLabel}</dd>
				</div>
				<div>
					<dt>Actor</dt>
					<dd>{actorById.get(PROXY_COMBAT_RECEIPT.actingActorId)!.label}</dd>
				</div>
				<div>
					<dt>Target</dt>
					<dd>{actorById.get(PROXY_COMBAT_RECEIPT.targetActorId)!.label}</dd>
				</div>
				<div>
					<dt>Final target vitality</dt>
					<dd>
						{snapshot.actors.find((actor) => actor.id === PROXY_COMBAT_RECEIPT.targetActorId)!
							.health}
					</dd>
				</div>
			</dl>

			<p class="fixture-note">
				Authored environment with Dara and Sprout Goblin pilot sprites. The remaining silhouettes
				stay explicit proxies until their combat packs exist.
			</p>
		</aside>
	</section>
</main>

<style>
	:global(html) {
		background: #050b11;
	}

	:global(body) {
		margin: 0;
		background: #050b11;
	}

	:global(*) {
		box-sizing: border-box;
	}

	main {
		min-height: 100vh;
		padding: clamp(3.5rem, 5vw, 5rem) clamp(0.75rem, 3vw, 2.5rem) 2rem;
		background:
			radial-gradient(circle at 72% 4%, rgba(48, 102, 116, 0.22), transparent 28rem),
			linear-gradient(180deg, #071018, #05090e);
		color: #f2eadb;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}

	.combat-header,
	.combat-shell {
		width: min(100%, 78rem);
		margin-inline: auto;
	}

	.combat-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1rem;
	}

	.combat-header p,
	.aside-heading p {
		margin: 0 0 0.35rem;
		color: #7bc0cb;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1,
	.aside-heading h2 {
		margin: 0;
		font:
			400 clamp(1.65rem, 4vw, 3rem) / 1 Georgia,
			serif;
	}

	.receipt-binding {
		display: grid;
		gap: 0.25rem;
		text-align: right;
	}

	.receipt-binding span,
	.receipt-binding code {
		font-size: 0.58rem;
		letter-spacing: 0.08em;
	}

	.receipt-binding span {
		color: #8a9696;
		text-transform: uppercase;
	}

	.receipt-binding code {
		color: #d9b76d;
	}

	.combat-shell {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22rem;
		min-height: min(78vh, 58rem);
		border: 1px solid rgba(207, 176, 107, 0.26);
		background: #081017;
		box-shadow: 0 2rem 7rem rgba(0, 0, 0, 0.38);
	}

	.battlefield {
		position: relative;
		min-height: 52rem;
		overflow: hidden;
		background: #071018;
		isolation: isolate;
	}

	.initiative {
		position: absolute;
		z-index: 4;
		top: 0.8rem;
		left: 50%;
		width: min(93%, 45rem);
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.45rem 0.65rem;
		background: linear-gradient(
			90deg,
			rgba(4, 9, 13, 0.2),
			rgba(4, 9, 13, 0.72) 14% 86%,
			rgba(4, 9, 13, 0.2)
		);
	}

	.now-marker {
		flex: none;
		display: grid;
		place-items: center;
		width: 3rem;
		color: #efd083;
		text-transform: uppercase;
	}

	.now-marker i {
		width: 1rem;
		height: 1rem;
		border: 1px solid #e3bd64;
		transform: rotate(45deg);
		box-shadow: 0 0 1rem rgba(231, 192, 95, 0.45);
	}

	.now-marker strong {
		margin-top: 0.35rem;
		font:
			700 0.55rem/1 Inter,
			sans-serif;
		letter-spacing: 0.12em;
	}

	.initiative ol {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		gap: clamp(0.25rem, 0.8vw, 0.6rem);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.initiative ol::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: rgba(220, 181, 95, 0.46);
	}

	.initiative li {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		display: grid;
		place-items: center;
	}

	.initiative li span {
		position: relative;
		display: grid;
		place-items: center;
		width: clamp(1.65rem, 4.8vw, 2.45rem);
		aspect-ratio: 1;
		border: 2px solid #5a92bd;
		border-radius: 50%;
		background: radial-gradient(circle at 36% 30%, #d8c9ab, #30435a 48%, #111821 72%);
		color: #f9ecd5;
		font:
			700 0.68rem Georgia,
			serif;
		box-shadow: 0 0 0 2px rgba(3, 7, 11, 0.84);
	}

	.initiative li.hostile span {
		border-color: #c65145;
		background: radial-gradient(circle at 36% 30%, #9b8568, #5a2928 50%, #171113 72%);
	}

	.initiative li.ready span {
		border-color: #f2cb70;
		box-shadow:
			0 0 0 2px #15120b,
			0 0 1.1rem rgba(246, 197, 91, 0.72);
		transform: scale(1.14);
	}

	.initiative li small {
		position: absolute;
		top: calc(100% + 0.3rem);
		max-width: 4.2rem;
		overflow: hidden;
		color: transparent;
		font-size: 0.45rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.initiative li.ready small {
		color: #f3d58e;
	}

	.beat-status {
		position: absolute;
		z-index: 4;
		top: 6.1rem;
		left: 1rem;
		display: grid;
		gap: 0.25rem;
		width: 8rem;
		color: #e1d1ae;
		font-size: 0.55rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.beat-status progress {
		width: 100%;
		height: 0.16rem;
		border: 0;
		accent-color: #d8ae58;
	}

	.command-bar {
		position: absolute;
		z-index: 5;
		left: 0.9rem;
		right: 0.9rem;
		bottom: 0.9rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.65rem;
		border: 1px solid rgba(222, 183, 101, 0.5);
		border-radius: 1.5rem;
		background: rgba(8, 10, 12, 0.9);
		box-shadow:
			0 1rem 2rem rgba(0, 0, 0, 0.4),
			inset 0 0 2rem rgba(190, 137, 47, 0.08);
		backdrop-filter: blur(10px);
	}

	.ownership,
	.skills,
	.playback-controls,
	.playback-controls [role='group'] {
		display: flex;
		gap: 0.35rem;
	}

	button {
		border: 1px solid rgba(216, 180, 104, 0.32);
		background: #12171a;
		color: #d9d2c4;
		font:
			750 0.6rem/1 Inter,
			sans-serif;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		border-color: #e3b960;
		color: #fff3d5;
	}

	button:focus-visible {
		outline: 2px solid #efbd73;
		outline-offset: 3px;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}

	.ownership button {
		width: 2.85rem;
		height: 2.85rem;
		border-radius: 50%;
		font-size: 0.46rem;
	}

	.ownership button.active {
		border-color: #efc466;
		background: #3b2b12;
		color: #ffe5a1;
		box-shadow: 0 0 1rem rgba(227, 181, 85, 0.25);
	}

	.skills {
		justify-content: flex-end;
	}

	.skills button {
		position: relative;
		width: 4.4rem;
		height: 4.4rem;
		border-radius: 0.65rem;
		background: radial-gradient(circle at 50% 40%, #75551f, #21180d 68%);
	}

	.skills button.selected {
		border-color: #ffcf68;
		box-shadow:
			0 0 0 2px #4f3611,
			0 0 1.25rem rgba(249, 188, 69, 0.36);
	}

	.skills i {
		display: block;
		color: #fff1bd;
		font:
			normal 2rem/1 Georgia,
			serif;
	}

	.skills span {
		position: absolute;
		left: 50%;
		bottom: 0.25rem;
		transform: translateX(-50%);
		max-width: 90%;
		overflow: hidden;
		font-size: 0.43rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.commit {
		align-self: stretch;
		min-width: 4.4rem;
		border-color: #e7bc64;
		border-radius: 0.75rem;
		background: linear-gradient(145deg, #7f581f, #3d2910);
		color: #fff0c2;
		text-transform: uppercase;
	}

	.mobile-feed {
		display: none;
	}

	aside {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.4rem;
		border-left: 1px solid rgba(207, 176, 107, 0.2);
		background: linear-gradient(180deg, rgba(14, 22, 28, 0.98), rgba(7, 12, 17, 0.98));
	}

	.aside-heading span,
	.fixture-note {
		color: #8c9898;
		font-size: 0.72rem;
		line-height: 1.5;
	}

	.aside-heading h2 {
		margin-bottom: 0.65rem;
		font-size: 2rem;
	}

	.playback-controls {
		flex-wrap: wrap;
		padding-block: 1rem;
		border-block: 1px solid rgba(255, 255, 255, 0.09);
	}

	.playback-controls button {
		min-height: 2.5rem;
		padding: 0.65rem 0.75rem;
	}

	.playback-controls [role='group'] {
		width: 100%;
	}

	.playback-controls button.active {
		border-color: #cfa64e;
		background: #35260f;
		color: #ffe4a5;
	}

	.desktop-feed {
		margin-top: auto;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(2, 6, 9, 0.55);
	}

	.desktop-feed header {
		display: flex;
		justify-content: space-between;
		padding: 0.7rem 0.8rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		color: #d9b86c;
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.desktop-feed header small {
		color: #737f80;
	}

	.feed-lines {
		padding: 0.65rem 0.8rem;
	}

	.feed-lines p {
		margin: 0;
		padding: 0.35rem 0;
		color: #d8cfbf;
		font:
			0.7rem/1.45 Inter,
			sans-serif;
		opacity: calc(1 - var(--age) * 0.25);
	}

	.feed-lines strong {
		color: #e4bd69;
	}

	.feed-lines p.system {
		color: #8dc4eb;
	}

	.receipt-state {
		margin: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.09);
	}

	.receipt-state div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.58rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}

	.receipt-state dt,
	.receipt-state dd {
		margin: 0;
		font-size: 0.62rem;
	}

	.receipt-state dt {
		color: #7c8989;
	}

	.receipt-state dd {
		color: #ded4c1;
		text-align: right;
	}

	.fixture-note {
		margin: 0;
		padding-left: 0.75rem;
		border-left: 2px solid #bb8544;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 760px) {
		main {
			padding: 3.1rem 0 0;
		}

		.combat-header {
			display: none;
		}

		.combat-shell {
			display: block;
			min-height: calc(100svh - 3.1rem);
			border-inline: 0;
			border-bottom: 0;
		}

		.battlefield {
			min-height: calc(100svh - 3.1rem);
		}

		aside {
			display: none;
		}

		.initiative {
			top: 0.45rem;
			width: 98%;
			padding-inline: 0.2rem;
		}

		.now-marker {
			width: 2.35rem;
		}

		.initiative ol {
			gap: 0.14rem;
		}

		.initiative li span {
			width: clamp(1.55rem, 8.3vw, 2.15rem);
		}

		.beat-status {
			top: 4.7rem;
		}

		.mobile-feed {
			position: absolute;
			z-index: 5;
			left: 0.65rem;
			right: 0.65rem;
			bottom: 6.65rem;
			display: block;
			border: 1px solid rgba(255, 255, 255, 0.1);
			background: rgba(3, 7, 10, 0.82);
			backdrop-filter: blur(8px);
		}

		.feed-lines {
			padding: 0.45rem 0.65rem;
		}

		.feed-lines p {
			padding: 0.18rem 0;
			font-size: clamp(0.55rem, 2.4vw, 0.68rem);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.command-bar {
			left: 0.45rem;
			right: 0.45rem;
			bottom: 0.45rem;
			grid-template-columns: auto 1fr auto;
			gap: 0.35rem;
			padding: 0.4rem;
			border-radius: 1.15rem;
		}

		.ownership {
			gap: 0.1rem;
		}

		.ownership button {
			width: 2.35rem;
			height: 2.35rem;
			font-size: 0.39rem;
		}

		.skills {
			gap: 0.2rem;
		}

		.skills button {
			width: clamp(2.65rem, 13vw, 3.5rem);
			height: clamp(2.65rem, 13vw, 3.5rem);
		}

		.skills i {
			font-size: 1.45rem;
		}

		.skills span {
			display: none;
		}

		.commit {
			min-width: 3.25rem;
			padding-inline: 0.35rem;
			font-size: 0.5rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			transition-duration: 0s !important;
			animation-duration: 0s !important;
		}
	}
</style>
