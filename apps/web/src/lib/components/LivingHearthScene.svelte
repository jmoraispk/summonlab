<script lang="ts">
	import type {
		AuthoritativeEvent,
		SettlementPresentation,
		SettlementSceneDefinition
	} from '@summonlab/contracts';
	import { projectVillageSceneResidents } from '$lib/village-scene';
	import type { VillageResident } from '$lib/village-shell';

	let {
		scene,
		presentation,
		residents,
		eventCue = null
	}: {
		scene: SettlementSceneDefinition;
		presentation: SettlementPresentation;
		residents: readonly VillageResident[];
		eventCue?: AuthoritativeEvent | null;
	} = $props();

	const sceneResidents = $derived(projectVillageSceneResidents(scene, presentation, residents));
	const primaryOccupant = $derived(sceneResidents[0]?.occupant ?? null);
	let unavailableArtHeroIds = $state<ReadonlySet<string>>(new Set());
	const buildingState = $derived(
		new Map(presentation.buildings.map((building) => [building.buildingId, building]))
	);
	const phaseCopy = $derived(
		presentation.dayPhase === 'dawn'
			? 'First light catches on the gate.'
			: presentation.dayPhase === 'day'
				? 'Work carries across the courtyard.'
				: presentation.dayPhase === 'dusk'
					? 'Reserve lamps answer the falling light.'
					: 'The walls keep watch while Hearth 01 sleeps.'
	);

	function markSceneArtUnavailable(heroId: string) {
		unavailableArtHeroIds = new Set([...unavailableArtHeroIds, heroId]);
	}

	function buildingLabel(buildingId: string): string {
		return buildingId
			.replace('summoning-gate', 'Gate')
			.replace('training-ground', 'Training')
			.replace('dormitory', 'Dorm')
			.replace('workshop', 'Forge')
			.replace('kitchen', 'Kitchen');
	}
</script>

<section
	class={`living-scene phase-${presentation.dayPhase}`}
	data-testid="living-settlement"
	data-day-phase={presentation.dayPhase}
	data-hero-pose={primaryOccupant?.pose ?? 'absent'}
	data-event-cursor={presentation.eventCursor}
	aria-label={`Hearth 01 on day ${presentation.dayNumber} at ${presentation.gameTime.slice(11, 16)}, ${primaryOccupant?.activityLabel ?? 'residents absent'}`}
>
	<img
		class="environment"
		src={scene.runtime.publicPath}
		width={scene.runtime.width}
		height={scene.runtime.height}
		decoding="async"
		fetchpriority="high"
		alt=""
	/>
	<div class="phase-grade"></div>
	<div class="sky-life" aria-hidden="true">
		<i class="moon"></i>
		<i class="star star-one"></i><i class="star star-two"></i><i class="star star-three"></i>
	</div>
	<div class="mist mist-one"></div>
	<div class="mist mist-two"></div>

	{#each scene.hotspots as hotspot (hotspot.buildingId)}
		{@const state = buildingState.get(hotspot.buildingId)}
		<div
			class:powered={state?.powerState === 'powered'}
			class:inhabited={(state?.occupantHeroIds.length ?? 0) > 0}
			class="building-aura"
			style={`--x:${hotspot.center.x * 100}%;--y:${hotspot.center.y * 100}%;--w:${hotspot.bounds.width * 100}%;--h:${hotspot.bounds.height * 100}%`}
		></div>
		<div
			class="building-chip"
			style={`--x:${hotspot.center.x * 100}%;--y:${hotspot.center.y * 100}%`}
			data-power={state?.powerState ?? 'unknown'}
		>
			<span>{buildingLabel(hotspot.buildingId)}</span>
			<small>{state?.occupantHeroIds.length ?? 0} here · {state?.powerState ?? 'unknown'}</small>
		</div>
	{/each}

	{#each sceneResidents as sceneResident (sceneResident.occupant.heroId)}
		{@const knownResident = sceneResident.resident}
		{@const showSceneArt =
			knownResident?.sceneArt && !unavailableArtHeroIds.has(sceneResident.occupant.heroId)}
		{#if knownResident}
			<a
				class={`scene-resident pose-${sceneResident.occupant.pose}`}
				style={`--x:${sceneResident.point.x * 100}%;--y:${sceneResident.point.y * 100}%;--cluster-offset:${sceneResident.clusterOffsetRem}rem;--cluster-half:${sceneResident.clusterHalfRem}rem`}
				href={`?mode=residents#resident-${knownResident.heroId}`}
				data-testid="village-scene-resident"
				aria-label={`${sceneResident.label}: ${sceneResident.occupant.activityLabel}. View resident details.`}
			>
				<div class="activity-fx" aria-hidden="true">
					{#if sceneResident.occupant.pose === 'sleep'}<span class="sleep-rune">z</span><span
							class="sleep-rune">z</span
						>{/if}
					{#if sceneResident.occupant.pose === 'eat'}<span class="steam">⌇</span><i class="bowl"
						></i>{/if}
					{#if sceneResident.occupant.pose === 'work'}<span class="spark">✦</span><span
							class="spark">✦</span
						>{/if}
					{#if sceneResident.occupant.pose === 'train'}<i class="arc"></i>{/if}
				</div>
				{#if showSceneArt}
					<img
						class="resident-cutout village-resident-art"
						src={knownResident.sceneArt.publicPath}
						width={knownResident.sceneArt.width}
						height={knownResident.sceneArt.height}
						alt=""
						onerror={() => markSceneArtUnavailable(knownResident.heroId)}
					/>
				{:else}
					<div class="art-pending" aria-hidden="true">Art pending</div>
				{/if}
				<div class="activity-tag">
					<span>{sceneResident.label}</span>
					<strong>{sceneResident.occupant.activityLabel}</strong>
				</div>
			</a>
		{:else}
			<div
				class={`scene-resident unavailable pose-${sceneResident.occupant.pose}`}
				style={`--x:${sceneResident.point.x * 100}%;--y:${sceneResident.point.y * 100}%;--cluster-offset:${sceneResident.clusterOffsetRem}rem;--cluster-half:${sceneResident.clusterHalfRem}rem`}
				data-testid="village-scene-resident"
			>
				<div class="art-pending">{sceneResident.label}</div>
				<div class="activity-tag">
					<span>{sceneResident.label}</span>
					<strong>{sceneResident.occupant.activityLabel}</strong>
				</div>
			</div>
		{/if}
	{/each}

	<div class="time-plaque">
		<p>Hearth 01 · Day {presentation.dayNumber}</p>
		<strong>{presentation.gameTime.slice(11, 16)}</strong>
		<span>{presentation.dayPhase} · {phaseCopy}</span>
	</div>

	<div class="state-seal">
		<span>Authoritative world</span>
		<code>#{presentation.eventCursor} · {presentation.stateHash.slice(0, 9)}</code>
	</div>

	{#if eventCue}
		{#key eventCue.sequence}
			<div class="event-cue">
				<span>World event #{eventCue.sequence}</span>
				<strong>{eventCue.eventType.replaceAll('.', ' ')}</strong>
			</div>
		{/key}
	{/if}

	<div class="occupancy-ledger" aria-label="Settlement occupancy and assignment capacity">
		{#each presentation.buildings as building (building.buildingId)}
			<div class:active={building.occupantHeroIds.length > 0}>
				<span>{buildingLabel(building.buildingId)}</span>
				<strong>{building.occupantHeroIds.length}</strong>
				<small>{building.assignmentCount}/{building.assignmentCapacity} assigned</small>
			</div>
		{/each}
	</div>
</section>

<style>
	.living-scene {
		position: relative;
		isolation: isolate;
		min-height: min(67vw, 46rem);
		overflow: hidden;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		background: #071016;
	}
	.environment,
	.phase-grade,
	.sky-life,
	.mist,
	.building-aura {
		position: absolute;
		inset: 0;
	}
	.environment {
		z-index: -5;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.phase-grade {
		z-index: -4;
		pointer-events: none;
		transition: background 1.4s ease;
	}
	.phase-dawn .phase-grade {
		background:
			linear-gradient(180deg, rgba(120, 82, 123, 0.2), transparent 55%), rgba(12, 37, 49, 0.08);
	}
	.phase-day .phase-grade {
		background:
			linear-gradient(180deg, rgba(102, 172, 181, 0.16), transparent 58%), rgba(227, 193, 128, 0.03);
	}
	.phase-dusk .phase-grade {
		background:
			linear-gradient(180deg, rgba(124, 61, 72, 0.32), transparent 62%), rgba(61, 21, 38, 0.12);
	}
	.phase-night .phase-grade {
		background:
			linear-gradient(180deg, rgba(4, 8, 29, 0.58), rgba(4, 8, 18, 0.28)), rgba(8, 18, 38, 0.18);
		mix-blend-mode: multiply;
	}
	.sky-life {
		z-index: -3;
		pointer-events: none;
	}
	.moon {
		position: absolute;
		top: 5%;
		right: 17%;
		width: clamp(1.8rem, 4vw, 4rem);
		aspect-ratio: 1;
		border-radius: 50%;
		background: #c7e6ea;
		box-shadow: 0 0 3rem rgba(139, 221, 232, 0.48);
		opacity: 0;
		transition: opacity 1s ease;
	}
	.phase-night .moon,
	.phase-dusk .moon {
		opacity: 0.74;
	}
	.star {
		position: absolute;
		width: 0.18rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: white;
		box-shadow: 0 0 0.6rem white;
		opacity: 0;
	}
	.phase-night .star {
		opacity: 0.62;
		animation: twinkle 3s ease-in-out infinite alternate;
	}
	.star-one {
		top: 12%;
		left: 18%;
	}
	.star-two {
		top: 8%;
		left: 73%;
		animation-delay: -1.4s !important;
	}
	.star-three {
		top: 20%;
		left: 84%;
		animation-delay: -2.1s !important;
	}
	.mist {
		z-index: -2;
		top: auto;
		width: 65%;
		height: 21%;
		background: radial-gradient(ellipse, rgba(144, 196, 202, 0.18), transparent 65%);
		filter: blur(1rem);
		animation: drift 16s ease-in-out infinite alternate;
		pointer-events: none;
	}
	.mist-one {
		left: -20%;
		bottom: 3%;
	}
	.mist-two {
		right: -18%;
		bottom: 18%;
		animation-delay: -8s;
	}
	.building-aura {
		z-index: -1;
		left: calc(var(--x) - var(--w) / 2);
		top: calc(var(--y) - var(--h) / 2);
		width: var(--w);
		height: var(--h);
		background: radial-gradient(ellipse, rgba(214, 150, 72, 0.1), transparent 70%);
		opacity: 0.3;
		pointer-events: none;
	}
	.building-aura.inhabited {
		opacity: 0.8;
		animation: lamp 2.8s ease-in-out infinite alternate;
	}
	.building-aura.powered {
		background: radial-gradient(ellipse, rgba(96, 219, 228, 0.26), transparent 68%);
		opacity: 1;
	}
	.building-chip {
		position: absolute;
		z-index: 4;
		left: var(--x);
		top: var(--y);
		display: grid;
		min-width: 5rem;
		padding: 0.38rem 0.48rem;
		border: 1px solid rgba(255, 255, 255, 0.13);
		background: rgba(4, 8, 13, 0.65);
		box-shadow: 0 0.8rem 1.5rem rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(8px);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
	.building-chip[data-power='powered'] {
		border-color: rgba(102, 224, 230, 0.65);
	}
	.building-chip span {
		color: #eee7db;
		font:
			700 0.5rem/1.1 ui-sans-serif,
			sans-serif;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.building-chip small {
		margin-top: 0.2rem;
		color: rgba(238, 231, 219, 0.46);
		font:
			0.42rem ui-monospace,
			monospace;
	}
	.scene-resident {
		position: absolute;
		z-index: 8;
		left: clamp(var(--cluster-half), var(--x), calc(100% - var(--cluster-half)));
		top: var(--y);
		display: flex;
		width: clamp(3.6rem, 8vw, 7.2rem);
		height: clamp(5.2rem, 11vw, 10rem);
		align-items: end;
		justify-content: center;
		color: inherit;
		text-decoration: none;
		transform: translate(calc(-50% + var(--cluster-offset)), -100%);
		transition:
			left 0.8s linear,
			top 0.8s linear;
	}
	.scene-resident:focus-visible {
		z-index: 14;
		outline: 2px solid #e5aa73;
		outline-offset: 0.3rem;
	}
	.resident-cutout {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center bottom;
		filter: drop-shadow(0 0.55rem 0.35rem rgba(0, 0, 0, 0.58));
	}
	.art-pending {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: 1px dashed rgba(213, 170, 89, 0.72);
		color: rgba(242, 207, 135, 0.86);
		background: rgba(5, 8, 12, 0.92);
		box-shadow: 0 0.6rem 1.2rem rgba(0, 0, 0, 0.55);
		font:
			700 0.48rem/1.2 ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-align: center;
		text-transform: uppercase;
	}
	.unavailable .art-pending {
		color: rgba(239, 233, 221, 0.64);
		border-color: rgba(239, 233, 221, 0.36);
	}
	.activity-tag {
		position: absolute;
		left: 50%;
		bottom: -1rem;
		display: grid;
		min-width: 6.5rem;
		padding: 0.35rem 0.45rem;
		border-left: 2px solid #d5aa59;
		background: rgba(4, 7, 11, 0.88);
		box-shadow: 0 0.6rem 1.2rem rgba(0, 0, 0, 0.45);
		transform: translateX(-50%);
	}
	.activity-tag span {
		color: rgba(241, 235, 223, 0.5);
		font:
			0.38rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.activity-tag strong {
		margin-top: 0.08rem;
		color: #f1ebdf;
		font:
			600 0.48rem Georgia,
			serif;
		text-transform: capitalize;
		white-space: nowrap;
	}
	.activity-fx {
		position: absolute;
		z-index: 3;
		inset: 0;
		pointer-events: none;
	}
	.sleep-rune {
		position: absolute;
		top: -10%;
		right: -10%;
		color: #9be6ee;
		font:
			italic 700 0.9rem Georgia,
			serif;
		animation: rise 2s ease-out infinite;
	}
	.sleep-rune + .sleep-rune {
		animation-delay: -1s;
		right: -28%;
	}
	.bowl {
		position: absolute;
		right: -15%;
		bottom: 15%;
		width: 42%;
		height: 18%;
		border: 2px solid #d5aa59;
		border-top: 0;
		border-radius: 0 0 50% 50%;
	}
	.steam {
		position: absolute;
		right: -2%;
		bottom: 35%;
		color: #eee7db;
		animation: rise 1.2s ease-out infinite;
	}
	.spark {
		position: absolute;
		right: -20%;
		top: 36%;
		color: #ffc76b;
		animation: spark 0.8s ease-out infinite;
	}
	.spark + .spark {
		animation-delay: -0.4s;
		right: -5%;
		top: 26%;
	}
	.arc {
		position: absolute;
		left: -25%;
		top: 8%;
		width: 130%;
		height: 80%;
		border: 1px solid rgba(183, 231, 234, 0.75);
		border-left-color: transparent;
		border-bottom-color: transparent;
		border-radius: 50%;
		transform: rotate(22deg);
		animation: arc 1.05s ease-out infinite;
	}
	.time-plaque,
	.state-seal {
		position: absolute;
		z-index: 12;
		top: clamp(1rem, 2.4vw, 2rem);
		padding: 0.75rem 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(3, 7, 12, 0.76);
		backdrop-filter: blur(12px);
	}
	.time-plaque {
		left: clamp(1rem, 2.4vw, 2rem);
	}
	.time-plaque p,
	.time-plaque strong,
	.time-plaque span,
	.state-seal span,
	.state-seal code {
		display: block;
		margin: 0;
	}
	.time-plaque p,
	.state-seal span {
		color: #d5aa59;
		font:
			700 0.48rem ui-sans-serif,
			sans-serif;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.time-plaque strong {
		margin: 0.1rem 0;
		color: #f5f0e7;
		font:
			400 clamp(1.6rem, 3vw, 2.7rem)/1 Georgia,
			serif;
	}
	.time-plaque span {
		max-width: 29ch;
		color: rgba(245, 240, 231, 0.5);
		font:
			0.48rem/1.4 ui-monospace,
			monospace;
		text-transform: capitalize;
	}
	.state-seal {
		right: clamp(1rem, 2.4vw, 2rem);
		text-align: right;
	}
	.state-seal code {
		margin-top: 0.3rem;
		color: #85dbe4;
		font:
			0.5rem ui-monospace,
			monospace;
	}
	.event-cue {
		position: absolute;
		z-index: 20;
		top: 18%;
		left: 50%;
		display: grid;
		width: min(28rem, 70%);
		padding: 0.7rem 0.9rem;
		border: 1px solid rgba(133, 219, 228, 0.4);
		background: rgba(4, 9, 14, 0.9);
		box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.5);
		transform: translateX(-50%);
		animation: event-arrival 4.5s both;
	}
	.event-cue span {
		color: #85dbe4;
		font:
			0.46rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.event-cue strong {
		margin-top: 0.24rem;
		color: #eee7db;
		font:
			400 0.67rem/1.4 Georgia,
			serif;
	}
	.occupancy-ledger {
		position: absolute;
		z-index: 11;
		right: clamp(1rem, 2.4vw, 2rem);
		bottom: clamp(1rem, 2.4vw, 2rem);
		display: grid;
		grid-template-columns: repeat(5, minmax(4.2rem, 1fr));
		border: 1px solid rgba(255, 255, 255, 0.13);
		background: rgba(3, 7, 12, 0.82);
		backdrop-filter: blur(12px);
	}
	.occupancy-ledger div {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.14rem 0.5rem;
		padding: 0.48rem 0.55rem;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}
	.occupancy-ledger div:last-child {
		border: 0;
	}
	.occupancy-ledger div.active {
		background: rgba(213, 170, 89, 0.08);
	}
	.occupancy-ledger span {
		color: rgba(245, 240, 231, 0.58);
		font:
			700 0.4rem ui-sans-serif,
			sans-serif;
		text-transform: uppercase;
	}
	.occupancy-ledger strong {
		color: #85dbe4;
		font:
			0.7rem Georgia,
			serif;
	}
	.occupancy-ledger small {
		grid-column: 1 / -1;
		color: rgba(245, 240, 231, 0.3);
		font:
			0.36rem ui-monospace,
			monospace;
	}

	@keyframes drift {
		to {
			transform: translateX(22%);
		}
	}
	@keyframes twinkle {
		to {
			opacity: 0.16;
			transform: scale(0.5);
		}
	}
	@keyframes lamp {
		to {
			filter: brightness(1.35);
		}
	}
	@keyframes marker-pulse {
		50% {
			box-shadow:
				0 0 0 0.45rem rgba(213, 170, 89, 0.05),
				0 0.6rem 1.2rem rgba(0, 0, 0, 0.55);
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0) scale(0.7);
		}
		50% {
			opacity: 1;
		}
		to {
			opacity: 0;
			transform: translateY(-1.5rem) scale(1.1);
		}
	}
	@keyframes spark {
		from {
			opacity: 1;
			transform: translate(0, 0) scale(1);
		}
		to {
			opacity: 0;
			transform: translate(0.8rem, -0.8rem) scale(0.2);
		}
	}
	@keyframes arc {
		from {
			opacity: 0;
			transform: rotate(5deg) scale(0.8);
		}
		40% {
			opacity: 1;
		}
		to {
			opacity: 0;
			transform: rotate(42deg) scale(1.15);
		}
	}
	@keyframes event-arrival {
		0% {
			opacity: 0;
			transform: translate(-50%, -0.8rem);
		}
		12%,
		78% {
			opacity: 1;
			transform: translate(-50%, 0);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -0.5rem);
			visibility: hidden;
		}
	}

	@media (max-width: 720px) {
		.living-scene {
			min-height: 34rem;
		}
		.environment {
			object-position: 50% 50%;
		}
		.building-chip {
			display: none;
		}
		.occupancy-ledger {
			left: 0.8rem;
			right: 0.8rem;
			grid-template-columns: repeat(5, 1fr);
		}
		.occupancy-ledger div {
			padding: 0.4rem 0.3rem;
		}
		.occupancy-ledger small {
			display: none;
		}
		.state-seal {
			top: auto;
			right: 0.8rem;
			bottom: 4.8rem;
		}
		.time-plaque {
			top: 0.8rem;
			left: 0.8rem;
		}
		.time-plaque span {
			display: none;
		}
		.occupant {
			width: 3.4rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation: none !important;
			transition: none !important;
		}
		.event-cue {
			opacity: 1;
		}
	}
</style>
