<script lang="ts">
	import towerArtwork from '../../../../../../assets/tower-prototype.png';
	import EncounterPresentation from '$lib/components/living-village/tower/EncounterPresentation.svelte';
	import FloorSelector from '$lib/components/living-village/tower/FloorSelector.svelte';
	import HuntReport from '$lib/components/living-village/tower/HuntReport.svelte';
	import HuntSetup from '$lib/components/living-village/tower/HuntSetup.svelte';
	import PartyReadiness from '$lib/components/living-village/tower/PartyReadiness.svelte';
	import {
		ENCOUNTER_CAP,
		FIXTURE_VERSION,
		FLOORS,
		HEROES,
		INVENTORY_CAPACITY,
		speciesById,
		type Availability,
		type FloorFixture,
		type HealthThreshold,
		type HeroFixture
	} from '$lib/components/living-village/tower/tower-fixtures';
	import {
		simulateHunt,
		type HuntFixtureResult
	} from '$lib/components/living-village/tower/tower-combat';
	import { onMount, tick } from 'svelte';

	type TowerScreen = 'prepare' | 'hunt' | 'haul';

	let floors = $state(FLOORS.map((floor) => ({ ...floor })));
	let screen = $state<TowerScreen>('prepare');
	let selectedFloorId = $state(FLOORS[2]!.id);
	let threshold = $state<HealthThreshold>(50);
	let activeHeroIds = $state<HeroFixture['id'][]>(HEROES.map((hero) => hero.id));
	let availability = $state<Record<HeroFixture['id'], Availability>>({
		'dara-zev': 'idle',
		'mara-vey': 'idle',
		'jori-daro': 'idle'
	});
	let deployError = $state('');
	let huntResult = $state<HuntFixtureResult | null>(null);
	let selectedEncounterIndex = $state(1);
	let visibleEventCount = $state(1);
	let playing = $state(false);
	let speed = $state(1);
	let reducedMotion = $state(false);
	let handoff = $state<'none' | 'village' | 'training'>('none');

	let selectedFloor = $derived(floors.find((floor) => floor.id === selectedFloorId)!);
	let availableSpecies = $derived(selectedFloor.speciesIds.map(speciesById));
	let selectedParty = $derived(
		HEROES.filter((hero) => activeHeroIds.includes(hero.id)).map((hero) => ({
			...hero,
			availability: availability[hero.id]
		}))
	);
	let selectedReceipt = $derived(
		huntResult?.combatReceipts.find(
			(receipt) => receipt.encounterIndex === selectedEncounterIndex
		) ?? huntResult?.combatReceipts[0]
	);
	let selectedReceiptSpecies = $derived(
		speciesById(selectedReceipt?.encounterRef.speciesId ?? availableSpecies[0]!.id)
	);
	let partyReady = $derived(
		selectedParty.length === 3 && selectedParty.every((hero) => hero.availability === 'idle')
	);

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => {
			reducedMotion = media.matches;
			if (media.matches) playing = false;
		};
		sync();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	});

	$effect(() => {
		const receipt = selectedReceipt;
		if (!playing || !receipt || visibleEventCount >= receipt.events.length) return;
		const timer = window.setTimeout(
			() => {
				visibleEventCount = Math.min(visibleEventCount + 1, receipt.events.length);
			},
			Math.round(760 / speed)
		);
		return () => window.clearTimeout(timer);
	});

	$effect(() => {
		if (selectedReceipt && visibleEventCount >= selectedReceipt.events.length && playing) {
			playing = false;
		}
	});

	async function changeScreen(next: TowerScreen): Promise<void> {
		screen = next;
		deployError = '';
		await tick();
		document.querySelector<HTMLElement>('[data-screen-scroll]')?.scrollTo({ top: 0 });
		document.getElementById(`screen-${next}-heading`)?.focus();
	}

	function selectFloor(floor: FloorFixture): void {
		selectedFloorId = floor.id;
		resetResult();
	}

	function resetResult(): void {
		huntResult = null;
		selectedEncounterIndex = 1;
		visibleEventCount = 1;
		playing = false;
		handoff = 'none';
		deployError = '';
	}

	function toggleMember(id: HeroFixture['id']): void {
		activeHeroIds = activeHeroIds.includes(id)
			? activeHeroIds.filter((candidate) => candidate !== id)
			: [...activeHeroIds, id];
		resetResult();
	}

	function toggleAvailability(id: HeroFixture['id']): void {
		availability[id] = availability[id] === 'idle' ? 'training' : 'idle';
		resetResult();
	}

	async function showDeployError(message: string): Promise<void> {
		deployError = message;
		await tick();
		document.getElementById('deploy-error')?.focus();
	}

	async function deploy(): Promise<void> {
		if (selectedFloor.state === 'locked') {
			await showDeployError(
				`Floor ${selectedFloor.number} is locked. Clear the preceding floor first.`
			);
			return;
		}
		if (selectedParty.length !== 3) {
			await showDeployError(
				`Deployment rejected: ${selectedParty.length}/3 party slots are filled.`
			);
			return;
		}
		const unavailable = selectedParty.find((hero) => availability[hero.id] !== 'idle');
		if (unavailable) {
			await showDeployError(
				`Deployment rejected: ${unavailable.name} is ${availability[unavailable.id]}. Recall every hero to idle first.`
			);
			return;
		}

		huntResult = simulateHunt({
			floor: selectedFloor,
			speciesPool: availableSpecies,
			party: selectedParty,
			threshold
		});
		selectedEncounterIndex = 1;
		visibleEventCount = 1;
		playing = !reducedMotion;
		handoff = 'none';
		await changeScreen('hunt');
	}

	function selectEncounter(encounterIndex: number): void {
		selectedEncounterIndex = encounterIndex;
		visibleEventCount = 1;
		playing = !reducedMotion;
	}

	function replayEncounter(): void {
		visibleEventCount = 1;
		playing = !reducedMotion;
	}

	function setHandoff(value: 'village' | 'training'): void {
		handoff = value;
		tick().then(() =>
			document.querySelector<HTMLElement>('[data-testid="return-handoff"]')?.focus()
		);
	}
</script>

<svelte:head>
	<title>Tower floor exploration · Living Village Lab</title>
	<meta name="description" content="Choose a Tower floor and safely explore its encounters." />
</svelte:head>

<main>
	<header class="app-bar">
		<div class="brand">
			<span class="mark">S</span>
			<div><strong>Tower Expedition</strong><small>Living Village Lab</small></div>
		</div>
		<div class="current-order" aria-label="Current floor exploration">
			<img src={towerArtwork} alt="" />
			<div><small>Floor {selectedFloor.number}</small><strong>{selectedFloor.name}</strong></div>
			<span>{threshold}% return</span>
		</div>
	</header>

	<nav class="screen-tabs" aria-label="Tower exploration screens">
		<button
			class:active={screen === 'prepare'}
			aria-current={screen === 'prepare' ? 'step' : undefined}
			onclick={() => changeScreen('prepare')}
			><span>1</span><strong>Prepare</strong><small>Floor · Health · Party</small></button
		>
		<button
			class:active={screen === 'hunt'}
			aria-current={screen === 'hunt' ? 'step' : undefined}
			disabled={!huntResult}
			onclick={() => changeScreen('hunt')}
			><span>2</span><strong>Explore</strong><small
				>{huntResult ? `${huntResult.encountersCompleted} encounters` : 'Deploy first'}</small
			></button
		>
		<button
			class:active={screen === 'haul'}
			aria-current={screen === 'haul' ? 'step' : undefined}
			disabled={!huntResult}
			onclick={() => changeScreen('haul')}
			><span>3</span><strong>Haul</strong><small
				>{huntResult ? huntResult.returnReason.code : 'Awaiting return'}</small
			></button
		>
	</nav>

	{#if screen === 'prepare'}
		<section class="screen-shell" aria-labelledby="screen-prepare-heading">
			<header class="screen-heading">
				<div>
					<p>01 · Prepare the expedition</p>
					<h1 id="screen-prepare-heading" tabindex="-1">Choose a floor and return point</h1>
				</div>
				<div class="fixture-chip" data-testid="fixture-version">
					<strong>Presentation fixture</strong><span
						>{FIXTURE_VERSION} · not accepted final combat math</span
					>
				</div>
			</header>
			<div class="screen-scroll" data-screen-scroll>
				<FloorSelector {floors} {selectedFloorId} onSelect={selectFloor} />
				<HuntSetup
					floor={selectedFloor}
					{availableSpecies}
					{threshold}
					onThreshold={(value) => {
						threshold = value;
						resetResult();
					}}
				/>
				<PartyReadiness
					heroes={HEROES}
					{activeHeroIds}
					{availability}
					onToggleMember={toggleMember}
					onToggleAvailability={toggleAvailability}
				/>
				{#if deployError}<div
						id="deploy-error"
						class="deploy-error"
						role="alert"
						tabindex="-1"
						data-testid="deploy-error"
					>
						<strong>Cannot deploy</strong><span>{deployError}</span>
					</div>{/if}
			</div>
			<footer class="command-bar">
				<div class="deploy-summary">
					<small
						>Floor {selectedFloor.number} · return at {threshold}% · {activeHeroIds.length}/3 heroes</small
					><strong
						>{partyReady
							? `${availableSpecies.length} possible monsters · party ready`
							: 'Resolve party warning'}</strong
					>
				</div>
				<button class="primary" type="button" onclick={deploy}
					>Explore Floor {selectedFloor.number} <span aria-hidden="true">→</span></button
				>
			</footer>
		</section>
	{:else if screen === 'hunt' && huntResult && selectedReceipt}
		<section class="screen-shell" aria-labelledby="screen-hunt-heading">
			<header class="screen-heading hunt-heading">
				<div>
					<p>02 · Floor exploration</p>
					<h1 id="screen-hunt-heading" tabindex="-1">
						{huntResult.encountersCompleted} encounters resolved
					</h1>
				</div>
				<div class="hunt-stats">
					<span><small>Kills</small><strong>{huntResult.speciesKills}</strong></span><span
						><small>Bag</small><strong>{huntResult.inventoryUsed}/{INVENTORY_CAPACITY}</strong
						></span
					><span><small>Return</small><strong>{huntResult.returnReason.code}</strong></span>
				</div>
			</header>
			<div class="screen-scroll" data-screen-scroll>
				<EncounterPresentation
					result={huntResult}
					receipt={selectedReceipt}
					party={selectedParty}
					species={selectedReceiptSpecies}
					{visibleEventCount}
					{playing}
					{speed}
					onEncounter={selectEncounter}
					onPlayPause={() => (playing = !playing)}
					onReplay={replayEncounter}
					onSpeed={(value) => (speed = value)}
				/>
			</div>
			<footer class="command-bar">
				<button
					class="secondary"
					type="button"
					onclick={() => {
						resetResult();
						changeScreen('prepare');
					}}>Edit floor</button
				>
				<div>
					<small>Exact stop reason</small><strong>{huntResult.returnReason.summary}</strong>
				</div>
				<button class="primary" type="button" onclick={() => changeScreen('haul')}
					>View haul <span aria-hidden="true">→</span></button
				>
			</footer>
		</section>
	{:else if screen === 'haul' && huntResult}
		<section class="screen-shell haul-screen" aria-labelledby="screen-haul-heading">
			<header class="screen-heading">
				<div>
					<p>03 · Returned safely</p>
					<h1 id="screen-haul-heading" tabindex="-1">Exploration complete</h1>
				</div>
				<div class="readiness-chip ready">
					<span aria-hidden="true">✓</span><strong>Haul secured</strong>
				</div>
			</header>
			<div class="screen-scroll" data-screen-scroll>
				<HuntReport
					result={huntResult}
					floor={selectedFloor}
					party={selectedParty}
					{handoff}
					onVillage={() => setHandoff('village')}
					onTraining={() => setHandoff('training')}
				/>
			</div>
		</section>
	{/if}

	<div class="fixture-footer">
		<span>Seeded route-local fixture</span><span>{ENCOUNTER_CAP} encounter cap</span><span
			>{INVENTORY_CAPACITY} material capacity</span
		>
	</div>
</main>

<style>
	:global(html),
	:global(body) {
		overflow: hidden;
		background: #07090c;
	}
	:global(button:focus-visible),
	:global(input:focus-visible),
	:global([tabindex='-1']:focus-visible) {
		outline: 3px solid #ffd28c;
		outline-offset: 3px;
	}
	main {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		height: 100dvh;
		overflow: hidden;
		background: radial-gradient(circle at 76% 20%, #19212b 0, #090b0f 40%, #07090c 75%);
		color: #ece5d8;
	}
	.app-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 4.25rem;
		padding: 0.65rem clamp(0.75rem, 3vw, 2rem);
		border-bottom: 1px solid #332b22;
		background: rgba(7, 9, 12, 0.97);
	}
	.brand,
	.current-order,
	.current-order > div {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.mark {
		display: grid;
		width: 2.4rem;
		height: 2.4rem;
		place-items: center;
		border: 1px solid #c48847;
		color: #efb767;
		font:
			700 1rem Georgia,
			serif;
	}
	.brand strong,
	.brand small,
	.current-order strong,
	.current-order small {
		display: block;
	}
	.brand strong {
		font:
			400 1.15rem Georgia,
			serif;
	}
	.brand small,
	.current-order small {
		color: #89857e;
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	.current-order img {
		width: 2.7rem;
		height: 2.7rem;
		object-fit: cover;
		border-radius: 50%;
		filter: saturate(0.6);
	}
	.current-order > span {
		padding: 0.45rem 0.65rem;
		border: 1px solid #65492f;
		color: #e4b370;
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	.screen-tabs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-bottom: 1px solid #332f29;
		background: #0d0f12;
	}
	.screen-tabs button {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0 0.55rem;
		align-items: center;
		min-width: 0;
		min-height: 3.6rem;
		padding: 0.55rem clamp(0.55rem, 2vw, 1rem);
		border: 0;
		border-right: 1px solid #2c2c2d;
		background: #101216;
		color: #9c9890;
		text-align: left;
		cursor: pointer;
	}
	.screen-tabs button.active {
		background: #2c2116;
		color: #f2e6d4;
		box-shadow: inset 0 -3px #e8a652;
	}
	.screen-tabs button:disabled {
		color: #575755;
		cursor: not-allowed;
	}
	.screen-tabs button > span {
		grid-row: 1 / 3;
		display: grid;
		width: 1.7rem;
		height: 1.7rem;
		place-items: center;
		border: 1px solid currentColor;
		border-radius: 50%;
		font-size: 0.7rem;
	}
	.screen-tabs strong,
	.screen-tabs small {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.screen-tabs strong {
		font-size: 0.76rem;
	}
	.screen-tabs small {
		color: #74716c;
		font-size: 0.6rem;
	}
	.screen-shell {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		min-width: 0;
		min-height: 0;
		width: min(88rem, 100%);
		margin: 0 auto;
		background: rgba(8, 10, 13, 0.96);
	}
	.screen-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem clamp(0.75rem, 2.5vw, 1.5rem);
		border-bottom: 1px solid #2c2b28;
	}
	.screen-heading p {
		margin: 0 0 0.2rem;
		color: #d99b54;
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.screen-heading h1 {
		margin: 0;
		font:
			400 clamp(1.45rem, 3vw, 2.2rem) Georgia,
			serif;
	}
	.fixture-chip,
	.readiness-chip {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid #62472d;
		background: #21180f;
	}
	.fixture-chip strong,
	.fixture-chip span {
		display: block;
	}
	.fixture-chip strong {
		color: #e0a85d;
		font-size: 0.7rem;
		text-transform: uppercase;
	}
	.fixture-chip span {
		color: #8f8980;
		font-size: 0.63rem;
	}
	.readiness-chip > span {
		display: grid;
		width: 1.8rem;
		height: 1.8rem;
		place-items: center;
		border-radius: 50%;
		background: #7a392f;
		font-weight: 900;
	}
	.readiness-chip.ready {
		border-color: #477451;
		background: #112217;
	}
	.readiness-chip.ready > span {
		background: #4b9b5f;
	}
	.screen-scroll {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 0.75rem;
		min-width: 0;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
		scrollbar-color: #9b6a39 #15171a;
	}
	.screen-scroll > * {
		min-width: 0;
	}
	.command-bar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		min-height: 4.7rem;
		padding: 0.65rem clamp(0.75rem, 2.5vw, 1.5rem);
		border-top: 1px solid #45382a;
		background: #111317;
		box-shadow: 0 -0.75rem 2rem rgba(0, 0, 0, 0.35);
	}
	.command-bar > div {
		min-width: 0;
		margin-right: auto;
	}
	.command-bar small,
	.command-bar strong {
		display: block;
	}
	.command-bar small {
		color: #938d84;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.command-bar strong {
		max-width: 44rem;
		overflow: hidden;
		font-size: 0.76rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.command-bar button {
		min-height: 2.9rem;
		padding: 0.65rem 1rem;
		border: 1px solid #5a554e;
		background: #1b1d21;
		color: #eee5d8;
		font-weight: 750;
		white-space: nowrap;
		cursor: pointer;
	}
	.command-bar button.primary {
		border-color: #e8ad63;
		background: #dda052;
		color: #180f05;
	}
	.deploy-error {
		display: flex;
		gap: 0.7rem;
		padding: 0.8rem;
		border: 1px solid #d57d68;
		background: #311915;
	}
	.deploy-error strong {
		color: #ffb2a0;
	}
	.deploy-summary {
		text-align: right;
	}
	.hunt-stats {
		display: flex;
		gap: 0.45rem;
	}
	.hunt-stats span {
		min-width: 5rem;
		padding: 0.4rem 0.55rem;
		background: #11161a;
	}
	.hunt-stats small,
	.hunt-stats strong {
		display: block;
	}
	.hunt-stats small {
		color: #7f8e8c;
		font-size: 0.57rem;
		text-transform: uppercase;
	}
	.hunt-stats strong {
		margin-top: 0.15rem;
		font:
			0.65rem ui-monospace,
			monospace;
	}
	.haul-screen {
		grid-template-rows: auto minmax(0, 1fr);
	}
	.fixture-footer {
		display: flex;
		justify-content: center;
		gap: 1.2rem;
		padding: 0.28rem 0.75rem;
		border-top: 1px solid #2d2924;
		background: #090b0d;
		color: #625f5a;
		font:
			0.55rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	@media (max-width: 700px) {
		.app-bar {
			min-height: 3.5rem;
		}
		.current-order img,
		.current-order > div,
		.current-order > span {
			display: none;
		}
		.screen-tabs button {
			display: flex;
			justify-content: center;
			min-height: 3rem;
			padding: 0.4rem;
			text-align: center;
		}
		.screen-tabs button > span,
		.screen-tabs small {
			display: none;
		}
		.screen-tabs strong {
			font-size: 0.68rem;
		}
		.screen-heading {
			min-height: 3.8rem;
			padding: 0.55rem 0.75rem;
		}
		.screen-heading p {
			font-size: 0.54rem;
		}
		.screen-heading h1 {
			font-size: 1.35rem;
		}
		.hunt-heading {
			display: grid;
			grid-template-columns: 1fr;
			gap: 0.45rem;
		}
		.hunt-heading > div:first-child {
			display: flex;
			align-items: baseline;
			gap: 0.6rem;
		}
		.hunt-heading > div:first-child p {
			display: none;
		}
		.hunt-heading > div:first-child h1 {
			font-size: 1.15rem;
		}
		.hunt-stats {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
		}
		.fixture-chip span,
		.readiness-chip strong {
			display: none;
		}
		.fixture-chip {
			padding: 0.4rem 0.5rem;
		}
		.readiness-chip {
			padding: 0;
			border: 0;
			background: transparent;
		}
		.screen-scroll {
			padding: 0.5rem;
		}
		.command-bar {
			min-height: 4.3rem;
			padding: 0.5rem;
		}
		.command-bar > div:not(.deploy-summary) {
			display: none;
		}
		.command-bar .deploy-summary {
			display: block;
			margin-right: auto;
			text-align: left;
		}
		.command-bar button {
			min-height: 3.15rem;
			padding: 0.6rem 0.75rem;
		}
		.command-bar button.primary {
			flex: 1;
		}
		.fixture-footer {
			display: none;
		}
		main {
			grid-template-rows: auto auto minmax(0, 1fr);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
			transition: none !important;
			animation: none !important;
		}
	}
</style>
