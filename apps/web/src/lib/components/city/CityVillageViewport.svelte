<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	import {
		cityModeHref,
		type CityFacility,
		type CityIntent,
		type CityResident,
		type CityViewModel
	} from '$lib/city';

	import CityResidentDetails from './CityResidentDetails.svelte';

	const WORLD_WIDTH = 1536;
	const WORLD_HEIGHT = 1024;
	const MIN_ZOOM = 1;
	const MAX_ZOOM = 3;

	let {
		view,
		onIntent = async () => undefined,
		pendingIntent = null,
		intentError = null
	}: {
		view: CityViewModel;
		onIntent?: (intent: CityIntent) => void | Promise<void>;
		pendingIntent?: CityIntent | null;
		intentError?: string | null;
	} = $props();

	let viewport: HTMLElement;
	let viewportWidth = $state(960);
	let viewportHeight = $state(640);
	let zoom = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let selectedFacilityId = $state<CityFacility['facilityId']>('summoning-circle');
	let selectedHeroId = $state<string | null>(null);
	let detailHeroId = $state<string | null>(null);
	let announcement = $state('Summoning Circle selected.');
	let dragging = $state(false);
	let pointerId: number | null = null;
	let lastPointer: { x: number; y: number } | null = null;
	let pointerTravel = 0;
	const gameTime = $derived(view.gameTime.slice(11, 16));

	const fitScale = $derived(Math.max(viewportWidth / WORLD_WIDTH, viewportHeight / WORLD_HEIGHT));
	const sceneScale = $derived(fitScale * zoom);
	const heroCounterScale = $derived(Math.min(1.75, Math.pow(zoom, 0.55)) / sceneScale);
	const baseX = $derived((viewportWidth - WORLD_WIDTH * sceneScale) / 2);
	const baseY = $derived((viewportHeight - WORLD_HEIGHT * sceneScale) / 2);
	const selectedHero = $derived(
		selectedHeroId
			? (view.residents.find((resident) => resident.heroId === selectedHeroId) ?? null)
			: null
	);
	const detailHero = $derived(
		detailHeroId
			? (view.residents.find((resident) => resident.heroId === detailHeroId) ?? null)
			: null
	);
	const popoverPosition = $derived.by(() => {
		if (!selectedHero) return { left: 12, top: 12 };
		const point = pointFor(selectedHero.heroId);
		const anchorX = baseX + offsetX + point.x * WORLD_WIDTH * sceneScale;
		const anchorY = baseY + offsetY + point.y * WORLD_HEIGHT * sceneScale;
		const width = Math.min(300, viewportWidth - 24);
		return {
			left: Math.max(12, Math.min(anchorX + 24, viewportWidth - width - 12)),
			top: Math.max(12, Math.min(anchorY - 96, viewportHeight - 320))
		};
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
		return () => {
			observer.disconnect();
			viewport.removeEventListener('wheel', handleWheel);
		};
	});

	function clamp(value: number, minimum: number, maximum: number): number {
		return Math.min(maximum, Math.max(minimum, value));
	}

	function clampOffsets(): void {
		const maxX = Math.max(0, (WORLD_WIDTH * sceneScale - viewportWidth) / 2);
		const maxY = Math.max(0, (WORLD_HEIGHT * sceneScale - viewportHeight) / 2);
		offsetX = clamp(offsetX, -maxX, maxX);
		offsetY = clamp(offsetY, -maxY, maxY);
	}

	function setZoom(nextZoom: number, clientX?: number, clientY?: number): void {
		const bounded = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
		if (bounded === zoom) return;
		const rect = viewport.getBoundingClientRect();
		const anchorX = clientX === undefined ? viewportWidth / 2 : clientX - rect.left;
		const anchorY = clientY === undefined ? viewportHeight / 2 : clientY - rect.top;
		const worldX = (anchorX - baseX - offsetX) / sceneScale;
		const worldY = (anchorY - baseY - offsetY) / sceneScale;
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
		selectedFacilityId = 'summoning-circle';
		selectedHeroId = null;
		detailHeroId = null;
		announcement = 'View reset. Summoning Circle selected.';
	}

	function selectFacility(facility: CityFacility): void {
		selectedFacilityId = facility.facilityId;
		announcement = `${facility.label} selected.`;
	}

	function heroButtonId(heroId: string): string {
		return `city-resident-${heroId}`;
	}

	function pointFor(heroId: string): { x: number; y: number } {
		return (
			view.sceneResidents.find((entry) => entry.occupant.heroId === heroId)?.point ?? {
				x: 0.5,
				y: 0.5
			}
		);
	}

	function selectHero(hero: CityResident): void {
		selectedHeroId = hero.heroId;
		detailHeroId = null;
		announcement = `${hero.name} selected. ${hero.activity}.`;
	}

	function openDetails(hero: CityResident): void {
		detailHeroId = hero.heroId;
		selectedHeroId = null;
	}

	async function submitIntent(hero: CityResident, action: CityIntent['action']): Promise<void> {
		selectedFacilityId = action === 'court-training' ? 'training-grounds' : 'residence';
		announcement =
			action === 'court-training'
				? `Sending ${hero.name} to Court training.`
				: `Sending ${hero.name} to rest in the Dormitory.`;
		await onIntent({ action, heroId: hero.heroId, expectedVersion: view.expectedVersion });
	}

	function handleWheel(event: WheelEvent): void {
		event.preventDefault();
		setZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15), event.clientX, event.clientY);
	}

	function handlePointerDown(event: PointerEvent): void {
		if ((event.target as HTMLElement).closest('[data-no-pan], button, a')) return;
		pointerId = event.pointerId;
		lastPointer = { x: event.clientX, y: event.clientY };
		pointerTravel = 0;
		viewport.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent): void {
		if (pointerId !== event.pointerId || !lastPointer) return;
		const deltaX = event.clientX - lastPointer.x;
		const deltaY = event.clientY - lastPointer.y;
		pointerTravel += Math.hypot(deltaX, deltaY);
		if (pointerTravel >= 5) {
			dragging = true;
			offsetX += deltaX;
			offsetY += deltaY;
			clampOffsets();
		}
		lastPointer = { x: event.clientX, y: event.clientY };
	}

	function finishPointer(event: PointerEvent): void {
		if (pointerId !== event.pointerId) return;
		pointerId = null;
		lastPointer = null;
		requestAnimationFrame(() => (dragging = false));
	}

	function handleViewportKeydown(event: KeyboardEvent): void {
		if (event.target !== viewport) return;
		const actions: Record<string, () => void> = {
			'+': () => setZoom(zoom + 0.2),
			'=': () => setZoom(zoom + 0.2),
			'-': () => setZoom(zoom - 0.2),
			ArrowLeft: () => (offsetX += 50),
			ArrowRight: () => (offsetX -= 50),
			ArrowUp: () => (offsetY += 50),
			ArrowDown: () => (offsetY -= 50),
			'0': () => fitVillage(),
			Home: resetVillage
		};
		const action = actions[event.key];
		if (!action) return;
		event.preventDefault();
		action();
		clampOffsets();
	}

	function pointStyle(point: { readonly x: number; readonly y: number }): string {
		return `--x:${point.x * 100}%;--y:${point.y * 100}%`;
	}

	function hotspotStyle(facility: CityFacility): string {
		const bounds = facility.hotspot.bounds;
		return `--left:${bounds.x * 100}%;--top:${bounds.y * 100}%;--width:${bounds.width * 100}%;--height:${bounds.height * 100}%`;
	}

	function labelStyle(facility: CityFacility): string {
		const { labelAnchor } = facility.hotspot;
		const x = baseX + offsetX + labelAnchor.x * WORLD_WIDTH * sceneScale;
		const y = baseY + offsetY + labelAnchor.y * WORLD_HEIGHT * sceneScale;
		const visible = x >= 96 && x <= viewportWidth - 96 && y >= 36 && y <= viewportHeight - 64;
		return `--label-x:${labelAnchor.x * 100}%;--label-y:${labelAnchor.y * 100}%;left:${x}px;top:${y}px;display:${visible ? 'flex' : 'none'}`;
	}
</script>

<section class:details-open={detailHero !== null} class="city-village-surface">
	<div class="city-village-column">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class:dragging
			class="city-viewport"
			bind:this={viewport}
			role="application"
			tabindex="0"
			aria-label="Interactive Hearth Village map"
			data-testid="city-village-viewport"
			data-zoom-percent={Math.round(zoom * 100)}
			data-offset-x={Math.round(offsetX)}
			data-offset-y={Math.round(offsetY)}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={finishPointer}
			onpointercancel={finishPointer}
			onkeydown={handleViewportKeydown}
		>
			<aside
				class="city-clock"
				data-no-pan
				data-testid="city-clock"
				aria-label={`Day ${view.dayNumber}, ${gameTime}, ${view.dayPhase}`}
			>
				<span>Day {view.dayNumber}</span>
				<strong>{gameTime}</strong>
				<small>{view.dayPhase}</small>
			</aside>
			<div class="floating-camera" data-no-pan role="group" aria-label="Village camera controls">
				<strong aria-label={`${Math.round(zoom * 100)} percent zoom`}
					>{Math.round(zoom * 100)}%</strong
				>
				<button type="button" aria-label="Zoom out" onclick={() => setZoom(zoom - 0.25)}>−</button>
				<button type="button" aria-label="Zoom in" onclick={() => setZoom(zoom + 0.25)}>+</button>
				<button type="button" aria-label="Fit Village" onclick={() => fitVillage()}>Fit</button>
				<button type="button" aria-label="Reset View" onclick={resetVillage}>Reset</button>
			</div>
			<div
				class="city-world"
				data-testid="city-world"
				style={`transform:translate(${baseX + offsetX}px, ${baseY + offsetY}px) scale(${sceneScale});--scene-scale:${sceneScale};--hero-counter-scale:${heroCounterScale}`}
			>
				<img
					class="environment"
					src={view.scene.runtime.publicPath}
					alt="Hearth Village with a rear Portal, Summoning Circle and Residence to the left, and Training Grounds and Forge to the right"
					width={view.scene.runtime.width}
					height={view.scene.runtime.height}
					draggable="false"
					fetchpriority="high"
					decoding="async"
				/>
				<div class="scene-grade" aria-hidden="true"></div>

				{#each view.facilities as facility (facility.facilityId)}
					{#if facility.hrefMode === 'tower'}
						<a
							class="facility-hotspot"
							class:selected={selectedFacilityId === facility.facilityId}
							data-facility={facility.facilityId}
							data-testid="city-facility"
							style={hotspotStyle(facility)}
							aria-label={`Enter ${facility.label}`}
							aria-current={selectedFacilityId === facility.facilityId ? 'location' : undefined}
							href={`${base}${cityModeHref('tower')}`}
							draggable="false"
							onclick={() => selectFacility(facility)}
						>
						</a>
					{:else}
						<button
							type="button"
							class="facility-hotspot"
							class:selected={selectedFacilityId === facility.facilityId}
							data-facility={facility.facilityId}
							data-testid="city-facility"
							style={hotspotStyle(facility)}
							aria-pressed={selectedFacilityId === facility.facilityId}
							aria-label={`Inspect ${facility.label}`}
							onclick={() => selectFacility(facility)}
						>
						</button>
					{/if}
				{/each}

				{#each view.sceneResidents as sceneResident (sceneResident.occupant.heroId)}
					{@const resident = sceneResident.resident}
					<div
						class="resident-anchor"
						style={`${pointStyle(sceneResident.point)};--cluster-offset:${sceneResident.clusterOffsetRem}rem`}
					>
						{#if resident && resident.sceneArt}
							<button
								id={heroButtonId(resident.heroId)}
								type="button"
								class="resident-marker"
								class:selected={selectedHeroId === resident.heroId}
								class:available={resident.readiness === 'available'}
								data-availability={resident.readiness}
								data-testid="city-scene-resident"
								aria-pressed={selectedHeroId === resident.heroId}
								aria-label={`Inspect ${resident.name}, ${resident.activity}`}
								onclick={() => selectHero(resident)}
							>
								<img
									src={resident.sceneArt.publicPath}
									alt=""
									width={resident.sceneArt.width}
									height={resident.sceneArt.height}
									draggable="false"
								/>
							</button>
						{:else}
							<span class="missing-art">Resident art unavailable</span>
						{/if}
					</div>
				{/each}
			</div>

			{#each view.facilities as facility (facility.facilityId)}
				<span
					class="facility-label"
					class:selected={selectedFacilityId === facility.facilityId}
					data-facility={facility.facilityId}
					data-testid="city-facility-label"
					style={labelStyle(facility)}><i></i><strong>{facility.label}</strong></span
				>
			{/each}

			{#if selectedHero}
				<div
					class="resident-popover"
					style={`left:${popoverPosition.left}px;top:${popoverPosition.top}px`}
					data-no-pan
					data-testid="resident-quick-view"
					role="dialog"
					tabindex="0"
					aria-label={`${selectedHero.name} quick actions`}
				>
					<header>
						{#if selectedHero.portrait}
							<img
								src={selectedHero.portrait.publicPath}
								alt=""
								width={selectedHero.portrait.width}
								height={selectedHero.portrait.height}
								draggable="false"
							/>
						{/if}
						<div>
							<span
								>{selectedHero.level === null
									? 'Level unavailable'
									: `Level ${selectedHero.level}`}</span
							>
							<strong>{selectedHero.name}</strong>
							<small>{selectedHero.role}</small>
						</div>
						<button
							type="button"
							aria-label={`Close ${selectedHero.name} quick view`}
							onclick={() => (selectedHeroId = null)}>×</button
						>
					</header>
					<div class="resident-status">
						<div>
							<span>Health</span>
							<strong
								>{selectedHero.health
									? `${selectedHero.health.current} / ${selectedHero.health.maximum}`
									: 'Unavailable'}</strong
							>
						</div>
						<div><span>Activity</span><strong>{selectedHero.activity}</strong></div>
					</div>
					<div class="resident-actions">
						{#if selectedHero.availableActions.includes('court-training')}
							<button
								type="button"
								disabled={pendingIntent !== null}
								onclick={() => submitIntent(selectedHero, 'court-training')}>Court training</button
							>
						{/if}
						{#if selectedHero.availableActions.includes('rest')}
							<button
								type="button"
								disabled={pendingIntent !== null}
								onclick={() => submitIntent(selectedHero, 'rest')}>Rest</button
							>
						{/if}
						<button type="button" onclick={() => openDetails(selectedHero)}>Details</button>
					</div>
					{#if intentError}<p class="intent-error" role="alert">{intentError}</p>{/if}
				</div>
			{/if}
		</div>
		<p class="sr-only" aria-live="polite">{announcement}</p>
	</div>

	{#if detailHero}
		<CityResidentDetails resident={detailHero} onClose={() => (detailHeroId = null)} />
	{/if}
</section>

<style>
	.city-village-surface {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
	}

	.city-village-surface.details-open {
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
	}

	.city-village-column {
		min-width: 0;
	}

	.resident-popover header span,
	.resident-status span {
		color: #cf9f61;
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.floating-camera button,
	.resident-actions button,
	.resident-popover header button {
		min-width: 2.75rem;
		min-height: 2.75rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid rgba(225, 206, 173, 0.2);
		background: rgba(255, 255, 255, 0.05);
		color: #f6eddf;
		cursor: pointer;
	}

	.resident-actions button:disabled {
		cursor: wait;
		opacity: 0.55;
	}

	.city-viewport {
		position: relative;
		isolation: isolate;
		height: max(32rem, calc(100svh - 5.2rem));
		overflow: hidden;
		border: 1px solid rgba(221, 192, 142, 0.2);
		background: #05080d;
		box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.42);
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.city-viewport.dragging {
		cursor: grabbing;
	}

	.city-clock {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 45;
		min-width: 5.4rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid rgba(224, 197, 153, 0.36);
		border-left: 3px solid #62d1dc;
		background: rgba(5, 9, 13, 0.86);
		box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.4);
		pointer-events: none;
	}

	.city-clock span,
	.city-clock strong,
	.city-clock small {
		display: block;
	}

	.floating-camera {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 46;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem;
		border: 1px solid rgba(224, 197, 153, 0.3);
		background: rgba(5, 9, 13, 0.86);
		box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.4);
		cursor: default;
	}

	.floating-camera > strong {
		min-width: 2.75rem;
		color: #dda765;
		font:
			400 0.76rem Georgia,
			serif;
		text-align: center;
	}

	.city-clock span {
		color: #dda765;
		font-size: 0.58rem;
		font-weight: 850;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.city-clock strong {
		margin-top: 0.08rem;
		font:
			400 1rem Georgia,
			serif;
	}

	.city-clock small {
		margin-top: 0.04rem;
		color: #79cbd0;
		font-size: 0.52rem;
		text-transform: capitalize;
	}

	.city-world {
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
		background:
			radial-gradient(circle at 50% 54%, transparent 35%, rgba(2, 4, 8, 0.33) 100%),
			linear-gradient(180deg, rgba(40, 90, 114, 0.1), transparent 45%);
		pointer-events: none;
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
	}

	.facility-hotspot:hover,
	.facility-hotspot:focus-visible {
		border-color: rgba(112, 220, 226, 0.74);
		background: radial-gradient(ellipse, rgba(75, 188, 198, 0.13), transparent 70%);
	}

	.facility-label {
		position: absolute;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: max-content;
		max-width: min(12rem, calc(100% - 1rem));
		padding: 0.45rem 0.55rem;
		border: 1px solid rgba(239, 221, 187, 0.28);
		border-radius: 0.4rem;
		background: rgba(5, 9, 13, 0.84);
		transform: translate(-50%, -50%);
		white-space: nowrap;
		pointer-events: none;
	}

	.facility-label strong {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.facility-label i {
		flex: 0 0 auto;
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 50%;
		background: #d6a65e;
	}

	.facility-label.selected i {
		background: #73d7dd;
		box-shadow: 0 0 0.7rem #73d7dd;
	}

	.resident-anchor {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: 0;
		height: 0;
		transform: translateX(var(--cluster-offset));
	}

	.resident-marker {
		position: absolute;
		left: 0;
		top: 0;
		width: 4.5rem;
		height: 6.5rem;
		padding: 0;
		border: 0;
		background: transparent;
		transform: translate(-50%, -91%) scale(var(--hero-counter-scale));
		transform-origin: center bottom;
		cursor: pointer;
	}

	.resident-marker img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center bottom;
		pointer-events: none;
	}

	.resident-marker:hover,
	.resident-marker.selected,
	.resident-marker.available {
		filter: drop-shadow(0 0 0.25rem rgba(210, 246, 244, 0.9))
			drop-shadow(0 0 0.7rem rgba(98, 217, 224, 0.7));
	}

	.missing-art {
		position: absolute;
		width: 7rem;
		padding: 0.35rem;
		background: rgba(5, 9, 13, 0.86);
		color: #d9b982;
		font-size: 0.6rem;
		transform: translate(-50%, -100%);
	}

	.resident-popover {
		position: absolute;
		z-index: 40;
		width: min(18.75rem, calc(100% - 1.5rem));
		padding: 0.7rem;
		border: 1px solid rgba(222, 188, 128, 0.38);
		background: rgba(13, 16, 21, 0.97);
		box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.6);
		cursor: default;
		user-select: text;
	}

	.resident-popover header {
		display: grid;
		grid-template-columns: 3.7rem 1fr 2.75rem;
		align-items: center;
		gap: 0.65rem;
	}

	.resident-popover header img {
		width: 3.7rem;
		height: 4.4rem;
		object-fit: cover;
		object-position: 50% 16%;
	}

	.resident-popover header strong,
	.resident-popover header small {
		display: block;
	}

	.resident-popover header strong {
		font:
			400 1.15rem Georgia,
			serif;
	}

	.resident-popover header small {
		color: #77cbd0;
		font-size: 0.64rem;
	}

	.resident-status {
		display: grid;
		grid-template-columns: 0.85fr 1.3fr;
		gap: 0.5rem;
		margin-top: 0.65rem;
	}

	.resident-status > div {
		min-width: 0;
		padding: 0.45rem;
		background: rgba(255, 255, 255, 0.035);
	}

	.resident-status strong {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.68rem;
	}

	.resident-actions {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
		margin-top: 0.65rem;
	}

	.resident-actions button:first-child {
		border-color: #c97848;
		background: #c97848;
		color: #160b05;
	}

	.intent-error {
		margin: 0.5rem 0 0;
		color: #f0a18d;
		font-size: 0.7rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	@media (max-width: 1080px) {
		.city-village-surface.details-open {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.city-clock {
			top: 0.45rem;
			left: 0.45rem;
		}

		.floating-camera {
			top: 0.45rem;
			right: 0.45rem;
			display: grid;
			grid-template-columns: repeat(2, 3.2rem);
		}

		.floating-camera > strong {
			display: none;
		}

		.city-viewport {
			height: clamp(20rem, 88vw, 23rem);
		}

		.resident-marker {
			width: 3.35rem;
			height: 4.85rem;
		}

		.resident-popover {
			position: fixed;
			left: 0.75rem !important;
			top: auto !important;
			right: 0.75rem;
			bottom: calc(5.25rem + env(safe-area-inset-bottom));
			box-sizing: border-box;
			width: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.city-world,
		.resident-anchor {
			transition: none;
		}
	}
</style>
