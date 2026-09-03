<script lang="ts">
	import { onMount } from 'svelte';
	import type { Application, Container, Graphics, Sprite } from 'pixi.js';
	import {
		COMBAT_PLAYBACK_DURATION_MS,
		projectCombatPlayback,
		type CombatActorRole,
		type CombatPlaybackSnapshot,
		type CombatReceipt
	} from './combat-playback';

	type PlaybackCommand = Readonly<{
		sequence: number;
		kind: 'ready' | 'replay' | 'skip';
	}>;

	let {
		receipt,
		command,
		paused,
		speed,
		reducedMotion,
		onSnapshot,
		onComplete
	}: {
		receipt: CombatReceipt;
		command: PlaybackCommand;
		paused: boolean;
		speed: number;
		reducedMotion: boolean;
		onSnapshot: (snapshot: CombatPlaybackSnapshot) => void;
		onComplete: () => void;
	} = $props();

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let elapsedMs = 0;
	let started = false;
	let activeCommandSequence = -1;
	let completeReported = false;
	let renderSnapshot: ((snapshot: CombatPlaybackSnapshot) => void) | undefined;
	let unloadArt: (() => void) | undefined;

	const ART_ROOT = '/runtime/combat/observatory-art-pilot-v1';
	const TACTICAL_CELL_SIZE = 82;
	const ART_SOURCES = [
		`${ART_ROOT}/observatory-square-floor-v2.png`,
		`${ART_ROOT}/dara-zev-chibi-screen-v1.png`,
		`${ART_ROOT}/sprout-goblin-screen-v1.png`
	] as const;

	function publish(): void {
		const snapshot = projectCombatPlayback(receipt, elapsedMs, { started, reducedMotion });
		renderSnapshot?.(snapshot);
		onSnapshot(snapshot);
		if (snapshot.complete && !completeReported) {
			completeReported = true;
			onComplete();
		}
	}

	$effect(() => {
		if (command.sequence === activeCommandSequence) return;
		activeCommandSequence = command.sequence;
		completeReported = false;
		started = command.kind !== 'ready';
		elapsedMs = command.kind === 'skip' ? COMBAT_PLAYBACK_DURATION_MS : 0;
		publish();
	});

	onMount(() => {
		let disposed = false;
		let app: Application | undefined;
		let resizeObserver: ResizeObserver | undefined;

		void (async () => {
			const { Application, Assets, Container, Filter, Graphics, Sprite } = await import('pixi.js');
			if (disposed) return;
			const [environmentTexture, heroTexture, sproutTexture] = await Promise.all(
				ART_SOURCES.map((src) => Assets.load(src))
			);
			unloadArt = () => void Assets.unload([...ART_SOURCES]);
			if (disposed) {
				unloadArt();
				return;
			}

			app = new Application();
			await app.init({
				resizeTo: host,
				canvas,
				background: '#071018',
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
			const logicalHeight = 980;
			const world = new Container({ label: 'combat-world', sortableChildren: true });
			world.eventMode = 'none';
			app.stage.addChild(world);

			const board = { x: 63, y: 104, cellSize: TACTICAL_CELL_SIZE };
			const cellWidth = board.cellSize;
			const cellHeight = board.cellSize;
			const boardWidth = receipt.board.columns * board.cellSize;
			const boardHeight = receipt.board.rows * board.cellSize;
			const cellCenter = (column: number, row: number) => ({
				x: board.x + (column + 0.5) * cellWidth,
				y: board.y + (row + 0.5) * cellHeight
			});
			const makeBlackFieldFilter = () =>
				Filter.from({
					gl: {
						vertex: `
							in vec2 aPosition;
							out vec2 vTextureCoord;
							uniform vec4 uInputSize;
							uniform vec4 uOutputFrame;
							uniform vec4 uOutputTexture;

							vec4 filterVertexPosition(void) {
								vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
								position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
								position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
								return vec4(position, 0.0, 1.0);
							}

							vec2 filterTextureCoord(void) {
								return aPosition * (uOutputFrame.zw * uInputSize.zw);
							}

							void main(void) {
								gl_Position = filterVertexPosition();
								vTextureCoord = filterTextureCoord();
							}
						`,
						fragment: `
							in vec2 vTextureCoord;
							out vec4 finalColor;
							uniform sampler2D uTexture;

							void main(void) {
								vec4 color = texture(uTexture, vTextureCoord);
								float brightest = max(color.r, max(color.g, color.b));
								float keyedAlpha = smoothstep(0.005, 0.025, brightest);
								finalColor = vec4(color.rgb * keyedAlpha, keyedAlpha);
							}
						`
					}
				});

			const backdrop = new Sprite({ texture: environmentTexture, label: 'observatory-painted' });
			backdrop.position.set(0, -100);
			backdrop.width = logicalWidth;
			backdrop.height = 1244;
			world.addChild(backdrop);

			const moonVeil = new Graphics({ label: 'moonlit-atmosphere' });
			moonVeil.rect(0, 0, logicalWidth, logicalHeight).fill({ color: 0x061522, alpha: 0.08 });
			moonVeil.rect(0, 0, logicalWidth, 150).fill({ color: 0x020812, alpha: 0.28 });
			world.addChild(moonVeil);

			const tacticalGrid = new Graphics({ label: 'authoritative-square-grid' });
			for (let row = 0; row < receipt.board.rows; row += 1) {
				for (let column = 0; column < receipt.board.columns; column += 1) {
					const x = board.x + column * board.cellSize;
					const y = board.y + row * board.cellSize;
					tacticalGrid
						.rect(x + 2.5, y + 2.5, board.cellSize - 5, board.cellSize - 5)
						.fill({
							color: (column + row) % 2 === 0 ? 0x07131b : 0xb6a77f,
							alpha: (column + row) % 2 === 0 ? 0.13 : 0.065
						})
						.rect(x + 4, y + 4, board.cellSize - 8, board.cellSize - 8)
						.stroke({ color: 0xcac0a5, alpha: 0.13, width: 1, alignment: 1 });
				}
			}

			for (let column = 0; column <= receipt.board.columns; column += 1) {
				const x = board.x + column * board.cellSize;
				tacticalGrid.moveTo(x, board.y).lineTo(x, board.y + boardHeight);
			}
			for (let row = 0; row <= receipt.board.rows; row += 1) {
				const y = board.y + row * board.cellSize;
				tacticalGrid.moveTo(board.x, y).lineTo(board.x + boardWidth, y);
			}
			tacticalGrid.stroke({ color: 0x050b0e, alpha: 0.88, width: 5 });

			const bevelOffset = 1.75;
			for (let column = 0; column <= receipt.board.columns; column += 1) {
				const x = board.x + column * board.cellSize + bevelOffset;
				tacticalGrid.moveTo(x, board.y).lineTo(x, board.y + boardHeight);
			}
			for (let row = 0; row <= receipt.board.rows; row += 1) {
				const y = board.y + row * board.cellSize + bevelOffset;
				tacticalGrid.moveTo(board.x, y).lineTo(board.x + boardWidth, y);
			}
			tacticalGrid.stroke({ color: 0xc5b998, alpha: 0.5, width: 1.4, pixelLine: true });
			tacticalGrid
				.rect(board.x, board.y, boardWidth, boardHeight)
				.stroke({ color: 0x050b0e, alpha: 0.95, width: 6 })
				.rect(board.x + 2, board.y + 2, boardWidth - 4, boardHeight - 4)
				.stroke({ color: 0xd6c58f, alpha: 0.62, width: 2, alignment: 1 });
			tacticalGrid.zIndex = 1;
			world.addChild(tacticalGrid);

			const selection = new Graphics({ label: 'selected-cell' });
			selection
				.rect(-cellWidth / 2 + 3, -cellHeight / 2 + 3, cellWidth - 6, cellHeight - 6)
				.fill({ color: 0xf5c86b, alpha: 0.06 })
				.stroke({ color: 0xffd77c, alpha: 0.96, width: 3 });
			selection.zIndex = 3;
			world.addChild(selection);

			const motionPath = new Graphics({ label: 'fleeting-step-path' });
			const origin = cellCenter(receipt.from.column, receipt.from.row);
			const destination = cellCenter(receipt.to.column, receipt.to.row);
			motionPath
				.moveTo(origin.x, origin.y - 8)
				.bezierCurveTo(
					origin.x + 36,
					origin.y - 165,
					destination.x - 50,
					destination.y + 105,
					destination.x,
					destination.y
				)
				.stroke({ color: 0x6bd9ff, alpha: 0.15, width: 12, cap: 'round' })
				.moveTo(origin.x, origin.y - 8)
				.bezierCurveTo(
					origin.x + 36,
					origin.y - 165,
					destination.x - 50,
					destination.y + 105,
					destination.x,
					destination.y
				)
				.stroke({ color: 0xffd272, alpha: 0.85, width: 4, cap: 'round' });
			motionPath.alpha = 0;
			motionPath.zIndex = 4;
			world.addChild(motionPath);

			const actorsLayer = new Container({ label: 'actors', sortableChildren: true });
			actorsLayer.zIndex = 10;
			world.addChild(actorsLayer);

			type ActorView = {
				container: Container;
				glow: Graphics;
				healthFill: Graphics;
				body: Graphics | Sprite;
				authored: boolean;
				bodyScale: number;
			};
			const actorViews: Record<string, ActorView> = {};

			function makeActor(id: string, role: CombatActorRole, kind: 'hero' | 'monster'): ActorView {
				const container = new Container({ sortableChildren: true });
				const hostile = kind === 'monster';
				const glow = new Graphics().ellipse(0, 2, 38, 18).fill({
					color: hostile ? 0xd8614f : 0xffd679,
					alpha: 0.4
				});
				glow.alpha = 0;
				const shadow = new Graphics().ellipse(0, 14, 29, 10).fill({ color: 0x020405, alpha: 0.6 });
				const proxyFigure = new Graphics();
				let figure: Graphics | Sprite = proxyFigure;
				let authored = false;
				let bodyScale = 1;

				if (id === receipt.actingActorId) {
					const sprite = new Sprite({ texture: heroTexture, label: 'dara-zev-art-pilot' });
					sprite.anchor.set(0.5, 0.865);
					sprite.width = 148;
					sprite.height = 148;
					sprite.filters = [makeBlackFieldFilter()];
					figure = sprite;
					authored = true;
					bodyScale = sprite.scale.x;
				} else if (id === receipt.targetActorId) {
					const sprite = new Sprite({ texture: sproutTexture, label: 'sprout-goblin-art-pilot' });
					sprite.anchor.set(0.5, 0.835);
					sprite.width = 126;
					sprite.height = 126;
					sprite.filters = [makeBlackFieldFilter()];
					figure = sprite;
					authored = true;
					bodyScale = sprite.scale.x;
				} else {
					proxyFigure.alpha = 0.72;
				}

				if (!authored && (role === 'blade' || role === 'archer' || role === 'mage')) {
					const cloak = role === 'archer' ? 0x3f5c43 : role === 'mage' ? 0x5d7187 : 0x33547a;
					proxyFigure
						.poly([-18, 9, -13, -29, 0, -43, 15, -28, 21, 11], true)
						.fill(cloak)
						.stroke({ color: 0xc8b986, alpha: 0.62, width: 2 });
					proxyFigure.circle(0, -52, 17).fill(0xe7cdb3).stroke({ color: 0x201d1c, width: 2 });
					proxyFigure.arc(0, -55, 18, Math.PI, Math.PI * 2).stroke({
						color: role === 'mage' ? 0x9db5c8 : role === 'archer' ? 0xd8c3a2 : 0x4b3127,
						width: 11
					});
					if (role === 'blade') {
						proxyFigure
							.moveTo(12, -23)
							.lineTo(37, 10)
							.stroke({ color: 0xdfe5e5, width: 5, cap: 'round' });
						proxyFigure.moveTo(35, 8).lineTo(43, 17).stroke({ color: 0xc49b52, width: 3 });
					} else if (role === 'archer') {
						proxyFigure.arc(-16, -20, 23, -1.2, 1.2).stroke({ color: 0xc6995b, width: 3 });
					} else {
						proxyFigure.moveTo(17, -29).lineTo(28, 10).stroke({ color: 0xb88954, width: 4 });
						proxyFigure.circle(16, -34, 7).fill(0x70bfe2).stroke({ color: 0xd8f5ff, width: 2 });
					}
				} else if (!authored && role === 'sprout') {
					proxyFigure.circle(0, -24, 24).fill(0xb6b96c).stroke({ color: 0x3b3d25, width: 3 });
					proxyFigure.ellipse(-9, -55, 9, 18).fill(0x6d8c4c).stroke({ color: 0x344425, width: 2 });
					proxyFigure.ellipse(11, -54, 9, 18).fill(0x789a54).stroke({ color: 0x344425, width: 2 });
					proxyFigure.circle(-8, -26, 3).fill(0x171b15).circle(8, -26, 3).fill(0x171b15);
				} else if (!authored && role === 'bat') {
					proxyFigure.poly([-7, -27, -35, -43, -29, -17, -8, -10], true).fill(0x6b5278);
					proxyFigure.poly([7, -27, 35, -43, 29, -17, 8, -10], true).fill(0x6b5278);
					proxyFigure.circle(0, -27, 18).fill(0x73587f).stroke({ color: 0x241d2a, width: 3 });
					proxyFigure.circle(-6, -29, 3).fill(0xf2ca66).circle(6, -29, 3).fill(0xf2ca66);
				} else if (!authored && role === 'mummy') {
					proxyFigure
						.roundRect(-18, -61, 36, 67, 12)
						.fill(0xc4b99a)
						.stroke({ color: 0x4b4639, width: 3 });
					for (let y = -53; y < 0; y += 12)
						proxyFigure
							.moveTo(-16, y)
							.lineTo(16, y + 6)
							.stroke({ color: 0x716956, alpha: 0.7, width: 3 });
					proxyFigure
						.rect(-9, -44, 18, 8)
						.fill(0x24251f)
						.circle(-4, -40, 2)
						.fill(0xd8c36b)
						.circle(4, -40, 2)
						.fill(0xd8c36b);
				} else if (!authored && role === 'skeleton') {
					proxyFigure.circle(0, -43, 20).fill(0xd9d2b8).stroke({ color: 0x37362f, width: 3 });
					proxyFigure.circle(-7, -46, 5).fill(0x171a18).circle(7, -46, 5).fill(0x171a18);
					proxyFigure
						.poly([-16, -18, 0, -30, 16, -18, 12, 8, -12, 8], true)
						.fill(0x4d5960)
						.stroke({ color: 0x272d31, width: 2 });
					proxyFigure.arc(19, -10, 14, -1.5, 1.5).stroke({ color: 0xb8a16e, width: 5 });
				} else if (!authored) {
					proxyFigure
						.poly([-22, 4, -18, -38, 0, -57, 19, -38, 23, 4], true)
						.fill(0x3c3541)
						.stroke({ color: 0xa08b69, width: 2 });
					proxyFigure.circle(0, -48, 16).fill(0x211f22);
					proxyFigure
						.poly([-19, -64, 0, -89, 20, -64], true)
						.fill(0x343038)
						.stroke({ color: 0xa88b56, width: 2 });
					proxyFigure.circle(-6, -48, 3).fill(0xf1bb55).circle(6, -48, 3).fill(0xf1bb55);
				}

				const healthTrack = new Graphics().roundRect(-28, 21, 56, 6, 3).fill(0x120d0c);
				const healthFill = new Graphics()
					.roundRect(-28, 21, 56, 6, 3)
					.fill(hostile ? 0xdc5d4c : 0x78b9d9);
				container.addChild(glow, shadow, figure, healthTrack, healthFill);
				return { container, glow, healthFill, body: figure, authored, bodyScale };
			}

			for (const actor of receipt.actorsBefore) {
				const view = makeActor(actor.id, actor.role, actor.kind);
				view.container.label = actor.id;
				actorViews[actor.id] = view;
				actorsLayer.addChild(view.container);
			}

			const impact = new Graphics({ label: 'impact-crescent' });
			impact.circle(0, 0, 34).stroke({ color: 0x79d9ff, alpha: 0.75, width: 3 });
			impact.arc(0, 0, 48, -1.75, 1.05).stroke({ color: 0xfff4c5, width: 10, cap: 'round' });
			impact.moveTo(-28, 24).lineTo(34, -34).stroke({ color: 0xffcf5c, width: 5, cap: 'round' });
			for (const angle of [-1.2, -0.7, -0.15, 0.45, 0.95]) {
				impact
					.moveTo(Math.cos(angle) * 44, Math.sin(angle) * 44)
					.lineTo(Math.cos(angle) * 68, Math.sin(angle) * 68)
					.stroke({ color: 0xffefb2, alpha: 0.82, width: 3, cap: 'round' });
			}
			impact.alpha = 0;
			impact.zIndex = 1000;
			actorsLayer.addChild(impact);

			renderSnapshot = (snapshot) => {
				const selected = cellCenter(snapshot.selectedCell.column, snapshot.selectedCell.row);
				selection.position.set(selected.x, selected.y);
				selection.alpha =
					snapshot.beat === 'complete' ? 0.55 : snapshot.beat === 'impact' ? 1 : 0.72;
				motionPath.alpha =
					snapshot.beat === 'move' ? Math.sin(snapshot.beatProgress * Math.PI) * 0.72 : 0;

				for (const actor of snapshot.actors) {
					const view = actorViews[actor.id]!;
					const point = cellCenter(actor.position.column, actor.position.row);
					view.container.position.set(point.x + actor.recoil * 15, point.y);
					view.container.rotation =
						actor.id === receipt.targetActorId ? actor.downProgress * 1.15 : 0;
					view.container.alpha = actor.status === 'defeated' ? 0.58 : 1;
					view.container.zIndex = Math.round(point.y);
					view.healthFill.scale.x = Math.max(0, actor.health / actor.maximumHealth);
					view.glow.alpha =
						actor.id === receipt.actingActorId && snapshot.beat === 'focus'
							? 0.35 + Math.sin(snapshot.beatProgress * Math.PI) * 0.55
							: 0;
					if (view.authored) {
						const pulse =
							snapshot.beat === 'focus' && actor.id === receipt.actingActorId
								? 1 + Math.sin(snapshot.beatProgress * Math.PI) * 0.055
								: 1;
						view.body.scale.set(view.bodyScale * pulse);
					}
				}

				const target = snapshot.actors.find((actor) => actor.id === receipt.targetActorId)!;
				const targetPoint = cellCenter(target.position.column, target.position.row);
				impact.position.set(targetPoint.x - 18, targetPoint.y - 34);
				impact.alpha = snapshot.impactStrength;
				impact.scale.set(0.72 + snapshot.impactStrength * 0.42);
			};

			const fitWorld = () => {
				if (!app) return;
				const scale = Math.min(app.screen.width / logicalWidth, app.screen.height / logicalHeight);
				world.scale.set(scale);
				world.position.set(
					(app.screen.width - logicalWidth * scale) / 2,
					(app.screen.height - logicalHeight * scale) / 2
				);
			};
			fitWorld();
			resizeObserver = new ResizeObserver(fitWorld);
			resizeObserver.observe(host);

			app.ticker.maxFPS = 60;
			app.ticker.minFPS = 20;
			app.ticker.add((ticker) => {
				if (!started || paused || completeReported) return;
				elapsedMs = Math.min(COMBAT_PLAYBACK_DURATION_MS, elapsedMs + ticker.deltaMS * speed);
				publish();
			});
			publish();
		})();

		return () => {
			disposed = true;
			resizeObserver?.disconnect();
			renderSnapshot = undefined;
			app?.destroy({ removeView: false, releaseGlobalResources: true }, { children: true });
			unloadArt?.();
			unloadArt = undefined;
		};
	});
</script>

<div
	class="canvas-host"
	bind:this={host}
	data-testid="combat-pixi-host"
	data-board-contract={`${receipt.board.columns}x${receipt.board.rows}`}
	data-cell-width={TACTICAL_CELL_SIZE}
	data-cell-height={TACTICAL_CELL_SIZE}
>
	<canvas bind:this={canvas} data-testid="combat-pixi-canvas" aria-hidden="true"></canvas>
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
		background: #071018;
	}
</style>
