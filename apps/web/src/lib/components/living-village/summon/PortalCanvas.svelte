<script lang="ts">
	import { onMount } from 'svelte';

	type Direction = 'gate' | 'constellation' | 'identity';
	type Phase =
		| 'idle'
		| 'charge'
		| 'threshold'
		| 'marks'
		| 'form'
		| 'silhouette'
		| 'identity'
		| 'mechanics'
		| 'complete';

	let {
		direction,
		phase,
		runToken,
		reducedMotion
	}: { direction: Direction; phase: Phase; runToken: number; reducedMotion: boolean } = $props();

	let canvas: HTMLCanvasElement;
	let rendererReady = $state(false);

	onMount(() => {
		let disposed = false;
		let application: import('pixi.js').Application | undefined;

		void (async () => {
			const { Application, BlurFilter, Container, Graphics } = await import('pixi.js');
			if (disposed) return;

			const app = new Application();
			application = app;
			await app.init({
				canvas,
				resizeTo: canvas.parentElement ?? canvas,
				preference: 'webgl',
				antialias: true,
				backgroundAlpha: 0,
				resolution: Math.min(window.devicePixelRatio, 2),
				autoDensity: true,
				powerPreference: 'high-performance'
			});
			if (disposed) {
				app.destroy(false);
				return;
			}

			const aura = new Container();
			const geometry = new Container();
			const runes = new Container();
			const sparks = new Container();
			const core = new Container();
			app.stage.addChild(aura, geometry, runes, sparks, core);

			const glow = new Graphics().circle(0, 0, 192).fill({ color: 0x38d8c0, alpha: 0.08 });
			glow.filters = [new BlurFilter({ strength: 28, quality: 4 })];
			aura.addChild(glow);

			const rings = Array.from({ length: 5 }, (_, index) => {
				const radius = 100 + index * 31;
				const ring = new Graphics();
				ring.circle(0, 0, radius).stroke({
					color: index === 1 ? 0xf0bc66 : 0x70e3d0,
					width: index === 1 ? 1.5 : 0.72,
					alpha: 0.52 - index * 0.035
				});
				for (let spoke = 0; spoke < 16 + index * 4; spoke += 1) {
					const angle = (spoke / (16 + index * 4)) * Math.PI * 2;
					const length = spoke % 4 === 0 ? 11 : 5;
					ring
						.moveTo(Math.cos(angle) * (radius - length), Math.sin(angle) * (radius - length))
						.lineTo(Math.cos(angle) * (radius + length), Math.sin(angle) * (radius + length));
				}
				ring.stroke({ color: 0x99f0e1, width: 0.65, alpha: 0.25 });
				geometry.addChild(ring);
				return ring;
			});

			const runeMarks = Array.from({ length: 24 }, (_, index) => {
				const mark = new Graphics();
				mark
					.moveTo(-2, -7)
					.lineTo(4, 0)
					.lineTo(-2, 7)
					.moveTo(-5, 0)
					.lineTo(4, 0)
					.stroke({ color: index % 6 === 0 ? 0xf3bd67 : 0x8de5d5, width: 1, alpha: 0.55 });
				const angle = (index / 24) * Math.PI * 2;
				mark.position.set(Math.cos(angle) * 174, Math.sin(angle) * 174);
				mark.rotation = angle;
				runes.addChild(mark);
				return mark;
			});

			const particles = Array.from({ length: 58 }, (_, index) => {
				const particle = new Graphics()
					.circle(0, 0, index % 9 === 0 ? 2.2 : 1.1)
					.fill({ color: index % 7 === 0 ? 0xffcc76 : 0x74e4d0, alpha: 0.8 });
				const seed = (index * 0.61803398875) % 1;
				particle.position.set(
					Math.cos(seed * Math.PI * 2) * (85 + (index % 11) * 13),
					Math.sin(seed * Math.PI * 2) * (85 + (index % 11) * 13)
				);
				particle.alpha = 0.12;
				sparks.addChild(particle);
				return { view: particle, seed, radius: 85 + (index % 11) * 13 };
			});

			const aperture = new Graphics().circle(0, 0, 79).fill({ color: 0xbdfcf0, alpha: 0.15 });
			aperture.filters = [new BlurFilter({ strength: 22, quality: 4 })];
			const iris = new Graphics()
				.circle(0, 0, 68)
				.stroke({ color: 0xd8fff7, width: 2, alpha: 0.34 });
			const vertical = new Graphics().ellipse(0, 0, 26, 112).fill({ color: 0xe6fff8, alpha: 0.12 });
			vertical.filters = [new BlurFilter({ strength: 16, quality: 3 })];
			core.addChild(aperture, vertical, iris);

			let elapsed = 0;
			app.ticker.add((ticker) => {
				elapsed += ticker.deltaMS / 1000;
				const width = app.screen.width;
				const height = app.screen.height;
				const scale = Math.min(width / 660, height / 630);
				for (const layer of [aura, geometry, runes, sparks, core]) {
					layer.position.set(width * 0.47, height * 0.43);
					layer.scale.set(scale);
				}

				const active = runToken > 0 && phase !== 'complete';
				const charged = ['threshold', 'form', 'silhouette', 'identity', 'mechanics'].includes(
					phase
				);
				const forming =
					direction === 'constellation' && ['marks', 'form', 'silhouette'].includes(phase);
				const instant = direction === 'identity';
				const motion = reducedMotion ? 0 : 1;
				const pulse = 0.5 + Math.sin(elapsed * 4.4) * 0.5;

				geometry.rotation += ticker.deltaTime * 0.00042 * motion * (active ? 3 : 1);
				runes.rotation -= ticker.deltaTime * 0.00067 * motion * (charged ? 4 : 1);
				core.rotation += ticker.deltaTime * 0.00018 * motion;
				geometry.alpha = forming ? 0.26 : 1;
				runes.alpha = forming ? 1 : 0.72;
				aura.alpha = charged ? 0.72 + pulse * 0.24 : active ? 0.35 + pulse * 0.16 : 0.28;
				glow.scale.set(charged ? 1.1 + pulse * 0.15 : 0.86 + pulse * 0.05);
				aperture.alpha = charged ? 0.45 + pulse * 0.3 : active ? 0.25 : 0.12;
				aperture.scale.set(charged ? 0.85 + pulse * 0.28 : 0.7);
				vertical.alpha = phase === 'silhouette' || phase === 'form' ? 0.9 : charged ? 0.42 : 0.12;
				vertical.scale.y = phase === 'silhouette' ? 1.25 : 0.86 + pulse * 0.16;
				iris.alpha = active || instant ? 0.72 : 0.24;

				rings.forEach((ring, index) => {
					ring.rotation +=
						(index % 2 ? -1 : 1) * ticker.deltaTime * (0.00028 + index * 0.00008) * motion;
					ring.alpha = charged ? 0.8 + pulse * 0.2 : 0.68;
				});
				runeMarks.forEach((mark, index) => {
					mark.alpha = forming
						? 0.45 + ((index + Math.floor(elapsed * 10)) % 5) * 0.13
						: charged
							? 0.75
							: 0.34;
				});
				particles.forEach((particle, index) => {
					const speed = forming ? 1.8 : charged ? 0.72 : 0.2;
					const angle = particle.seed * Math.PI * 2 + elapsed * speed * (index % 2 ? 1 : -1);
					const collapse = forming ? Math.max(26, particle.radius - elapsed * 18) : particle.radius;
					particle.view.position.set(Math.cos(angle) * collapse, Math.sin(angle) * collapse * 0.86);
					particle.view.alpha = active
						? 0.32 + ((index + Math.floor(elapsed * 12)) % 7) * 0.09
						: 0.1;
					particle.view.scale.set(charged ? 1.25 : 0.8);
				});
			});

			rendererReady = true;
		})();

		return () => {
			disposed = true;
			application?.destroy(false, true);
		};
	});
</script>

<canvas
	bind:this={canvas}
	class:ready={rendererReady}
	data-ready={rendererReady}
	data-testid="portal-canvas"
	aria-hidden="true"
></canvas>

<style>
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 500ms ease;
	}
	canvas.ready {
		opacity: 1;
	}
</style>
