<script lang="ts">
	import { onMount } from 'svelte';
	import type { Spine } from '@esotericsoftware/spine-pixi-v8';
	import type { Application } from 'pixi.js';

	type Status = 'loading' | 'ready' | 'error' | 'disposed';
	type TransportBinding = typeof import('./asha-spine-transport.js');
	type TransportAssets = import('./asha-spine-transport.js').TransportAssetsApi;

	const LOGICAL_WIDTH = 1_400;
	const LOGICAL_HEIGHT = 680;
	const SOURCE_VISIBLE_HEIGHT = 420;
	const SOURCE_ALPHA_HEIGHT = 768;
	const FLOOR_Y = 570;

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let status = $state<Status>('loading');
	let motion = $state<'playing' | 'paused'>('playing');
	let errorMessage = $state('');

	onMount(() => {
		let disposed = false;
		let application: Application | undefined;
		let instances: Spine[] = [];
		let observer: ResizeObserver | undefined;
		let binding: TransportBinding | undefined;
		let transportAssets: TransportAssets | undefined;

		const release = async () => {
			observer?.disconnect();
			application?.stop();
			for (const instance of instances) {
				instance.autoUpdate = false;
				instance.destroy();
			}
			instances = [];
			application?.destroy({ removeView: false }, { children: true });
			application = undefined;
			if (binding && transportAssets) {
				await binding.destroyAshaSpineTransportAssets(transportAssets);
			}
		};

		const initialize = async () => {
			try {
				const [pixi, spineRuntime, nextBinding] = await Promise.all([
					import('pixi.js'),
					import('@esotericsoftware/spine-pixi-v8'),
					import('./asha-spine-transport.js')
				]);
				binding = nextBinding;
				transportAssets = pixi.Assets;
				if (disposed) return;

				const app = new pixi.Application();
				application = app;
				await app.init({
					width: LOGICAL_WIDTH,
					height: LOGICAL_HEIGHT,
					canvas,
					background: 0x0d1119,
					backgroundAlpha: 1,
					antialias: true,
					autoDensity: true,
					resolution: Math.min(window.devicePixelRatio || 1, 2),
					preference: 'webgl'
				});
				if (disposed) {
					await release();
					return;
				}

				observer = new ResizeObserver(([entry]) => {
					if (!entry || !application) return;
					const width = Math.min(LOGICAL_WIDTH, entry.contentRect.width);
					application.canvas.style.width = `${width}px`;
					application.canvas.style.height = `${(width * LOGICAL_HEIGHT) / LOGICAL_WIDTH}px`;
				});
				observer.observe(host);

				const chrome = new pixi.Container({ label: 'calibration-chrome' });
				const characters = new pixi.Container({ label: 'asha-transport-instances' });
				app.stage.addChild(chrome, characters);

				const panels = [
					{ x: 20, width: 500 },
					{ x: 540, width: 260 },
					{ x: 820, width: 260 },
					{ x: 1_100, width: 280 }
				] as const;
				for (const panel of panels) {
					const card = new pixi.Graphics()
						.roundRect(panel.x, 56, panel.width, 580, 20)
						.fill({ color: 0x151d2a, alpha: 0.96 })
						.stroke({ width: 2, color: 0x607b90, alpha: 0.45 });
					chrome.addChild(card);
				}

				for (const centerX of [670, 950, 1_240]) {
					const tile = new pixi.Graphics()
						.poly(
							[
								centerX,
								FLOOR_Y - 15.5,
								centerX + 31,
								FLOOR_Y,
								centerX,
								FLOOR_Y + 15.5,
								centerX - 31,
								FLOOR_Y
							],
							true
						)
						.fill({ color: 0x344b48, alpha: 0.7 })
						.stroke({ width: 2, color: 0xa9d6bd, alpha: 0.72 });
					chrome.addChild(tile);
				}

				await nextBinding.loadAshaSpineTransport(pixi.Assets);
				if (disposed) {
					await release();
					return;
				}

				const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
				motion = reducedMotion ? 'paused' : 'playing';
				const placements = [
					{ x: 270, visibleHeight: SOURCE_VISIBLE_HEIGHT },
					{ x: 670, visibleHeight: 72 },
					{ x: 950, visibleHeight: 84 },
					{ x: 1_240, visibleHeight: 96 }
				] as const;
				instances = placements.map(({ x, visibleHeight }) => {
					const instance = nextBinding.createAshaSpineTransportInstance(spineRuntime.Spine);
					const scale = visibleHeight / SOURCE_ALPHA_HEIGHT;
					instance.position.set(x, FLOOR_Y);
					instance.scale.set(scale, scale);
					if (reducedMotion) {
						instance.autoUpdate = false;
						instance.state.clearTracks();
						instance.skeleton.setupPose();
						instance.update(0);
					} else {
						instance.state.setAnimation(0, 'idle_transport_probe', true);
					}
					characters.addChild(instance);
					return instance;
				});

				status = 'ready';
			} catch (error) {
				if (disposed) return;
				status = 'error';
				errorMessage = error instanceof Error ? error.message : String(error);
				await release();
			}
		};

		void initialize();
		return () => {
			disposed = true;
			status = 'disposed';
			void release();
		};
	});
</script>

<section class="transport-stage" aria-label="Asha Spine transport calibration">
	<div class="stage-meta" aria-live="polite">
		<span>Runtime <strong data-testid="spine-transport-status">{status}</strong></span>
		<span>Probe <strong data-testid="spine-transport-motion">{motion}</strong></span>
	</div>
	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}
	<div class="canvas-frame" bind:this={host}>
		<canvas
			bind:this={canvas}
			data-testid="spine-transport-canvas"
			aria-label="Asha Spine transport calibration canvas"
		></canvas>
		<div class="labels" aria-hidden="true">
			<div class="source" data-testid="asha-spine-source">
				<strong>Source inspection</strong><span>unmodified approved cutout</span>
			</div>
			<div data-testid="asha-spine-72"><strong>72 px</strong><span>compact</span></div>
			<div data-testid="asha-spine-84"><strong>84 px</strong><span>balanced</span></div>
			<div data-testid="asha-spine-96"><strong>96 px</strong><span>readable</span></div>
		</div>
	</div>
</section>

<style>
	.transport-stage {
		display: grid;
		gap: 0.75rem;
	}

	.stage-meta {
		display: flex;
		gap: 0.65rem;
		flex-wrap: wrap;
		color: #92a9b9;
		font:
			700 0.72rem/1.2 Inter,
			ui-sans-serif,
			system-ui,
			sans-serif;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.stage-meta span {
		padding: 0.5rem 0.68rem;
		border: 1px solid rgba(124, 164, 185, 0.25);
		border-radius: 999px;
		background: rgba(12, 18, 27, 0.72);
	}

	.stage-meta strong {
		color: #d4f5dc;
	}

	.canvas-frame {
		position: relative;
		width: 100%;
		min-height: 15rem;
		overflow: hidden;
		border: 1px solid rgba(133, 170, 188, 0.25);
		border-radius: 1.35rem;
		background: #0d1119;
		box-shadow: 0 1.2rem 4rem rgba(0, 0, 0, 0.34);
	}

	.canvas-frame :global(canvas) {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.labels {
		position: absolute;
		z-index: 2;
		top: 4.2%;
		left: 1.4%;
		display: grid;
		grid-template-columns: 500fr 260fr 260fr 280fr;
		width: 97.2%;
		pointer-events: none;
	}

	.labels > div {
		display: grid;
		gap: 0.15rem;
		justify-items: center;
		min-width: 2rem;
		color: #d7e4ea;
		font:
			700 clamp(0.55rem, 1vw, 0.78rem)/1.15 Inter,
			ui-sans-serif,
			system-ui,
			sans-serif;
		letter-spacing: 0.04em;
		text-align: center;
		text-transform: uppercase;
	}

	.labels span {
		color: #8098a8;
		font-size: 0.72em;
	}

	.error {
		margin: 0;
		padding: 0.8rem 1rem;
		border: 1px solid rgba(223, 112, 112, 0.5);
		border-radius: 0.8rem;
		background: rgba(91, 29, 38, 0.6);
		color: #ffd8d8;
	}
</style>
