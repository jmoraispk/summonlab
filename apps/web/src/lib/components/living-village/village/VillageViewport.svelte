<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import VillageHeroDrawer from './VillageHeroDrawer.svelte';
	import type {
		VillageFacility,
		VillageFacilityId,
		VillageHero,
		VillageHeroId,
		VillageHeroRuntime,
		VillageOrder,
		VillagePoint
	} from './types';

	const WORLD_WIDTH = 1536;
	const WORLD_HEIGHT = 1024;
	const MIN_ZOOM = 1;
	const MAX_ZOOM = 3;
	const FIT_PADDING = 10;

	let {
		heroes,
		facilities,
		environment,
		runtime,
		huntSpecies,
		onOrder
	}: {
		heroes: readonly VillageHero[];
		facilities: readonly VillageFacility[];
		environment: { publicPath: string; width: number; height: number };
		runtime: Record<VillageHeroId, VillageHeroRuntime>;
		huntSpecies: readonly string[];
		onOrder: (order: VillageOrder) => void;
	} = $props();

	let viewport: HTMLElement;
	let viewportWidth = $state(960);
	let viewportHeight = $state(640);
	let zoom = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let selectedFacilityId = $state<VillageFacilityId>('gate');
	let selectedHeroId = $state<VillageHeroId | null>(null);
	let drawerHeroId = $state<VillageHeroId | null>(null);
	let huntMenuOpen = $state(false);
	let announcement = $state('Summoning Gate selected.');
	let isDragging = $state(false);
	let pointerTravel = 0;
	let gestureDragged = false;
	let suppressClick = false;
	let dragClickTarget: Element | null = null;

	const activePointers = new SvelteMap<number, { x: number; y: number }>();
	let lastPointer: { x: number; y: number } | null = null;
	let pinchStart: { distance: number; zoom: number; worldX: number; worldY: number } | undefined;

	const fitScale = $derived(
		Math.min(
			(viewportWidth - FIT_PADDING * 2) / WORLD_WIDTH,
			(viewportHeight - FIT_PADDING * 2) / WORLD_HEIGHT
		)
	);
	const sceneScale = $derived(fitScale * zoom);
	const heroCounterScale = $derived(Math.min(1.75, Math.pow(zoom, 0.55)) / sceneScale);
	const baseX = $derived((viewportWidth - WORLD_WIDTH * sceneScale) / 2);
	const baseY = $derived((viewportHeight - WORLD_HEIGHT * sceneScale) / 2);
	const selectedHero = $derived(
		selectedHeroId ? (heroes.find((hero) => hero.id === selectedHeroId) ?? null) : null
	);
	const drawerHero = $derived(
		drawerHeroId ? (heroes.find((hero) => hero.id === drawerHeroId) ?? null) : null
	);
	const popoverPosition = $derived.by(() => {
		if (!selectedHero) return { left: 12, top: 12 };
		const point = runtime[selectedHero.id].position;
		const anchorX = baseX + offsetX + point.x * WORLD_WIDTH * sceneScale;
		const anchorY = baseY + offsetY + point.y * WORLD_HEIGHT * sceneScale;
		const width = Math.min(300, viewportWidth - 24);
		const left = Math.max(12, Math.min(anchorX + 24, viewportWidth - width - 12));
		const top = Math.max(12, Math.min(anchorY - 96, viewportHeight - 320));
		return { left, top };
	});

	onMount(() => {
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return;
			viewportWidth = entry.contentRect.width;
			viewportHeight = entry.contentRect.height;
			clampOffsets();
		});
		observer.observe(viewport);
		viewport.addEventListener('wheel', handleWheel, { passive: false });
		viewport.addEventListener('pointerdown', handlePointerDown);
		viewport.addEventListener('pointermove', handlePointerMove);
		viewport.addEventListener('pointerup', finishPointer);
		viewport.addEventListener('pointercancel', finishPointer);
		viewport.addEventListener('lostpointercapture', finishPointer);
		viewport.addEventListener('click', handleClickCapture, true);
		viewport.addEventListener('keydown', handleViewportKeydown);
		return () => {
			observer.disconnect();
			viewport.removeEventListener('wheel', handleWheel);
			viewport.removeEventListener('pointerdown', handlePointerDown);
			viewport.removeEventListener('pointermove', handlePointerMove);
			viewport.removeEventListener('pointerup', finishPointer);
			viewport.removeEventListener('pointercancel', finishPointer);
			viewport.removeEventListener('lostpointercapture', finishPointer);
			viewport.removeEventListener('click', handleClickCapture, true);
			viewport.removeEventListener('keydown', handleViewportKeydown);
		};
	});

	function clamp(value: number, minimum: number, maximum: number): number {
		return Math.min(maximum, Math.max(minimum, value));
	}

	function clampOffsets(): void {
		const maxX = Math.max(
			Math.min(56, viewportWidth * 0.06),
			(WORLD_WIDTH * sceneScale - viewportWidth) / 2 + FIT_PADDING
		);
		const maxY = Math.max(
			Math.min(56, viewportHeight * 0.06),
			(WORLD_HEIGHT * sceneScale - viewportHeight) / 2 + FIT_PADDING
		);
		offsetX = clamp(offsetX, -maxX, maxX);
		offsetY = clamp(offsetY, -maxY, maxY);
	}

	function setZoom(nextZoom: number, clientX?: number, clientY?: number): void {
		const bounded = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
		if (bounded === zoom) return;
		const rect = viewport.getBoundingClientRect();
		const anchorX = clientX === undefined ? viewportWidth / 2 : clientX - rect.left;
		const anchorY = clientY === undefined ? viewportHeight / 2 : clientY - rect.top;
		const oldScale = sceneScale;
		const worldX = (anchorX - baseX - offsetX) / oldScale;
		const worldY = (anchorY - baseY - offsetY) / oldScale;
		zoom = bounded;
		const nextScale = fitScale * zoom;
		const nextBaseX = (viewportWidth - WORLD_WIDTH * nextScale) / 2;
		const nextBaseY = (viewportHeight - WORLD_HEIGHT * nextScale) / 2;
		offsetX = anchorX - nextBaseX - worldX * nextScale;
		offsetY = anchorY - nextBaseY - worldY * nextScale;
		clampOffsets();
	}

	function fitVillage(announce = true): void {
		zoom = 1;
		offsetX = 0;
		offsetY = 0;
		if (announce) announcement = 'Village fitted to the viewport.';
	}

	function resetVillage(): void {
		fitVillage(false);
		selectedFacilityId = 'gate';
		selectedHeroId = null;
		huntMenuOpen = false;
		announcement = 'View reset. Summoning Gate selected.';
	}

	function selectFacility(facility: VillageFacility): void {
		selectedFacilityId = facility.id;
		announcement = `${facility.name} selected. ${facility.state}.`;
	}

	function heroButtonId(heroId: VillageHeroId): string {
		return `village-hero-${heroId}`;
	}

	function selectHero(hero: VillageHero, focusMarker = false): void {
		selectedHeroId = hero.id;
		huntMenuOpen = false;
		announcement = `${hero.name} selected. ${runtime[hero.id].activity}.`;
		if (focusMarker) {
			focusHero(hero);
			requestAnimationFrame(() => {
				document.getElementById(heroButtonId(hero.id))?.focus({ preventScroll: true });
			});
		}
	}

	function focusHero(hero: VillageHero): void {
		zoom = Math.max(zoom, 1.65);
		const nextScale = fitScale * zoom;
		const nextBaseX = (viewportWidth - WORLD_WIDTH * nextScale) / 2;
		const nextBaseY = (viewportHeight - WORLD_HEIGHT * nextScale) / 2;
		const point = runtime[hero.id].position;
		offsetX = viewportWidth / 2 - nextBaseX - point.x * WORLD_WIDTH * nextScale;
		offsetY = viewportHeight / 2 - nextBaseY - point.y * WORLD_HEIGHT * nextScale;
		clampOffsets();
	}

	function issueTraining(hero: VillageHero): void {
		selectedFacilityId = 'court';
		onOrder({ kind: 'court', heroId: hero.id });
		announcement = `${hero.name} assigned to Court training.`;
		selectedHeroId = null;
	}

	function issueHunt(hero: VillageHero, species: string): void {
		selectedFacilityId = 'tower';
		huntMenuOpen = false;
		onOrder({ kind: 'hunt', heroId: hero.id, species });
		announcement = `${hero.name} assigned to hunt ${species} at the Tower.`;
		selectedHeroId = null;
	}

	function moveCamera(deltaX: number, deltaY: number): void {
		offsetX += deltaX;
		offsetY += deltaY;
		clampOffsets();
	}

	function handleWheel(event: WheelEvent): void {
		event.preventDefault();
		setZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15), event.clientX, event.clientY);
	}

	function pointerDistance(): number {
		const [first, second] = [...activePointers.values()];
		return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0;
	}

	function pointerCentroid(): { x: number; y: number } {
		const [first, second] = [...activePointers.values()];
		if (!first) return { x: 0, y: 0 };
		return second ? { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 } : first;
	}

	function handlePointerDown(event: PointerEvent): void {
		if ((event.target as HTMLElement).closest('[data-no-pan]')) return;
		const interactiveTarget = (event.target as HTMLElement).closest('button, a');
		if (!interactiveTarget) viewport.setPointerCapture(event.pointerId);
		activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (activePointers.size === 1) {
			lastPointer = { x: event.clientX, y: event.clientY };
			pointerTravel = 0;
			gestureDragged = false;
			dragClickTarget = (event.target as Element).closest('button') ?? (event.target as Element);
			isDragging = false;
		} else if (activePointers.size === 2) {
			viewport.setPointerCapture(event.pointerId);
			gestureDragged = true;
			isDragging = true;
			const centroid = pointerCentroid();
			const rect = viewport.getBoundingClientRect();
			pinchStart = {
				distance: pointerDistance(),
				zoom,
				worldX: (centroid.x - rect.left - baseX - offsetX) / sceneScale,
				worldY: (centroid.y - rect.top - baseY - offsetY) / sceneScale
			};
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!activePointers.has(event.pointerId)) return;
		activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (activePointers.size === 2 && pinchStart) {
			const centroid = pointerCentroid();
			const rect = viewport.getBoundingClientRect();
			zoom = clamp(pinchStart.zoom * (pointerDistance() / pinchStart.distance), MIN_ZOOM, MAX_ZOOM);
			const nextScale = fitScale * zoom;
			const nextBaseX = (viewportWidth - WORLD_WIDTH * nextScale) / 2;
			const nextBaseY = (viewportHeight - WORLD_HEIGHT * nextScale) / 2;
			offsetX = centroid.x - rect.left - nextBaseX - pinchStart.worldX * nextScale;
			offsetY = centroid.y - rect.top - nextBaseY - pinchStart.worldY * nextScale;
			clampOffsets();
			return;
		}
		if (activePointers.size === 1 && lastPointer) {
			const deltaX = event.clientX - lastPointer.x;
			const deltaY = event.clientY - lastPointer.y;
			pointerTravel += Math.hypot(deltaX, deltaY);
			if (pointerTravel >= 5) {
				if (!viewport.hasPointerCapture(event.pointerId)) {
					viewport.setPointerCapture(event.pointerId);
				}
				gestureDragged = true;
				isDragging = true;
				moveCamera(deltaX, deltaY);
			}
			lastPointer = { x: event.clientX, y: event.clientY };
		}
	}

	function finishPointer(event: PointerEvent): void {
		if (gestureDragged) {
			suppressClick = true;
			setTimeout(() => {
				suppressClick = false;
				dragClickTarget = null;
			}, 0);
			gestureDragged = false;
		}
		activePointers.delete(event.pointerId);
		pinchStart = undefined;
		const [remaining] = [...activePointers.values()];
		lastPointer = remaining ?? null;
		isDragging = activePointers.size > 0;
		if (activePointers.size === 0) pointerTravel = 0;
	}

	function handleClickCapture(event: MouseEvent): void {
		if (!suppressClick) return;
		const clicked = event.target as Element;
		if (dragClickTarget && clicked !== dragClickTarget && !dragClickTarget.contains(clicked))
			return;
		event.preventDefault();
		event.stopPropagation();
		suppressClick = false;
	}

	function handleViewportKeydown(event: KeyboardEvent): void {
		if (event.target !== viewport) return;
		const keyActions: Record<string, () => void> = {
			'+': () => setZoom(zoom + 0.2),
			'=': () => setZoom(zoom + 0.2),
			'-': () => setZoom(zoom - 0.2),
			ArrowLeft: () => moveCamera(50, 0),
			ArrowRight: () => moveCamera(-50, 0),
			ArrowUp: () => moveCamera(0, 50),
			ArrowDown: () => moveCamera(0, -50),
			'0': () => fitVillage(),
			Home: () => resetVillage()
		};
		const action = keyActions[event.key];
		if (!action) return;
		event.preventDefault();
		action();
	}

	function handlePopoverKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !selectedHero) return;
		event.preventDefault();
		document.getElementById(heroButtonId(selectedHero.id))?.focus({ preventScroll: true });
	}

	function pointStyle(point: VillagePoint): string {
		return `--x:${point.x * 100}%;--y:${point.y * 100}%`;
	}

	function hotspotStyle(facility: VillageFacility): string {
		return `--left:${facility.bounds.x * 100}%;--top:${facility.bounds.y * 100}%;--width:${facility.bounds.width * 100}%;--height:${facility.bounds.height * 100}%`;
	}
</script>

<section class:drawer-open={drawerHero !== null} class="village-command-surface">
	<div class="command-column">
		<div class="command-toolbar" role="toolbar" aria-label="Village toolbar">
			<section class="roster-ribbon" aria-label="Find a resident">
				<div class="ribbon-label"><span>Residents</span><strong>Find in Village</strong></div>
				<div class="ribbon-list">
					{#each heroes as hero (hero.id)}
						<button
							type="button"
							class:active={selectedHeroId === hero.id}
							aria-pressed={selectedHeroId === hero.id}
							onclick={() => selectHero(hero, true)}
						>
							<img src={hero.portrait} alt="" width="1024" height="1536" draggable="false" />
							<span>{hero.name}</span>
						</button>
					{/each}
				</div>
			</section>

			<div class="viewport-toolbar">
				<div>
					<span>Hearth overlook</span>
					<strong>{Math.round(zoom * 100)}%</strong>
				</div>
				<div class="camera-controls" role="group" aria-label="Village camera controls">
					<button type="button" aria-label="Zoom out" onclick={() => setZoom(zoom - 0.25)}>−</button
					>
					<button type="button" aria-label="Zoom in" onclick={() => setZoom(zoom + 0.25)}>+</button>
					<button type="button" onclick={() => fitVillage()}>Fit Village</button>
					<button type="button" onclick={resetVillage}>Reset View</button>
				</div>
			</div>
		</div>

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class:dragging={isDragging}
			class="village-viewport"
			bind:this={viewport}
			role="application"
			tabindex="0"
			aria-label="Interactive Hearth Village map"
			data-testid="village-viewport"
			data-zoom-percent={Math.round(zoom * 100)}
			data-offset-x={Math.round(offsetX)}
			data-offset-y={Math.round(offsetY)}
		>
			<div
				class="village-world"
				style={`transform:translate(${baseX + offsetX}px, ${baseY + offsetY}px) scale(${sceneScale});--scene-scale:${sceneScale};--hero-counter-scale:${heroCounterScale}`}
			>
				<img
					class="environment"
					src={environment.publicPath}
					alt="Hearth Village with the Summoning Gate north, Training Grounds southeast, and Tower Threshold south"
					width={environment.width}
					height={environment.height}
					draggable="false"
					fetchpriority="high"
					decoding="async"
				/>
				<div class="scene-grade" aria-hidden="true"></div>

				{#each facilities as facility (facility.id)}
					{#if facility.href}
						<a
							class="facility-hotspot"
							class:selected={selectedFacilityId === facility.id}
							data-facility={facility.id}
							style={hotspotStyle(facility)}
							aria-label={`Enter ${facility.name}`}
							href={resolve(facility.href)}
							draggable="false"
							onclick={() => selectFacility(facility)}
						>
							<span><i></i><strong>{facility.shortName}</strong></span>
						</a>
					{:else}
						<button
							type="button"
							class="facility-hotspot"
							class:selected={selectedFacilityId === facility.id}
							data-facility={facility.id}
							style={hotspotStyle(facility)}
							aria-pressed={selectedFacilityId === facility.id}
							aria-label={`Inspect ${facility.name}`}
							onclick={() => selectFacility(facility)}
						>
							<span><i></i><strong>{facility.shortName}</strong></span>
						</button>
					{/if}
				{/each}

				{#each heroes as hero (hero.id)}
					<div
						class="hero-anchor"
						class:moving={runtime[hero.id].order !== null}
						style={pointStyle(runtime[hero.id].position)}
					>
						<button
							id={heroButtonId(hero.id)}
							type="button"
							class="hero-marker"
							class:selected={selectedHeroId === hero.id}
							class:available={runtime[hero.id].order === null}
							data-availability={runtime[hero.id].order === null ? 'available' : 'busy'}
							aria-pressed={selectedHeroId === hero.id}
							aria-label={`Inspect ${hero.name}, level ${hero.level}, ${runtime[hero.id].activity}`}
							onclick={() => selectHero(hero)}
						>
							<img src={hero.portrait} alt="" width="1024" height="1536" draggable="false" />
						</button>
					</div>
				{/each}
			</div>

			{#if selectedHero}
				<div
					class="hero-popover"
					style={`left:${popoverPosition.left}px;top:${popoverPosition.top}px`}
					data-no-pan
					data-testid="hero-popover"
					role="dialog"
					tabindex="0"
					aria-label={`${selectedHero.name} quick actions`}
					onkeydown={handlePopoverKeydown}
				>
					<header>
						<img
							src={selectedHero.portrait}
							alt={selectedHero.portraitAlt}
							width="1024"
							height="1536"
							draggable="false"
						/>
						<div>
							<span>Level {selectedHero.level}</span>
							<strong>{selectedHero.name}</strong>
							<small>{selectedHero.partyStatus}</small>
						</div>
						<button
							type="button"
							aria-label={`Close ${selectedHero.name} popover`}
							onclick={() => (selectedHeroId = null)}>×</button
						>
					</header>
					<div class="hero-status">
						<div>
							<span>Health</span><strong
								>{selectedHero.health.current} / {selectedHero.health.maximum}</strong
							>
						</div>
						<div><span>Activity</span><strong>{runtime[selectedHero.id].activity}</strong></div>
					</div>
					<div class="health-bar" aria-hidden="true">
						<i style={`width:${(selectedHero.health.current / selectedHero.health.maximum) * 100}%`}
						></i>
					</div>
					<div class="hero-actions">
						<button type="button" onclick={() => issueTraining(selectedHero)}>Court training</button
						>
						<button type="button" onclick={() => (huntMenuOpen = !huntMenuOpen)}>Tower hunt</button>
						<button type="button" onclick={() => (drawerHeroId = selectedHero.id)}>Details</button>
					</div>
					{#if huntMenuOpen}
						<div class="hunt-menu" aria-label="Choose hunt species">
							<span>Choose a Floor 4 species</span>
							{#each huntSpecies as species (species)}
								<button type="button" onclick={() => issueHunt(selectedHero, species)}
									>{species}</button
								>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<p class="sr-only" aria-live="polite">{announcement}</p>
	</div>

	{#if drawerHero}
		<VillageHeroDrawer
			hero={drawerHero}
			runtime={runtime[drawerHero.id]}
			onClose={() => (drawerHeroId = null)}
		/>
	{/if}
</section>

<style>
	.village-command-surface {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.8rem;
	}

	.village-command-surface.drawer-open {
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
	}

	.command-column {
		min-width: 0;
	}

	.command-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		min-width: 0;
	}

	.roster-ribbon {
		display: flex;
		grid-column: 1;
		align-items: stretch;
		gap: 0.6rem;
		padding: 0.55rem;
		border: 1px solid rgba(221, 192, 142, 0.16);
		background: rgba(12, 15, 20, 0.96);
	}

	.ribbon-label {
		display: grid;
		align-content: center;
		flex: 0 0 auto;
		padding: 0 0.55rem;
		border-right: 1px solid rgba(221, 192, 142, 0.13);
	}

	.ribbon-label span,
	.viewport-toolbar span {
		color: #cf9f61;
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	.ribbon-label strong {
		font:
			400 0.82rem Georgia,
			serif;
	}

	.ribbon-list {
		display: grid;
		grid-template-columns: repeat(6, minmax(4.6rem, 1fr));
		gap: 0.35rem;
		min-width: 0;
		width: 100%;
	}

	.ribbon-list button {
		display: flex;
		align-items: center;
		min-width: 0;
		min-height: 2.75rem;
		padding: 0.28rem;
		border: 1px solid transparent;
		background: rgba(255, 255, 255, 0.035);
		color: rgba(247, 238, 221, 0.68);
		cursor: pointer;
	}

	.ribbon-list button:hover,
	.ribbon-list button.active {
		border-color: rgba(105, 209, 214, 0.62);
		background: rgba(62, 130, 136, 0.16);
		color: #fff8e9;
	}

	.ribbon-list img {
		width: 2.1rem;
		height: 2.1rem;
		flex: 0 0 auto;
		object-fit: cover;
		object-position: 50% 16%;
	}

	.ribbon-list span {
		overflow: hidden;
		padding: 0 0.4rem;
		font-size: 0.68rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.viewport-toolbar {
		display: flex;
		grid-column: 2;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.45rem 0.55rem;
		border: 1px solid rgba(221, 192, 142, 0.16);
		border-left: 0;
		background: #181b20;
	}

	.viewport-toolbar > div:first-child {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding-left: 0.35rem;
	}

	.viewport-toolbar strong {
		font:
			400 0.9rem Georgia,
			serif;
	}

	.camera-controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 0.3rem;
	}

	.camera-controls button {
		min-width: 2.75rem;
		min-height: 2.75rem;
		padding: 0.45rem 0.68rem;
		border: 1px solid rgba(225, 206, 173, 0.18);
		background: rgba(255, 255, 255, 0.045);
		color: #f6eddf;
		cursor: pointer;
		font-size: 0.68rem;
		font-weight: 750;
	}

	.camera-controls button:hover {
		background: rgba(214, 157, 88, 0.17);
	}

	.village-viewport {
		position: relative;
		grid-column: 1 / -1;
		isolation: isolate;
		height: max(32rem, calc(100svh - 7.8rem));
		overflow: hidden;
		border: 1px solid rgba(221, 192, 142, 0.2);
		background: #05080d;
		box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.42);
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.village-viewport.dragging {
		cursor: grabbing;
	}

	.village-world {
		position: absolute;
		left: 0;
		top: 0;
		width: 1536px;
		height: 1024px;
		transform-origin: 0 0;
		will-change: transform;
	}

	.environment,
	.scene-grade {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.environment {
		display: block;
		object-fit: cover;
	}

	.scene-grade {
		pointer-events: none;
		background:
			radial-gradient(circle at 50% 54%, transparent 35%, rgba(2, 4, 8, 0.33) 100%),
			linear-gradient(180deg, rgba(40, 90, 114, 0.1), transparent 45%);
	}

	.facility-hotspot {
		position: absolute;
		left: var(--left);
		top: var(--top);
		display: block;
		box-sizing: border-box;
		width: var(--width);
		height: var(--height);
		border: 2px solid transparent;
		border-radius: 12%;
		background: transparent;
		color: white;
		cursor: pointer;
		text-decoration: none;
		transition:
			border-color 140ms ease,
			background 140ms ease,
			box-shadow 140ms ease;
	}

	.facility-hotspot:hover,
	.facility-hotspot:focus-visible {
		border-color: rgba(112, 220, 226, 0.74);
		background: radial-gradient(ellipse, rgba(75, 188, 198, 0.13), transparent 70%);
		box-shadow:
			inset 0 0 70px rgba(82, 202, 211, 0.1),
			0 0 22px rgba(82, 202, 211, 0.16);
	}

	.facility-hotspot > span {
		position: absolute;
		z-index: 30;
		left: 50%;
		top: 0;
		display: grid;
		min-width: 7rem;
		padding: 0.48rem 0.58rem;
		border: 1px solid rgba(239, 221, 187, 0.28);
		background: rgba(5, 9, 13, 0.82);
		box-shadow: 0 0.6rem 1.5rem rgba(0, 0, 0, 0.34);
		transform: translate(-50%, -50%) scale(calc(1 / var(--scene-scale)));
		transform-origin: center;
		backdrop-filter: blur(8px);
		pointer-events: none;
	}

	.facility-hotspot[data-facility='gate'] > span {
		top: auto;
		bottom: 0;
		transform: translate(-50%, 50%) scale(calc(1 / var(--scene-scale)));
	}

	.facility-hotspot i {
		position: absolute;
		left: 0.35rem;
		top: 0.55rem;
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 50%;
		background: #d6a65e;
	}

	.facility-hotspot.selected i {
		background: #73d7dd;
		box-shadow: 0 0 0.7rem #73d7dd;
	}

	.facility-hotspot strong {
		padding-left: 0.75rem;
		text-align: left;
	}

	.facility-hotspot strong {
		font:
			400 0.82rem/1 Georgia,
			serif;
	}

	.hero-anchor {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: 0;
		height: 0;
		transition:
			left 1.05s ease,
			top 1.05s ease;
	}

	.hero-marker {
		position: absolute;
		left: 0;
		top: 0;
		display: block;
		width: 4.5rem;
		height: 6.5rem;
		padding: 0;
		border: 0;
		background: transparent;
		transform: translate(-50%, -91%) scale(var(--hero-counter-scale));
		transform-origin: center bottom;
		cursor: pointer;
	}

	.hero-marker::after {
		position: absolute;
		left: 50%;
		bottom: -0.15rem;
		width: 2.2rem;
		height: 0.55rem;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.42);
		filter: blur(0.22rem);
		content: '';
		transform: translateX(-50%);
	}

	.hero-marker:hover,
	.hero-marker.selected {
		filter: drop-shadow(0 0 0.25rem rgba(210, 246, 244, 0.9))
			drop-shadow(0 0 0.8rem rgba(98, 217, 224, 0.8));
	}

	.hero-marker img {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center bottom;
		pointer-events: none;
	}

	.hero-marker.available img {
		filter: drop-shadow(0 0 0.08rem rgba(222, 255, 251, 0.98))
			drop-shadow(0 0 0.34rem rgba(94, 229, 222, 0.86));
	}

	.hero-anchor.moving .hero-marker {
		animation: order-pulse 1s ease-in-out 2;
	}

	.hero-popover header span,
	.hero-status span,
	.hunt-menu > span {
		display: block;
		color: #d3a461;
		font-size: 0.56rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.hero-popover {
		position: absolute;
		z-index: 40;
		width: min(18.75rem, calc(100% - 1.5rem));
		padding: 0.7rem;
		border: 1px solid rgba(222, 188, 128, 0.38);
		background: rgba(13, 16, 21, 0.97);
		box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(14px);
		cursor: default;
		user-select: text;
	}

	.hero-popover header {
		display: grid;
		grid-template-columns: 3.7rem 1fr 2.75rem;
		gap: 0.65rem;
		align-items: center;
	}

	.hero-popover header img {
		width: 3.7rem;
		height: 4.4rem;
		object-fit: cover;
		object-position: 50% 16%;
	}

	.hero-popover header strong,
	.hero-popover header small {
		display: block;
	}

	.hero-popover header strong {
		margin-top: 0.15rem;
		font:
			400 1.15rem/1 Georgia,
			serif;
	}

	.hero-popover header small {
		margin-top: 0.28rem;
		color: #77cbd0;
		font-size: 0.64rem;
	}

	.hero-popover header button {
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid rgba(236, 218, 184, 0.18);
		background: rgba(255, 255, 255, 0.04);
		color: #f5ebdb;
		cursor: pointer;
		font-size: 1.1rem;
	}

	.hero-status {
		display: grid;
		grid-template-columns: 0.85fr 1.3fr;
		gap: 0.5rem;
		margin-top: 0.65rem;
	}

	.hero-status > div {
		min-width: 0;
		padding: 0.45rem;
		background: rgba(255, 255, 255, 0.035);
	}

	.hero-status strong {
		display: block;
		margin-top: 0.2rem;
		overflow: hidden;
		font-size: 0.68rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.health-bar {
		height: 0.2rem;
		margin-top: 0.35rem;
		background: rgba(255, 255, 255, 0.08);
	}

	.health-bar i {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #b64d40, #da8661);
	}

	.hero-actions {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.35rem;
		margin-top: 0.65rem;
	}

	.hero-actions button,
	.hunt-menu button {
		min-height: 2.75rem;
		padding: 0.45rem;
		border: 1px solid rgba(225, 203, 164, 0.19);
		background: rgba(255, 255, 255, 0.045);
		color: #f4ead9;
		cursor: pointer;
		font-size: 0.64rem;
		font-weight: 750;
	}

	.hero-actions button:first-child {
		border-color: #c97848;
		background: #c97848;
		color: #160b05;
	}

	.hunt-menu {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.3rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(225, 203, 164, 0.12);
	}

	.hunt-menu > span {
		grid-column: 1 / -1;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes order-pulse {
		50% {
			filter: drop-shadow(0 0 0.8rem #77dce1);
		}
	}

	@media (max-width: 1080px) {
		.village-command-surface.drawer-open {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.command-toolbar {
			display: block;
		}

		.roster-ribbon {
			display: block;
			padding: 0.35rem;
		}

		.ribbon-label {
			display: none;
		}

		.ribbon-list {
			grid-template-columns: repeat(6, minmax(3.1rem, 1fr));
		}

		.ribbon-list button {
			display: grid;
			justify-items: center;
			min-height: 3.2rem;
			padding: 0.25rem 0.1rem;
		}

		.ribbon-list img {
			width: 2.4rem;
			height: 2.4rem;
		}

		.ribbon-list span {
			width: 100%;
			padding: 0;
			font-size: 0.52rem;
			text-align: center;
		}

		.viewport-toolbar {
			display: block;
			padding: 0.35rem;
			border-left: 1px solid rgba(221, 192, 142, 0.16);
		}

		.viewport-toolbar > div:first-child {
			display: none;
		}

		.camera-controls {
			display: grid;
			grid-template-columns: 2.75rem 2.75rem 1fr 1fr;
			width: 100%;
		}

		.village-viewport {
			height: clamp(20rem, 88vw, 23rem);
		}

		.hero-marker {
			width: 3.35rem;
			height: 4.85rem;
		}

		.hero-popover {
			padding: 0.6rem;
		}

		.hero-actions {
			grid-template-columns: 1fr 1fr;
		}

		.hero-actions button:last-child {
			grid-column: 1 / -1;
		}

		.hunt-menu {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-anchor,
		.village-world {
			transition: none;
		}

		.hero-anchor.moving .hero-marker {
			animation: none;
		}
	}

	:global(html[data-player-motion='reduced']) .hero-anchor,
	:global(html[data-player-motion='reduced']) .village-world {
		transition: none;
	}

	:global(html[data-player-motion='reduced']) .hero-anchor.moving .hero-marker {
		animation: none;
	}
</style>
