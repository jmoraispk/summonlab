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
	const packTwo = $derived(['human-v4', 'human-v5'].includes(manifest.generationVersion));
	const attire = $derived(manifest.attire);
	const faceStructure = $derived(manifest.phenotype.facialStructure);
	const faceWidth = $derived(
		['round', 'square', 'broad'].includes(manifest.phenotype.faceShape)
			? 1.08
			: ['long', 'oblong', 'tapered'].includes(manifest.phenotype.faceShape)
				? 0.93
				: 1
	);
	const faceLength = $derived(
		['long', 'oblong'].includes(manifest.phenotype.faceShape)
			? 1.08
			: manifest.phenotype.faceShape === 'round'
				? 0.94
				: 1
	);
	const eyeGap = $derived(
		faceStructure?.eyeSpacing === 'close-set'
			? 4.4
			: faceStructure?.eyeSpacing === 'wide-set'
				? 6.8
				: 5.5
	);
	const eyeRx = $derived(
		['narrow', 'hooded', 'deep-set'].includes(faceStructure?.eyeShape ?? '') ? 1.3 : 1.05
	);
	const eyeRy = $derived(
		['narrow', 'hooded', 'deep-set'].includes(faceStructure?.eyeShape ?? '')
			? 0.65
			: faceStructure?.eyeShape === 'round'
				? 1.2
				: 0.9
	);
	const coveredHair = $derived(
		['linen-coif', 'wool-hood', 'mail-coif', 'kettle-hat', 'nasal-helm'].includes(
			attire?.headwear ?? ''
		)
	);
	const proportions = $derived(manifest.physiology?.proportions);
	const shoulderScale = $derived(packTwo ? manifest.rig.shoulderWidth : 1);
	const hipScale = $derived(packTwo ? manifest.rig.hipWidth : 1);
	const torsoScale = $derived(packTwo ? (proportions?.torsoRatio ?? 1) : 1);
	const armScale = $derived(packTwo ? (proportions?.armRatio ?? 1) / torsoScale : 1);
	const legScale = $derived(packTwo ? (proportions?.legRatio ?? 1) : 1);
	const headOffsetY = $derived(packTwo ? (1 - torsoScale) * 52 : 0);
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
	data-build={manifest.bodyBuild}
	data-height-band={manifest.physiology?.heightBand ?? 'legacy'}
	data-proportion={manifest.physiology?.proportions?.profile ?? 'legacy'}
	data-footwear={attire?.footwear ?? 'legacy'}
	data-legwear={attire?.legwear ?? 'legacy'}
	data-torso={attire?.torso ?? 'legacy'}
	data-arms={attire?.arms ?? 'legacy'}
	data-headwear={attire?.headwear ?? 'none'}
	aria-label={`${manifest.displayName}, deterministic modular hero rig`}
>
	<svg
		viewBox={packTwo ? '0 0 100 184' : '0 0 100 180'}
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

		<ellipse class="shadow" cx="50" cy={packTwo ? 176 : 171} rx="27" ry="5" />
		<g class="figure">
			<g
				class="lower-body"
				transform={`translate(50 169) scale(${hipScale} ${legScale}) translate(-50 -169)`}
			>
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
				{#if attire?.legwear === 'wrap-skirt-over-leggings'}
					<path class="overskirt" d="M33 102 L66 102 L72 135 L28 135 Z" />
				{:else if attire?.legwear === 'divided-skirt-trousers'}
					<path
						class="overskirt divided"
						d="M33 102 L66 102 L69 132 L53 132 L50 112 L47 132 L30 132 Z"
					/>
				{/if}
			</g>

			<g
				class="upper-body"
				transform={`translate(50 103) scale(${shoulderScale} ${torsoScale}) translate(-50 -103)`}
			>
				{#if attire?.torso === 'scholar-robe' || attire?.torso === 'hooded-surcoat'}
					<path class="cloak-back robe-back" d="M29 50 Q50 40 72 51 L81 139 Q51 151 19 138 Z" />
				{:else}
					<path class="cloak-back" d="M29 50 Q50 40 72 51 L78 115 Q51 128 22 113 Z" />
				{/if}
				<g class="arms" transform={`translate(50 56) scale(1 ${armScale}) translate(-50 -56)`}>
					<g class="arm arm-left">
						{#if attire?.arms !== 'sleeveless'}
							<path class="sleeve" d="M30 53 Q23 58 20 79 L27 101 L35 98 L32 78 L39 62 Z" />
						{/if}
						<path class="bracer" d="M26 92 L36 90 L38 108 L30 112 L25 104 Z" />
						<path class="skin" d="M30 108 Q35 104 38 109 L38 119 L34 126 L30 121 Z" />
					</g>
					<g class="arm arm-right">
						{#if attire?.arms !== 'sleeveless'}
							<path class="sleeve" d="M69 53 Q77 58 81 78 L75 101 L66 98 L69 77 L61 62 Z" />
						{/if}
						<path class="bracer" d="M65 90 L75 92 L76 105 L71 112 L63 108 Z" />
						<path class="skin" d="M63 108 Q68 104 72 109 L70 122 L66 126 L62 118 Z" />
					</g>
				</g>

				<path class="neck skin" d="M43 39 L57 39 L59 54 L41 54 Z" />
				<path class="torso" d="M38 48 Q50 43 63 49 L70 77 L65 111 L34 111 L29 78 Z" />
				<path class="tunic-panel" d="M42 54 L57 53 L61 105 L39 105 Z" />
				{#if attire?.torso === 'apron-over-tunic'}
					<path class="garment-detail apron" d="M38 64 L62 64 L65 122 L34 122 Z" />
				{:else if attire?.torso === 'fitted-doublet'}
					<path class="garment-detail doublet" d="M40 52 L50 65 L60 52 M50 65 L50 105" />
				{:else if attire?.torso === 'quilted-gambeson'}
					<path
						class="garment-detail quilting"
						d="M33 64 L67 64 M32 75 L68 75 M34 86 L66 86 M35 97 L65 97"
					/>
				{:else if attire?.torso === 'mail-shirt'}
					<path
						class="garment-detail mail"
						d="M34 61 Q50 70 67 61 M33 70 Q50 79 68 70 M34 79 Q50 88 67 79 M35 88 Q50 97 66 88"
					/>
				{:else if attire?.torso === 'brigandine-vest'}
					<path
						class="garment-detail studs"
						d="M39 61 L61 61 M38 73 L62 73 M38 85 L62 85 M39 97 L61 97"
					/>
				{/if}
				<path class="cape" d="M30 50 Q50 43 70 51 L65 65 Q50 57 34 66 Z" />
				<path class="belt" d="M33 94 Q50 98 66 94 L66 101 Q50 105 34 101 Z" />
				<rect class="buckle" x="47" y="96" width="7" height="6" rx="1" />

				<g class="clasp" filter={`url(#glow-${manifest.characterId})`}>
					<circle cx="50" cy="55" r="3.5" />
					<path d="M50 49 L52 55 L50 61 L48 55 Z" />
				</g>
			</g>

			<g
				class="head"
				transform={`translate(0 ${headOffsetY}) translate(50 33) scale(${manifest.rig.headScale}) translate(-50 -33)`}
			>
				{#if hasLongHair && !coveredHair}
					<path class="hair-back" d="M37 19 Q50 7 64 19 L66 48 L36 49 Z" />
				{/if}
				{#if hasKnot && !coveredHair}
					<circle class="hair" cx="51" cy="10" r="8" />
					<circle class="hair-detail" cx="48" cy="8" r="4" />
				{/if}
				<g transform={`translate(50 33) scale(${faceWidth} ${faceLength}) translate(-50 -33)`}>
					<ellipse class="ear skin" cx="36.5" cy="32" rx="3" ry="5" />
					<ellipse class="ear skin" cx="63.5" cy="32" rx="3" ry="5" />
					<path class="skin face" d="M37 20 Q50 12 63 20 L62 38 Q57 48 50 49 Q41 46 38 38 Z" />
				</g>
				{#if !coveredHair}
					<path class="hair" d="M37 26 Q36 14 49 13 Q64 13 64 27 Q58 20 51 22 Q43 18 37 26 Z" />
				{/if}
				{#if expression === 'skeptical'}
					<path class="brow" d="M41 27 Q45 25 48 28 M53 30 Q57 28 60 30" />
				{:else if expression === 'injured'}
					<path class="brow" d="M41 30 Q45 28 48 30 M53 29 Q57 27 60 29" />
				{:else}
					<path class="brow" d="M41 29 Q45 27 48 29 M53 29 Q57 27 60 29" />
				{/if}
				<ellipse class="eye" cx={50 - eyeGap} cy="32" rx={eyeRx} ry={eyeRy} />
				<ellipse class="eye" cx={50 + eyeGap} cy="32" rx={eyeRx} ry={eyeRy} />
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
				{#if attire?.headwear === 'linen-coif' || attire?.headwear === 'mail-coif'}
					<path
						class="headwear coif"
						d="M36 28 Q35 12 50 11 Q65 12 65 29 L61 37 L60 22 Q50 15 40 22 L40 37 Z"
					/>
				{:else if attire?.headwear === 'wool-hood'}
					<path
						class="headwear hood"
						d="M32 30 Q31 10 50 8 Q69 10 68 31 L63 49 L57 43 Q65 31 60 20 Q50 13 40 20 Q35 31 43 44 L36 50 Z"
					/>
				{:else if attire?.headwear === 'broad-hat'}
					<path
						class="headwear hat"
						d="M29 19 Q50 14 72 19 L69 23 Q50 26 31 22 Z M40 18 Q40 6 59 8 L62 19 Z"
					/>
				{:else if attire?.headwear === 'felt-cap'}
					<path class="headwear cap" d="M36 21 Q38 8 53 10 Q63 12 65 21 Q50 17 36 21 Z" />
				{:else if attire?.headwear === 'kettle-hat'}
					<path
						class="headwear metal"
						d="M27 21 Q50 14 74 21 L70 26 L30 26 Z M38 20 Q40 7 60 10 L64 21 Z"
					/>
				{:else if attire?.headwear === 'nasal-helm'}
					<path
						class="headwear metal"
						d="M35 24 Q37 7 50 6 Q64 8 66 24 Z M49 20 L53 20 L52 38 L49 38 Z"
					/>
				{:else if attire?.headwear === 'turban-wrap'}
					<path
						class="headwear turban"
						d="M34 23 Q34 8 50 8 Q67 9 67 24 Q51 18 34 23 Z M36 16 Q51 22 65 15 M41 10 Q51 16 60 10"
					/>
				{:else if attire?.headwear === 'circlet'}
					<path
						class="headwear circlet"
						d="M37 23 Q50 18 64 23 L62 27 Q50 23 38 27 Z M48 21 L51 16 L54 21"
					/>
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

	.garment-detail {
		fill: none;
		stroke: color-mix(in srgb, var(--accent), #111 38%);
		stroke-width: 0.8;
	}

	.apron {
		fill: color-mix(in srgb, var(--cloth), #6b4931 44%);
		stroke-width: 0.7;
	}

	.mail {
		stroke: #9ca2a7;
		stroke-dasharray: 1.5 1.2;
	}

	.studs {
		stroke-width: 1.8;
		stroke-dasharray: 0.1 4.5;
		stroke-linecap: round;
	}

	figure[data-arms='rolled-sleeves'] .sleeve {
		clip-path: inset(0 0 35% 0);
	}

	figure[data-arms='bell-cuffs'] .sleeve {
		stroke-width: 2.2;
	}

	figure[data-arms='mail-sleeves'] .sleeve {
		fill: #555c63;
		stroke: #aeb5bc;
		stroke-dasharray: 1 1;
	}

	figure[data-legwear='mail-chausses'] .trouser {
		fill: #4d545b;
		stroke: #aab1b8;
		stroke-dasharray: 1 1;
	}

	.overskirt {
		fill: color-mix(in srgb, var(--cloth), #fff 6%);
		stroke: color-mix(in srgb, var(--accent), transparent 58%);
		stroke-width: 0.7;
	}

	figure[data-footwear='turnshoes'] .boot,
	figure[data-footwear='soft-leather-shoes'] .boot,
	figure[data-footwear='wrapped-sandals'] .boot {
		clip-path: inset(62% 0 0 0);
	}

	figure[data-footwear='riding-greaves'] .boot,
	figure[data-footwear='sabatons'] .boot {
		fill: #626970;
		stroke: #b8c0c7;
	}

	figure[data-footwear='fur-lined-boots'] .boot {
		stroke: #c9b79d;
		stroke-width: 2.2;
	}

	.headwear {
		fill: color-mix(in srgb, var(--cloth), #0b0c0f 20%);
		stroke: color-mix(in srgb, var(--accent), #fff 16%);
		stroke-width: 0.75;
		stroke-linejoin: round;
	}

	.headwear.metal {
		fill: #596067;
		stroke: #c0c7ce;
	}

	.headwear.turban,
	.headwear.circlet {
		fill: none;
		stroke-width: 1.8;
	}

	.headwear.circlet {
		stroke: var(--accent);
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
