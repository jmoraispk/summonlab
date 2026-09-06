<script lang="ts">
	import type {
		AuthoritativeEvent,
		CharacterManifest,
		NormalizedScenePoint,
		SettlementPresentation,
		SettlementSceneDefinition
	} from '@summonlab/contracts';
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { VillageResident } from '$lib/village-shell';

	let {
		scene,
		presentation,
		manifest,
		residents = [],
		eventCue = null
	}: {
		scene: SettlementSceneDefinition;
		presentation: SettlementPresentation;
		manifest: CharacterManifest;
		residents?: readonly VillageResident[];
		eventCue?: AuthoritativeEvent | null;
	} = $props();

	interface FacilityCallout {
		readonly buildingId: string;
		readonly name: string;
		readonly anchor: NormalizedScenePoint;
		readonly label: NormalizedScenePoint;
		readonly priority: number;
	}

	const CALLOUTS: Readonly<Record<string, Omit<FacilityCallout, 'buildingId' | 'anchor'>>> = {
		'summoning-gate': {
			name: 'Portal Tower',
			label: { x: 0.5, y: 0.37 },
			priority: 5
		},
		kitchen: { name: 'Kitchen', label: { x: 0.17, y: 0.46 }, priority: 4 },
		workshop: { name: 'Forge', label: { x: 0.83, y: 0.46 }, priority: 3 },
		dormitory: { name: 'Residence', label: { x: 0.18, y: 0.73 }, priority: 2 },
		'training-ground': {
			name: 'Training Grounds',
			label: { x: 0.81, y: 0.74 },
			priority: 1
		}
	};
	const COURTYARD_POINTS: readonly NormalizedScenePoint[] = [
		{ x: 0.42, y: 0.53 },
		{ x: 0.56, y: 0.58 },
		{ x: 0.48, y: 0.66 },
		{ x: 0.61, y: 0.49 }
	];

	let sceneElement = $state<HTMLElement>(null!);
	let sceneWidth = $state(1_200);
	let sceneHeight = $state(720);

	const points = $derived(
		new Map(scene.nodeProjections.map((entry) => [entry.nodeId, entry.point]))
	);
	const primaryOccupant = $derived(
		presentation.occupants.find((entry) => entry.heroId === manifest.characterId) ??
			presentation.occupants[0]
	);
	const buildingState = $derived(
		new Map(presentation.buildings.map((building) => [building.buildingId, building]))
	);
	const callouts = $derived(
		scene.hotspots.flatMap((hotspot) => {
			const config = CALLOUTS[hotspot.buildingId];
			return config
				? [
						{
							buildingId: hotspot.buildingId,
							anchor: hotspot.center,
							...config
						}
					]
				: [];
		})
	);
	const visibleCalloutIds = $derived(resolveVisibleCallouts(callouts, sceneWidth, sceneHeight));
	const sceneResidents = $derived.by(() => {
		if (residents.length > 0) {
			const projectedResidents = residents.map((resident, index) => {
				const projected = presentation.occupants.find((entry) => entry.heroId === resident.heroId);
				return {
					resident,
					projected,
					point: projected
						? pointAlongRoute(projected)
						: COURTYARD_POINTS[index % COURTYARD_POINTS.length]!
				};
			});
			const groupSizes = new SvelteMap<string, number>();
			for (const entry of projectedResidents) {
				const key = `${entry.point.x.toFixed(3)}:${entry.point.y.toFixed(3)}`;
				groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
			}
			const groupIndexes = new SvelteMap<string, number>();
			return projectedResidents.map((entry) => {
				const key = `${entry.point.x.toFixed(3)}:${entry.point.y.toFixed(3)}`;
				const groupSize = groupSizes.get(key) ?? 1;
				const groupIndex = groupIndexes.get(key) ?? 0;
				groupIndexes.set(key, groupIndex + 1);
				const spread = groupSize > 1 ? (groupIndex - (groupSize - 1) / 2) * 0.18 : 0;
				return {
					...entry,
					point: {
						x: Math.min(0.9, Math.max(0.1, entry.point.x + spread)),
						y: entry.point.y
					}
				};
			});
		}
		return primaryOccupant
			? [
					{
						resident: {
							heroId: manifest.characterId,
							name: manifest.displayName,
							activity: primaryOccupant.activityLabel,
							location: primaryOccupant.buildingId ?? primaryOccupant.nodeId,
							portrait: null,
							sceneArt: null
						},
						projected: primaryOccupant,
						point: pointAlongRoute(primaryOccupant)
					}
				]
			: [];
	});

	onMount(() => {
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return;
			sceneWidth = entry.contentRect.width;
			sceneHeight = entry.contentRect.height;
		});
		observer.observe(sceneElement);
		return () => observer.disconnect();
	});

	function pointAlongRoute(
		entry: SettlementPresentation['occupants'][number]
	): NormalizedScenePoint {
		const fallback = points.get(entry.nodeId) ?? { x: 0.5, y: 0.5 };
		if (!entry.travel || entry.travel.routeNodeIds.length < 2) return fallback;
		const routePoints = entry.travel.routeNodeIds
			.map((nodeId) => points.get(nodeId))
			.filter((point): point is NormalizedScenePoint => point !== undefined);
		if (routePoints.length < 2) return fallback;
		const scaled = entry.travel.progress * (routePoints.length - 1);
		const segment = Math.min(Math.floor(scaled), routePoints.length - 2);
		const localProgress = scaled - segment;
		const from = routePoints[segment]!;
		const to = routePoints[segment + 1]!;
		return {
			x: from.x + (to.x - from.x) * localProgress,
			y: from.y + (to.y - from.y) * localProgress
		};
	}

	function resolveVisibleCallouts(
		entries: readonly FacilityCallout[],
		width: number,
		height: number
	): ReadonlySet<string> {
		const accepted: Array<{ left: number; top: number; right: number; bottom: number }> = [];
		const visible = new SvelteSet<string>();
		for (const entry of [...entries].sort((left, right) => right.priority - left.priority)) {
			const calloutWidth = Math.min(width * 0.42, Math.max(76, entry.name.length * 7 + 24));
			const calloutHeight = 28;
			const centerX = entry.label.x * width;
			const centerY = entry.label.y * height;
			const bounds = {
				left: centerX - calloutWidth / 2 - 6,
				top: centerY - calloutHeight / 2 - 6,
				right: centerX + calloutWidth / 2 + 6,
				bottom: centerY + calloutHeight / 2 + 6
			};
			const collides = accepted.some(
				(other) =>
					bounds.left < other.right &&
					bounds.right > other.left &&
					bounds.top < other.bottom &&
					bounds.bottom > other.top
			);
			if (collides) continue;
			accepted.push(bounds);
			visible.add(entry.buildingId);
		}
		return visible;
	}
</script>

<section
	bind:this={sceneElement}
	class={`living-scene phase-${presentation.dayPhase}`}
	data-testid="living-settlement"
	data-day-phase={presentation.dayPhase}
	data-hero-pose={primaryOccupant?.pose ?? 'absent'}
	data-event-cursor={presentation.eventCursor}
	aria-label={`Hearth 01 on day ${presentation.dayNumber} at ${presentation.gameTime.slice(11, 16)}, ${sceneResidents.length} residents visible`}
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
	{/each}

	<svg class="facility-leaders" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
		{#each callouts as callout (callout.buildingId)}
			{#if visibleCalloutIds.has(callout.buildingId)}
				<path
					d={`M ${callout.label.x * 100} ${callout.label.y * 100} L ${callout.anchor.x * 100} ${callout.anchor.y * 100}`}
				></path>
				<circle cx={callout.anchor.x * 100} cy={callout.anchor.y * 100} r="0.55"></circle>
			{/if}
		{/each}
	</svg>

	{#each callouts as callout (callout.buildingId)}
		{#if visibleCalloutIds.has(callout.buildingId)}
			<div
				class="facility-callout"
				style={`--x:${callout.label.x * 100}%;--y:${callout.label.y * 100}%`}
				data-testid="village-facility-callout"
			>
				{callout.name}
			</div>
		{/if}
	{/each}

	{#each sceneResidents as sceneResident (sceneResident.resident.heroId)}
		<div
			class={`occupant pose-${sceneResident.projected?.pose ?? 'idle'}`}
			style={`--x:${sceneResident.point.x * 100}%;--y:${sceneResident.point.y * 100}%`}
			data-testid={residents.length > 0 ? 'village-scene-resident' : 'settlement-occupant'}
			aria-label={`${sceneResident.resident.name}, ${sceneResident.resident.activity}, ${sceneResident.resident.location}`}
		>
			<div class="activity-fx" aria-hidden="true">
				{#if sceneResident.projected?.pose === 'sleep'}<span class="sleep-rune">z</span><span
						class="sleep-rune">z</span
					>{/if}
				{#if sceneResident.projected?.pose === 'eat'}<span class="steam">⌇</span><i class="bowl"
					></i>{/if}
				{#if sceneResident.projected?.pose === 'work'}<span class="spark">✦</span><span
						class="spark">✦</span
					>{/if}
				{#if sceneResident.projected?.pose === 'train'}<i class="arc"></i>{/if}
			</div>
			<div class="presence-marker" aria-hidden="true">
				{#if sceneResident.resident.sceneArt}
					<img
						class="resident-art"
						src={sceneResident.resident.sceneArt.publicPath}
						width={sceneResident.resident.sceneArt.width}
						height={sceneResident.resident.sceneArt.height}
						decoding="async"
						alt=""
					/>
				{/if}
				<b></b>
			</div>
			<div class="activity-tag">
				<strong>{sceneResident.resident.name}</strong>
			</div>
		</div>
	{/each}

	{#if eventCue}
		{#key eventCue.sequence}
			<div class="event-cue">
				<span>World event #{eventCue.sequence}</span>
				<strong>{eventCue.eventType.replaceAll('.', ' ')}</strong>
			</div>
		{/key}
	{/if}
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
	.building-aura,
	.facility-leaders {
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
	.facility-leaders {
		position: absolute;
		z-index: 3;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.facility-leaders path {
		fill: none;
		stroke: rgba(91, 215, 227, 0.8);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.facility-leaders circle {
		fill: #62dce7;
		filter: drop-shadow(0 0 0.25rem rgba(98, 220, 231, 0.9));
		vector-effect: non-scaling-stroke;
	}
	.facility-callout {
		position: absolute;
		z-index: 6;
		left: var(--x);
		top: var(--y);
		padding: 0.25rem 0.4rem;
		color: #f1ecdf;
		font:
			700 clamp(0.52rem, 1.1vw, 0.72rem)/1.1 ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-shadow:
			0 1px 0 #02070b,
			0 0 0.75rem #02070b;
		text-transform: uppercase;
		transform: translate(-50%, -50%);
		white-space: nowrap;
		pointer-events: none;
	}
	.occupant {
		position: absolute;
		z-index: 8;
		left: var(--x);
		top: var(--y);
		width: clamp(3rem, 6.2vw, 5rem);
		transform: translate(-50%, -82%);
		transition:
			left 0.8s linear,
			top 0.8s linear;
	}
	.presence-marker {
		position: relative;
		display: grid;
		place-items: center;
		width: clamp(3.2rem, 6.5vw, 5.4rem);
		height: clamp(4.2rem, 8.8vw, 7.4rem);
		margin: 0 auto;
		color: #69dce8;
	}
	.resident-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center bottom;
		filter: drop-shadow(0 0.35rem 0.4rem rgba(0, 0, 0, 0.72));
	}
	.presence-marker b {
		position: absolute;
		bottom: -0.25rem;
		left: 50%;
		width: 58%;
		height: 0.32rem;
		border-radius: 50%;
		background: rgba(92, 218, 230, 0.32);
		box-shadow: 0 0 0.7rem #62dce7;
		transform: translateX(-50%);
	}
	.pose-downed .presence-marker,
	.pose-dead .presence-marker {
		filter: grayscale(1) brightness(0.58);
	}
	.activity-tag {
		position: absolute;
		left: 50%;
		bottom: -1.05rem;
		display: grid;
		min-width: 6.5rem;
		padding: 0.35rem 0.45rem;
		border-left: 2px solid #62dce7;
		background: rgba(4, 7, 11, 0.88);
		box-shadow: 0 0.6rem 1.2rem rgba(0, 0, 0, 0.45);
		transform: translateX(-50%);
	}
	.activity-tag strong {
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
			min-height: calc(100dvh - 3.8rem - 5.65rem - env(safe-area-inset-bottom));
		}
		.environment {
			object-position: 50% 50%;
		}
		.facility-callout {
			font-size: 0.48rem;
			letter-spacing: 0.08em;
		}
		.occupant {
			width: 3rem;
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
