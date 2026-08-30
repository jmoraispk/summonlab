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
		type HeroFixture,
		type SpeciesFixture
	} from '$lib/components/living-village/tower/tower-fixtures';
	import {
		simulateHunt,
		type HuntFixtureResult
	} from '$lib/components/living-village/tower/tower-combat';
	import { onMount, tick } from 'svelte';

	let floors = $state(FLOORS.map((floor) => ({ ...floor })));
	let selectedFloorId = $state(FLOORS[2]!.id);
	let selectedSpeciesId = $state<SpeciesFixture['id']>(FLOORS[2]!.speciesIds[0]!);
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
	let selectedSpecies = $derived(speciesById(selectedSpeciesId));
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
	let lowestOpeningMargin = $derived(
		Math.min(
			...selectedParty.map(
				(hero) => hero.maxHealth - (selectedSpecies.baseDamage + selectedFloor.number + 6)
			)
		)
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

	function selectFloor(floor: FloorFixture): void {
		selectedFloorId = floor.id;
		selectedSpeciesId = floor.speciesIds[0]!;
		resetResult();
	}

	function selectSpecies(id: SpeciesFixture['id']): void {
		selectedSpeciesId = id;
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

		deployError = '';
		huntResult = simulateHunt({
			floor: selectedFloor,
			species: selectedSpecies,
			party: selectedParty,
			threshold
		});
		selectedEncounterIndex = 1;
		visibleEventCount = 1;
		playing = !reducedMotion;
		handoff = 'none';
		await tick();
		document.getElementById('hunt-progress')?.scrollIntoView({
			behavior: reducedMotion ? 'auto' : 'smooth',
			block: 'start'
		});
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
	<title>Tower species hunt · Living Village Lab</title>
	<meta
		name="description"
		content="Configure a deterministic Tower species hunt, inspect repeated combat, collect materials, and understand the exact automatic-return reason."
	/>
</svelte:head>

<main>
	<header class="hero">
		<img
			src={towerArtwork}
			alt="Existing Summonlab tower prototype used as a screen fixture"
			width="1536"
			height="768"
		/>
		<div class="hero-veil"></div>
		<div class="hero-copy">
			<div class="wordmark"><span>SUMMONLAB</span><strong>Living Village · Tower Lab</strong></div>
			<p class="eyebrow">Mechanical Floors 01–10 · bounded species hunt</p>
			<h1>Hunt until<br /><em>the margin closes.</em></h1>
			<p class="lede">
				Choose one known species, set the Health line, and inspect exactly why the party returns. No
				story, navigation, discovery, permanent injury, database, or model provider.
			</p>
			<div class="hero-facts">
				<span><strong>{FIXTURE_VERSION}</strong>presentation fixture</span>
				<span><strong>{INVENTORY_CAPACITY}</strong>material capacity</span>
				<span><strong>{ENCOUNTER_CAP}</strong>encounter cap</span>
			</div>
		</div>
		<div class="floor-stamp">
			<span>Selected ground</span><strong>{String(selectedFloor.number).padStart(2, '0')}</strong
			><small>{selectedFloor.name}</small>
		</div>
	</header>

	<div class="content">
		<div class="fixture-notice" data-testid="fixture-version">
			<strong>Transparent presentation fixture</strong>
			<span
				>Seeded, route-local, reproducible. Constants are visible and are not accepted final combat
				or economy math.</span
			>
		</div>

		<FloorSelector {floors} {selectedFloorId} onSelect={selectFloor} />

		<div class="planning-grid">
			<HuntSetup
				floor={selectedFloor}
				species={selectedSpecies}
				{availableSpecies}
				{threshold}
				onSpecies={selectSpecies}
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
		</div>

		<section class="readiness" aria-labelledby="readiness-heading">
			<div>
				<p class="eyebrow">04 · Readiness gate</p>
				<h2 id="readiness-heading">Authorize the bounded hunt</h2>
				<p>
					The {threshold}% rule is checked after an encounter. Before another begins, the fixture
					also stops if upper-bound damage could reduce any hero to 0 Health.
				</p>
			</div>
			<div class="readiness-facts">
				<span
					><small>Lowest opening margin</small><strong
						>{Number.isFinite(lowestOpeningMargin)
							? `${lowestOpeningMargin} Health`
							: 'Party incomplete'}</strong
					></span
				>
				<span><small>Target</small><strong>{selectedSpecies.name}</strong></span>
				<span><small>Return line</small><strong>{threshold}% post-encounter</strong></span>
			</div>
			<button type="button" onclick={deploy}>Deploy species hunt</button>
		</section>

		{#if deployError}
			<div
				id="deploy-error"
				class="deploy-error"
				role="alert"
				tabindex="-1"
				data-testid="deploy-error"
			>
				<strong>Party not ready</strong>
				<span>{deployError}</span>
			</div>
		{/if}

		{#if huntResult && selectedReceipt}
			<section id="hunt-progress" class="hunt-progress" aria-labelledby="progress-title">
				<div>
					<p class="eyebrow">Hunt resolved · deterministic receipt chain</p>
					<h2 id="progress-title">
						{huntResult.encountersCompleted} encounters · {huntResult.speciesKills}
						{selectedSpecies.name} kills
					</h2>
				</div>
				<div>
					<span
						><small>Inventory</small><strong
							>{huntResult.inventoryUsed}/{huntResult.inventoryCapacity}</strong
						></span
					>
					<span><small>Return code</small><strong>{huntResult.returnReason.code}</strong></span>
					<span><small>Hunt ID</small><strong>{huntResult.huntId}</strong></span>
				</div>
			</section>

			<EncounterPresentation
				result={huntResult}
				receipt={selectedReceipt}
				party={selectedParty}
				species={selectedSpecies}
				{visibleEventCount}
				{playing}
				{speed}
				onEncounter={selectEncounter}
				onPlayPause={() => (playing = !playing)}
				onReplay={replayEncounter}
				onSpeed={(value) => (speed = value)}
			/>

			<HuntReport
				result={huntResult}
				floor={selectedFloor}
				species={selectedSpecies}
				party={selectedParty}
				{handoff}
				onVillage={() => setHandoff('village')}
				onTraining={() => setHandoff('training')}
			/>
		{/if}
	</div>
</main>

<style>
	:global(body) {
		background: #080a0e;
	}
	main {
		min-height: 100vh;
		background:
			radial-gradient(circle at 14% 40%, rgba(118, 70, 31, 0.09), transparent 28rem), #080a0e;
		color: #ece5d8;
	}
	.hero {
		position: relative;
		display: grid;
		min-height: min(43rem, 82svh);
		isolation: isolate;
		overflow: hidden;
	}
	.hero > img,
	.hero-veil {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.hero > img {
		z-index: -3;
		object-fit: cover;
		object-position: center 38%;
		filter: saturate(0.65) contrast(1.08) brightness(0.68);
	}
	.hero-veil {
		z-index: -2;
		background:
			linear-gradient(90deg, #08090c 2%, rgba(8, 9, 12, 0.94) 34%, rgba(8, 9, 12, 0.18) 72%),
			linear-gradient(0deg, #080a0e 0%, transparent 42%);
	}
	.hero-copy {
		align-self: center;
		width: min(46rem, calc(100% - 2rem));
		padding: 3rem 0 5rem clamp(1rem, 8vw, 8rem);
	}
	.wordmark {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		margin-bottom: clamp(3rem, 8vh, 6rem);
	}
	.wordmark span {
		padding: 0.35rem 0.45rem;
		border: 1px solid #b27a3e;
		color: #e8b46e;
		font:
			0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.16em;
	}
	.wordmark strong {
		color: #aaa69e;
		font-size: 0.73rem;
		font-weight: 600;
	}
	.eyebrow {
		margin: 0 0 0.6rem;
		color: #d99b54;
		font:
			0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(3.4rem, 7vw, 7rem);
		font-weight: 400;
		line-height: 0.9;
		letter-spacing: -0.055em;
	}
	h1 em {
		color: #e6b671;
		font-weight: 400;
	}
	.lede {
		max-width: 38rem;
		margin: 1.6rem 0 0;
		color: #b4afa6;
		font-family: Georgia, serif;
		font-size: clamp(1rem, 1.5vw, 1.18rem);
		line-height: 1.65;
	}
	.hero-facts {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		margin-top: 2rem;
	}
	.hero-facts span {
		color: #8e8a83;
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	.hero-facts strong {
		display: block;
		max-width: 18rem;
		margin-bottom: 0.25rem;
		color: #e0d7ca;
		font:
			0.7rem ui-monospace,
			monospace;
		text-transform: none;
	}
	.floor-stamp {
		position: absolute;
		right: clamp(1rem, 6vw, 6rem);
		bottom: 4rem;
		padding: 1rem 1.2rem;
		border: 1px solid rgba(222, 176, 109, 0.4);
		background: rgba(8, 9, 12, 0.82);
		text-align: center;
	}
	.floor-stamp span,
	.floor-stamp strong,
	.floor-stamp small {
		display: block;
	}
	.floor-stamp span {
		color: #b49b79;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.floor-stamp strong {
		font-family: Georgia, serif;
		font-size: 3rem;
		font-weight: 400;
		line-height: 1;
	}
	.floor-stamp small {
		color: #a9a49b;
	}
	.content {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		width: min(94rem, calc(100% - 2rem));
		margin: -1rem auto 0;
		padding-bottom: 5rem;
	}
	.content > * {
		min-width: 0;
	}
	.fixture-notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1rem;
		border: 1px solid #6e4e2e;
		background: #241a12;
	}
	.fixture-notice strong {
		color: #e6b671;
	}
	.fixture-notice span {
		color: #aaa298;
		font-size: 0.76rem;
		text-align: right;
	}
	.planning-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}
	.readiness {
		display: grid;
		grid-template-columns: minmax(15rem, 1fr) minmax(20rem, 1.2fr) auto;
		align-items: center;
		gap: 1.5rem;
		padding: clamp(1.25rem, 3vw, 2rem);
		border: 1px solid #745331;
		background: linear-gradient(90deg, #20170f, #111317);
	}
	.readiness h2,
	.hunt-progress h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(1.4rem, 2.4vw, 2rem);
		font-weight: 400;
	}
	.readiness div > p:last-child {
		margin: 0.5rem 0 0;
		color: #9d978f;
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.readiness-facts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}
	.readiness-facts span {
		padding: 0.65rem;
		background: #0d0f12;
	}
	.readiness-facts small,
	.readiness-facts strong {
		display: block;
	}
	.readiness-facts small {
		color: #8e8982;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.readiness-facts strong {
		margin-top: 0.25rem;
		font-size: 0.73rem;
	}
	.readiness > button {
		min-height: 3.5rem;
		padding: 0.8rem 1.2rem;
		border: 1px solid #e6b671;
		background: #d99b54;
		color: #1a1006;
		font-weight: 800;
		cursor: pointer;
	}
	.deploy-error {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid #d57d68;
		background: #311915;
	}
	.deploy-error strong {
		color: #ffb2a0;
	}
	.deploy-error span {
		color: #dbc1bb;
	}
	.hunt-progress {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.2rem;
		border: 1px solid #3e4c4b;
		background: #11191a;
		scroll-margin-top: 1rem;
	}
	.hunt-progress > div:last-child {
		display: flex;
		gap: 0.6rem;
	}
	.hunt-progress span {
		min-width: 8rem;
		padding: 0.6rem;
		background: #0a0e10;
	}
	.hunt-progress small,
	.hunt-progress strong {
		display: block;
	}
	.hunt-progress small {
		color: #779391;
		font-size: 0.6rem;
		text-transform: uppercase;
	}
	.hunt-progress strong {
		margin-top: 0.2rem;
		font:
			0.7rem ui-monospace,
			monospace;
	}
	@media (max-width: 1080px) {
		.planning-grid,
		.readiness {
			grid-template-columns: 1fr;
		}
		.readiness > button {
			width: 100%;
		}
	}
	@media (max-width: 760px) {
		.hero {
			min-height: 44rem;
		}
		.hero-copy {
			align-self: end;
			padding: 3rem 0 8rem;
		}
		.wordmark {
			margin-bottom: 2.5rem;
		}
		h1 {
			font-size: clamp(3.1rem, 15vw, 4.7rem);
		}
		.floor-stamp {
			right: 1rem;
			bottom: 1rem;
		}
		.content {
			width: min(100% - 1rem, 94rem);
		}
		.fixture-notice,
		.hunt-progress {
			display: block;
		}
		.fixture-notice span {
			display: block;
			margin-top: 0.35rem;
			text-align: left;
		}
		.readiness-facts {
			grid-template-columns: 1fr;
		}
		.hunt-progress > div:last-child {
			display: grid;
			margin-top: 0.8rem;
		}
		.deploy-error {
			display: block;
		}
		.deploy-error span {
			display: block;
			margin-top: 0.3rem;
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
