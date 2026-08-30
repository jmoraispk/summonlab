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
		reducedMotion,
		stars
	}: {
		direction: Direction;
		phase: Phase;
		runToken: number;
		reducedMotion: boolean;
		stars: number;
	} = $props();

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

			const starfield = new Container();
			const aura = new Container();
			const arcField = new Container();
			const geometry = new Container();
			const runes = new Container();
			const sparks = new Container();
			const core = new Container();
			const identityFx = new Container();
			app.stage.addChild(starfield, aura, arcField, geometry, runes, sparks, core, identityFx);

			const distantStars = Array.from({ length: 86 }, (_, index) => {
				const seed = (index * 0.754877666) % 1;
				const radius = 110 + ((index * 37) % 240);
				const point = new Graphics().circle(0, 0, index % 13 === 0 ? 1.8 : 0.7).fill({
					color: index % 11 === 0 ? 0xf1bd68 : 0x79d8c7,
					alpha: index % 13 === 0 ? 0.7 : 0.36
				});
				starfield.addChild(point);
				return { view: point, seed, radius };
			});

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

			const energyArcs = Array.from({ length: 14 }, (_, index) => {
				const radius = 82 + (index % 7) * 27;
				const start = ((index * 0.37) % 1) * Math.PI * 2;
				const arc = new Graphics()
					.arc(0, 0, radius, start, start + 0.28 + (index % 4) * 0.13)
					.stroke({
						color: index % 4 === 0 ? 0xf2bd65 : 0x83e6d4,
						width: index % 5 === 0 ? 2.2 : 1.1,
						alpha: 0.78
					});
				arcField.addChild(arc);
				return arc;
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
			const membrane = new Graphics().ellipse(0, 0, 61, 91).fill({ color: 0x79dac9, alpha: 0.11 });
			membrane.filters = [new BlurFilter({ strength: 7, quality: 3 })];
			core.addChild(aperture, membrane, vertical, iris);

			const shockwaves = Array.from({ length: 3 }, (_, index) => {
				const wave = new Graphics()
					.circle(0, 0, 56)
					.stroke({ color: 0xffffff, width: 2.1 - index * 0.45, alpha: 0.85 });
				identityFx.addChild(wave);
				return wave;
			});
			const shards = Array.from({ length: 18 }, (_, index) => {
				const shard = new Graphics()
					.moveTo(0, -7)
					.lineTo(2.2, 5)
					.lineTo(-2.2, 5)
					.closePath()
					.fill({ color: index % 4 === 0 ? 0xffffff : 0x86e6d4, alpha: 0.82 });
				identityFx.addChild(shard);
				return { view: shard, angle: (index / 18) * Math.PI * 2, distance: 78 + (index % 5) * 17 };
			});

			let elapsed = 0;
			let phaseElapsed = 0;
			let trackedPhase: Phase = phase;
			let trackedToken = runToken;
			app.ticker.add((ticker) => {
				const seconds = ticker.deltaMS / 1000;
				elapsed += seconds;
				if (phase !== trackedPhase || runToken !== trackedToken) {
					trackedPhase = phase;
					trackedToken = runToken;
					phaseElapsed = 0;
				} else phaseElapsed += seconds;

				const width = app.screen.width;
				const height = app.screen.height;
				const baseScale = Math.min(width / 660, height / 630);
				for (const layer of [
					starfield,
					aura,
					arcField,
					geometry,
					runes,
					sparks,
					core,
					identityFx
				]) {
					layer.position.set(width * 0.47, height * 0.43);
					layer.scale.set(baseScale);
				}

				const active = runToken > 0 && phase !== 'complete';
				const charged = ['threshold', 'form', 'silhouette', 'identity', 'mechanics'].includes(
					phase
				);
				const forming =
					direction === 'constellation' && ['marks', 'form', 'silhouette'].includes(phase);
				const gathering = phase === 'charge' || phase === 'marks';
				const identityBeat = phase === 'identity' || phase === 'mechanics';
				const instant = direction === 'identity';
				const motion = reducedMotion ? 0 : 1;
				const pulse = 0.5 + Math.sin(elapsed * 5.2) * 0.5;
				const gatherProgress = gathering ? Math.min(1, phaseElapsed / 0.58) : charged ? 1 : 0;
				const rarityTint = stars >= 3 ? 0xc69aff : stars === 2 ? 0x7dccff : 0xf0bd68;
				identityFx.tint = rarityTint;

				const compression = gathering
					? 1.28 - gatherProgress * 0.28
					: phase === 'threshold'
						? 0.94
						: identityBeat
							? 1.04 + Math.min(phaseElapsed, 0.45) * 0.12
							: 1;
				geometry.scale.set(baseScale * compression);
				runes.scale.set(baseScale * (gathering ? 1.38 - gatherProgress * 0.38 : 1));
				arcField.scale.set(baseScale * (gathering ? 1.5 - gatherProgress * 0.5 : 1));
				geometry.rotation +=
					ticker.deltaTime * 0.00105 * motion * (active ? (gathering ? 8 : 3.5) : 0.5);
				runes.rotation -=
					ticker.deltaTime * 0.0013 * motion * (charged ? 5.5 : gathering ? 8 : 0.7);
				arcField.rotation += ticker.deltaTime * 0.0032 * motion * (active ? 5 : 0.3);
				core.rotation -= ticker.deltaTime * 0.00045 * motion;
				geometry.alpha = forming ? 0.18 : phase === 'identity' ? 0.82 : 1;
				runes.alpha = forming ? 1 : identityBeat ? 0.48 : 0.82;
				arcField.alpha = active
					? gathering
						? 0.35 + gatherProgress * 0.65
						: charged
							? 0.78
							: 0.3
					: 0.22;
				aura.alpha = identityBeat
					? 1
					: charged
						? 0.78 + pulse * 0.2
						: active
							? 0.42 + pulse * 0.18
							: 0.3;
				glow.tint = rarityTint;
				glow.scale.set(
					identityBeat ? 1.42 + pulse * 0.2 : charged ? 1.1 + pulse * 0.15 : 0.86 + pulse * 0.05
				);
				aperture.tint = rarityTint;
				aperture.alpha = identityBeat ? 0.82 : charged ? 0.5 + pulse * 0.3 : active ? 0.3 : 0.14;
				aperture.scale.set(
					phase === 'threshold'
						? 0.5 + Math.min(phaseElapsed, 0.4) * 2
						: identityBeat
							? 1.3
							: 0.72 + gatherProgress * 0.18
				);
				membrane.tint = rarityTint;
				membrane.alpha =
					phase === 'threshold' || phase === 'silhouette' || phase === 'form'
						? 0.74
						: identityBeat
							? 0.34
							: 0.1;
				membrane.scale.x = phase === 'threshold' ? 0.16 + Math.min(phaseElapsed, 0.42) * 2 : 1;
				vertical.tint = rarityTint;
				vertical.alpha =
					phase === 'threshold' || phase === 'silhouette' || phase === 'form'
						? 1
						: charged
							? 0.44
							: 0.12;
				vertical.scale.x = phase === 'threshold' ? 0.55 + Math.min(phaseElapsed, 0.35) * 1.8 : 1;
				vertical.scale.y = phase === 'silhouette' ? 1.36 : 0.88 + pulse * 0.16;
				iris.tint = rarityTint;
				iris.alpha = active || instant ? 0.82 : 0.28;

				distantStars.forEach((star, index) => {
					const swirl =
						elapsed * (gathering ? 0.75 : identityBeat ? 0.18 : 0.08) * (index % 2 ? 1 : -1);
					const intake = gathering
						? 1.25 - gatherProgress * 0.7
						: phase === 'threshold'
							? 0.5
							: identityBeat
								? 0.78 + Math.min(phaseElapsed, 0.65) * 1.25
								: 1;
					const radius = star.radius * intake;
					const angle = star.seed * Math.PI * 2 + swirl;
					star.view.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72);
					star.view.alpha = active ? 0.28 + ((index + Math.floor(elapsed * 14)) % 9) * 0.07 : 0.14;
				});
				energyArcs.forEach((arc, index) => {
					arc.rotation +=
						(index % 2 ? -1 : 1) * ticker.deltaTime * (0.002 + index * 0.00012) * motion;
					arc.alpha = active ? 0.38 + ((index + Math.floor(elapsed * 8)) % 5) * 0.14 : 0.18;
				});
				rings.forEach((ring, index) => {
					ring.rotation +=
						(index % 2 ? -1 : 1) *
						ticker.deltaTime *
						(0.00055 + index * 0.00016) *
						motion *
						(gathering ? 4 : 1);
					ring.scale.set(
						gathering
							? 1 + Math.sin((gatherProgress + index * 0.11) * Math.PI) * 0.07
							: identityBeat
								? 1 + phaseElapsed * 0.035 * (index + 1)
								: 1
					);
					ring.alpha = identityBeat
						? Math.max(0.25, 0.92 - phaseElapsed * 0.4)
						: charged
							? 0.82 + pulse * 0.18
							: 0.68;
				});
				runeMarks.forEach((mark, index) => {
					const lockWave = Math.max(0, Math.min(1, gatherProgress * 8 - (index % 8)));
					mark.tint = identityBeat ? rarityTint : 0xffffff;
					mark.scale.set(gathering ? 0.72 + lockWave * 0.48 : 1);
					mark.alpha = forming
						? 0.52 + ((index + Math.floor(elapsed * 12)) % 5) * 0.12
						: gathering
							? 0.18 + lockWave * 0.82
							: charged
								? 0.78
								: 0.34;
				});
				particles.forEach((particle, index) => {
					const speed = forming
						? 2.2
						: gathering
							? 1.4 + gatherProgress * 2
							: charged
								? 0.82
								: 0.22;
					const angle = particle.seed * Math.PI * 2 + elapsed * speed * (index % 2 ? 1 : -1);
					const collapse =
						forming || gathering
							? Math.max(22, particle.radius * (1 - gatherProgress * 0.76))
							: identityBeat
								? particle.radius * (0.35 + Math.min(phaseElapsed, 0.7) * 2.1)
								: particle.radius;
					particle.view.position.set(Math.cos(angle) * collapse, Math.sin(angle) * collapse * 0.86);
					particle.view.tint = identityBeat ? rarityTint : 0xffffff;
					particle.view.alpha = active
						? 0.34 + ((index + Math.floor(elapsed * 14)) % 7) * 0.09
						: 0.1;
					particle.view.scale.set(identityBeat ? 1.65 : charged ? 1.25 : 0.8);
				});

				const shockTime =
					phase === 'identity' ? phaseElapsed : phase === 'mechanics' ? phaseElapsed + 0.45 : -1;
				shockwaves.forEach((wave, index) => {
					const progress = Math.max(0, Math.min(1, shockTime * 1.55 - index * 0.18));
					wave.scale.set(0.45 + progress * 5.8);
					wave.alpha = shockTime < 0 ? 0 : (1 - progress) * (1 - progress) * 0.9;
				});
				shards.forEach((shard, index) => {
					const progress = identityBeat ? Math.min(1, shockTime * 1.7) : 0;
					const distance = shard.distance * progress;
					shard.view.position.set(
						Math.cos(shard.angle) * distance,
						Math.sin(shard.angle) * distance
					);
					shard.view.rotation = shard.angle + elapsed * (index % 2 ? 2 : -2);
					shard.view.alpha = identityBeat ? Math.sin(progress * Math.PI) * 0.95 : 0;
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
