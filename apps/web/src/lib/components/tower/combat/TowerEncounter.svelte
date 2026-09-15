<script lang="ts">
	import type {
		ExplorationCombatReceipt,
		ExplorationCombatRejection,
		ExplorationEncounterRequest
	} from '@summonlab/contracts';

	import {
		TOWER_COMBAT_CLAIM_POLICY,
		TOWER_COMBAT_CLAIM_POLICY_BINDING
	} from '$lib/tower-combat-policy';
	import { TOWER_COMBAT_CONTENT_CATALOG } from '$lib/tower-combat-content';

	import RealtimeCombatStage from './automated/RealtimeCombatStage.svelte';
	import {
		CombatSessionRegistry,
		type CombatReplayVerification,
		type CombatUnavailableState
	} from './automated/combat-session';
	import type { RealtimeCombatState } from './automated/realtime-combat';

	let {
		floorName,
		positionTileId,
		encounterRequest,
		onComplete,
		busy = false
	}: {
		floorName: string;
		positionTileId: string;
		encounterRequest: ExplorationEncounterRequest;
		onComplete: (receipt: ExplorationCombatReceipt) => Promise<boolean>;
		busy?: boolean;
	} = $props();

	const registry = new CombatSessionRegistry();
	let started = $state(false);
	let paused = $state(false);
	let settling = $state(false);
	let snapshot = $state<RealtimeCombatState | null>(null);
	let rejection = $state<ExplorationCombatRejection | null>(null);
	let unavailable = $state<CombatUnavailableState | null>(null);
	let replayVerification = $state<CombatReplayVerification | null>(null);
	let pendingReceipt = $state<ExplorationCombatReceipt | null>(null);
	const reducedMotion = $derived(
		typeof document !== 'undefined' &&
			(document.documentElement.dataset.playerMotion === 'reduced' ||
				window.matchMedia('(prefers-reduced-motion: reduce)').matches)
	);

	async function finish(receipt: ExplorationCombatReceipt) {
		if (settling) return;
		settling = true;
		paused = true;
		pendingReceipt = receipt;
		try {
			if (await onComplete(receipt)) pendingReceipt = null;
		} finally {
			settling = false;
		}
	}
</script>

<section class="encounter" aria-labelledby="encounter-title">
	<div class="battlefield">
		{#if started}
			<RealtimeCombatStage
				request={encounterRequest}
				claimPolicy={TOWER_COMBAT_CLAIM_POLICY}
				claimPolicyBinding={TOWER_COMBAT_CLAIM_POLICY_BINDING}
				contentCatalog={TOWER_COMBAT_CONTENT_CATALOG}
				{registry}
				mode="2.5d-v2"
				{paused}
				{reducedMotion}
				onSnapshot={(next) => (snapshot = next)}
				onComplete={(receipt) => void finish(receipt)}
				onRejected={(next) => (rejection = next)}
				onUnavailable={(next) => (unavailable = next)}
				onReplayVerified={(next) => (replayVerification = next)}
			/>
		{:else}
			<div class="briefing">
				<p>Automated encounter · {positionTileId}</p>
				<h1 id="encounter-title">Opposition in {floorName}</h1>
				<p class="summary">
					Your summoned company will move, choose targets, attack, and resolve this fight from its
					current policy. The result is the same canonical encounter used by every presentation.
				</p>
				<ul aria-label="Expedition party">
					{#each encounterRequest.party as hero (hero.heroRef.heroId)}
						<li>{hero.displayName}</li>
					{/each}
				</ul>
				<button type="button" disabled={busy} onclick={() => (started = true)}>
					Start automated fight
				</button>
			</div>
		{/if}
		{#if started}
			<div class="combat-hud">
				<div>
					<p>Automated combat</p>
					<strong>{snapshot?.lastEvent ?? 'Loading approved combat assets…'}</strong>
				</div>
				<button
					type="button"
					disabled={settling || Boolean(rejection || unavailable)}
					onclick={() => (paused = !paused)}
				>
					{paused ? 'Resume' : 'Pause'}
				</button>
			</div>
		{/if}
	</div>
	<aside>
		<p>Encounter record</p>
		<h2>
			{settling ? 'Recording result' : snapshot?.phase === 'victory' ? 'Victory' : 'In progress'}
		</h2>
		<dl>
			<div>
				<dt>Heroes</dt>
				<dd>{encounterRequest.party.length}</dd>
			</div>
			<div>
				<dt>Enemies</dt>
				<dd>{encounterRequest.enemies.length}</dd>
			</div>
			<div>
				<dt>Defeated</dt>
				<dd>{snapshot?.defeatedEnemies ?? 0}</dd>
			</div>
		</dl>
		<p class="explain">
			Movement and attacks are automatic. The server replays and verifies the completed receipt
			before the expedition can continue.
		</p>
		{#if rejection}<p class="failure" role="alert">{rejection.summary}</p>{/if}
		{#if unavailable}<p class="failure" role="alert">{unavailable.message}</p>{/if}
		{#if replayVerification?.kind === 'mismatch'}
			<p class="failure" role="alert">Replay verification failed.</p>
		{/if}
		{#if pendingReceipt && !settling}
			<button type="button" onclick={() => void finish(pendingReceipt!)}
				>Retry recording result</button
			>
		{/if}
	</aside>
</section>

<style>
	.encounter {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 25rem);
		min-height: calc(100vh - 7rem);
		background: #080a0e;
		color: #eee8dd;
	}
	.battlefield {
		position: relative;
		min-height: 42rem;
		overflow: hidden;
		background: #05090e;
	}
	.briefing {
		display: grid;
		min-height: inherit;
		align-content: end;
		padding: clamp(2rem, 6vw, 6rem);
		background:
			linear-gradient(#07101a88, #12100ecc),
			url('/runtime/combat/realtime-study-v1/ruined-threshold-environment-v1.png') center / cover;
	}
	p {
		color: #d99b55;
		font:
			700 0.7rem/1.5 ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	h1,
	h2 {
		font-family: Georgia, serif;
		font-weight: 400;
	}
	h1 {
		max-width: 48rem;
		margin: 0.25rem 0 1rem;
		font-size: clamp(2.5rem, 6vw, 6rem);
		line-height: 0.95;
	}
	.summary,
	.explain {
		max-width: 42rem;
		color: #eee8ddaa;
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 400;
		line-height: 1.6;
		letter-spacing: 0;
		text-transform: none;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		padding: 0;
		list-style: none;
	}
	li {
		padding: 0.4rem 0.65rem;
		border: 1px solid #d99b5555;
		background: #080a0ecc;
	}
	button {
		width: fit-content;
		padding: 0.8rem 1rem;
		border: 1px solid #e59a4b;
		background: #693119;
		color: #fff0de;
		cursor: pointer;
	}
	button:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 3px;
	}
	.combat-hud {
		position: absolute;
		z-index: 10;
		top: 1rem;
		left: 1rem;
		right: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 1rem;
		border: 1px solid #d99b5544;
		background: #06090cdd;
	}
	.combat-hud p {
		margin: 0;
	}
	.combat-hud strong {
		font-size: 0.8rem;
	}
	.combat-hud button {
		background: #101820;
	}
	aside {
		padding: clamp(1.5rem, 4vw, 3rem);
		border-left: 1px solid #d99b5533;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}
	dl div {
		padding: 0.7rem;
		border: 1px solid #d99b5533;
	}
	dt {
		color: #eee8dd88;
		font-size: 0.65rem;
	}
	dd {
		margin: 0.25rem 0 0;
		font:
			1.3rem Georgia,
			serif;
	}
	.failure {
		padding: 0.75rem;
		border: 1px solid #d9624c;
		background: #2c100d;
		color: #ffd6ce;
		letter-spacing: 0;
		text-transform: none;
	}
	@media (max-width: 750px) {
		.encounter {
			grid-template-columns: 1fr;
			padding-bottom: 7rem;
		}
		.battlefield {
			min-height: 36rem;
		}
		aside {
			border-top: 1px solid #d99b5533;
			border-left: 0;
		}
	}
</style>
