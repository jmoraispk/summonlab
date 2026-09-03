<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		AnimatedSprite,
		Application,
		Container,
		Graphics,
		Sprite,
		Spritesheet,
		Texture
	} from 'pixi.js';

	import {
		createActorAnimator,
		frameIndexForClip,
		stepActorAnimator,
		type ActorAnimatorState,
		type CombatClip
	} from './actor-animator';
	import {
		projectCombatPoint,
		type CombatPresentationMode,
		type ProjectedCombatPoint
	} from './depth-projection';
	import { layoutHealthBar } from './health-bar-layout';
	import {
		createRealtimeCombat,
		stepRealtimeCombat,
		type RealtimeActor,
		type RealtimeCombatState
	} from './realtime-combat';

	let {
		mode,
		paused,
		restartKey,
		reducedMotion,
		onSnapshot
	}: {
		mode: CombatPresentationMode;
		paused: boolean;
		restartKey: number;
		reducedMotion: boolean;
		onSnapshot: (snapshot: RealtimeCombatState) => void;
	} = $props();

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let simulation = createRealtimeCombat();
	let activeRestartKey = -1;
	let renderSimulation: ((snapshot: RealtimeCombatState) => void) | undefined;
	let applyPresentation: ((next: CombatPresentationMode) => void) | undefined;
	let resetPresentationState: ((snapshot: RealtimeCombatState) => void) | undefined;

	const ART_ROOT = '/runtime/combat/realtime-study-v1';
	const ART = {
		environment: `${ART_ROOT}/ruined-threshold-environment-v1.png`,
		wellOccluder: `${ART_ROOT}/environment-occluders-v1/well-foreground-v1.png`,
		'saffron-braid': `${ART_ROOT}/hero-saffron-braid-ready-v1.png`,
		'iron-guardian': `${ART_ROOT}/hero-iron-guardian-ready-v1.png`,
		'moss-archer': `${ART_ROOT}/hero-moss-archer-ready-v1.png`,
		'rat-brute': `${ART_ROOT}/rat-brute-ready-v1.png`,
		'plague-rat': `${ART_ROOT}/lesser-rat-ready-v1.png`
	} as const;
	const MOTION = {
		asha: `${ART_ROOT}/animation-canary-v1/asha/asha-motion-v1.json`,
		'lesser-rat': `${ART_ROOT}/animation-canary-v1/lesser-rat/lesser-rat-motion-v1.json`
	} as const;
	const ART_SOURCES = [...Object.values(ART), ...Object.values(MOTION)];
	const CLIP_META: Record<CombatClip, { framesPerSecond: number; loop: boolean }> = {
		idle: { framesPerSecond: 6, loop: true },
		advance: { framesPerSecond: 10, loop: true },
		attack: { framesPerSecond: 12, loop: false },
		hit: { framesPerSecond: 9, loop: false },
		down: { framesPerSecond: 6, loop: false }
	};

	$effect(() => {
		if (restartKey === activeRestartKey) return;
		activeRestartKey = restartKey;
		simulation = createRealtimeCombat();
		resetPresentationState?.(simulation);
		renderSimulation?.(simulation);
		onSnapshot(simulation);
	});

	$effect(() => applyPresentation?.(mode));

	onMount(() => {
		let disposed = false;
		let app: Application | undefined;
		let resizeObserver: ResizeObserver | undefined;

		void (async () => {
			const { AnimatedSprite, Application, Assets, Container, Graphics, Sprite } =
				await import('pixi.js');
			const textures = await Promise.all(ART_SOURCES.map((source) => Assets.load(source)));
			if (disposed) {
				void Assets.unload(ART_SOURCES);
				return;
			}

			const assetBySource = new Map<string, (typeof textures)[number]>(
				ART_SOURCES.map((source, index) => [source, textures[index]!])
			);
			const textureFor = (source: string): Texture => assetBySource.get(source) as Texture;
			const sheetFor = (source: string): Spritesheet => assetBySource.get(source) as Spritesheet;
			const motionSheets = {
				asha: sheetFor(MOTION.asha),
				'lesser-rat': sheetFor(MOTION['lesser-rat'])
			};
			app = new Application();
			await app.init({
				resizeTo: host,
				canvas,
				background: '#05090e',
				antialias: true,
				autoDensity: true,
				resolution: Math.min(window.devicePixelRatio || 1, 2),
				preference: 'webgl',
				powerPreference: 'high-performance'
			});
			if (disposed) {
				app.destroy({ removeView: false }, { children: true });
				return;
			}

			const logicalWidth = 700;
			const logicalHeight = 1050;
			const scene = new Container({ label: 'realtime-combat-scene' });
			const backdropLayer = new Container({ label: 'painted-backdrop' });
			const worldLayer = new Container({ label: 'depth-sorted-world', sortableChildren: true });
			const occluderLayer = new Container({ label: 'environment-occluders' });
			const atmosphereLayer = new Container({ label: 'atmosphere' });
			const transientUiLayer = new Container({ label: 'transient-world-ui' });
			scene.addChild(backdropLayer, worldLayer, occluderLayer, atmosphereLayer, transientUiLayer);
			app.stage.addChild(scene);
			const sceneMask = new Graphics({ label: 'portrait-stage-mask' })
				.rect(0, 0, logicalWidth, logicalHeight)
				.fill(0xffffff);
			scene.addChild(sceneMask);
			scene.mask = sceneMask;

			const backdrop = new Sprite({
				texture: textureFor(ART.environment),
				label: 'ruined-threshold-environment'
			});
			backdrop.width = logicalWidth;
			backdrop.height = logicalHeight;
			backdropLayer.addChild(backdrop);
			const wellOccluder = new Sprite({
				texture: textureFor(ART.wellOccluder),
				label: 'well-foreground-occluder'
			});
			wellOccluder.width = logicalWidth;
			wellOccluder.height = logicalHeight;
			occluderLayer.addChild(wellOccluder);

			const grade = new Graphics({ label: 'mode-grade' })
				.rect(0, 0, logicalWidth, logicalHeight)
				.fill({ color: 0x06111a, alpha: 0.12 });
			backdropLayer.addChild(grade);

			const laneGlow = new Graphics({ label: 'combat-lane-light' })
				.ellipse(350, 690, 260, 290)
				.fill({ color: 0xd89b42, alpha: 0.055 });
			worldLayer.addChild(laneGlow);
			laneGlow.zIndex = 1;

			const trapezoidGuide = new Graphics({ label: 'trapezoid-projection-guide' })
				.moveTo(112, 170)
				.lineTo(588, 170)
				.lineTo(682, 970)
				.lineTo(18, 970)
				.closePath()
				.moveTo(271, 170)
				.lineTo(240, 970)
				.moveTo(429, 170)
				.lineTo(460, 970)
				.moveTo(84, 420)
				.lineTo(616, 420)
				.moveTo(52, 690)
				.lineTo(648, 690)
				.stroke({ color: 0x79c3cf, alpha: 0.22, width: 1.5 });
			trapezoidGuide.zIndex = 2;
			worldLayer.addChild(trapezoidGuide);

			const fogBanks = [
				new Graphics().ellipse(160, 430, 230, 60).fill({ color: 0x9db7bd, alpha: 0.075 }),
				new Graphics().ellipse(545, 650, 260, 72).fill({ color: 0x8aa9b2, alpha: 0.065 })
			];
			fogBanks.forEach((fog) => atmosphereLayer.addChild(fog));

			const motes = Array.from({ length: 22 }, (_, index) => {
				const mote = new Graphics()
					.circle(0, 0, index % 4 === 0 ? 2.2 : 1.2)
					.fill({ color: index % 3 === 0 ? 0xd89b42 : 0x79c3cf, alpha: 0.38 });
				mote.position.set((index * 97) % logicalWidth, 210 + ((index * 151) % 690));
				mote.alpha = 0.25 + (index % 5) * 0.08;
				atmosphereLayer.addChild(mote);
				return mote;
			});

			type ActorView = {
				container: Container;
				body: Sprite | AnimatedSprite;
				shadow: Graphics;
				healthContainer: Container;
				healthFill: Graphics;
				impact: Graphics;
				baseWidth: number;
				baseHeight: number;
				displaySize: number;
				bodyAnchorY: number;
				healthWidth: number;
				motion?: {
					sprite: AnimatedSprite;
					sheet: Spritesheet;
					state: ActorAnimatorState;
					clip: CombatClip;
				};
			};
			const actorViews: Record<string, ActorView> = {};

			const artSourceFor = (entry: RealtimeActor): string =>
				entry.role === 'swarm' ? ART['plague-rat'] : ART[entry.id as keyof typeof ART];
			const sizeFor = (entry: RealtimeActor): number =>
				entry.role === 'brute'
					? 250
					: entry.role === 'swarm'
						? 118
						: entry.role === 'guardian'
							? 184
							: entry.role === 'archer'
								? 168
								: 178;
			const motionSheetFor = (entry: RealtimeActor): Spritesheet | undefined =>
				entry.id === 'saffron-braid'
					? motionSheets.asha
					: entry.id === 'plague-rat-1'
						? motionSheets['lesser-rat']
						: undefined;

			for (const entry of simulation.actors) {
				const container = new Container({ label: entry.id, sortableChildren: true });
				const shadow = new Graphics({ label: `${entry.id}-contact-shadow` })
					.ellipse(0, 5, entry.role === 'brute' ? 72 : entry.role === 'swarm' ? 29 : 45, 14)
					.fill({ color: 0x010305, alpha: 0.62 });
				const motionSheet = motionSheetFor(entry);
				const body = motionSheet
					? new AnimatedSprite({
							textures: motionSheet.animations.idle!,
							autoPlay: false,
							autoUpdate: false,
							loop: true,
							label: `${entry.id}-motion-canary`
						})
					: new Sprite({ texture: textureFor(artSourceFor(entry)) });
				const bodyAnchorY = motionSheet ? 246 / 256 : 0.88;
				body.anchor.set(0.5, bodyAnchorY);
				const displaySize = sizeFor(entry);
				body.width = displaySize;
				body.height = displaySize;
				const healthWidth = entry.role === 'brute' ? 92 : entry.role === 'swarm' ? 44 : 64;
				const healthContainer = new Container({ label: `${entry.id}-health-bar` });
				const healthTrack = new Graphics()
					.roundRect(-healthWidth / 2, -3.5, healthWidth, 7, 4)
					.fill({ color: 0x08080a, alpha: 0.9 })
					.stroke({ color: 0xeadcbc, alpha: 0.26, width: 1 });
				const healthFill = new Graphics()
					.roundRect(0, -2.5, healthWidth - 2, 5, 3)
					.fill(entry.team === 'heroes' ? 0x79c3cf : 0xa4473f);
				healthFill.position.x = -healthWidth / 2 + 1;
				healthContainer.addChild(healthTrack, healthFill);
				const impact = new Graphics({ label: `${entry.id}-impact` })
					.circle(0, -54, entry.role === 'brute' ? 62 : 38)
					.stroke({ color: entry.team === 'rats' ? 0xffd072 : 0xe95a4c, alpha: 0.88, width: 5 });
				impact.alpha = 0;
				container.addChild(shadow, body, impact);
				worldLayer.addChild(container);
				transientUiLayer.addChild(healthContainer);
				actorViews[entry.id] = {
					container,
					body,
					shadow,
					healthContainer,
					healthFill,
					impact,
					baseWidth: body.scale.x,
					baseHeight: body.scale.y,
					displaySize,
					bodyAnchorY,
					healthWidth,
					motion: motionSheet
						? {
								sprite: body as AnimatedSprite,
								sheet: motionSheet,
								state: createActorAnimator(entry),
								clip: 'idle'
							}
						: undefined
				};
			}

			resetPresentationState = (snapshot) => {
				for (const entry of snapshot.actors) {
					const motion = actorViews[entry.id]?.motion;
					if (!motion) continue;
					motion.state = createActorAnimator(entry);
					motion.clip = motion.state.clip;
					motion.sprite.textures = motion.sheet.animations[motion.clip]!;
					motion.sprite.gotoAndStop(0);
				}
			};
			const updateAnimations = (snapshot: RealtimeCombatState, frameSeconds: number) => {
				for (const entry of snapshot.actors) {
					const motion = actorViews[entry.id]?.motion;
					if (!motion) continue;
					motion.state = stepActorAnimator(motion.state, entry, frameSeconds);
					if (motion.clip !== motion.state.clip) {
						motion.clip = motion.state.clip;
						motion.sprite.textures = motion.sheet.animations[motion.clip]!;
					}
					const meta = CLIP_META[motion.clip];
					motion.sprite.gotoAndStop(
						frameIndexForClip(
							motion.state,
							motion.sprite.textures.length,
							meta.framesPerSecond,
							meta.loop
						)
					);
				}
			};

			let activeMode = mode;
			applyPresentation = (next) => {
				activeMode = next;
				host.dataset.appliedPresentationMode = next;
				grade.alpha = next === '2d' ? 0.28 : next === '2.5d-v2' ? 0.08 : 0.12;
				atmosphereLayer.visible = next !== '2d';
				const showV2Projection = next === '2.5d-v2';
				trapezoidGuide.visible = showV2Projection;
				trapezoidGuide.renderable = showV2Projection;
				trapezoidGuide.alpha = showV2Projection ? 1 : 0;
				occluderLayer.visible = showV2Projection;
				occluderLayer.renderable = showV2Projection;
				renderSimulation?.(simulation);
			};

			renderSimulation = (snapshot) => {
				for (const entry of snapshot.actors) {
					const view = actorViews[entry.id]!;
					const target = snapshot.actors.find((candidate) => candidate.id === entry.targetId);
					const pulse = Math.sin(entry.attackPulse * Math.PI);
					const dx = target ? target.x - entry.x : 0;
					const dy = target ? target.y - entry.y : 0;
					const length = Math.hypot(dx, dy) || 1;
					const lunge = pulse * (entry.role === 'archer' ? 4 : 12);
					const projected = projectCombatPoint(activeMode, entry.x, entry.y, {
						width: logicalWidth,
						height: logicalHeight
					});
					const renderedPoint: ProjectedCombatPoint = {
						...projected,
						x: projected.x + (dx / length) * lunge,
						y: projected.y + (dy / length) * lunge
					};
					view.container.position.set(renderedPoint.x, renderedPoint.y);
					view.container.scale.set(renderedPoint.scale);
					view.container.zIndex =
						activeMode === '2d' ? (entry.team === 'rats' ? 10 : 20) : renderedPoint.depth;
					view.container.alpha = entry.health <= 0 ? (view.motion ? 0.72 : 0.22) : 1;
					view.container.rotation =
						entry.health <= 0 && !view.motion ? (entry.team === 'rats' ? 0.92 : -0.92) : 0;
					view.healthFill.scale.x = Math.max(0, entry.health / entry.maximumHealth);
					const healthLayout = layoutHealthBar(renderedPoint, view.displaySize, {
						anchorY: view.bodyAnchorY,
						clearance: entry.role === 'brute' ? 17 : 13,
						width: view.healthWidth
					});
					view.healthContainer.position.set(healthLayout.x, healthLayout.y);
					view.healthContainer.alpha =
						entry.health <= 0
							? entry.hitPulse
							: entry.team === 'rats' || entry.health < entry.maximumHealth
								? 1
								: 0;
					view.impact.alpha = entry.hitPulse * 0.9;
					view.impact.scale.set(0.72 + (1 - entry.hitPulse) * 0.55);
					view.body.tint = entry.hitPulse > 0.48 ? 0xffc8a4 : 0xffffff;
					view.body.scale.set(
						view.baseWidth * (1 + pulse * 0.055),
						view.baseHeight * (1 - pulse * 0.035)
					);
					view.shadow.scale.set(
						activeMode === '2d' ? 0.82 : 1 + pulse * 0.18,
						activeMode === '2d' ? 0.82 : 1 - pulse * 0.22
					);
					view.shadow.alpha = activeMode === '2d' ? 0.36 : 0.62;
					view.shadow.rotation = activeMode === '2.5d-v2' ? -0.17 : 0;
				}
			};

			const fitScene = () => {
				if (!app) return;
				const scale = Math.min(app.screen.width / logicalWidth, app.screen.height / logicalHeight);
				scene.scale.set(scale);
				scene.position.set(
					(app.screen.width - logicalWidth * scale) / 2,
					(app.screen.height - logicalHeight * scale) / 2
				);
			};
			fitScene();
			resizeObserver = new ResizeObserver(fitScene);
			resizeObserver.observe(host);

			let accumulator = 0;
			let publishTimer = 0;
			app.ticker.maxFPS = 60;
			app.ticker.minFPS = 20;
			app.ticker.add((ticker) => {
				if (activeMode !== mode) applyPresentation?.(mode);
				const frameSeconds = Math.min(ticker.deltaMS / 1000, 0.1);
				if (!paused && simulation.phase === 'running') {
					accumulator += frameSeconds;
					while (accumulator >= 1 / 60) {
						simulation = stepRealtimeCombat(simulation, 1 / 60);
						accumulator -= 1 / 60;
					}
				}
				if (!paused) updateAnimations(simulation, frameSeconds);
				renderSimulation?.(simulation);
				if (!reducedMotion && activeMode !== '2d') {
					const time = simulation.elapsedSeconds;
					const cameraStrength = activeMode === '2.5d-v2' ? 1.45 : 1;
					backdropLayer.position.set(
						Math.sin(time * 0.19) * 2.5 * cameraStrength,
						Math.cos(time * 0.16) * 1.5 * cameraStrength
					);
					const worldX = Math.sin(time * 0.19) * -1.2 * cameraStrength;
					const worldY = Math.cos(time * 0.16) * -0.8 * cameraStrength;
					worldLayer.position.set(worldX, worldY);
					transientUiLayer.position.set(worldX, worldY);
					occluderLayer.position.copyFrom(backdropLayer.position);
					fogBanks[0]!.x = Math.sin(time * 0.11) * 46;
					fogBanks[1]!.x = Math.cos(time * 0.09) * 38;
					motes.forEach((mote, index) => {
						mote.y -= frameSeconds * (4 + (index % 4));
						if (mote.y < 190) mote.y = 900;
					});
				} else {
					backdropLayer.position.set(0);
					worldLayer.position.set(0);
					transientUiLayer.position.set(0);
					occluderLayer.position.set(0);
				}
				publishTimer += frameSeconds;
				if (publishTimer >= 0.12 || simulation.phase !== 'running') {
					publishTimer = 0;
					onSnapshot(simulation);
				}
			});

			applyPresentation(mode);
			resetPresentationState(simulation);
			renderSimulation(simulation);
			onSnapshot(simulation);
		})();

		return () => {
			disposed = true;
			resizeObserver?.disconnect();
			renderSimulation = undefined;
			applyPresentation = undefined;
			resetPresentationState = undefined;
			app?.destroy({ removeView: false, releaseGlobalResources: true }, { children: true });
			void import('pixi.js').then(({ Assets }) => Assets.unload(ART_SOURCES));
		};
	});
</script>

<div
	class="canvas-host"
	bind:this={host}
	data-testid="realtime-combat-pixi-host"
	data-presentation-mode={mode}
>
	<canvas bind:this={canvas} data-testid="realtime-combat-pixi-canvas" aria-hidden="true"></canvas>
</div>

<style>
	.canvas-host,
	.canvas-host :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.canvas-host {
		position: absolute;
		inset: 0;
		background: #05090e;
	}
</style>
