<script lang="ts">
	import { attributeDisplayName, orderCharacterSheetAttributes } from '../attribute-display';
	import PortalGlyph from './PortalGlyph.svelte';
	import MechanicIcon from './MechanicIcon.svelte';

	type Hero = {
		name: string;
		identityLine: string;
		affinity: string;
		affinityIcon: 'ember' | 'tide' | 'gale' | 'grove';
		calling: string;
		stars: number;
		image: string;
		attributes: readonly { name: string; value: number }[];
		personality: {
			traits: readonly string[];
			value: string;
			drive: string;
			socialStyle: string;
			stressResponse: string;
			tendency: string;
		};
		aptitudes: readonly { name: string; class: 'martial' | 'magic' | 'crafting' }[];
	};

	let { hero, onclose }: { hero: Hero; onclose: () => void } = $props();
	const aptitudeClassLabels = {
		martial: 'Martial',
		magic: 'Magical',
		crafting: 'Craft & life'
	} as const;
	const orderedAttributes = $derived(
		orderCharacterSheetAttributes(hero.attributes, (attribute) => attribute.name)
	);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="dossier"
	role="dialog"
	aria-modal="true"
	aria-labelledby="dossier-name"
	data-testid="hero-dossier"
	data-stars={hero.stars}
>
	<button type="button" class="close" onclick={onclose} aria-label="Close hero details">×</button>
	<div class="portrait">
		<div class="halo"></div>
		<img src={hero.image} alt={`${hero.name} full identity portrait`} width="1024" height="1536" />
		<div class="portrait-label">
			<span class="rarity-stars">{'✦'.repeat(hero.stars)} <i>{hero.stars}★</i></span>
			<strong>{hero.calling}</strong>
		</div>
	</div>
	<div class="details">
		<header>
			<p><PortalGlyph kind="ember" size={15} /> Hero profile</p>
			<h2 id="dossier-name">{hero.name}</h2>
			<span>{hero.identityLine}</span>
			<div class="chips">
				<i class="affinity"
					><MechanicIcon kind={hero.affinityIcon} size={16} />{hero.affinity} affinity</i
				>{#each hero.personality.traits as trait (trait)}<i>{trait}</i>{/each}
			</div>
		</header>

		<section class="attributes" aria-labelledby="attribute-title">
			<div class="section-title">
				<h3 id="attribute-title">Attributes</h3>
				<span>Current readiness</span>
			</div>
			<div class="attribute-grid" data-testid="attribute-grid">
				{#each orderedAttributes as attribute (attribute.name)}
					<div data-testid="hero-attribute">
						<span title={attribute.name} aria-label={attribute.name}
							>{attributeDisplayName(attribute.name)}</span
						><strong>{attribute.value}</strong><i><b style:width={`${attribute.value}%`}></b></i>
					</div>
				{/each}
			</div>
		</section>

		<section class="personality" aria-labelledby="personality-title">
			<div class="section-title">
				<h3 id="personality-title">Personality</h3>
				<span>Stable profile</span>
			</div>
			<dl>
				<div>
					<dt>Values</dt>
					<dd>{hero.personality.value}</dd>
				</div>
				<div>
					<dt>Drive</dt>
					<dd>{hero.personality.drive}</dd>
				</div>
				<div>
					<dt>Social style</dt>
					<dd>{hero.personality.socialStyle}</dd>
				</div>
				<div>
					<dt>Under pressure</dt>
					<dd>{hero.personality.stressResponse}</dd>
				</div>
				<div>
					<dt>Leadership</dt>
					<dd>{hero.personality.tendency}</dd>
				</div>
			</dl>
		</section>

		<section class="aptitudes">
			<div class="section-title">
				<h3>Aptitudes</h3>
				<span>Learning potential</span>
			</div>
			<div>
				{#each hero.aptitudes as aptitude (aptitude.name)}<span data-class={aptitude.class}
						><MechanicIcon kind={aptitude.class} size={17} /><b>{aptitude.name}</b><small
							>{aptitudeClassLabels[aptitude.class]}</small
						></span
					>{/each}
			</div>
		</section>
	</div>
</div>

<style>
	.dossier {
		--rarity: #d9a956;
		--rarity-soft: #d9a95624;
		position: absolute;
		z-index: 20;
		inset: 12px;
		display: grid;
		grid-template-columns: minmax(230px, 0.82fr) minmax(0, 1.18fr);
		overflow: hidden;
		border: 1px solid #b9e8dc3b;
		border-radius: 22px;
		background: linear-gradient(135deg, #0d181eea, #060b10fb 62%);
		box-shadow:
			0 32px 100px #000e,
			inset 0 1px #fff1;
		backdrop-filter: blur(20px);
	}
	.dossier[data-stars='2'] {
		--rarity: #75c4f4;
		--rarity-soft: #488fca33;
	}
	.dossier[data-stars='3'] {
		--rarity: #bd8cf4;
		--rarity-soft: #8857c43d;
	}
	.close {
		position: absolute;
		z-index: 4;
		top: 16px;
		right: 16px;
		display: grid;
		width: 38px;
		height: 38px;
		place-items: center;
		border: 1px solid #dceae32b;
		border-radius: 50%;
		background: #071015c7;
		color: #d9ded9;
		font-size: 1.45rem;
		cursor: pointer;
	}
	.portrait {
		position: relative;
		overflow: hidden;
		background: radial-gradient(circle at 50% 38%, #277f726b, transparent 44%), #060b10;
	}
	.portrait::after {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(90deg, transparent 67%, #0c151b),
			linear-gradient(0deg, #081016, transparent 42%);
		content: '';
	}
	.halo {
		position: absolute;
		top: 14%;
		left: 50%;
		width: 74%;
		aspect-ratio: 1;
		transform: translateX(-50%);
		border: 1px solid color-mix(in srgb, var(--rarity) 48%, transparent);
		border-radius: 50%;
		box-shadow:
			0 0 55px var(--rarity-soft),
			inset 0 0 45px var(--rarity-soft);
	}
	.portrait img {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 12%;
		filter: saturate(0.88) contrast(1.04);
	}
	.portrait-label {
		position: absolute;
		z-index: 3;
		bottom: 22px;
		left: 22px;
		display: grid;
		gap: 4px;
	}
	.portrait-label span {
		color: var(--rarity);
		letter-spacing: 0.18em;
	}
	.rarity-stars i {
		font-size: 0.58rem;
		font-style: normal;
		opacity: 0.72;
	}
	.portrait-label strong {
		color: #dbe7e2;
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.details {
		overflow-y: auto;
		padding: 44px clamp(24px, 4vw, 48px) 34px;
	}
	header p {
		display: flex;
		gap: 7px;
		align-items: center;
		margin: 0 0 7px;
		color: #81c8b8;
		font-size: 0.61rem;
		font-weight: 750;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	header h2 {
		margin: 0;
		font:
			500 clamp(2.8rem, 5vw, 4.6rem)/0.9 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	header > span {
		display: block;
		max-width: 520px;
		margin-top: 12px;
		color: #9ba7a2;
		line-height: 1.55;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 16px;
	}
	.chips i,
	.aptitudes span {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		padding: 5px 8px;
		border: 1px solid #7dc5b534;
		border-radius: 99px;
		color: #a8d8cd;
		font-size: 0.57rem;
		font-style: normal;
		font-weight: 720;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.chips .affinity {
		border-color: color-mix(in srgb, currentColor 45%, transparent);
		background: #ffffff08;
		color: #dcebe6;
	}
	section {
		margin-top: 25px;
		padding-top: 19px;
		border-top: 1px solid #dfeae416;
	}
	.section-title {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 13px;
	}
	.section-title h3 {
		margin: 0;
		font:
			500 1.1rem Georgia,
			serif;
	}
	.section-title span {
		color: #697a74;
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.attribute-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
		padding: 13px;
		border: 1px solid #d9e7e119;
		border-radius: 11px;
		background: #ffffff05;
	}
	.attribute-grid > div {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 5px 10px;
		align-items: center;
	}
	.attribute-grid span {
		color: #b8c2bd;
		font-size: 0.7rem;
	}
	.attribute-grid strong {
		color: #e9c987;
		font:
			500 0.75rem Georgia,
			serif;
	}
	.attribute-grid i {
		grid-column: 1 / -1;
		height: 3px;
		overflow: hidden;
		border-radius: 9px;
		background: #d6ebe421;
	}
	.attribute-grid b {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #358c7c, #8ed8c7);
		box-shadow: 0 0 10px #71c8b5;
	}
	dl {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 13px 20px;
		margin: 0;
	}
	dl div:nth-child(2) {
		grid-column: 1 / -1;
	}
	dt {
		color: #6e827b;
		font-size: 0.55rem;
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	dd {
		margin: 4px 0 0;
		color: #cbd2ce;
		font-size: 0.71rem;
		line-height: 1.45;
	}
	.aptitudes > div:last-child {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	.aptitudes span {
		padding: 7px 9px;
		text-transform: none;
	}
	.aptitudes span b {
		color: #d7dfdb;
		font-size: 0.62rem;
	}
	.aptitudes span small {
		color: #6f817a;
		font-size: 0.47rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.aptitudes span[data-class='martial'] {
		border-color: #d79b6638;
	}
	.aptitudes span[data-class='magic'] {
		border-color: #a988e54a;
	}
	.aptitudes span[data-class='crafting'] {
		border-color: #d2b66c40;
	}
	@media (max-width: 720px) {
		.dossier {
			position: fixed;
			inset: 10px;
			grid-template-columns: 1fr;
			grid-template-rows: 230px 1fr;
		}
		.portrait::after {
			background: linear-gradient(0deg, #0c151b, transparent 65%);
		}
		.portrait img {
			object-position: center 18%;
		}
		.details {
			padding: 25px 20px 28px;
		}
		.attribute-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		dl {
			grid-template-columns: 1fr;
		}
		dl div:nth-child(2) {
			grid-column: auto;
		}
	}
</style>
