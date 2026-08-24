<script lang="ts">
	import type {
		CharacterExpression,
		CharacterManifest,
		CharacterVisualProfile
	} from '@summonlab/contracts';

	let {
		manifest,
		profile,
		expression = 'neutral',
		equipment = 'none',
		paletteMode = 'base',
		walking = false,
		compact = false
	}: {
		manifest: CharacterManifest;
		profile?: CharacterVisualProfile;
		expression?: CharacterExpression;
		equipment?: 'none' | 'practice-blade' | 'short-bow';
		paletteMode?: 'base' | 'night' | 'injured';
		walking?: boolean;
		compact?: boolean;
	} = $props();

	const hasKnot = $derived(
		manifest.phenotype.hairStyle.includes('knot') || manifest.phenotype.hairStyle.includes('crown')
	);
	const hasLongHair = $derived(
		manifest.phenotype.hairStyle.includes('shoulder') ||
			manifest.phenotype.hairStyle.includes('jaw')
	);
	const stars = $derived('✦'.repeat(manifest.rarityStars));
	const mainHandAnchor = $derived(
		profile?.anchors.mainHand ?? {
			x: manifest.handedness === 'left' ? 0.27 : 0.73,
			y: 0.56,
			rotationDegrees: manifest.handedness === 'left' ? -5 : 5,
			depth: 'front' as const
		}
	);
	const injuryAnchor = $derived(
		profile?.anchors.faceInjury ?? { x: 0.4, y: 0.2, rotationDegrees: -10, depth: 'front' as const }
	);
</script>

<figure
	class:walking
	class:compact
	class:night={paletteMode === 'night'}
	class:injured={paletteMode === 'injured' || expression === 'injured'}
	data-expression={expression}
	data-equipment={equipment}
	aria-label={`${manifest.displayName}, deterministic modular hero rig`}
>
	<svg
		viewBox="0 0 100 180"
		role="img"
		aria-labelledby={`hero-${manifest.characterId}`}
		style={`--skin:${manifest.palette.skin};--hair:${manifest.palette.hair};--cloth:${manifest.palette.cloth};--accent:${manifest.palette.accent};--shoulders:${manifest.rig.shoulderWidth};--hips:${manifest.rig.hipWidth};--head:${manifest.rig.headScale};--legs:${manifest.rig.legRatio}`}
	>
		<title id={`hero-${manifest.characterId}`}>{manifest.displayName}</title>
		<defs>
			<linearGradient id={`cloth-${manifest.characterId}`} x1="0" x2="1" y1="0" y2="1">
				<stop offset="0" stop-color="var(--cloth)" stop-opacity="0.72" />
				<stop offset="0.5" stop-color="var(--cloth)" />
				<stop offset="1" stop-color="#07090e" />
			</linearGradient>
			<radialGradient id={`skin-${manifest.characterId}`} cx="62%" cy="28%" r="75%">
				<stop offset="0" stop-color="var(--skin)" stop-opacity="1" />
				<stop offset="1" stop-color="var(--skin)" stop-opacity="0.66" />
			</radialGradient>
			<filter id={`glow-${manifest.characterId}`} x="-100%" y="-100%" width="300%" height="300%">
				<feGaussianBlur stdDeviation="1.8" result="blur" />
				<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
		</defs>

		<ellipse class="shadow" cx="50" cy="171" rx="27" ry="5" />
		<g class="figure">
			<path class="cloak-back" d="M29 50 Q50 40 72 51 L78 115 Q51 128 22 113 Z" />

			<g class="leg leg-left">
				<path class="trouser" d="M34 103 L49 103 L46 150 L31 150 Z" />
				<path class="boot" d="M31 143 L46 143 L44 169 L25 169 Q23 165 31 160 Z" />
				<path class="boot-line" d="M29 153 L44 154 M28 160 L43 161" />
			</g>
			<g class="leg leg-right">
				<path class="trouser" d="M50 103 L66 103 L70 150 L54 150 Z" />
				<path class="boot" d="M55 143 L70 143 L77 167 Q76 170 69 170 L53 169 Z" />
				<path class="boot-line" d="M56 153 L72 153 M57 160 L74 160" />
			</g>

			<g class="arm arm-left">
				<path class="sleeve" d="M30 53 Q23 58 20 79 L27 101 L35 98 L32 78 L39 62 Z" />
				<path class="bracer" d="M26 92 L36 90 L38 108 L30 112 L25 104 Z" />
				<path class="skin" d="M30 108 Q35 104 38 109 L38 119 L34 126 L30 121 Z" />
			</g>
			<g class="arm arm-right">
				<path class="sleeve" d="M69 53 Q77 58 81 78 L75 101 L66 98 L69 77 L61 62 Z" />
				<path class="bracer" d="M65 90 L75 92 L76 105 L71 112 L63 108 Z" />
				<path class="skin" d="M63 108 Q68 104 72 109 L70 122 L66 126 L62 118 Z" />
			</g>

			<path class="neck skin" d="M43 39 L57 39 L59 54 L41 54 Z" />
			<path class="torso" d="M38 48 Q50 43 63 49 L70 77 L65 111 L34 111 L29 78 Z" />
			<path class="tunic-panel" d="M42 54 L57 53 L61 105 L39 105 Z" />
			<path class="cape" d="M30 50 Q50 43 70 51 L65 65 Q50 57 34 66 Z" />
			<path class="belt" d="M33 94 Q50 98 66 94 L66 101 Q50 105 34 101 Z" />
			<rect class="buckle" x="47" y="96" width="7" height="6" rx="1" />

			<g
				class="head"
				transform={`translate(50 33) scale(${manifest.rig.headScale}) translate(-50 -33)`}
			>
				{#if hasLongHair}
					<path class="hair-back" d="M37 19 Q50 7 64 19 L66 48 L36 49 Z" />
				{/if}
				{#if hasKnot}
					<circle class="hair" cx="51" cy="10" r="8" />
					<circle class="hair-detail" cx="48" cy="8" r="4" />
				{/if}
				<ellipse class="ear skin" cx="36.5" cy="32" rx="3" ry="5" />
				<ellipse class="ear skin" cx="63.5" cy="32" rx="3" ry="5" />
				<path class="skin face" d="M37 20 Q50 12 63 20 L62 38 Q57 48 50 49 Q41 46 38 38 Z" />
				<path class="hair" d="M37 26 Q36 14 49 13 Q64 13 64 27 Q58 20 51 22 Q43 18 37 26 Z" />
				{#if expression === 'skeptical'}
					<path class="brow" d="M41 27 Q45 25 48 28 M53 30 Q57 28 60 30" />
				{:else if expression === 'injured'}
					<path class="brow" d="M41 30 Q45 28 48 30 M53 29 Q57 27 60 29" />
				{:else}
					<path class="brow" d="M41 29 Q45 27 48 29 M53 29 Q57 27 60 29" />
				{/if}
				<circle class="eye" cx="45" cy="32" r="1.15" />
				<circle class="eye" cx="56" cy="32" r="1.15" />
				<path class="nose" d="M51 31 L49 37 L52 38" />
				{#if expression === 'amused'}
					<path class="mouth" d="M46 41 Q51 45 56 40" />
				{:else if expression === 'alert'}
					<path class="mouth" d="M47 42 Q51 41 55 42" />
				{:else if expression === 'exertion'}
					<ellipse class="mouth-open" cx="51" cy="42" rx="3" ry="1.8" />
				{:else if expression === 'injured'}
					<path class="mouth" d="M46 43 Q51 40 55 43" />
				{:else}
					<path class="mouth" d="M46 42 Q50 43 55 41" />
				{/if}
			</g>

			{#if expression === 'injured'}
				<g
					class="injury-mark"
					transform={`translate(${injuryAnchor.x * 100} ${injuryAnchor.y * 180}) rotate(${injuryAnchor.rotationDegrees})`}
				>
					<path d="M-4 -1 Q0 -4 4 -1 M-3 2 Q0 0 3 2" />
				</g>
			{/if}

			{#if equipment !== 'none'}
				<g
					class="equipment"
					transform={`translate(${mainHandAnchor.x * 100} ${mainHandAnchor.y * 180}) rotate(${mainHandAnchor.rotationDegrees})`}
				>
					{#if equipment === 'practice-blade'}
						<path class="blade" d="M-1 2 L-2 -34 L1 -41 L4 -34 L2 2 Z" />
						<path class="guard" d="M-7 1 L8 1 L8 4 L-7 4 Z" />
						<path class="grip" d="M-2 4 L3 4 L3 15 L-2 15 Z" />
					{:else}
						<path class="bow" d="M0 -30 Q18 0 0 30" />
						<path class="bow-string" d="M0 -30 L0 30" />
					{/if}
				</g>
			{/if}

			<g class="clasp" filter={`url(#glow-${manifest.characterId})`}>
				<circle cx="50" cy="55" r="3.5" />
				<path d="M50 49 L52 55 L50 61 L48 55 Z" />
			</g>
		</g>
	</svg>
	{#if !compact}
		<figcaption>
			<span>{stars}</span>
			<strong>{manifest.displayName}</strong>
		</figcaption>
	{/if}
</figure>

<style>
	figure {
		position: relative;
		display: grid;
		width: min(100%, 22rem);
		margin: 0;
		place-items: center;
	}

	svg {
		display: block;
		width: 100%;
		overflow: visible;
		filter: drop-shadow(0 1.4rem 1.2rem rgba(0, 0, 0, 0.65));
	}

	.shadow {
		fill: rgba(0, 0, 0, 0.5);
	}

	.figure {
		transform-origin: 50% 168px;
	}

	.cloak-back {
		fill: color-mix(in srgb, var(--cloth), #05060a 55%);
		stroke: color-mix(in srgb, var(--accent), transparent 75%);
		stroke-width: 0.7;
	}

	.skin {
		fill: var(--skin);
	}

	.face,
	.ear {
		fill: var(--skin);
	}

	.torso,
	.sleeve,
	.trouser {
		fill: url(#cloth);
		stroke: rgba(255, 255, 255, 0.12);
		stroke-width: 0.6;
	}

	.tunic-panel {
		fill: color-mix(in srgb, var(--cloth), #fff 5%);
		opacity: 0.75;
	}

	.cape {
		fill: color-mix(in srgb, var(--cloth), var(--accent) 16%);
		stroke: color-mix(in srgb, var(--accent), transparent 70%);
		stroke-width: 0.6;
	}

	.belt,
	.bracer,
	.boot {
		fill: #1d1717;
		stroke: #705746;
		stroke-width: 0.7;
	}

	.boot-line {
		fill: none;
		stroke: #826650;
		stroke-width: 0.75;
	}

	.buckle {
		fill: var(--accent);
		stroke: #f4dfb4;
		stroke-width: 0.5;
	}

	.hair,
	.hair-back {
		fill: var(--hair);
		stroke: color-mix(in srgb, var(--hair), #fff 20%);
		stroke-width: 0.6;
	}

	.hair-detail {
		fill: none;
		stroke: color-mix(in srgb, var(--hair), #fff 26%);
		stroke-width: 0.7;
	}

	.brow,
	.nose,
	.mouth {
		fill: none;
		stroke: color-mix(in srgb, var(--skin), #050505 72%);
		stroke-linecap: round;
		stroke-width: 0.8;
	}

	.mouth-open {
		fill: #241313;
		stroke: color-mix(in srgb, var(--skin), #050505 72%);
		stroke-width: 0.6;
	}

	.injury-mark {
		fill: none;
		stroke: #7c2f32;
		stroke-linecap: round;
		stroke-width: 1.2;
	}

	.equipment {
		filter: drop-shadow(0 0.2rem 0.2rem rgba(0, 0, 0, 0.7));
	}

	.blade {
		fill: #727983;
		stroke: #c3ccd4;
		stroke-width: 0.7;
	}

	.guard,
	.grip {
		fill: #5b4638;
		stroke: #b08a59;
		stroke-width: 0.6;
	}

	.bow,
	.bow-string {
		fill: none;
		stroke-linecap: round;
	}

	.bow {
		stroke: #8c6745;
		stroke-width: 2.1;
	}

	.bow-string {
		stroke: #c9bda8;
		stroke-width: 0.55;
	}

	.eye {
		fill: #f2d9c6;
		stroke: #17151a;
		stroke-width: 0.8;
	}

	.clasp {
		fill: var(--accent);
		stroke: #ffe6a6;
		stroke-width: 0.5;
	}

	figcaption {
		position: absolute;
		bottom: 0.8rem;
		left: 50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		transform: translateX(-50%);
		text-align: center;
		white-space: nowrap;
	}

	figcaption span {
		color: var(--accent, #d49b47);
		font-size: 0.62rem;
		letter-spacing: 0.25em;
	}

	figcaption strong {
		font-family: Georgia, serif;
		font-size: 1rem;
		font-weight: 400;
	}

	.compact {
		width: 100%;
	}

	.walking .figure {
		animation: body-bob 0.72s ease-in-out infinite;
	}

	.night .figure {
		filter: saturate(0.76) brightness(0.72) hue-rotate(7deg);
	}

	.injured .figure {
		filter: saturate(0.72) contrast(1.04);
	}

	.walking .leg-left,
	.walking .arm-right {
		transform-origin: 50px 102px;
		animation: limb-forward 0.72s ease-in-out infinite alternate;
	}

	.walking .leg-right,
	.walking .arm-left {
		transform-origin: 50px 102px;
		animation: limb-back 0.72s ease-in-out infinite alternate;
	}

	@keyframes body-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-2px);
		}
	}

	@keyframes limb-forward {
		from {
			transform: rotate(-5deg);
		}
		to {
			transform: rotate(6deg);
		}
	}

	@keyframes limb-back {
		from {
			transform: rotate(5deg);
		}
		to {
			transform: rotate(-6deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.walking .figure,
		.walking .leg,
		.walking .arm {
			animation: none;
		}
	}
</style>
