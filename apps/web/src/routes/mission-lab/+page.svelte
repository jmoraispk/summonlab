<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		MissionArenaEdge,
		MissionArenaNode,
		MissionDiscoveryAffordance,
		MissionRoutePlan
	} from '@summonlab/contracts';

	let { data } = $props();
	let selectedFloor = $state(1);
	let selectedNodeId = $state('tower-threshold');
	let discoveredIds = $state<string[]>([]);
	let visitedNodeIds = $state<string[]>(['tower-threshold']);
	let viewMode = $state<'knowledge' | 'truth'>('knowledge');
	let latestDiscoveryId = $state<string | null>(null);
	let retainedRouteMemory = $state(false);

	const mission = $derived(
		data.missions.find((candidate) => candidate.tower?.floor === selectedFloor) ?? data.missions[0]!
	);
	const missionRoutes = $derived(data.routes[mission.missionId]!);
	const floorTitle = $derived(mission.displayName.replace(/^Floor \d+ · /u, ''));
	const toolTags = $derived(new Set(retainedRouteMemory ? ['relay-route-memory'] : []));

	const discovered = $derived(new Set(discoveredIds));
	const visited = $derived(new Set(visitedNodeIds));
	const revealedNodeIds = $derived(
		new Set(
			mission.arena.discoveries
				.filter((discovery) => discovered.has(discovery.discoveryId))
				.flatMap((discovery) => discovery.revealNodeIds)
		)
	);
	const visibleNodeIds = $derived(
		new Set(
			mission.arena.nodes
				.filter((node) => node.initialKnowledge === 'known' || revealedNodeIds.has(node.nodeId))
				.map((node) => node.nodeId)
		)
	);
	const visibleEdgeIds = $derived(
		new Set(
			mission.arena.edges
				.filter(
					(edge) =>
						visibleNodeIds.has(edge.fromNodeId) &&
						visibleNodeIds.has(edge.toNodeId) &&
						(edge.access.kind === 'open' || discovered.has(edge.access.discoveryId))
				)
				.map((edge) => edge.edgeId)
		)
	);
	const selectedNode = $derived(
		mission.arena.nodes.find((node) => node.nodeId === selectedNodeId) ?? mission.arena.nodes[0]!
	);
	const selectedObservations = $derived(
		mission.arena.observations.filter(
			(observation) =>
				observation.nodeId === selectedNodeId &&
				(observation.reveal.kind === 'discovery'
					? discovered.has(observation.reveal.discoveryId)
					: visited.has(observation.nodeId))
		)
	);
	const selectedAffordances = $derived(
		mission.arena.discoveryAffordances.filter(
			(affordance) =>
				affordance.nodeId === selectedNodeId &&
				visited.has(affordance.nodeId) &&
				affordance.requiresDiscoveryIds.every((id) => discovered.has(id)) &&
				affordance.requiredToolTags.every((tag) => toolTags.has(tag)) &&
				affordance.blockedByDiscoveryIds.every((id) => !discovered.has(id))
		)
	);
	const routeKey = $derived([...discovered].sort().join('|') || 'none');
	const currentRoute = $derived((missionRoutes[routeKey] ?? null) as MissionRoutePlan | null);
	const activeRouteEdgeIds = $derived(
		new Set((currentRoute?.steps ?? []).map((step) => step.edgeId))
	);
	const latestDiscovery = $derived(
		mission.arena.discoveries.find((discovery) => discovery.discoveryId === latestDiscoveryId) ??
			null
	);
	const primaryObjective = $derived(mission.objectives.find((objective) => objective.primary)!);

	function pathPoints(edge: MissionArenaEdge): string {
		return edge.visualPath.map((point) => `${point.x},${point.y}`).join(' ');
	}

	function nodeStyle(node: MissionArenaNode): string {
		return `--x:${(node.position.x / mission.design.width) * 100}%;--y:${(node.position.y / mission.design.height) * 100}%`;
	}

	function isNodeVisible(node: MissionArenaNode): boolean {
		return viewMode === 'truth' || visibleNodeIds.has(node.nodeId);
	}

	function edgeVisibility(edge: MissionArenaEdge): 'visible' | 'concealed' | 'hidden' {
		if (visibleEdgeIds.has(edge.edgeId)) return 'visible';
		if (viewMode === 'truth') return 'concealed';
		return 'hidden';
	}

	function inspectNode(node: MissionArenaNode): void {
		selectedNodeId = node.nodeId;
		if (visibleNodeIds.has(node.nodeId) && !visited.has(node.nodeId)) {
			visitedNodeIds = [...visitedNodeIds, node.nodeId].sort();
		}
	}

	function resolveAffordance(affordance: MissionDiscoveryAffordance): void {
		const outcomes = affordance.outcomeDiscoveryIds.filter((id) => !discovered.has(id));
		if (outcomes.length === 0) return;
		discoveredIds = [...new Set([...discoveredIds, ...outcomes])].sort();
		latestDiscoveryId = outcomes[0]!;
	}

	function resetKnowledge(): void {
		selectedNodeId = mission.deployment.entryNodeIds[0]!;
		discoveredIds = [];
		visitedNodeIds = [mission.deployment.entryNodeIds[0]!];
		latestDiscoveryId = null;
		viewMode = 'knowledge';
	}

	function selectFloor(floor: number): void {
		selectedFloor = floor;
		selectedNodeId = 'tower-threshold';
		discoveredIds = [];
		visitedNodeIds = ['tower-threshold'];
		latestDiscoveryId = null;
		retainedRouteMemory = false;
		viewMode = 'knowledge';
	}

	function roleLabel(node: MissionArenaNode): string {
		return node.roles.length > 0 ? node.roles.join(' · ') : node.kind;
	}
</script>

<svelte:head>
	<title>{floorTitle} · Mission package lab</title>
	<meta
		name="description"
		content="Inspect the validated Tower Band 01 mission packages, arena knowledge boundaries, legal discoveries, fixed story anchors, and reward contracts."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>MIS-005</span><strong>First band atlas</strong></div>
		<nav aria-label="Mission lab links">
			<a href={resolve('/settlement-lab')}>Hearth 01</a>
			<a href={resolve('/forge')}>Forge</a>
			<a href={resolve('/design-reference')}>Design reference</a>
		</nav>
	</header>

	<section class="opening">
		<div class="floor-mark" aria-hidden="true">
			<span>{String(selectedFloor).padStart(2, '0')}</span><i>{selectedFloor}</i>
		</div>
		<div class="opening-title">
			<p class="eyebrow">Tower band 01 · floor {String(selectedFloor).padStart(2, '0')} of 100</p>
			<h1>{floorTitle}</h1>
			<p>{mission.tagline}</p>
		</div>
		<div class="mission-seal">
			<span>Primary objective</span>
			<strong>{primaryObjective.title}</strong>
			<p>{primaryObjective.summary}</p>
			<code>{mission.contentHash.slice(0, 16)}</code>
		</div>
	</section>

	<section class="band-index" aria-label="Tower Band 01 floors">
		{#each data.missions as candidate (candidate.missionId)}
			<button
				type="button"
				class:active={candidate.tower?.floor === selectedFloor}
				onclick={() => selectFloor(candidate.tower!.floor)}
			>
				<i>{String(candidate.tower!.floor).padStart(2, '0')}</i>
				<span>{candidate.displayName.replace(/^Floor \d+ · /u, '')}</span>
				<small>{candidate.objectives.find((objective) => objective.primary)!.kind}</small>
			</button>
		{/each}
	</section>

	{#if selectedFloor === 5}
		<section class="memory-gate" data-testid="route-memory-gate">
			<div>
				<span>Cross-floor knowledge gate</span>
				<strong>Floor 04 · Foundry maintenance schematic</strong>
				<p>The route is not a free hint. A hero must have retained the relay archive evidence.</p>
			</div>
			<button
				type="button"
				class:active={retainedRouteMemory}
				onclick={() => (retainedRouteMemory = !retainedRouteMemory)}
			>
				{retainedRouteMemory ? 'Memory previewed' : 'Preview retained memory'}
			</button>
		</section>
	{/if}

	<section class="boundary-strip" aria-label="Mission package boundaries">
		<article>
			<span>Party</span><strong
				>{mission.deployment.minimumPartyMembers}–{mission.deployment.maximumPartyMembers}</strong
			><small>Master counts · no reserve</small>
		</article>
		<article>
			<span>Entry</span><strong
				>{mission.arena.nodes.find((node) => node.nodeId === mission.deployment.entryNodeIds[0])!
					.label}</strong
			><small>One authored deployment node</small>
		</article>
		<article>
			<span>Success</span><strong>{primaryObjective.kind}</strong><small
				>{primaryObjective.title}</small
			>
		</article>
		<article>
			<span>Reward budget</span><strong>{mission.rewards.budgetPoints}</strong><small
				>Immutable package points</small
			>
		</article>
	</section>

	<section class="arena-grid" aria-labelledby="arena-heading">
		<div class="arena-panel">
			<header class="panel-heading">
				<div>
					<p class="eyebrow">Arena knowledge projection</p>
					<h2 id="arena-heading">The map cannot<br />know for them.</h2>
				</div>
				<div class="view-switch" role="group" aria-label="Arena view">
					<button
						type="button"
						class:active={viewMode === 'knowledge'}
						onclick={() => (viewMode = 'knowledge')}>Hero knowledge</button
					>
					<button
						type="button"
						class:active={viewMode === 'truth'}
						onclick={() => (viewMode = 'truth')}>Author truth</button
					>
				</div>
			</header>

			<div class="arena-map" data-testid="mission-arena-map">
				<div class="vault-glow" aria-hidden="true"></div>
				<div class="stone-grid" aria-hidden="true"></div>
				<svg
					viewBox={`0 0 ${mission.design.width} ${mission.design.height}`}
					role="img"
					aria-label={`Tower Floor ${String(selectedFloor).padStart(2, '0')} arena graph`}
				>
					<defs>
						<filter id="ember-glow"><feGaussianBlur stdDeviation="10"></feGaussianBlur></filter>
						<linearGradient id="path-metal" x1="0" y1="0" x2="1" y2="0">
							<stop offset="0" stop-color="#68543f"></stop>
							<stop offset="1" stop-color="#b3874a"></stop>
						</linearGradient>
					</defs>
					{#each mission.arena.edges as edge (edge.edgeId)}
						{@const visibility = edgeVisibility(edge)}
						{#if visibility !== 'hidden'}
							<polyline class="edge-shadow" points={pathPoints(edge)}></polyline>
							<polyline
								class="arena-edge"
								class:active={activeRouteEdgeIds.has(edge.edgeId)}
								class:concealed={visibility === 'concealed'}
								class:secret={edge.access.kind === 'requires-discovery'}
								points={pathPoints(edge)}
							></polyline>
						{/if}
					{/each}
				</svg>

				{#each mission.arena.nodes as node, index (node.nodeId)}
					{#if isNodeVisible(node)}
						<button
							type="button"
							class="arena-node"
							class:selected={selectedNodeId === node.nodeId}
							class:visited={visited.has(node.nodeId)}
							class:concealed={!visibleNodeIds.has(node.nodeId)}
							class:objective={node.roles.includes('objective')}
							class:secret={node.roles.includes('secret')}
							style={nodeStyle(node)}
							aria-label={`Inspect ${node.label}${visibleNodeIds.has(node.nodeId) ? '' : ' in author truth'}`}
							onclick={() => inspectNode(node)}
						>
							<i>{String(index + 1).padStart(2, '0')}</i>
							<strong>{node.label}</strong>
							<small>{visibleNodeIds.has(node.nodeId) ? roleLabel(node) : 'concealed truth'}</small>
						</button>
					{/if}
				{/each}

				<div class="map-legend">
					<span><i class="known-dot"></i> Known</span>
					<span><i class="visited-dot"></i> Visited</span>
					<span><i class="secret-dot"></i> Discovered route</span>
				</div>
				<div class="map-status">
					<strong>{visibleNodeIds.size} / {mission.arena.nodes.length}</strong>
					<span>nodes visible</span>
				</div>
			</div>
		</div>

		<aside class="node-inspector" aria-labelledby="node-heading">
			<p class="eyebrow">Selected place</p>
			<h2 id="node-heading">{selectedNode.label}</h2>
			<p class="node-summary">{selectedNode.summary}</p>
			<div class="node-metrics">
				<div><span>Elevation</span><strong>{selectedNode.elevation}</strong></div>
				<div><span>Capacity</span><strong>{selectedNode.capacity}</strong></div>
				<div>
					<span>Knowledge</span><strong
						>{visibleNodeIds.has(selectedNode.nodeId) ? 'known' : 'sealed'}</strong
					>
				</div>
			</div>

			<section class="observations" aria-label="Available observations">
				<header>
					<span>Witnessed observations</span><strong>{selectedObservations.length}</strong>
				</header>
				{#if selectedObservations.length > 0}
					{#each selectedObservations as observation (observation.observationId)}
						<article>
							<i>{observation.kind}</i>
							<p>{observation.summary}</p>
						</article>
					{/each}
				{:else}
					<p class="empty-copy">
						{visibleNodeIds.has(selectedNode.nodeId)
							? 'Select this known node to simulate arrival and reveal only its on-entry evidence.'
							: 'Author truth is not character knowledge. Nothing from this node enters a packet.'}
					</p>
				{/if}
			</section>

			<section class="affordances" aria-label="Legal discovery affordances">
				<header>
					<span>Legal discovery actions</span><strong>{selectedAffordances.length}</strong>
				</header>
				{#each selectedAffordances as affordance (affordance.affordanceId)}
					<button type="button" onclick={() => resolveAffordance(affordance)}>
						<span>{affordance.kind} · {affordance.timeActions} action</span>
						<strong>{affordance.label}</strong>
						<small>{affordance.description}</small>
					</button>
				{/each}
				{#if selectedAffordances.length === 0}
					<p class="empty-copy">No unresolved authored discovery action is legal here.</p>
				{/if}
			</section>

			<button class="reset" type="button" onclick={resetKnowledge}>Reset projected knowledge</button
			>
		</aside>
	</section>

	{#if latestDiscovery}
		<section class="discovery-banner" data-testid="mission-discovery" aria-live="polite">
			<div><span>Discovery entered knowledge</span><strong>{latestDiscovery.title}</strong></div>
			<p>{latestDiscovery.summary}</p>
			<code>{latestDiscovery.discoveryId}</code>
		</section>
	{/if}

	<section class="route-and-story">
		<article class="route-card" data-testid="mission-route">
			<p class="eyebrow">
				Current route to {mission.arena.nodes.find(
					(node) => node.nodeId === primaryObjective.targetNodeIds[0]
				)!.label}
			</p>
			<header>
				<h2>{currentRoute?.totalTraversalActions ?? '—'} actions</h2>
				<span class:danger={currentRoute?.maximumExposure === 'exposed'}
					>{currentRoute?.maximumExposure ?? 'unreachable'} exposure</span
				>
			</header>
			{#if currentRoute}
				<ol>
					{#each currentRoute.nodeIds as nodeId, index (nodeId)}
						<li>
							<i>{String(index + 1).padStart(2, '0')}</i>
							<strong>{mission.arena.nodes.find((node) => node.nodeId === nodeId)!.label}</strong>
							{#if index < currentRoute.steps.length}
								<span>{currentRoute.steps[index]!.exposure}</span>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
			<p class="boundary-note">
				The route preview changes only when a persisted discovery eventually changes mission
				knowledge. This lab mutates no run state.
			</p>
		</article>

		<article class="story-card" data-testid="story-envelope">
			<p class="eyebrow">Fixed spine · bounded expression</p>
			<h2>Agents may bend the route.<br /><em>Not the truth.</em></h2>
			<p class="theme">{mission.story.openingQuestion}</p>
			<div class="story-line">
				{#each mission.story.anchors as anchor, index (anchor.anchorId)}
					<div class="anchor">
						<i>{String(index + 1).padStart(2, '0')}</i>
						<strong
							>{mission.story.beats.find((beat) => beat.beatId === anchor.beatId)!.title}</strong
						>
						<small>{anchor.immutableFact}</small>
					</div>
					{#if index === 1}
						<div class="patch-slot">
							<span>Agent patch slot</span>
							<strong>Choose 1 of {mission.story.proposalCatalog.length}</strong>
							<small>Optional beat only</small>
						</div>
					{/if}
				{/each}
			</div>
			<div class="forbidden">
				<span>Cannot rewrite</span>
				<p>{mission.story.forbiddenChanges.join(' · ')}</p>
			</div>
		</article>
	</section>

	<section class="package-ledger">
		<header>
			<div>
				<p class="eyebrow">Content declaration · execution comes later</p>
				<h2>What Floor {String(selectedFloor).padStart(2, '0')} promises.</h2>
			</div>
			<code>{mission.contentVersion}</code>
		</header>
		<div class="ledger-grid">
			<article>
				<span>Monster duties</span>
				{#each mission.monsterDuties as duty (duty.dutySlotId)}
					<div>
						<strong>{duty.dutySlotId.replaceAll('-', ' ')}</strong><small
							>{duty.count.min}–{duty.count.max} · {duty.policyId}</small
						>
					</div>
				{/each}
			</article>
			<article>
				<span>Reward grants</span>
				{#each mission.rewards.grants as grant (grant.grantId)}
					<div>
						<strong>{grant.key.replaceAll('-', ' ')}</strong><small
							>{grant.trigger} · cost {grant.budgetCost}</small
						>
					</div>
				{/each}
			</article>
			<article>
				<span>Entropy purposes</span>
				{#each mission.encounterSeedRules.namedPurposes as purpose (purpose)}
					<div>
						<strong>{purpose.replaceAll('-', ' ')}</strong><small>named deterministic draw</small>
					</div>
				{/each}
			</article>
		</div>
	</section>

	<footer>
		<span>MIS-005 · authored first band</span>
		<p>Next: make the maintenance route and cooling control engine-owned and replayable.</p>
	</footer>
</main>

<style>
	:global(body) {
		background:
			radial-gradient(circle at 82% 18%, rgba(210, 93, 45, 0.14), transparent 28rem),
			linear-gradient(135deg, #080a0e, #0b0d12 52%, #100b0a);
	}

	main {
		min-height: 100vh;
		overflow: hidden;
		color: #eee8dc;
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		padding: 1.3rem clamp(1.2rem, 4vw, 4rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(5, 7, 10, 0.78);
		backdrop-filter: blur(18px);
	}

	.wordmark {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.25em;
		text-transform: uppercase;
	}

	.topbar > div {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.topbar > div span {
		color: #e49a54;
	}

	.topbar nav {
		display: flex;
		justify-content: flex-end;
		gap: 1.2rem;
		color: rgba(238, 232, 220, 0.52);
		font-size: 0.58rem;
		text-transform: uppercase;
	}

	.topbar a:hover,
	.topbar a:focus-visible {
		color: #f2bd72;
	}

	.opening {
		display: grid;
		grid-template-columns: auto minmax(0, 1.2fr) minmax(20rem, 0.65fr);
		gap: clamp(1.5rem, 5vw, 5rem);
		align-items: end;
		padding: clamp(4rem, 9vw, 9rem) clamp(1.2rem, 5vw, 5.5rem) clamp(3rem, 6vw, 6rem);
		background:
			linear-gradient(90deg, transparent 49.8%, rgba(255, 255, 255, 0.025) 50%, transparent 50.2%),
			repeating-linear-gradient(90deg, transparent 0 8rem, rgba(255, 255, 255, 0.012) 8rem 8.05rem);
	}

	.floor-mark {
		position: relative;
		display: grid;
		place-items: center;
		width: clamp(5rem, 10vw, 9rem);
		aspect-ratio: 1;
		border: 1px solid rgba(228, 154, 84, 0.35);
		border-radius: 50%;
		box-shadow: inset 0 0 3rem rgba(228, 92, 45, 0.08);
	}

	.floor-mark::before,
	.floor-mark::after {
		content: '';
		position: absolute;
		inset: 10%;
		border: 1px solid rgba(255, 255, 255, 0.08);
		transform: rotate(45deg);
	}

	.floor-mark::after {
		inset: 25%;
	}

	.floor-mark span {
		font:
			400 clamp(1.5rem, 3vw, 2.8rem) Georgia,
			serif;
	}

	.floor-mark i {
		position: absolute;
		bottom: -0.7rem;
		padding: 0.1rem 0.45rem;
		background: #0a0c10;
		color: #e49a54;
		font:
			normal 0.55rem Georgia,
			serif;
	}

	.eyebrow {
		margin: 0 0 0.7rem;
		color: #d99452;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 1rem;
		font:
			400 clamp(3.6rem, 7vw, 7.4rem) / 0.86 Georgia,
			'Times New Roman',
			serif;
		letter-spacing: -0.065em;
		text-wrap: balance;
	}

	.story-card h2 em {
		color: #d6864d;
		font-weight: 400;
	}

	.opening-title > p:last-child {
		max-width: 44rem;
		margin: 0;
		color: rgba(238, 232, 220, 0.55);
		font-size: 0.82rem;
		line-height: 1.65;
	}

	.mission-seal {
		padding: 1.4rem;
		border: 1px solid rgba(228, 154, 84, 0.24);
		background: linear-gradient(145deg, rgba(60, 34, 24, 0.35), rgba(10, 12, 16, 0.9));
		box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.3);
	}

	.mission-seal span,
	.mission-seal strong,
	.mission-seal code {
		display: block;
	}

	.mission-seal span {
		color: #d99452;
		font-size: 0.5rem;
		text-transform: uppercase;
	}

	.mission-seal strong {
		margin-top: 0.5rem;
		font:
			400 1.35rem Georgia,
			serif;
	}

	.mission-seal p {
		margin: 0.7rem 0 1rem;
		color: rgba(238, 232, 220, 0.45);
		font-size: 0.6rem;
		line-height: 1.6;
	}

	.mission-seal code {
		padding-top: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		color: rgba(238, 232, 220, 0.28);
		font-size: 0.48rem;
	}

	.band-index {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 1px;
		margin: 0 clamp(1.2rem, 4vw, 4rem) 1px;
		background: rgba(255, 255, 255, 0.09);
	}

	.band-index button {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.7rem;
		align-items: center;
		min-width: 0;
		padding: 0.95rem 1rem;
		border: 0;
		background: #0a0d12;
		color: rgba(238, 232, 220, 0.48);
		cursor: pointer;
		text-align: left;
	}

	.band-index button:hover,
	.band-index button:focus-visible,
	.band-index button.active {
		outline: none;
		background: linear-gradient(135deg, rgba(104, 50, 28, 0.45), #101116);
		color: #f0d9bd;
		box-shadow: inset 0 -2px #da8750;
	}

	.band-index i {
		color: #d88b52;
		font:
			normal 0.56rem ui-monospace,
			monospace;
	}

	.band-index span {
		overflow: hidden;
		font:
			400 0.7rem Georgia,
			serif;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.band-index small {
		color: rgba(238, 232, 220, 0.25);
		font-size: 0.4rem;
		text-transform: uppercase;
	}

	.memory-gate {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: center;
		margin: 0 clamp(1.2rem, 4vw, 4rem) 1px;
		padding: 1rem 1.2rem;
		border: 1px solid rgba(67, 180, 188, 0.22);
		background: linear-gradient(90deg, rgba(24, 73, 78, 0.28), rgba(8, 11, 15, 0.92));
	}

	.memory-gate span,
	.memory-gate strong {
		display: block;
	}

	.memory-gate span {
		color: #52b4bc;
		font-size: 0.43rem;
		text-transform: uppercase;
	}

	.memory-gate strong {
		margin-top: 0.25rem;
		font:
			400 0.82rem Georgia,
			serif;
	}

	.memory-gate p {
		margin: 0.3rem 0 0;
		color: rgba(238, 232, 220, 0.38);
		font-size: 0.48rem;
	}

	.memory-gate button {
		padding: 0.75rem 0.9rem;
		border: 1px solid rgba(82, 180, 188, 0.35);
		background: transparent;
		color: #81ccd2;
		cursor: pointer;
		font-size: 0.46rem;
		text-transform: uppercase;
	}

	.memory-gate button.active {
		background: rgba(82, 180, 188, 0.18);
		box-shadow: 0 0 1.5rem rgba(82, 180, 188, 0.12);
	}

	.boundary-strip {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		margin: 0 clamp(1.2rem, 4vw, 4rem) clamp(3rem, 6vw, 6rem);
		background: rgba(255, 255, 255, 0.08);
	}

	.boundary-strip article {
		padding: 1rem 1.2rem;
		background: #0b0e13;
	}

	.boundary-strip span,
	.boundary-strip strong,
	.boundary-strip small {
		display: block;
	}

	.boundary-strip span {
		color: rgba(238, 232, 220, 0.3);
		font-size: 0.45rem;
		text-transform: uppercase;
	}

	.boundary-strip strong {
		margin-top: 0.35rem;
		font:
			400 1rem Georgia,
			serif;
	}

	.boundary-strip small {
		margin-top: 0.25rem;
		color: #b17048;
		font-size: 0.46rem;
	}

	.arena-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(20rem, 0.55fr);
		gap: 1px;
		margin: 0 clamp(1.2rem, 4vw, 4rem);
		background: rgba(255, 255, 255, 0.08);
	}

	.arena-panel,
	.node-inspector {
		background: #090c11;
	}

	.panel-heading {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: end;
		padding: 1.5rem;
	}

	h2 {
		margin-bottom: 0;
		font:
			400 clamp(2.2rem, 4vw, 4.5rem) / 0.92 Georgia,
			serif;
		letter-spacing: -0.045em;
	}

	.view-switch {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}

	.view-switch button {
		padding: 0.7rem 0.8rem;
		border: 0;
		background: #10141a;
		color: rgba(238, 232, 220, 0.35);
		cursor: pointer;
		font-size: 0.48rem;
		text-transform: uppercase;
	}

	.view-switch button.active {
		background: rgba(145, 78, 43, 0.3);
		color: #efb472;
		box-shadow: inset 0 2px #d4844d;
	}

	.arena-map {
		position: relative;
		min-height: 42rem;
		overflow: hidden;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		background:
			linear-gradient(180deg, rgba(23, 28, 35, 0.95), rgba(7, 9, 13, 0.98)),
			repeating-linear-gradient(90deg, transparent 0 5rem, rgba(255, 255, 255, 0.02) 5rem 5.1rem);
		isolation: isolate;
	}

	.arena-map::before,
	.arena-map::after {
		content: '';
		position: absolute;
		z-index: -1;
		border: 1px solid rgba(218, 158, 88, 0.08);
		border-radius: 50%;
	}

	.arena-map::before {
		inset: 10% 20%;
	}

	.arena-map::after {
		inset: 22% 32%;
	}

	.stone-grid {
		position: absolute;
		inset: 0;
		z-index: -2;
		background:
			linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
		background-size: 4rem 4rem;
		transform: perspective(40rem) rotateX(8deg);
	}

	.vault-glow {
		position: absolute;
		right: 3%;
		top: 32%;
		width: 18rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(221, 91, 43, 0.22), transparent 68%);
		filter: blur(14px);
	}

	.arena-map svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.edge-shadow,
	.arena-edge {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.edge-shadow {
		stroke: rgba(0, 0, 0, 0.75);
		stroke-width: 20;
	}

	.arena-edge {
		stroke: rgba(184, 177, 162, 0.23);
		stroke-width: 5;
		transition:
			stroke 180ms ease,
			opacity 180ms ease;
	}

	.arena-edge.active {
		stroke: url(#path-metal);
		stroke-width: 7;
	}

	.arena-edge.secret {
		stroke: #50aeb5;
		stroke-dasharray: 14 12;
	}

	.arena-edge.concealed {
		stroke: rgba(102, 154, 160, 0.22);
		stroke-dasharray: 8 18;
		opacity: 0.55;
	}

	.arena-node {
		position: absolute;
		left: var(--x);
		top: var(--y);
		z-index: 3;
		min-width: 8.5rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: rgba(8, 11, 15, 0.9);
		color: #eee8dc;
		cursor: pointer;
		text-align: left;
		transform: translate(-50%, -50%);
		backdrop-filter: blur(10px);
		box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.32);
	}

	.arena-node:hover,
	.arena-node:focus-visible,
	.arena-node.selected {
		border-color: #d58a50;
		outline: none;
		box-shadow: 0 0 1.8rem rgba(213, 100, 58, 0.2);
	}

	.arena-node.visited::after {
		content: '';
		position: absolute;
		right: 0.5rem;
		top: 0.5rem;
		width: 0.32rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: #e29a5e;
		box-shadow: 0 0 0.7rem #e29a5e;
	}

	.arena-node.objective {
		border-color: rgba(221, 91, 43, 0.65);
		background: rgba(45, 20, 15, 0.9);
	}

	.arena-node.secret {
		border-color: rgba(80, 174, 181, 0.55);
	}

	.arena-node.concealed {
		border-style: dashed;
		opacity: 0.48;
	}

	.arena-node i,
	.arena-node strong,
	.arena-node small {
		display: block;
	}

	.arena-node i {
		color: rgba(238, 232, 220, 0.25);
		font:
			normal 0.42rem ui-monospace,
			monospace;
	}

	.arena-node strong {
		margin-top: 0.25rem;
		font:
			400 0.74rem Georgia,
			serif;
	}

	.arena-node small {
		margin-top: 0.2rem;
		color: #a87350;
		font-size: 0.4rem;
		text-transform: uppercase;
	}

	.map-legend,
	.map-status {
		position: absolute;
		bottom: 1rem;
		z-index: 5;
		display: flex;
		gap: 1rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(5, 7, 10, 0.78);
		backdrop-filter: blur(10px);
	}

	.map-legend {
		left: 1rem;
		font-size: 0.42rem;
		text-transform: uppercase;
	}

	.map-legend span {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		color: rgba(238, 232, 220, 0.42);
	}

	.map-legend i {
		width: 0.42rem;
		aspect-ratio: 1;
		border: 1px solid #867d70;
		border-radius: 50%;
	}

	.map-legend .visited-dot {
		background: #d58a50;
		box-shadow: 0 0 0.5rem #d58a50;
	}

	.map-legend .secret-dot {
		border-color: #50aeb5;
	}

	.map-status {
		right: 1rem;
		align-items: baseline;
	}

	.map-status strong {
		font:
			400 1.1rem Georgia,
			serif;
	}

	.map-status span {
		color: rgba(238, 232, 220, 0.32);
		font-size: 0.42rem;
		text-transform: uppercase;
	}

	.node-inspector {
		padding: 1.5rem;
	}

	.node-inspector > h2 {
		font-size: clamp(2rem, 3vw, 3.2rem);
	}

	.node-summary {
		margin: 0.8rem 0 1.2rem;
		color: rgba(238, 232, 220, 0.45);
		font-size: 0.62rem;
		line-height: 1.6;
	}

	.node-metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}

	.node-metrics div {
		padding: 0.7rem;
		background: #0e1218;
	}

	.node-metrics span,
	.node-metrics strong {
		display: block;
	}

	.node-metrics span,
	.observations header span,
	.affordances header span {
		color: rgba(238, 232, 220, 0.28);
		font-size: 0.4rem;
		text-transform: uppercase;
	}

	.node-metrics strong {
		margin-top: 0.25rem;
		color: #d79b65;
		font:
			400 0.72rem Georgia,
			serif;
		text-transform: capitalize;
	}

	.observations,
	.affordances {
		margin-top: 1.2rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.observations header,
	.affordances header {
		display: flex;
		justify-content: space-between;
	}

	.observations header strong,
	.affordances header strong {
		color: #cf8751;
		font-size: 0.5rem;
	}

	.observations article {
		margin-top: 0.7rem;
		padding: 0.8rem;
		border-left: 2px solid #9d6847;
		background: rgba(255, 255, 255, 0.025);
	}

	.observations article i {
		color: #50aeb5;
		font:
			normal 0.4rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}

	.observations article p {
		margin: 0.35rem 0 0;
		color: rgba(238, 232, 220, 0.6);
		font:
			400 0.68rem / 1.55 Georgia,
			serif;
	}

	.empty-copy {
		margin: 0.7rem 0 0;
		color: rgba(238, 232, 220, 0.28);
		font-size: 0.52rem;
		line-height: 1.55;
	}

	.affordances button {
		display: block;
		width: 100%;
		margin-top: 0.7rem;
		padding: 0.85rem;
		border: 1px solid rgba(80, 174, 181, 0.28);
		background: rgba(32, 78, 82, 0.12);
		color: #eee8dc;
		cursor: pointer;
		text-align: left;
	}

	.affordances button:hover,
	.affordances button:focus-visible {
		border-color: #50aeb5;
		outline: none;
		box-shadow: 0 0 1rem rgba(80, 174, 181, 0.12);
	}

	.affordances button span,
	.affordances button strong,
	.affordances button small {
		display: block;
	}

	.affordances button span {
		color: #50aeb5;
		font-size: 0.4rem;
		text-transform: uppercase;
	}

	.affordances button strong {
		margin-top: 0.3rem;
		font:
			400 0.78rem Georgia,
			serif;
	}

	.affordances button small {
		margin-top: 0.35rem;
		color: rgba(238, 232, 220, 0.35);
		font-size: 0.48rem;
		line-height: 1.45;
	}

	.reset {
		width: 100%;
		margin-top: 1.2rem;
		padding: 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: transparent;
		color: rgba(238, 232, 220, 0.4);
		cursor: pointer;
		font-size: 0.46rem;
		text-transform: uppercase;
	}

	.discovery-banner {
		display: grid;
		grid-template-columns: minmax(14rem, 0.5fr) minmax(0, 1fr) auto;
		gap: 2rem;
		align-items: center;
		margin: 1px clamp(1.2rem, 4vw, 4rem) 0;
		padding: 1rem 1.3rem;
		border: 1px solid rgba(80, 174, 181, 0.28);
		background: linear-gradient(90deg, rgba(31, 83, 88, 0.22), rgba(9, 12, 17, 0.9));
	}

	.discovery-banner span,
	.discovery-banner strong {
		display: block;
	}

	.discovery-banner span {
		color: #50aeb5;
		font-size: 0.42rem;
		text-transform: uppercase;
	}

	.discovery-banner strong {
		margin-top: 0.25rem;
		font:
			400 1rem Georgia,
			serif;
	}

	.discovery-banner p {
		margin: 0;
		color: rgba(238, 232, 220, 0.48);
		font-size: 0.58rem;
		line-height: 1.55;
	}

	.discovery-banner code {
		color: rgba(238, 232, 220, 0.3);
		font-size: 0.46rem;
	}

	.route-and-story {
		display: grid;
		grid-template-columns: minmax(20rem, 0.55fr) minmax(0, 1.45fr);
		gap: 1px;
		margin: clamp(3rem, 6vw, 6rem) clamp(1.2rem, 4vw, 4rem) 0;
		background: rgba(255, 255, 255, 0.08);
	}

	.route-card,
	.story-card {
		padding: clamp(1.5rem, 3vw, 3rem);
		background: #090c11;
	}

	.route-card header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.route-card header h2 {
		font-size: clamp(2.5rem, 5vw, 5rem);
	}

	.route-card header span {
		padding: 0.4rem 0.6rem;
		border: 1px solid rgba(212, 157, 89, 0.25);
		color: #d49d59;
		font-size: 0.44rem;
		text-transform: uppercase;
	}

	.route-card header span.danger {
		border-color: rgba(213, 94, 71, 0.35);
		color: #d76f5d;
	}

	.route-card ol {
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	.route-card li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.7rem;
		align-items: center;
		padding: 0.65rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.route-card li i {
		color: rgba(238, 232, 220, 0.25);
		font:
			normal 0.42rem ui-monospace,
			monospace;
	}

	.route-card li strong {
		font:
			400 0.68rem Georgia,
			serif;
	}

	.route-card li span {
		color: #a56f4d;
		font-size: 0.4rem;
		text-transform: uppercase;
	}

	.boundary-note {
		margin: 1rem 0 0;
		color: rgba(238, 232, 220, 0.28);
		font-size: 0.48rem;
		line-height: 1.55;
	}

	.story-card {
		background: linear-gradient(135deg, rgba(38, 25, 19, 0.35), transparent 55%), #0b0d11;
	}

	.story-card h2 {
		max-width: 15ch;
	}

	.theme {
		max-width: 40rem;
		margin: 1rem 0 2rem;
		color: rgba(238, 232, 220, 0.48);
		font:
			400 0.8rem / 1.6 Georgia,
			serif;
	}

	.story-line {
		display: grid;
		grid-template-columns: repeat(6, minmax(7rem, 1fr));
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}

	.anchor,
	.patch-slot {
		min-height: 10rem;
		padding: 0.8rem;
		background: #0c1015;
	}

	.anchor i,
	.anchor strong,
	.anchor small,
	.patch-slot span,
	.patch-slot strong,
	.patch-slot small {
		display: block;
	}

	.anchor i {
		color: #9b6b47;
		font:
			normal 0.42rem ui-monospace,
			monospace;
	}

	.anchor strong,
	.patch-slot strong {
		margin-top: 0.45rem;
		font:
			400 0.72rem Georgia,
			serif;
	}

	.anchor small,
	.patch-slot small {
		margin-top: 0.5rem;
		color: rgba(238, 232, 220, 0.3);
		font-size: 0.43rem;
		line-height: 1.45;
	}

	.patch-slot {
		border: 1px dashed rgba(80, 174, 181, 0.45);
		background: rgba(27, 70, 73, 0.1);
	}

	.patch-slot span {
		color: #50aeb5;
		font-size: 0.4rem;
		text-transform: uppercase;
	}

	.forbidden {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}

	.forbidden span {
		color: #d06f5d;
		font-size: 0.42rem;
		text-transform: uppercase;
	}

	.forbidden p {
		margin: 0;
		color: rgba(238, 232, 220, 0.32);
		font-size: 0.46rem;
	}

	.package-ledger {
		padding: clamp(4rem, 8vw, 8rem) clamp(1.2rem, 4vw, 4rem);
	}

	.package-ledger > header {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: end;
		margin-bottom: 2rem;
	}

	.package-ledger > header code {
		color: #50aeb5;
		font-size: 0.55rem;
	}

	.ledger-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}

	.ledger-grid article {
		padding: 1.2rem;
		background: #090c11;
	}

	.ledger-grid article > span {
		color: #d48b52;
		font-size: 0.46rem;
		text-transform: uppercase;
	}

	.ledger-grid article div {
		margin-top: 0.8rem;
		padding-top: 0.65rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.ledger-grid strong,
	.ledger-grid small {
		display: block;
	}

	.ledger-grid strong {
		font:
			400 0.72rem Georgia,
			serif;
		text-transform: capitalize;
	}

	.ledger-grid small {
		margin-top: 0.25rem;
		color: rgba(238, 232, 220, 0.28);
		font-size: 0.44rem;
	}

	footer {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.5rem clamp(1.2rem, 4vw, 4rem) 4rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		color: rgba(238, 232, 220, 0.32);
		font-size: 0.5rem;
	}

	footer span {
		color: #d48b52;
		text-transform: uppercase;
	}

	footer p {
		margin: 0;
	}

	@media (max-width: 1180px) {
		.arena-grid,
		.route-and-story {
			grid-template-columns: 1fr;
		}

		.story-line {
			grid-template-columns: repeat(3, 1fr);
		}

		.band-index {
			grid-template-columns: repeat(3, minmax(0, 1fr));
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
			align-items: start;
		}

		.floor-mark {
			width: 5rem;
		}

		h1 {
			font-size: clamp(4rem, 20vw, 6rem);
		}

		.boundary-strip,
		.ledger-grid {
			grid-template-columns: 1fr 1fr;
		}

		.band-index {
			grid-template-columns: 1fr;
		}

		.band-index small {
			display: block;
		}

		.memory-gate {
			align-items: stretch;
			flex-direction: column;
		}

		.panel-heading,
		.package-ledger > header,
		footer {
			align-items: flex-start;
			flex-direction: column;
		}

		.arena-map {
			min-height: 32rem;
		}

		.arena-node {
			min-width: 5.3rem;
			padding: 0.45rem;
		}

		.arena-node strong {
			font-size: 0.55rem;
		}

		.arena-node small,
		.arena-node i {
			display: none;
		}

		.map-legend {
			display: none;
		}

		.discovery-banner {
			grid-template-columns: 1fr;
			gap: 0.6rem;
		}

		.story-line {
			grid-template-columns: 1fr 1fr;
		}

		.ledger-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.arena-edge {
			transition: none;
		}
	}
</style>
