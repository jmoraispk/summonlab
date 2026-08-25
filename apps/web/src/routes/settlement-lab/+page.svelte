<script lang="ts">
	import { resolve } from '$app/paths';
	import HearthScene from '$lib/components/HearthScene.svelte';
	import type {
		SettlementBuilding,
		SettlementRouteNode,
		SettlementRoutePlan
	} from '@summonlab/contracts';

	let { data } = $props();
	let selectedBuildingId = $state('kitchen');
	let selectedTargetNodeId = $state('kitchen-table');
	let routeProfile = $state<'reserve' | 'allSystems'>('reserve');

	const selectedBuilding = $derived(
		data.definition.buildings.find((building) => building.buildingId === selectedBuildingId) ??
			data.definition.buildings[0]!
	);
	const selectedInteriorNodes = $derived(
		selectedBuilding.interior.nodeIds.map((nodeId) =>
			data.definition.nodes.find((node) => node.nodeId === nodeId)!
		)
	);
	const selectedTarget = $derived(
		data.definition.nodes.find((node) => node.nodeId === selectedTargetNodeId) ??
			selectedInteriorNodes[0]!
	);
	const selectedRoute = $derived(
		data.routeProfiles[routeProfile][selectedTargetNodeId] as SettlementRoutePlan | null
	);
	const selectedRouteEdgeIds = $derived(
		new Set((selectedRoute?.steps ?? []).map((step) => step.edgeId))
	);
	const blockedAccess = $derived(
		selectedRoute === null
			? data.definition.edges.find(
					(edge) =>
						(edge.fromNodeId === selectedTargetNodeId || edge.toNodeId === selectedTargetNodeId) &&
						edge.access.kind === 'requires-system'
				)
			: undefined
	);

	function chooseBuilding(building: SettlementBuilding): void {
		selectedBuildingId = building.buildingId;
		selectedTargetNodeId = building.interior.focusNodeId;
	}

	function entranceFor(building: SettlementBuilding): SettlementRouteNode {
		return data.definition.nodes.find((node) => node.nodeId === building.entranceNodeId)!;
	}

	function mapStyle(node: SettlementRouteNode): string {
		return `--x:${(node.mapPosition.x / data.definition.design.width) * 100}%;--y:${(node.mapPosition.y / data.definition.design.height) * 100}%`;
	}

	function interiorStyle(node: SettlementRouteNode): string {
		const position = node.interiorPosition ?? { x: 500, y: 400 };
		return `--x:${position.x / 10}%;--y:${position.y / 8}%`;
	}

	function pathPoints(edge: (typeof data.definition.edges)[number]): string {
		return edge.visualPath.map((point) => `${point.x},${point.y}`).join(' ');
	}

	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const remainder = seconds % 60;
		return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
	}
</script>

<svelte:head>
	<title>Hearth 01 settlement lab · summonlab</title>
	<meta
		name="description"
		content="Inspect the layered Hearth 01 environment, versioned five-building route graph, authored interiors, travel times, capacities, and dormant-system boundaries."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>SET-001 · SET-002</span><strong>Hearth 01 settlement lab</strong></div>
		<nav aria-label="Settlement lab links">
			<a href={resolve('/mission-lab')}>Mission lab</a>
			<a href={resolve('/forge')}>Forge</a>
			<a href={resolve('/visual-lab/recognition')}>Recognition</a>
			<a href={resolve('/design-reference')}>Design reference</a>
		</nav>
	</header>

	<section class="opening">
		<div>
			<p class="eyebrow">Versioned topology · not authoritative run state</p>
			<h1>A small refuge.<br /><em>Enough room for a life.</em></h1>
		</div>
		<div class="opening-copy">
			<p>
				Hearth 01 is a route graph, not a free-walk illusion. Buildings, rooms, stations,
				capacities, access rules, and travel time are authored here; the engine will own every
				arrival later.
			</p>
			<div class="hash-seal">
				<span
					>{data.definition.contentVersion} · {(
						data.buildBudget.measurements.settlementRouteLabLoadedJavaScriptGzipBytes / 1000
					).toFixed(1)} KB route JS</span
				>
				<code>{data.definition.contentHash.slice(0, 16)}</code>
			</div>
		</div>
	</section>

	<HearthScene
		definition={data.definition}
		scene={data.scene}
		{selectedBuildingId}
		{selectedTargetNodeId}
		{selectedRoute}
		{routeProfile}
		onSelectBuilding={chooseBuilding}
	/>

	<section class="world-grid" aria-labelledby="map-heading">
		<div class="map-panel">
			<header class="panel-heading">
				<div>
					<p class="eyebrow">High three-quarter command view</p>
					<h2 id="map-heading">Five places.<br />One shared courtyard.</h2>
				</div>
				<strong>{data.definition.nodes.length} nodes · {data.definition.edges.length} paths</strong>
			</header>

			<div class="settlement-map" data-testid="settlement-map">
				<div class="tower" aria-hidden="true"><i></i><span>the black tower</span></div>
				<svg
					class="route-layer"
					viewBox={`0 0 ${data.definition.design.width} ${data.definition.design.height}`}
					role="img"
					aria-label="Authored Hearth 01 route graph"
				>
					<defs>
						<filter id="route-glow">
							<feGaussianBlur stdDeviation="7" result="blur"></feGaussianBlur>
							<feMerge
								><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"
								></feMergeNode></feMerge
							>
						</filter>
						<linearGradient id="wall-fill" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0" stop-color="#252833"></stop>
							<stop offset="1" stop-color="#10131b"></stop>
						</linearGradient>
					</defs>
					<polygon
						class="wall"
						points={data.definition.design.wallBoundary
							.map((point) => `${point.x},${point.y}`)
							.join(' ')}
					></polygon>
					{#each data.definition.edges as edge (edge.edgeId)}
						<polyline class="route-shadow" points={pathPoints(edge)}></polyline>
						<polyline
							class="route-line"
							class:active={selectedRouteEdgeIds.has(edge.edgeId)}
							class:restricted={edge.access.kind === 'requires-system'}
							points={pathPoints(edge)}
						></polyline>
					{/each}
					{#each data.definition.nodes as node (node.nodeId)}
						<circle
							class="node-dot"
							class:active={selectedRoute?.nodeIds.includes(node.nodeId)}
							cx={node.mapPosition.x}
							cy={node.mapPosition.y}
							r={node.kind === 'courtyard' ? 10 : 6}
						></circle>
					{/each}
				</svg>

				<div class="courtyard-mark" aria-hidden="true"><span>courtyard heart</span></div>
				{#each data.definition.buildings as building, index (building.buildingId)}
					{@const entrance = entranceFor(building)}
					<button
						type="button"
						class="building-button"
						class:selected={building.buildingId === selectedBuildingId}
						class:dormant={building.kind === 'workshop'}
						style={mapStyle(entrance)}
						aria-pressed={building.buildingId === selectedBuildingId}
						onclick={() => chooseBuilding(building)}
					>
						<i>{String(index + 1).padStart(2, '0')}</i>
						<span class={`building-mark ${building.kind}`} aria-hidden="true"></span>
						<strong>{building.shortLabel}</strong>
						<small>{building.kind === 'workshop' ? 'dormant system' : 'inspect interior'}</small>
					</button>
				{/each}

				<div
					class="traveler"
					class:blocked={selectedRoute === null}
					style={mapStyle(selectedTarget)}
				>
					<i></i><span>{selectedRoute === null ? 'blocked' : 'route target'}</span>
				</div>
				<div class="map-caption">
					<span>{data.definition.displayName}</span>
					<strong>{data.definition.tagline}</strong>
				</div>
			</div>
		</div>

		<aside class="route-inspector" aria-labelledby="route-heading">
			<p class="eyebrow">Deterministic route preview</p>
			<h2 id="route-heading">From the gate<br />to {selectedTarget.label}.</h2>

			<div class="profile-switch" role="group" aria-label="System access preview">
				<button
					type="button"
					class:active={routeProfile === 'reserve'}
					aria-pressed={routeProfile === 'reserve'}
					onclick={() => (routeProfile = 'reserve')}>Reserve</button
				>
				<button
					type="button"
					class:active={routeProfile === 'allSystems'}
					aria-pressed={routeProfile === 'allSystems'}
					onclick={() => (routeProfile = 'allSystems')}>All systems</button
				>
			</div>
			<p class="profile-note">
				{routeProfile === 'reserve'
					? 'Only the summoning gate system is active in this topology preview.'
					: 'Preview only: every declared building system is treated as available.'}
			</p>

			{#if selectedRoute}
				<div class="route-metrics" data-testid="route-metrics">
					<div>
						<span>Travel</span><strong
							>{formatDuration(selectedRoute.totalTravelGameSeconds)}</strong
						>
					</div>
					<div>
						<span>Bottleneck</span><strong>{selectedRoute.bottleneckCapacity} people</strong>
					</div>
					<div><span>Transitions</span><strong>{selectedRoute.steps.length}</strong></div>
				</div>
				<ol class="route-steps">
					{#each selectedRoute.steps as step, index (step.edgeId)}
						<li>
							<i>{String(index + 1).padStart(2, '0')}</i>
							<div>
								<strong>{step.toNodeId.replaceAll('-', ' ')}</strong><span
									>{step.travelGameSeconds}s</span
								>
							</div>
						</li>
					{/each}
				</ol>
			{:else}
				<div class="route-blocked" role="status" data-testid="route-blocked">
					<strong>Route unavailable</strong>
					<p>
						{blockedAccess?.access.kind === 'requires-system'
							? `${blockedAccess.access.systemId} is dormant in the reserve preview.`
							: 'No legal authored path reaches this node under the selected access profile.'}
					</p>
				</div>
			{/if}

			<div class="authority-note">
				<span>Boundary</span>
				<p>
					The route is content evidence. A future engine command must schedule and commit arrival.
				</p>
			</div>
		</aside>
	</section>

	<section class="interior" aria-labelledby="interior-heading">
		<header class="section-heading">
			<div>
				<p class="eyebrow">
					Interior composition 0{data.definition.buildings.indexOf(selectedBuilding) + 1}
				</p>
				<h2 id="interior-heading">{selectedBuilding.label}</h2>
				<p>{selectedBuilding.summary}</p>
			</div>
			<div class="camera-seal">
				<span>camera</span><strong>{selectedBuilding.interior.camera.zoom.toFixed(2)}×</strong>
				<code>{selectedBuilding.interior.ambientColor}</code>
			</div>
		</header>

		<div class="interior-grid">
			<div
				class={`interior-stage ${selectedBuilding.kind}`}
				style={`--ambient:${selectedBuilding.interior.ambientColor}`}
				data-testid="interior-stage"
			>
				<div class="interior-sky"></div>
				<div class="rear-arches"></div>
				<div class="floor-plane"></div>
				{#if selectedBuilding.kind === 'summoning-gate'}
					<div class="gate-set"><i></i><span></span></div>
				{:else if selectedBuilding.kind === 'kitchen'}
					<div class="kitchen-set"><i></i><span></span><b></b></div>
				{:else if selectedBuilding.kind === 'dormitory'}
					<div class="dormitory-set"><i></i><i></i><i></i><span></span></div>
				{:else if selectedBuilding.kind === 'training-ground'}
					<div class="training-set"><i></i><span></span><b></b></div>
				{:else}
					<div class="workshop-set"><i></i><span></span><b></b></div>
				{/if}

				{#each selectedInteriorNodes as node (node.nodeId)}
					<button
						type="button"
						class="zone"
						class:selected={node.nodeId === selectedTargetNodeId}
						style={interiorStyle(node)}
						aria-pressed={node.nodeId === selectedTargetNodeId}
						onclick={() => (selectedTargetNodeId = node.nodeId)}
					>
						<i></i><strong>{node.label}</strong><small>{node.capacity} cap</small>
					</button>
				{/each}
				<div class="interior-caption">
					<span>{selectedBuilding.shortLabel}</span>
					<strong>{selectedBuilding.interior.caption}</strong>
				</div>
			</div>

			<div class="layer-ledger">
				{#each selectedBuilding.interior.layers as layer, index (layer.layerId)}
					<article>
						<i>0{index + 1}</i>
						<div>
							<span>{layer.depth} layer</span><strong>{layer.layerId.replaceAll('-', ' ')}</strong>
						</div>
						<p>{layer.description}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="building-ledger" aria-labelledby="ledger-heading">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Simulation contract</p>
				<h2 id="ledger-heading">Every room must matter.</h2>
			</div>
			<strong>Interaction → future engine effect</strong>
		</header>
		<div class="building-table">
			{#each data.definition.buildings as building (building.buildingId)}
				<article>
					<header><span>{building.kind}</span><strong>{building.label}</strong></header>
					<div>
						<span>Interactions</span>
						<p>{building.interactions.join(' · ')}</p>
					</div>
					<div>
						<span>Simulation effects</span>
						<p>{building.simulationEffects.join(' · ')}</p>
					</div>
					<code>{building.systemId}</code>
				</article>
			{/each}
		</div>
	</section>

	<footer>
		<p>
			<code>pnpm validate:settlement-content</code> and
			<code>pnpm validate:settlement-scene</code> verify topology, layers, assets, and routes.
		</p>
		<a href={resolve('/visual-lab')}>Return to the human visual gate →</a>
	</footer>
</main>

<style>
	:global(body) {
		background: #07090d;
	}
	main {
		min-height: 100vh;
		color: #f3efe5;
		background:
			radial-gradient(circle at 18% 5%, rgba(76, 120, 126, 0.13), transparent 30rem),
			linear-gradient(180deg, #080b10, #07090d 46rem, #0b0d12);
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 5rem;
		padding: 0 clamp(1rem, 4vw, 4rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(5, 7, 10, 0.86);
		backdrop-filter: blur(16px);
	}
	.wordmark {
		font-size: 0.72rem;
		font-weight: 850;
		letter-spacing: 0.25em;
		text-transform: uppercase;
	}
	.topbar > div {
		text-align: center;
	}
	.topbar > div span,
	.topbar > div strong {
		display: block;
	}
	.topbar > div span {
		color: #d7aa5b;
		font-size: 0.48rem;
		letter-spacing: 0.16em;
	}
	.topbar > div strong {
		margin-top: 0.2rem;
		font:
			400 1rem Georgia,
			serif;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1.1rem;
		color: rgba(243, 239, 229, 0.48);
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.opening,
	.world-grid,
	.interior,
	.building-ledger,
	footer {
		max-width: 100rem;
		margin: 0 auto;
	}
	.opening {
		display: grid;
		grid-template-columns: minmax(26rem, 1.15fr) minmax(20rem, 0.85fr);
		gap: clamp(3rem, 8vw, 9rem);
		align-items: end;
		padding: clamp(4rem, 8vw, 8rem) clamp(1.2rem, 4vw, 4rem);
	}
	.eyebrow {
		margin: 0 0 0.7rem;
		color: #d7aa5b;
		font-size: 0.52rem;
		font-weight: 750;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h1,
	h2,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 0;
		font:
			400 clamp(3.8rem, 7vw, 7.8rem) / 0.84 Georgia,
			serif;
		letter-spacing: -0.065em;
	}
	h1 em {
		color: #83cad6;
		font-weight: 400;
	}
	.opening-copy > p {
		color: rgba(243, 239, 229, 0.58);
		font-size: 0.78rem;
		line-height: 1.75;
	}
	.hash-seal {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}
	.hash-seal span {
		color: #d7aa5b;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.hash-seal code {
		color: #83cad6;
		font-size: 0.52rem;
	}
	.world-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.32fr);
		gap: 1px;
		padding: 0 clamp(1.2rem, 4vw, 4rem) clamp(5rem, 8vw, 8rem);
	}
	.map-panel,
	.route-inspector {
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: #0a0d12;
	}
	.panel-heading,
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.5rem;
	}
	.panel-heading h2,
	.section-heading h2,
	.route-inspector h2 {
		margin: 0;
		font:
			400 clamp(2.2rem, 4vw, 4.8rem) / 0.9 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	.panel-heading > strong,
	.section-heading > strong {
		color: #77d1ae;
		font:
			500 0.52rem ui-monospace,
			monospace;
	}
	.settlement-map {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		background:
			radial-gradient(ellipse at 50% 55%, rgba(98, 111, 96, 0.18), transparent 38%),
			linear-gradient(180deg, #111620 0 28%, #151615 29% 100%);
		isolation: isolate;
	}
	.settlement-map::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
		background-size: 2.5rem 2.5rem;
		transform: perspective(30rem) rotateX(55deg) scale(1.4);
		transform-origin: center bottom;
	}
	.route-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.wall {
		fill: url('#wall-fill');
		fill-opacity: 0.5;
		stroke: rgba(206, 184, 139, 0.28);
		stroke-width: 18;
		stroke-linejoin: round;
	}
	.route-shadow,
	.route-line {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.route-shadow {
		stroke: rgba(0, 0, 0, 0.5);
		stroke-width: 16;
	}
	.route-line {
		stroke: rgba(225, 210, 174, 0.17);
		stroke-width: 5;
		stroke-dasharray: 7 12;
		transition: stroke 180ms ease;
	}
	.route-line.restricted {
		stroke: rgba(211, 115, 101, 0.27);
	}
	.route-line.active {
		stroke: #7fd8e9;
		stroke-width: 7;
		stroke-dasharray: none;
		filter: url('#route-glow');
	}
	.node-dot {
		fill: #3f4b4d;
		stroke: rgba(255, 255, 255, 0.3);
		stroke-width: 3;
	}
	.node-dot.active {
		fill: #d9b267;
		stroke: #fff2d7;
	}
	.tower {
		position: absolute;
		top: 0;
		left: 50%;
		z-index: -1;
		width: 6%;
		height: 28%;
		background: linear-gradient(90deg, #08090d, #171723 48%, #05060a);
		clip-path: polygon(35% 0, 65% 0, 100% 100%, 0 100%);
		transform: translateX(-50%);
		box-shadow: 0 0 4rem rgba(102, 80, 145, 0.3);
	}
	.tower i {
		position: absolute;
		top: 25%;
		left: 48%;
		width: 4%;
		height: 65%;
		background: #8c6fc9;
		box-shadow: 0 0 1rem #8c6fc9;
	}
	.tower span {
		position: absolute;
		top: 1rem;
		left: 120%;
		width: 8rem;
		color: rgba(191, 169, 230, 0.35);
		font-size: 0.38rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.building-button,
	.traveler {
		position: absolute;
		left: var(--x);
		top: var(--y);
		transform: translate(-50%, -50%);
	}
	.building-button {
		z-index: 3;
		min-width: 5.6rem;
		padding: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(8, 10, 14, 0.87);
		color: inherit;
		cursor: pointer;
		text-align: left;
		transition:
			border 180ms ease,
			transform 180ms ease;
	}
	.building-button:hover,
	.building-button:focus-visible,
	.building-button.selected {
		z-index: 4;
		border-color: #d9b267;
		transform: translate(-50%, -55%);
		outline: none;
		box-shadow: 0 0 2rem rgba(217, 178, 103, 0.2);
	}
	.building-button > i {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		color: rgba(217, 178, 103, 0.45);
		font:
			normal 0.38rem ui-monospace,
			monospace;
	}
	.building-mark {
		display: block;
		width: 2.8rem;
		height: 1.6rem;
		margin-bottom: 0.35rem;
		background:
			linear-gradient(135deg, transparent 28%, #5a5147 29% 52%, transparent 53%),
			linear-gradient(#3a3b3b, #1a1d20);
		clip-path: polygon(0 38%, 50% 0, 100% 38%, 92% 100%, 8% 100%);
	}
	.building-mark.summoning-gate {
		background: radial-gradient(circle, transparent 30%, #72bdca 32% 42%, #242d33 44%);
		clip-path: none;
		border-radius: 50% 50% 12% 12%;
	}
	.building-mark.training-ground {
		background:
			linear-gradient(
				90deg,
				transparent 10%,
				#7e6750 11% 17%,
				transparent 18% 82%,
				#7e6750 83% 89%,
				transparent 90%
			),
			linear-gradient(transparent 62%, #594b3c 63% 70%, transparent 71%);
		clip-path: none;
	}
	.building-mark.workshop {
		background: linear-gradient(135deg, #2d3134 55%, #693d34 56%);
	}
	.building-button strong,
	.building-button small {
		display: block;
	}
	.building-button strong {
		font:
			400 0.68rem Georgia,
			serif;
	}
	.building-button small {
		margin-top: 0.2rem;
		color: rgba(243, 239, 229, 0.35);
		font-size: 0.38rem;
		text-transform: uppercase;
	}
	.building-button.dormant small {
		color: #d27870;
	}
	.courtyard-mark {
		position: absolute;
		left: 50%;
		top: 55%;
		width: 13%;
		aspect-ratio: 2 / 1;
		border: 1px solid rgba(217, 178, 103, 0.18);
		border-radius: 50%;
		transform: translate(-50%, -50%) rotate(-5deg);
	}
	.courtyard-mark span {
		position: absolute;
		top: 110%;
		left: 50%;
		color: rgba(217, 178, 103, 0.35);
		font-size: 0.38rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		transform: translateX(-50%);
		white-space: nowrap;
	}
	.traveler {
		z-index: 7;
		width: 1.2rem;
		height: 2.3rem;
		pointer-events: none;
		transition:
			left 260ms ease,
			top 260ms ease;
	}
	.traveler i {
		display: block;
		width: 0.55rem;
		height: 0.55rem;
		margin: 0 auto;
		border-radius: 50%;
		background: #3b251e;
		box-shadow: 0 0 0 2px #d7aa5b;
	}
	.traveler::after {
		content: '';
		display: block;
		width: 1rem;
		height: 1.5rem;
		margin: 0.15rem auto 0;
		background: linear-gradient(90deg, #20242b, #714c3b 50%, #20242b);
		clip-path: polygon(25% 0, 75% 0, 100% 100%, 0 100%);
	}
	.traveler span {
		position: absolute;
		top: 105%;
		left: 50%;
		padding: 0.15rem 0.25rem;
		background: #07090d;
		color: #7fd8e9;
		font-size: 0.34rem;
		text-transform: uppercase;
		transform: translateX(-50%);
		white-space: nowrap;
	}
	.traveler.blocked {
		filter: grayscale(1);
		opacity: 0.55;
	}
	.map-caption {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(6, 8, 11, 0.78);
		backdrop-filter: blur(12px);
	}
	.map-caption span {
		color: #d7aa5b;
		font-size: 0.45rem;
		text-transform: uppercase;
	}
	.map-caption strong {
		max-width: 34rem;
		font:
			400 0.62rem Georgia,
			serif;
		text-align: right;
	}
	.route-inspector {
		padding: 1.5rem;
	}
	.route-inspector h2 {
		font-size: clamp(2rem, 3vw, 3.4rem);
	}
	.profile-switch {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin-top: 2rem;
		background: rgba(255, 255, 255, 0.09);
	}
	.profile-switch button {
		padding: 0.7rem;
		border: 0;
		background: #0e1117;
		color: rgba(243, 239, 229, 0.38);
		cursor: pointer;
		font-size: 0.48rem;
		text-transform: uppercase;
	}
	.profile-switch button.active {
		background: rgba(81, 123, 130, 0.28);
		color: #83cad6;
		box-shadow: inset 0 2px #83cad6;
	}
	.profile-note {
		margin: 0.8rem 0 1.2rem;
		color: rgba(243, 239, 229, 0.38);
		font-size: 0.52rem;
		line-height: 1.55;
	}
	.route-metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.route-metrics div {
		padding: 0.8rem;
		background: #0d1016;
	}
	.route-metrics div:first-child {
		grid-column: 1 / -1;
	}
	.route-metrics span,
	.route-metrics strong {
		display: block;
	}
	.route-metrics span {
		color: rgba(243, 239, 229, 0.32);
		font-size: 0.42rem;
		text-transform: uppercase;
	}
	.route-metrics strong {
		margin-top: 0.35rem;
		color: #77d1ae;
		font:
			400 1rem Georgia,
			serif;
	}
	.route-steps {
		max-height: 15rem;
		margin: 1px 0 0;
		padding: 0;
		overflow: auto;
		list-style: none;
	}
	.route-steps li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.7rem;
		align-items: center;
		padding: 0.7rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}
	.route-steps li > i {
		color: rgba(217, 178, 103, 0.5);
		font:
			normal 0.45rem ui-monospace,
			monospace;
	}
	.route-steps div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.route-steps strong {
		font:
			400 0.65rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.route-steps span {
		color: #83cad6;
		font-size: 0.48rem;
	}
	.route-blocked {
		padding: 1rem;
		border: 1px solid rgba(210, 120, 112, 0.28);
		background: rgba(120, 55, 50, 0.1);
	}
	.route-blocked strong {
		color: #dc8a81;
		font:
			400 1.1rem Georgia,
			serif;
	}
	.route-blocked p {
		margin: 0.5rem 0 0;
		color: rgba(243, 239, 229, 0.48);
		font-size: 0.54rem;
		line-height: 1.55;
	}
	.authority-note {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.authority-note span {
		color: #d7aa5b;
		font-size: 0.44rem;
		text-transform: uppercase;
	}
	.authority-note p {
		margin: 0.35rem 0 0;
		color: rgba(243, 239, 229, 0.35);
		font-size: 0.52rem;
		line-height: 1.55;
	}
	.interior,
	.building-ledger {
		padding: clamp(5rem, 8vw, 8rem) clamp(1.2rem, 4vw, 4rem);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.section-heading {
		padding: 0 0 2rem;
	}
	.section-heading > div > p:not(.eyebrow) {
		max-width: 44rem;
		margin: 1rem 0 0;
		color: rgba(243, 239, 229, 0.45);
		font-size: 0.68rem;
		line-height: 1.65;
	}
	.camera-seal {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0.2rem 0.7rem;
		align-items: baseline;
	}
	.camera-seal span {
		color: rgba(243, 239, 229, 0.32);
		font-size: 0.45rem;
		text-transform: uppercase;
	}
	.camera-seal strong {
		color: #77d1ae;
		font:
			400 1.2rem Georgia,
			serif;
	}
	.camera-seal code {
		grid-column: 1 / -1;
		color: #83cad6;
		font-size: 0.5rem;
	}
	.interior-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(19rem, 0.65fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.interior-stage {
		position: relative;
		min-height: 36rem;
		overflow: hidden;
		background:
			radial-gradient(
				circle at 50% 38%,
				color-mix(in srgb, var(--ambient) 28%, transparent),
				transparent 45%
			),
			linear-gradient(#111722 0 55%, #0c0f14 56%);
		isolation: isolate;
	}
	.interior-sky {
		position: absolute;
		inset: 0 0 45%;
		z-index: -2;
		background:
			linear-gradient(
				90deg,
				transparent 49%,
				color-mix(in srgb, var(--ambient) 35%, transparent) 50% 51%,
				transparent 52%
			),
			radial-gradient(
				ellipse at 50% 0,
				color-mix(in srgb, var(--ambient) 35%, transparent),
				transparent 68%
			);
	}
	.rear-arches {
		position: absolute;
		inset: 12% 7% 39%;
		z-index: -1;
		border: 1px solid color-mix(in srgb, var(--ambient) 25%, transparent);
		background: repeating-linear-gradient(90deg, #11151b 0 12%, #1c2025 12% 14%);
		clip-path: polygon(0 14%, 8% 0, 92% 0, 100% 14%, 96% 100%, 4% 100%);
	}
	.floor-plane {
		position: absolute;
		right: -18%;
		bottom: -30%;
		left: -18%;
		height: 70%;
		background:
			linear-gradient(color-mix(in srgb, var(--ambient) 15%, transparent) 1px, transparent 1px),
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--ambient) 12%, transparent) 1px,
				transparent 1px
			),
			#111216;
		background-size: 4rem 4rem;
		transform: perspective(30rem) rotateX(58deg);
		transform-origin: center top;
	}
	.gate-set,
	.kitchen-set,
	.dormitory-set,
	.training-set,
	.workshop-set {
		position: absolute;
		left: 50%;
		top: 43%;
		width: 45%;
		height: 43%;
		transform: translate(-50%, -50%);
	}
	.gate-set i {
		position: absolute;
		inset: 0 18%;
		border: 1.2rem solid #27343a;
		border-bottom-width: 2.5rem;
		border-radius: 50% 50% 12% 12%;
		box-shadow:
			inset 0 0 2rem var(--ambient),
			0 0 3rem color-mix(in srgb, var(--ambient) 40%, transparent);
	}
	.gate-set span {
		position: absolute;
		right: 5%;
		bottom: 10%;
		left: 5%;
		height: 12%;
		border: 2px solid #725f45;
		border-radius: 50%;
	}
	.kitchen-set i {
		position: absolute;
		left: 4%;
		bottom: 22%;
		width: 32%;
		height: 45%;
		background: #2e2924;
		box-shadow: inset 0 -1rem 2rem #8c4c2a;
		clip-path: polygon(5% 20%, 50% 0, 95% 20%, 100% 100%, 0 100%);
	}
	.kitchen-set span {
		position: absolute;
		right: 5%;
		bottom: 16%;
		width: 58%;
		height: 18%;
		background: #493b2e;
		transform: skewX(-14deg);
		box-shadow: 0 1.1rem 0 -0.45rem #211c18;
	}
	.kitchen-set b {
		position: absolute;
		left: 18%;
		bottom: 31%;
		width: 0.6rem;
		height: 1.5rem;
		background: #e39345;
		filter: blur(2px);
		box-shadow: 0 0 1rem #e39345;
	}
	.dormitory-set {
		display: flex;
		justify-content: center;
		gap: 4%;
		align-items: end;
	}
	.dormitory-set i {
		width: 27%;
		height: 55%;
		border: 0.6rem solid #252a30;
		background: repeating-linear-gradient(#555d69 0 8%, #1a1e24 9% 46%);
		box-shadow: inset 0 0 1.5rem color-mix(in srgb, var(--ambient) 20%, transparent);
	}
	.dormitory-set span {
		position: absolute;
		right: -8%;
		bottom: 4%;
		width: 15%;
		aspect-ratio: 1;
		border: 1px solid #77849a;
		border-radius: 50%;
	}
	.training-set i {
		position: absolute;
		inset: 22% 5% 5%;
		border: 0.35rem solid #725b41;
		border-radius: 50%;
		transform: rotateX(58deg);
		box-shadow: inset 0 0 2rem rgba(164, 102, 65, 0.2);
	}
	.training-set span,
	.training-set b {
		position: absolute;
		top: 0;
		width: 0.5rem;
		height: 55%;
		background: #695744;
	}
	.training-set span {
		left: 18%;
	}
	.training-set b {
		right: 18%;
	}
	.workshop-set i {
		position: absolute;
		right: 4%;
		bottom: 16%;
		width: 34%;
		height: 62%;
		background: linear-gradient(#292c30 0 58%, #1c1110 59%);
		clip-path: polygon(25% 0, 75% 0, 100% 100%, 0 100%);
	}
	.workshop-set span {
		position: absolute;
		left: 2%;
		bottom: 17%;
		width: 58%;
		height: 17%;
		background: #40372e;
		box-shadow: 0 1rem 0 -0.4rem #191817;
	}
	.workshop-set b {
		position: absolute;
		right: 12%;
		bottom: 29%;
		width: 16%;
		height: 18%;
		border: 1px solid #a56452;
		background: #120d0d;
	}
	.zone {
		position: absolute;
		left: var(--x);
		top: var(--y);
		z-index: 5;
		padding: 0.45rem 0.55rem;
		border: 1px solid rgba(255, 255, 255, 0.13);
		background: rgba(6, 8, 11, 0.8);
		color: #f3efe5;
		cursor: pointer;
		text-align: left;
		transform: translate(-50%, -50%);
		backdrop-filter: blur(8px);
	}
	.zone:hover,
	.zone:focus-visible,
	.zone.selected {
		border-color: var(--ambient);
		outline: none;
		box-shadow: 0 0 1.4rem color-mix(in srgb, var(--ambient) 28%, transparent);
	}
	.zone i {
		display: inline-block;
		width: 0.38rem;
		height: 0.38rem;
		margin-right: 0.35rem;
		border: 1px solid var(--ambient);
		border-radius: 50%;
	}
	.zone.selected i {
		background: var(--ambient);
	}
	.zone strong,
	.zone small {
		display: block;
	}
	.zone strong {
		font:
			400 0.62rem Georgia,
			serif;
	}
	.zone small {
		margin-top: 0.15rem;
		color: rgba(243, 239, 229, 0.35);
		font-size: 0.38rem;
		text-transform: uppercase;
	}
	.interior-caption {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		z-index: 6;
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		padding: 0.8rem;
		border-top: 1px solid color-mix(in srgb, var(--ambient) 30%, transparent);
		background: rgba(6, 8, 11, 0.72);
	}
	.interior-caption span {
		color: var(--ambient);
		font-size: 0.46rem;
		text-transform: uppercase;
	}
	.interior-caption strong {
		max-width: 28rem;
		font:
			400 0.75rem Georgia,
			serif;
		text-align: right;
	}
	.layer-ledger {
		display: grid;
		grid-template-rows: repeat(3, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.layer-ledger article {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.8rem;
		align-content: center;
		padding: 1.2rem;
		background: #0a0d12;
	}
	.layer-ledger article > i {
		color: rgba(217, 178, 103, 0.45);
		font:
			normal 0.48rem ui-monospace,
			monospace;
	}
	.layer-ledger span,
	.layer-ledger strong {
		display: block;
	}
	.layer-ledger span {
		color: #83cad6;
		font-size: 0.45rem;
		text-transform: uppercase;
	}
	.layer-ledger strong {
		margin-top: 0.25rem;
		font:
			400 0.78rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.layer-ledger p {
		grid-column: 1 / -1;
		margin: 0;
		color: rgba(243, 239, 229, 0.38);
		font-size: 0.53rem;
		line-height: 1.55;
	}
	.building-table {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.building-table article {
		min-width: 0;
		padding: 1rem;
		background: #0a0d12;
	}
	.building-table header span,
	.building-table header strong {
		display: block;
	}
	.building-table header span,
	.building-table article > div > span {
		color: #d7aa5b;
		font-size: 0.42rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.building-table header strong {
		margin-top: 0.35rem;
		font:
			400 1rem Georgia,
			serif;
	}
	.building-table article > div {
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}
	.building-table article > div > span {
		color: rgba(243, 239, 229, 0.28);
	}
	.building-table article > div p {
		margin: 0.35rem 0 0;
		color: rgba(243, 239, 229, 0.48);
		font-size: 0.5rem;
		line-height: 1.55;
	}
	.building-table code {
		display: block;
		margin-top: 1rem;
		color: #83cad6;
		font-size: 0.45rem;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		padding: 2rem clamp(1.2rem, 4vw, 4rem) 5rem;
		color: rgba(243, 239, 229, 0.4);
		font-size: 0.55rem;
	}
	footer a {
		color: #d7aa5b;
		text-transform: uppercase;
	}
	@media (max-width: 1100px) {
		.world-grid,
		.interior-grid {
			grid-template-columns: 1fr;
		}
		.building-table {
			grid-template-columns: repeat(2, 1fr);
		}
		.layer-ledger {
			grid-template-columns: repeat(3, 1fr);
			grid-template-rows: none;
		}
	}
	@media (max-width: 760px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div,
		.topbar nav a:not(:first-child) {
			display: none;
		}
		.opening {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
		h1 {
			font-size: clamp(3.2rem, 15vw, 5rem);
		}
		.panel-heading,
		.section-heading,
		footer {
			align-items: flex-start;
			flex-direction: column;
		}
		.settlement-map {
			aspect-ratio: 1 / 1.15;
		}
		.route-layer {
			object-fit: fill;
		}
		.building-button {
			min-width: 3rem;
			padding: 0.35rem;
		}
		.building-button strong {
			font-size: 0.48rem;
		}
		.building-button small,
		.building-button > i {
			display: none;
		}
		.building-mark {
			width: 1.8rem;
			height: 1rem;
		}
		.map-caption strong {
			display: none;
		}
		.interior-stage {
			min-height: 26rem;
		}
		.zone {
			padding: 0.35rem;
		}
		.zone strong {
			font-size: 0.48rem;
		}
		.zone small {
			display: none;
		}
		.interior-caption strong {
			font-size: 0.58rem;
		}
		.layer-ledger,
		.building-table {
			grid-template-columns: 1fr;
		}
		.route-inspector {
			min-height: 34rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.building-button,
		.route-line,
		.traveler {
			transition: none;
		}
	}
</style>
