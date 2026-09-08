<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type {
		ExplorationCombatReceipt,
		ExplorationCombatRejection,
		ExplorationEncounterRequest
	} from '@summonlab/contracts';
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
	import { actorVisualRegistration } from './actor-visual-registration';
	import { WELL_OBSTACLE } from './combat-spatial';
	import {
		projectCombatPoint,
		type CombatPresentationMode,
		type ProjectedCombatPoint
	} from './depth-projection';
	import { layoutHealthBar } from './health-bar-layout';
	import { motionPackVersionDiagnostic } from './motion-pack-config';
	import { type RealtimeActor, type RealtimeCombatState } from './realtime-combat';
	import {
		createVerifiedStageAssetLoader,
		requestAssetBindings,
		type VerifiedStageAsset
	} from './stage-asset-integrity';
	import {
		advanceStageSession,
		bindStageSessionNotifications,
		stageSessionDependencies,
		stageAssetOwner,
		type StageAssetClaim
	} from './stage-lifecycle';
	import {
		CombatSessionRegistry,
		createReplayCombatSession,
		enterCombatSession,
		type CombatClaimPolicy,
		type CombatClaimPolicyBinding,
		type CombatSession,
		type CombatReplayVerification,
		type CombatUnavailableState
	} from './combat-session';

	let {
		request,
		claimPolicy,
		claimPolicyBinding,
		fixtureRequestHash,
		registry,
		replayOf,
		mode,
		paused,
		reducedMotion,
		onSnapshot,
		onComplete,
		onRejected,
		onUnavailable,
		onReplayVerified
	}: {
		request: ExplorationEncounterRequest;
		claimPolicy: CombatClaimPolicy;
		claimPolicyBinding: CombatClaimPolicyBinding;
		fixtureRequestHash?: string;
		registry: CombatSessionRegistry;
		replayOf?: ExplorationCombatReceipt;
		mode: CombatPresentationMode;
		paused: boolean;
		reducedMotion: boolean;
		onSnapshot: (snapshot: RealtimeCombatState) => void;
		onComplete: (receipt: ExplorationCombatReceipt) => void;
		onRejected: (rejection: ExplorationCombatRejection) => void;
		onUnavailable: (state: CombatUnavailableState) => void;
		onReplayVerified: (verification: CombatReplayVerification) => void;
	} = $props();

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let simulation: RealtimeCombatState | undefined;
	let renderSimulation: ((snapshot: RealtimeCombatState) => void) | undefined;
	let applyPresentation: ((next: CombatPresentationMode) => void) | undefined;

	function uniqueBySource<T extends { source: string }>(bindings: readonly T[]): readonly T[] {
		return [...new Map(bindings.map((binding) => [binding.source, binding])).values()];
	}

	function combatRasterBindings(encounter: ExplorationEncounterRequest) {
		return uniqueBySource([
			encounter.battlefieldBinding.environmentAssetBinding,
			...encounter.battlefieldBinding.occluderAssetBindings,
			...[...encounter.party, ...encounter.enemies].map(
				(participant) => participant.presentation.combatAssetBinding
			)
		]);
	}

	function combatMotionBindings(encounter: ExplorationEncounterRequest) {
		return uniqueBySource(
			[...encounter.party, ...encounter.enemies].map(
				(participant) => participant.presentation.motionPackBinding
			)
		);
	}

	const requestForSession = untrack(() => request);
	const claimPolicyForSession = untrack(() => claimPolicy);
	const claimPolicyBindingForSession = untrack(() => claimPolicyBinding);
	const fixtureRequestHashForSession = untrack(() => fixtureRequestHash);
	const registryForSession = untrack(() => registry);
	const replayForSession = untrack(() => replayOf);
	const onCompleteForSession = untrack(() => onComplete);
	const onRejectedForSession = untrack(() => onRejected);
	const dependencies = stageSessionDependencies(
		claimPolicyForSession,
		claimPolicyBindingForSession,
		fixtureRequestHashForSession
	);
	const entry = replayForSession
		? {
				kind: 'session' as const,
				session: createReplayCombatSession(requestForSession, replayForSession, dependencies)
			}
		: enterCombatSession(requestForSession, dependencies, registryForSession);
	const presentationRequest = entry.kind === 'session' ? entry.session.request : requestForSession;
	const rasterBindings = combatRasterBindings(presentationRequest);
	const motionBindings = combatMotionBindings(presentationRequest);
	const sources = requestAssetBindings(presentationRequest);
	const motionPackVersions = motionPackVersionDiagnostic(motionBindings);
	let session: CombatSession | undefined;
	if (entry.kind === 'completed') onCompleteForSession(entry.receipt);
	else if (entry.kind === 'rejected') onRejectedForSession(entry.rejection);
	else {
		session = entry.session;
		simulation = session.combat;
	}
	const CLIP_META: Record<CombatClip, { framesPerSecond: number; loop: boolean }> = {
		idle: { framesPerSecond: 6, loop: true },
		advance: { framesPerSecond: 10, loop: true },
		attack: { framesPerSecond: 12, loop: false },
		hit: { framesPerSecond: 9, loop: false },
		down: { framesPerSecond: 6, loop: false }
	};

	$effect(() => applyPresentation?.(mode));

	onMount(() => {
		if (!session || !simulation) return;

		let disposed = false;
		let app: Application | undefined;
		let resizeObserver: ResizeObserver | undefined;
		let detachTicker = () => {};
		let assetClaim: StageAssetClaim | undefined;
		let releaseDecodedAssets = async () => {};
		const activeSession = session;
		const unsubscribe = bindStageSessionNotifications(activeSession, Boolean(replayForSession), {
			onComplete,
			onUnavailable,
			onReplayVerified
		});
		const releaseAssets = async () => {
			try {
				await assetClaim?.release();
			} catch {
				// A later stage can retry a rejected raw-byte claim through the shared owner.
			}
		};
		const detachPresentation = () => {
			resizeObserver?.disconnect();
			detachTicker();
			renderSimulation = undefined;
			applyPresentation = undefined;
			app?.destroy({ removeView: false, releaseGlobalResources: true }, { children: true });
			app = undefined;
		};

		void (async () => {
			let failedDuringInit = false;
			try {
				const pixi = await import('pixi.js');
				const {
					AnimatedSprite,
					Application: PixiApplication,
					Assets,
					Container,
					Graphics,
					Sprite,
					Spritesheet,
					Texture
				} = pixi;
				assetClaim = stageAssetOwner(createVerifiedStageAssetLoader()).claim(sources);
				const verifiedAssets = (await assetClaim.ready) as readonly VerifiedStageAsset[];
				if (disposed) {
					await releaseAssets();
					return;
				}

				const assetBySource = new Map(verifiedAssets.map((asset) => [asset.source, asset]));
				const objectUrls: string[] = [];
				const decodedTextures = new SvelteMap<string, Texture>();
				const decodedSheets = new SvelteMap<string, Spritesheet>();
				let decodedAssetsReleased = false;
				releaseDecodedAssets = async () => {
					if (decodedAssetsReleased) return;
					decodedAssetsReleased = true;
					for (const sheet of decodedSheets.values()) {
						try {
							sheet.destroy(false);
						} catch {
							// Cleanup must not leave a rejected promise after a local asset failure.
						}
					}
					await Promise.allSettled(objectUrls.map((objectUrl) => Assets.unload(objectUrl)));
					for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
				};
				const assetFor = (source: string): VerifiedStageAsset => {
					const asset = assetBySource.get(source);
					if (!asset) throw new Error(`Missing verified bytes for ${source}`);
					return asset;
				};
				const textureForSource = async (source: string): Promise<Texture> => {
					const cached = decodedTextures.get(source);
					if (cached) return cached;
					const asset = assetFor(source);
					const objectUrl = URL.createObjectURL(
						new Blob([asset.bytes], {
							type: source.endsWith('.webp') ? 'image/webp' : 'image/png'
						})
					);
					objectUrls.push(objectUrl);
					const texture = (await Assets.load({ src: objectUrl, parser: 'texture' })) as Texture;
					decodedTextures.set(source, texture);
					return texture;
				};
				await Promise.all(rasterBindings.map((binding) => textureForSource(binding.source)));
				await Promise.all(
					motionBindings.map(async (binding) => {
						const sheet = new Spritesheet({
							texture: await textureForSource(binding.atlasImageSource),
							data: JSON.parse(new TextDecoder().decode(assetFor(binding.source).bytes)),
							cachePrefix: `${binding.motionPackId}-v${binding.version}-`
						});
						decodedSheets.set(binding.source, sheet);
						await sheet.parse();
					})
				);
				if (disposed) {
					await releaseDecodedAssets();
					await releaseAssets();
					return;
				}

				const textureFor = (source: string): Texture => {
					const texture = decodedTextures.get(source);
					if (!texture) throw new Error(`Missing decoded texture for ${source}`);
					return texture;
				};
				const sheetFor = (source: string): Spritesheet => {
					const sheet = decodedSheets.get(source);
					if (!sheet) throw new Error(`Missing decoded spritesheet for ${source}`);
					return sheet;
				};
				app = new PixiApplication();
				failedDuringInit = true;
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
				failedDuringInit = false;
				if (disposed) {
					app.destroy({ removeView: false }, { children: true });
					app = undefined;
					return;
				}

				const logicalWidth = 700;
				const logicalHeight = 1050;
				const scene = new Container({ label: 'realtime-combat-scene' });
				const backdropLayer = new Container({ label: 'painted-backdrop' });
				const worldLayer = new Container({ label: 'depth-sorted-world', sortableChildren: true });
				const atmosphereLayer = new Container({ label: 'atmosphere' });
				const transientUiLayer = new Container({ label: 'transient-world-ui' });
				scene.addChild(backdropLayer, worldLayer, atmosphereLayer, transientUiLayer);
				app.stage.addChild(scene);
				const sceneMask = new Graphics({ label: 'portrait-stage-mask' })
					.rect(0, 0, logicalWidth, logicalHeight)
					.fill(0xffffff);
				scene.addChild(sceneMask);
				scene.mask = sceneMask;

				const backdrop = new Sprite({
					texture: textureFor(
						activeSession.request.battlefieldBinding.environmentAssetBinding.source
					),
					label: 'ruined-threshold-environment'
				});
				backdrop.width = logicalWidth;
				backdrop.height = logicalHeight;
				backdropLayer.addChild(backdrop);
				const wellOccluderBinding =
					activeSession.request.battlefieldBinding.occluderAssetBindings[0];
				const wellOccluder = new Sprite({
					texture: wellOccluderBinding ? textureFor(wellOccluderBinding.source) : Texture.EMPTY,
					label: 'well-foreground-occluder'
				});
				wellOccluder.width = logicalWidth;
				wellOccluder.height = logicalHeight;
				wellOccluder.zIndex = projectCombatPoint(
					'2.5d-v2',
					WELL_OBSTACLE.centerX,
					WELL_OBSTACLE.centerY + WELL_OBSTACLE.radiusY,
					{ width: logicalWidth, height: logicalHeight }
				).depth;
				worldLayer.addChild(wellOccluder);

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

				const initialAnimatorState = (entry: RealtimeActor): ActorAnimatorState => {
					return createActorAnimator(entry);
				};

				for (const entry of activeSession.combat.actors) {
					const container = new Container({ label: entry.id, sortableChildren: true });
					const registration = actorVisualRegistration({
						role: entry.role,
						clip: 'idle',
						visualTuning: entry.presentation.visualTuning
					});
					const shadow = new Graphics({ label: `${entry.id}-contact-shadow` })
						.ellipse(0, 0, registration.shadowRadiusX, registration.shadowRadiusY)
						.fill({ color: 0x010305, alpha: 0.62 });
					const rasterTexture = textureFor(entry.presentation.combatAssetBinding.source);
					const motionSheet = sheetFor(entry.presentation.motionPackBinding.source);
					if (!rasterTexture || !motionSheet.animations.idle) {
						throw new Error(`Missing declared combat visual for ${entry.id}`);
					}
					const body = new AnimatedSprite({
						textures: motionSheet.animations.idle,
						autoPlay: false,
						autoUpdate: false,
						loop: true,
						label: `${entry.id}-motion-pack`
					});
					const bodyAnchorY = 246 / 256;
					body.anchor.set(0.5, bodyAnchorY);
					const displaySize = registration.displaySize;
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
					container.addChild(body, impact);
					worldLayer.addChild(shadow, container);
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
						motion: {
							sprite: body,
							sheet: motionSheet,
							state: initialAnimatorState(entry),
							clip: 'idle'
						}
					};
				}
				host.dataset.animatedActorCount = String(
					Object.values(actorViews).filter((view) => view.motion).length
				);

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
					wellOccluder.visible = showV2Projection;
					wellOccluder.renderable = showV2Projection;
					if (simulation) renderSimulation?.(simulation);
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
						view.shadow.position.set(
							renderedPoint.x - (activeMode === '2.5d-v2' ? 4.5 * renderedPoint.scale : 0),
							renderedPoint.y + 3 * renderedPoint.scale
						);
						view.shadow.zIndex = view.container.zIndex - 1;
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
						view.body.position.y = actorVisualRegistration({
							role: entry.role,
							clip: view.motion?.clip ?? 'idle',
							visualTuning: entry.presentation.visualTuning
						}).bodyOffsetY;
						view.body.scale.set(
							view.baseWidth * (1 + pulse * 0.055),
							view.baseHeight * (1 - pulse * 0.035)
						);
						view.shadow.scale.set(
							renderedPoint.scale * (activeMode === '2d' ? 0.82 : 1.02),
							renderedPoint.scale * (activeMode === '2d' ? 0.82 : 0.68)
						);
						view.shadow.alpha = entry.health <= 0 ? 0.18 : activeMode === '2d' ? 0.36 : 0.52;
						view.shadow.rotation = activeMode === '2.5d-v2' ? -0.12 : 0;
					}
				};

				const fitScene = () => {
					if (!app) return;
					const scale = Math.min(
						app.screen.width / logicalWidth,
						app.screen.height / logicalHeight
					);
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
				const tick = (ticker: import('pixi.js').Ticker) => {
					if (activeMode !== mode) applyPresentation?.(mode);
					const frameSeconds = Math.min(ticker.deltaMS / 1000, 0.1);
					const advanced = advanceStageSession(activeSession, paused, accumulator, frameSeconds);
					accumulator = advanced.accumulator;
					simulation = advanced.combat;
					if (!paused) updateAnimations(simulation, frameSeconds);
					renderSimulation?.(simulation);
					if (!reducedMotion && activeMode !== '2d') {
						const time = simulation.elapsedSeconds;
						const cameraStrength = activeMode === '2.5d-v2' ? 1.45 : 1;
						const backdropX = Math.sin(time * 0.19) * 2.5 * cameraStrength;
						const backdropY = Math.cos(time * 0.16) * 1.5 * cameraStrength;
						backdropLayer.position.set(backdropX, backdropY);
						const worldX = Math.sin(time * 0.19) * -1.2 * cameraStrength;
						const worldY = Math.cos(time * 0.16) * -0.8 * cameraStrength;
						worldLayer.position.set(worldX, worldY);
						transientUiLayer.position.set(worldX, worldY);
						wellOccluder.position.set(backdropX - worldX, backdropY - worldY);
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
						wellOccluder.position.set(0);
					}
					publishTimer += frameSeconds;
					if (publishTimer >= 0.12 || activeSession.status !== 'running') {
						publishTimer = 0;
						onSnapshot(simulation);
					}
				};
				app.ticker.add(tick);
				detachTicker = () => app?.ticker.remove(tick);

				applyPresentation(mode);
				renderSimulation(simulation);
				onSnapshot(simulation);
				activeSession.markAssetsReady();
			} catch {
				if (disposed) {
					await releaseDecodedAssets();
					await releaseAssets();
					return;
				}
				const unavailable = {
					code: failedDuringInit ? 'renderer-initialization-failed' : 'asset-load-failed',
					message: 'Combat presentation could not be loaded.'
				} as const;
				activeSession.markUnavailable(unavailable);
				unsubscribe();
				detachPresentation();
				void releaseDecodedAssets();
				void releaseAssets();
			} finally {
				if (disposed) {
					await releaseDecodedAssets();
					await releaseAssets();
				}
			}
		})();

		return () => {
			disposed = true;
			unsubscribe();
			detachPresentation();
			void releaseDecodedAssets();
			void releaseAssets();
		};
	});
</script>

<div
	class="canvas-host"
	bind:this={host}
	data-testid="realtime-combat-pixi-host"
	data-presentation-mode={mode}
	data-motion-pack-versions={motionPackVersions}
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
