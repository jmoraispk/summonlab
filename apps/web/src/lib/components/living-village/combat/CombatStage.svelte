<script lang="ts">
	import { onMount } from 'svelte';
	import type { Application, Container, Graphics } from 'pixi.js';
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
			const { Application, Container, Graphics } = await import('pixi.js');
			if (disposed) return;

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

			const board = { x: 56, y: 88, width: 588, height: 756 };
			const cellWidth = board.width / receipt.board.columns;
			const cellHeight = board.height / receipt.board.rows;
			const cellCenter = (column: number, row: number) => ({
				x: board.x + (column + 0.5) * cellWidth,
				y: board.y + (row + 0.5) * cellHeight
			});

			const backdrop = new Graphics({ label: 'observatory-stone' });
			backdrop.rect(0, 0, logicalWidth, logicalHeight).fill(0x071018);
			backdrop.circle(350, 210, 330).fill({ color: 0x10252a, alpha: 0.72 });
			backdrop.circle(85, 120, 185).stroke({ color: 0xb38b45, alpha: 0.28, width: 18 });
			backdrop.circle(85, 120, 132).stroke({ color: 0xd7b362, alpha: 0.14, width: 3 });
			backdrop.circle(620, 135, 92).stroke({ color: 0x8c7448, alpha: 0.22, width: 12 });
			backdrop.rect(0, 0, 700, 170).fill({ color: 0x061019, alpha: 0.28 });
			world.addChild(backdrop);

			const floor = new Graphics({ label: 'tactical-floor' });
			floor
				.roundRect(board.x - 24, board.y - 26, board.width + 48, board.height + 55, 22)
				.fill({ color: 0x162321, alpha: 0.98 })
				.stroke({ color: 0x6e684f, alpha: 0.35, width: 2 });
			for (let row = 0; row < receipt.board.rows; row += 1) {
				for (let column = 0; column < receipt.board.columns; column += 1) {
					const variation = (row * 7 + column * 11) % 4;
					floor
						.rect(board.x + column * cellWidth, board.y + row * cellHeight, cellWidth, cellHeight)
						.fill({ color: [0x27352f, 0x24322d, 0x2b3831, 0x202e2a][variation]!, alpha: 0.94 })
						.stroke({ color: 0x77806d, alpha: 0.18, width: 1.5 });
				}
			}
			floor.circle(350, 466, 55).stroke({ color: 0xb59b5a, alpha: 0.2, width: 2 });
			floor.circle(350, 466, 24).stroke({ color: 0xb59b5a, alpha: 0.16, width: 1 });
			floor.moveTo(295, 466).lineTo(405, 466).stroke({ color: 0xb59b5a, alpha: 0.13, width: 1 });
			floor.moveTo(350, 411).lineTo(350, 521).stroke({ color: 0xb59b5a, alpha: 0.13, width: 1 });
			world.addChild(floor);

			const moss = new Graphics({ label: 'moss-and-ruins' });
			for (const [x, y, radius] of [
				[32, 260, 72],
				[668, 330, 82],
				[25, 710, 96],
				[665, 760, 105]
			] as const) {
				moss.circle(x, y, radius).fill({ color: 0x1b2b1d, alpha: 0.92 });
				moss.circle(x + 18, y - 22, radius * 0.55).fill({ color: 0x334326, alpha: 0.55 });
			}
			for (const [x, y] of [
				[34, 375],
				[660, 500],
				[50, 840],
				[625, 875]
			] as const) {
				moss
					.roundRect(x - 34, y - 22, 68, 44, 8)
					.fill(0x303832)
					.stroke({ color: 0x74725f, alpha: 0.22, width: 2 });
			}
			world.addChild(moss);

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
			};
			const actorViews: Record<string, ActorView> = {};

			function makeActor(role: CombatActorRole, kind: 'hero' | 'monster'): ActorView {
				const container = new Container({ sortableChildren: true });
				const hostile = kind === 'monster';
				const glow = new Graphics().ellipse(0, 2, 38, 18).fill({
					color: hostile ? 0xd8614f : 0xffd679,
					alpha: 0.4
				});
				glow.alpha = 0;
				const shadow = new Graphics().ellipse(0, 14, 29, 10).fill({ color: 0x020405, alpha: 0.6 });
				const figure = new Graphics();

				if (role === 'blade' || role === 'archer' || role === 'mage') {
					const cloak = role === 'archer' ? 0x3f5c43 : role === 'mage' ? 0x5d7187 : 0x33547a;
					figure
						.poly([-18, 9, -13, -29, 0, -43, 15, -28, 21, 11], true)
						.fill(cloak)
						.stroke({ color: 0xc8b986, alpha: 0.62, width: 2 });
					figure.circle(0, -52, 17).fill(0xe7cdb3).stroke({ color: 0x201d1c, width: 2 });
					figure.arc(0, -55, 18, Math.PI, Math.PI * 2).stroke({
						color: role === 'mage' ? 0x9db5c8 : role === 'archer' ? 0xd8c3a2 : 0x4b3127,
						width: 11
					});
					if (role === 'blade') {
						figure
							.moveTo(12, -23)
							.lineTo(37, 10)
							.stroke({ color: 0xdfe5e5, width: 5, cap: 'round' });
						figure.moveTo(35, 8).lineTo(43, 17).stroke({ color: 0xc49b52, width: 3 });
					} else if (role === 'archer') {
						figure.arc(-16, -20, 23, -1.2, 1.2).stroke({ color: 0xc6995b, width: 3 });
					} else {
						figure.moveTo(17, -29).lineTo(28, 10).stroke({ color: 0xb88954, width: 4 });
						figure.circle(16, -34, 7).fill(0x70bfe2).stroke({ color: 0xd8f5ff, width: 2 });
					}
				} else if (role === 'sprout') {
					figure.circle(0, -24, 24).fill(0xb6b96c).stroke({ color: 0x3b3d25, width: 3 });
					figure.ellipse(-9, -55, 9, 18).fill(0x6d8c4c).stroke({ color: 0x344425, width: 2 });
					figure.ellipse(11, -54, 9, 18).fill(0x789a54).stroke({ color: 0x344425, width: 2 });
					figure.circle(-8, -26, 3).fill(0x171b15).circle(8, -26, 3).fill(0x171b15);
				} else if (role === 'bat') {
					figure.poly([-7, -27, -35, -43, -29, -17, -8, -10], true).fill(0x6b5278);
					figure.poly([7, -27, 35, -43, 29, -17, 8, -10], true).fill(0x6b5278);
					figure.circle(0, -27, 18).fill(0x73587f).stroke({ color: 0x241d2a, width: 3 });
					figure.circle(-6, -29, 3).fill(0xf2ca66).circle(6, -29, 3).fill(0xf2ca66);
				} else if (role === 'mummy') {
					figure
						.roundRect(-18, -61, 36, 67, 12)
						.fill(0xc4b99a)
						.stroke({ color: 0x4b4639, width: 3 });
					for (let y = -53; y < 0; y += 12)
						figure
							.moveTo(-16, y)
							.lineTo(16, y + 6)
							.stroke({ color: 0x716956, alpha: 0.7, width: 3 });
					figure
						.rect(-9, -44, 18, 8)
						.fill(0x24251f)
						.circle(-4, -40, 2)
						.fill(0xd8c36b)
						.circle(4, -40, 2)
						.fill(0xd8c36b);
				} else if (role === 'skeleton') {
					figure.circle(0, -43, 20).fill(0xd9d2b8).stroke({ color: 0x37362f, width: 3 });
					figure.circle(-7, -46, 5).fill(0x171a18).circle(7, -46, 5).fill(0x171a18);
					figure
						.poly([-16, -18, 0, -30, 16, -18, 12, 8, -12, 8], true)
						.fill(0x4d5960)
						.stroke({ color: 0x272d31, width: 2 });
					figure.arc(19, -10, 14, -1.5, 1.5).stroke({ color: 0xb8a16e, width: 5 });
				} else {
					figure
						.poly([-22, 4, -18, -38, 0, -57, 19, -38, 23, 4], true)
						.fill(0x3c3541)
						.stroke({ color: 0xa08b69, width: 2 });
					figure.circle(0, -48, 16).fill(0x211f22);
					figure
						.poly([-19, -64, 0, -89, 20, -64], true)
						.fill(0x343038)
						.stroke({ color: 0xa88b56, width: 2 });
					figure.circle(-6, -48, 3).fill(0xf1bb55).circle(6, -48, 3).fill(0xf1bb55);
				}

				const healthTrack = new Graphics().roundRect(-28, 21, 56, 6, 3).fill(0x120d0c);
				const healthFill = new Graphics()
					.roundRect(-28, 21, 56, 6, 3)
					.fill(hostile ? 0xdc5d4c : 0x78b9d9);
				container.addChild(glow, shadow, figure, healthTrack, healthFill);
				return { container, glow, healthFill };
			}

			for (const actor of receipt.actorsBefore) {
				const view = makeActor(actor.role, actor.kind);
				view.container.label = actor.id;
				actorViews[actor.id] = view;
				actorsLayer.addChild(view.container);
			}

			const impact = new Graphics({ label: 'impact-crescent' });
			impact.arc(0, 0, 42, -1.65, 1.15).stroke({ color: 0xfff2bb, width: 9, cap: 'round' });
			impact.moveTo(-20, 20).lineTo(29, -27).stroke({ color: 0xffd26a, width: 4, cap: 'round' });
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
		};
	});
</script>

<div class="canvas-host" bind:this={host}>
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
