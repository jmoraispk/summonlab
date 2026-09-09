<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		SettlementBuilding,
		SettlementDefinition,
		SettlementRoutePlan,
		SettlementSceneDefinition
	} from '@summonlab/contracts';

	type RouteProfile = 'reserve' | 'allSystems';

	let {
		definition,
		scene,
		selectedBuildingId,
		selectedTargetNodeId,
		selectedRoute,
		routeProfile,
		onSelectBuilding
	}: {
		definition: SettlementDefinition;
		scene: SettlementSceneDefinition;
		selectedBuildingId: string;
		selectedTargetNodeId: string;
		selectedRoute: SettlementRoutePlan | null;
		routeProfile: RouteProfile;
		onSelectBuilding: (building: SettlementBuilding) => void;
	} = $props();

	const projectionByNodeId = $derived(
		new Map(scene.nodeProjections.map((projection) => [projection.nodeId, projection.point]))
	);
	const buildingById = $derived(
		new Map(definition.buildings.map((building) => [building.buildingId, building]))
	);
	const selectedProjection = $derived(projectionByNodeId.get(selectedTargetNodeId));
	const routePoints = $derived(
		(selectedRoute?.nodeIds ?? [])
			.map((nodeId) => projectionByNodeId.get(nodeId))
			.filter((point) => point !== undefined)
			.map((point) => `${point.x * scene.runtime.width},${point.y * scene.runtime.height}`)
			.join(' ')
	);

	function hotspotStyle(hotspot: SettlementSceneDefinition['hotspots'][number]): string {
		const labelX = ((hotspot.center.x - hotspot.bounds.x) / hotspot.bounds.width) * 100;
		const labelY = ((hotspot.center.y - hotspot.bounds.y) / hotspot.bounds.height) * 100;
		return `--left:${hotspot.bounds.x * 100}%;--top:${hotspot.bounds.y * 100}%;--width:${hotspot.bounds.width * 100}%;--height:${hotspot.bounds.height * 100}%;--label-x:${labelX}%;--label-y:${labelY}%`;
	}

	function pointStyle(point: { x: number; y: number } | undefined): string {
		const resolved = point ?? { x: 0.5, y: 0.52 };
		return `--x:${resolved.x * 100}%;--y:${resolved.y * 100}%`;
	}
</script>

<section class="scene-shell" aria-labelledby="painted-scene-heading">
	<header class="scene-heading">
		<div>
			<p class="scene-kicker">SET-002 · layered environment candidate</p>
			<h2 id="painted-scene-heading">Hearth 01,<br /><em>with the lights left on.</em></h2>
		</div>
		<div class="scene-seal">
			<span>{scene.sceneVersion}</span>
			<strong>{(scene.runtime.bytes / 1000).toFixed(1)} KB WebP</strong>
			<code>{scene.sceneHash.slice(0, 16)}</code>
		</div>
	</header>

	<div
		class="painted-scene"
		data-testid="painted-settlement-scene"
		aria-label="Interactive layered painting of Hearth 01"
	>
		<img
			class="environment-base"
			data-layer-kind="bitmap-base"
			src={scene.runtime.publicPath}
			alt="Hero-free high three-quarter view of Hearth 01 with a rear Tower Portal, Summoning Circle and Residence to the left, and Training Grounds and Forge to the right."
			width={scene.runtime.width}
			height={scene.runtime.height}
			decoding="async"
		/>

		<div class="atmosphere-layer" data-layer-kind="code-atmosphere" aria-hidden="true">
			<i></i><i></i>
		</div>
		<div class="illumination-layer" data-layer-kind="code-illumination" aria-hidden="true">
			<i class="portal-light"></i>
			<i class="circle-light"></i>
			<i class="residence-light"></i>
		</div>

		<svg
			class="scene-route"
			data-layer-kind="code-route"
			viewBox={`0 0 ${scene.runtime.width} ${scene.runtime.height}`}
			aria-hidden="true"
		>
			<defs>
				<filter id="painted-route-glow">
					<feGaussianBlur stdDeviation="7" result="blur"></feGaussianBlur>
					<feMerge>
						<feMergeNode in="blur"></feMergeNode>
						<feMergeNode in="SourceGraphic"></feMergeNode>
					</feMerge>
				</filter>
			</defs>
			{#if routePoints}
				<polyline class="route-underlay" points={routePoints}></polyline>
				<polyline class="route-signal" points={routePoints}></polyline>
			{/if}
		</svg>

		<div
			class="activity-cursor"
			class:blocked={selectedRoute === null}
			data-layer-kind="code-activity"
			style={pointStyle(selectedProjection)}
			aria-hidden="true"
		>
			<i></i>
		</div>

		<div class="hotspot-layer" data-layer-kind="code-interface">
			{#each scene.hotspots as hotspot (hotspot.facilityId)}
				{#if hotspot.target.kind === 'settlement-buildings'}
					{@const building = buildingById.get(hotspot.target.buildingIds[0]!)!}
					<button
						type="button"
						class="scene-hotspot"
						class:selected={building.buildingId === selectedBuildingId}
						class:dormant={building.kind === 'workshop' && routeProfile === 'reserve'}
						style={hotspotStyle(hotspot)}
						aria-label={`Inspect ${hotspot.label} in painted settlement`}
						aria-pressed={building.buildingId === selectedBuildingId}
						onclick={() => onSelectBuilding(building)}
					>
						<span>
							<i></i>
							<strong>{hotspot.label}</strong>
							<small
								>{building.kind === 'workshop' && routeProfile === 'reserve'
									? 'dormant'
									: 'inspect'}</small
							>
						</span>
					</button>
				{:else}
					<a
						class="scene-hotspot portal-hotspot"
						style={hotspotStyle(hotspot)}
						href={resolve('/living-village-lab/tower')}
						aria-label="Open Tower mode through Tower Portal"
					>
						<span><i></i><strong>{hotspot.label}</strong><small>open</small></span>
					</a>
				{/if}
			{/each}
		</div>

		<div class="scene-boundary">
			<span>{routeProfile === 'reserve' ? 'reserve profile' : 'all systems preview'}</span>
			<strong>{selectedRoute === null ? 'No legal route' : 'Projected intent only'}</strong>
		</div>
	</div>

	<div class="scene-foot">
		<p>
			The bitmap supplies architecture; five code-owned layers supply atmosphere, light, route,
			activity intent, and interaction. None can commit arrival.
		</p>
		<ol aria-label="Settlement scene layer contract">
			{#each scene.layers as layer (layer.layerId)}
				<li>
					<i>{String(layer.depth + 1).padStart(2, '0')}</i>
					<div>
						<strong>{layer.layerId.replaceAll('-', ' ')}</strong><span>{layer.motion}</span>
					</div>
				</li>
			{/each}
		</ol>
	</div>
</section>

<style>
	.scene-shell {
		width: min(100%, 96rem);
		margin: 0 auto;
		padding: clamp(2.5rem, 7vw, 7rem) clamp(1rem, 4vw, 4rem);
	}
	.scene-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.5rem;
	}
	.scene-kicker {
		margin: 0 0 0.65rem;
		color: #d4a751;
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		font:
			400 clamp(2rem, 5vw, 4.8rem) / 0.88 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	h2 em {
		color: #8bcbd4;
		font-weight: 400;
	}
	.scene-seal {
		display: grid;
		justify-items: end;
		gap: 0.35rem;
		min-width: 13rem;
		padding: 0.9rem 0 0.2rem 1.5rem;
		border-left: 1px solid rgba(255, 255, 255, 0.12);
	}
	.scene-seal span,
	.scene-seal code {
		font-size: 0.6rem;
		letter-spacing: 0.08em;
	}
	.scene-seal span {
		color: #d4a751;
		text-transform: uppercase;
	}
	.scene-seal strong {
		font:
			400 1rem Georgia,
			serif;
	}
	.scene-seal code {
		color: #7dc6d0;
	}
	.painted-scene {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		aspect-ratio: 3 / 2;
		border: 1px solid rgba(209, 171, 96, 0.2);
		background: #070a11;
		box-shadow:
			0 2rem 7rem rgba(0, 0, 0, 0.62),
			inset 0 0 0 1px rgba(255, 255, 255, 0.025);
	}
	.environment-base,
	.atmosphere-layer,
	.illumination-layer,
	.scene-route,
	.hotspot-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.environment-base {
		z-index: 0;
		display: block;
		object-fit: cover;
	}
	.atmosphere-layer {
		z-index: 1;
		pointer-events: none;
		background:
			linear-gradient(180deg, rgba(23, 49, 79, 0.16), transparent 34%),
			radial-gradient(circle at 50% 52%, transparent 28%, rgba(2, 4, 10, 0.2) 82%);
		mix-blend-mode: screen;
	}
	.atmosphere-layer i {
		position: absolute;
		left: -15%;
		width: 70%;
		height: 12%;
		border-radius: 50%;
		background: rgba(116, 161, 174, 0.07);
		filter: blur(22px);
		animation: fog-drift 18s ease-in-out infinite alternate;
	}
	.atmosphere-layer i:first-child {
		top: 46%;
	}
	.atmosphere-layer i:last-child {
		top: 62%;
		left: 45%;
		animation-delay: -8s;
	}
	.illumination-layer {
		z-index: 2;
		pointer-events: none;
		mix-blend-mode: screen;
	}
	.illumination-layer i {
		position: absolute;
		border-radius: 50%;
		filter: blur(15px);
		animation: light-breathe 4.8s ease-in-out infinite alternate;
	}
	.portal-light {
		left: 39%;
		top: 10%;
		width: 22%;
		height: 28%;
		background: radial-gradient(circle, rgba(91, 211, 238, 0.2), transparent 68%);
	}
	.circle-light,
	.residence-light {
		width: 21%;
		height: 22%;
		background: radial-gradient(circle, rgba(230, 154, 68, 0.15), transparent 70%);
		animation-delay: -2.2s;
	}
	.circle-light {
		left: 12%;
		top: 24%;
	}
	.residence-light {
		left: 18%;
		top: 56%;
	}
	.scene-route {
		z-index: 3;
		pointer-events: none;
		overflow: visible;
	}
	.route-underlay,
	.route-signal {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}
	.route-underlay {
		stroke: rgba(3, 9, 13, 0.82);
		stroke-width: 8;
	}
	.route-signal {
		stroke: #76dae6;
		stroke-width: 2.5;
		stroke-dasharray: 7 11;
		filter: url('#painted-route-glow');
		animation: route-flow 2.2s linear infinite;
	}
	.activity-cursor {
		position: absolute;
		z-index: 4;
		left: var(--x);
		top: var(--y);
		width: clamp(0.55rem, 1.4vw, 1.15rem);
		aspect-ratio: 1;
		border: 1px solid rgba(235, 213, 164, 0.92);
		border-radius: 50%;
		background: #101820;
		box-shadow:
			0 0 0 0.3rem rgba(7, 10, 14, 0.72),
			0 0 1.1rem rgba(108, 215, 228, 0.75);
		transform: translate(-50%, -50%);
		transition:
			left 0.65s cubic-bezier(0.2, 0.8, 0.2, 1),
			top 0.65s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.activity-cursor i {
		position: absolute;
		inset: 27%;
		border-radius: 50%;
		background: #8be1e9;
		animation: cursor-pulse 1.7s ease-in-out infinite;
	}
	.activity-cursor.blocked {
		border-color: #c87963;
		box-shadow:
			0 0 0 0.3rem rgba(7, 10, 14, 0.72),
			0 0 1.1rem rgba(200, 95, 71, 0.7);
	}
	.activity-cursor.blocked i {
		background: #ca745d;
	}
	.hotspot-layer {
		z-index: 5;
		pointer-events: none;
	}
	.scene-hotspot {
		position: absolute;
		left: var(--left);
		top: var(--top);
		width: var(--width);
		height: var(--height);
		padding: 0;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		background: transparent;
		color: #f4efe3;
		cursor: pointer;
		color: inherit;
		text-decoration: none;
		pointer-events: auto;
		transition:
			border-color 160ms ease,
			background 160ms ease;
	}
	.scene-hotspot:hover,
	.scene-hotspot:focus-visible,
	.scene-hotspot.selected {
		border-color: rgba(121, 218, 230, 0.68);
		background: rgba(59, 121, 132, 0.08);
		outline: none;
	}
	.scene-hotspot:focus-visible {
		box-shadow: inset 0 0 0 2px #f2d391;
	}
	.scene-hotspot > span {
		position: absolute;
		left: var(--label-x);
		top: var(--label-y);
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0 0.35rem;
		align-items: center;
		min-width: max-content;
		padding: 0.35rem 0.45rem;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(4, 8, 13, 0.84);
		box-shadow: 0 0.7rem 1.5rem rgba(0, 0, 0, 0.45);
		transform: translate(-50%, -50%);
		backdrop-filter: blur(8px);
		text-align: left;
	}
	.scene-hotspot > span i {
		grid-row: 1 / 3;
		width: 0.38rem;
		height: 0.38rem;
		border: 1px solid #79d7e2;
		transform: rotate(45deg);
	}
	.scene-hotspot strong,
	.scene-hotspot small {
		display: block;
	}
	.scene-hotspot strong {
		font-size: clamp(0.48rem, 0.85vw, 0.72rem);
		line-height: 1;
	}
	.scene-hotspot small {
		margin-top: 0.15rem;
		color: #9aa5ac;
		font-size: clamp(0.38rem, 0.58vw, 0.5rem);
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.scene-hotspot.selected > span {
		border-color: rgba(121, 218, 230, 0.62);
		background: rgba(6, 23, 29, 0.92);
	}
	.scene-hotspot.dormant > span i {
		border-color: #c47961;
	}
	.scene-hotspot.dormant small {
		color: #d08a73;
	}
	.scene-boundary {
		position: absolute;
		right: 0.8rem;
		bottom: 0.8rem;
		z-index: 6;
		display: grid;
		justify-items: end;
		gap: 0.15rem;
		padding: 0.55rem 0.7rem;
		border-right: 2px solid #73cbd5;
		background: rgba(4, 7, 11, 0.76);
		backdrop-filter: blur(10px);
	}
	.scene-boundary span {
		color: #c7a55f;
		font-size: 0.48rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
	.scene-boundary strong {
		font-size: 0.62rem;
	}
	.scene-foot {
		display: grid;
		grid-template-columns: minmax(14rem, 0.65fr) 1.35fr;
		gap: clamp(1.5rem, 4vw, 4rem);
		padding: 1.25rem 0 0;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
	.scene-foot > p {
		margin: 0;
		color: #9ba2a5;
		font-size: 0.72rem;
		line-height: 1.75;
	}
	.scene-foot ol {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.scene-foot li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.55rem;
		align-items: center;
		padding: 0.55rem;
		border: 1px solid rgba(255, 255, 255, 0.07);
		background: rgba(255, 255, 255, 0.018);
	}
	.scene-foot li > i {
		color: #d2a653;
		font: 0.52rem monospace;
	}
	.scene-foot li strong,
	.scene-foot li span {
		display: block;
	}
	.scene-foot li strong {
		font-size: 0.54rem;
		text-transform: capitalize;
	}
	.scene-foot li span {
		margin-top: 0.14rem;
		color: #6f7f84;
		font-size: 0.45rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	@keyframes fog-drift {
		to {
			transform: translateX(55%);
		}
	}
	@keyframes light-breathe {
		to {
			opacity: 0.66;
			transform: scale(1.05);
		}
	}
	@keyframes route-flow {
		to {
			stroke-dashoffset: -36;
		}
	}
	@keyframes cursor-pulse {
		50% {
			opacity: 0.45;
			transform: scale(0.65);
		}
	}
	@media (max-width: 720px) {
		.scene-heading {
			align-items: start;
			flex-direction: column;
		}
		.scene-seal {
			justify-items: start;
			padding-left: 0;
			border-left: 0;
		}
		.scene-hotspot > span {
			gap: 0 0.2rem;
			padding: 0.25rem 0.3rem;
		}
		.scene-hotspot > span i,
		.scene-hotspot small {
			display: none;
		}
		.scene-boundary {
			right: 0.35rem;
			bottom: 0.35rem;
			padding: 0.35rem 0.45rem;
		}
		.scene-boundary span {
			display: none;
		}
		.scene-foot {
			grid-template-columns: 1fr;
		}
		.scene-foot ol {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.atmosphere-layer i,
		.illumination-layer i,
		.route-signal,
		.activity-cursor i {
			animation: none;
		}
		.activity-cursor,
		.scene-hotspot {
			transition: none;
		}
	}
</style>
