<script lang="ts">
	import type { TowerCombatMode } from '$lib/server/tower-encounter';

	let {
		floorName,
		positionTileId,
		onResolve,
		busy = false
	}: {
		floorName: string;
		positionTileId: string;
		onResolve: (mode: TowerCombatMode) => void | Promise<void>;
		busy?: boolean;
	} = $props();
	let mode = $state<TowerCombatMode>('turn-based');
</script>

<section class="encounter" aria-labelledby="encounter-title">
	<div class:automated={mode === 'automated'} class="battlefield">
		<p>Encounter · {positionTileId}</p>
		<h1 id="encounter-title">Opposition in {floorName}</h1>
		<div class="silhouettes" aria-label="Approved combat art pending canonical binding">
			<span>Approved combat presentation loads from the encounter binding.</span>
		</div>
	</div>
	<aside>
		<p>Control mode</p>
		<div class="modes">
			<button
				class:active={mode === 'turn-based'}
				type="button"
				onclick={() => (mode = 'turn-based')}>Turn-based</button
			>
			<button class:active={mode === 'automated'} type="button" onclick={() => (mode = 'automated')}
				>Automated</button
			>
		</div>
		<h2>
			{mode === 'turn-based'
				? 'Issue the company’s orders'
				: 'Let company policy resolve the fight'}
		</h2>
		<p class="explain">
			Both presentations use the same active encounter, legal rules, result, and receipt. Switching
			modes cannot create a second fight.
		</p>
		<button class="resolve" type="button" disabled={busy} onclick={() => onResolve(mode)}>
			{mode === 'turn-based' ? 'Resolve turn' : 'Run encounter'}
		</button>
	</aside>
</section>

<style>
	.encounter {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 27rem);
		min-height: calc(100vh - 7rem);
		background: #080a0e;
		color: #eee8dd;
	}
	.battlefield {
		display: grid;
		align-content: end;
		padding: clamp(2rem, 6vw, 6rem);
		background:
			linear-gradient(#07101aaa, #12100e99),
			url('/runtime/combat/observatory-art-pilot-v1/observatory-empty-v1.png') center / cover;
	}
	.battlefield.automated {
		background:
			linear-gradient(#07101a88, #12100eaa),
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
		font-size: clamp(2.5rem, 6vw, 6rem);
		line-height: 0.95;
	}
	.silhouettes {
		display: grid;
		min-height: 13rem;
		place-items: center;
		border: 1px dashed #d99b5544;
		color: #eee8dd77;
		text-align: center;
	}
	aside {
		padding: clamp(1.5rem, 4vw, 3rem);
		border-left: 1px solid #d99b5533;
	}
	.modes {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.modes button,
	.resolve {
		padding: 0.8rem;
		border: 1px solid #d99b5555;
		background: #111;
		color: #eee8dd;
		cursor: pointer;
	}
	.modes button.active {
		background: #342113;
		border-color: #d99b55;
	}
	.explain {
		color: #eee8dd88;
		text-transform: none;
		letter-spacing: 0;
	}
	.resolve {
		width: 100%;
		margin-top: 1rem;
		background: #693119;
		border-color: #e59a4b;
	}
	@media (max-width: 650px) {
		.encounter {
			grid-template-columns: 1fr;
			padding-bottom: 7rem;
		}
		aside {
			border-left: 0;
			border-top: 1px solid #d99b5533;
		}
	}
</style>
