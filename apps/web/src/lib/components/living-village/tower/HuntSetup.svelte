<script lang="ts">
	import beasts from '../../../../../../../assets/enemies/review/beasts-v1.webp';
	import goblinoids from '../../../../../../../assets/enemies/review/goblinoids-v1.webp';
	import elementals from '../../../../../../../assets/enemies/review/pack-2/elementals-v1.png';
	import type { FloorFixture, HealthThreshold, SpeciesFixture } from './tower-fixtures';

	let {
		floor,
		availableSpecies,
		threshold,
		onThreshold
	}: {
		floor: FloorFixture;
		availableSpecies: SpeciesFixture[];
		threshold: HealthThreshold;
		onThreshold: (threshold: HealthThreshold) => void;
	} = $props();

	const artBySpecies: Record<SpeciesFixture['id'], string> = {
		'goblin-skirmisher': goblinoids,
		'grey-wolf': beasts,
		'ember-wisp': elementals
	};
</script>

<section class="setup" aria-labelledby="exploration-heading">
	<header>
		<div>
			<p class="eyebrow">02 · Floor conditions</p>
			<h2 id="exploration-heading">Explore the whole floor</h2>
		</div>
		<p>Encounters are drawn from this floor automatically. The party does not choose a target.</p>
	</header>

	<div class="setup-grid">
		<section
			class="inhabitants"
			aria-labelledby="inhabitants-heading"
			data-testid="species-preview"
		>
			<div class="subheading">
				<span>Possible encounters · Floor {floor.number}</span>
				<strong>{availableSpecies.length} known monsters</strong>
			</div>
			<div class="monster-grid">
				{#each availableSpecies as species (species.id)}
					<article>
						<img
							src={artBySpecies[species.id]}
							alt={`${species.name} existing review-art fixture`}
						/>
						<div>
							<span>{species.family} · {species.affinity}</span>
							<strong>{species.name}</strong>
							<small>{species.role}</small>
							<ul aria-label={`${species.name} known drops`}>
								{#each species.materials as material (material.id)}
									<li>{material.name}</li>
								{/each}
							</ul>
						</div>
					</article>
				{/each}
			</div>
		</section>

		<fieldset class="threshold-choice">
			<legend>Return at remaining Health</legend>
			<div>
				{#each [75, 50, 25] as value (value)}
					<label class:active={threshold === value}>
						<input
							type="radio"
							name="health-threshold"
							{value}
							checked={threshold === value}
							onchange={() => onThreshold(value as HealthThreshold)}
						/>
						<strong>{value}%</strong>
					</label>
				{/each}
			</div>
			<p data-testid="threshold-warning">
				Checked after a complete encounter. One fight can cross below {threshold}% before the party
				returns.
			</p>
			<div class="reward">
				<span>{floor.state === 'frontier' ? 'First clear' : 'Repeat exploration'}</span>
				<strong>{floor.state === 'frontier' ? floor.firstClearReward : floor.repeatReward}</strong>
			</div>
		</fieldset>
	</div>
</section>

<style>
	.setup {
		padding: 1rem;
		border: 1px solid rgba(225, 188, 121, 0.22);
		background: rgba(14, 15, 18, 0.94);
	}
	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}
	header > p {
		max-width: 34rem;
		margin: 0;
		color: #99958f;
		font-size: 0.72rem;
		text-align: right;
	}
	.eyebrow,
	.subheading span,
	.reward span {
		margin: 0 0 0.3rem;
		color: #d99b54;
		font:
			0.63rem ui-monospace,
			monospace;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		font:
			400 clamp(1.35rem, 2.5vw, 1.85rem) Georgia,
			serif;
	}
	.setup-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(17rem, 0.6fr);
		gap: 0.75rem;
	}
	.inhabitants,
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0.75rem;
		border: 1px solid #34322d;
	}
	.subheading {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.55rem;
	}
	.subheading strong {
		font-size: 0.72rem;
	}
	.monster-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
	}
	.monster-grid article {
		position: relative;
		min-height: 9.5rem;
		overflow: hidden;
		border: 1px solid #494039;
		background: #111317;
	}
	.monster-grid img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.72) contrast(1.08) brightness(0.58);
	}
	.monster-grid article > div {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: end;
		padding: 0.75rem;
		background: linear-gradient(transparent 15%, rgba(7, 9, 12, 0.92) 72%);
	}
	.monster-grid span,
	.monster-grid strong,
	.monster-grid small {
		display: block;
	}
	.monster-grid span {
		color: #dca45c;
		font-size: 0.57rem;
		text-transform: uppercase;
	}
	.monster-grid strong {
		margin-top: 0.15rem;
		font:
			400 1.15rem Georgia,
			serif;
	}
	.monster-grid small {
		color: #aaa49a;
		font-size: 0.64rem;
	}
	.monster-grid ul {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
		margin: 0.4rem 0 0;
		padding: 0;
		list-style: none;
	}
	.monster-grid li {
		padding: 0.18rem 0.3rem;
		background: rgba(38, 34, 29, 0.92);
		color: #c9c1b5;
		font-size: 0.56rem;
	}
	legend {
		padding: 0 0.4rem;
		color: #bbb3a5;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
	}
	.threshold-choice > div:first-of-type {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}
	.threshold-choice label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		min-width: 0;
		min-height: 3.3rem;
		padding: 0.5rem 0.2rem;
		border: 1px solid transparent;
		background: #17191d;
		cursor: pointer;
	}
	.threshold-choice label.active {
		border-color: #d99b54;
		background: #2b2117;
	}
	.threshold-choice input {
		width: 1rem;
		height: 1rem;
		accent-color: #df9e4d;
	}
	.threshold-choice label strong {
		font-size: clamp(0.85rem, 2vw, 1.1rem);
	}
	.threshold-choice > p {
		margin: 0.65rem 0 0;
		padding: 0.65rem;
		border-left: 3px solid #d99b54;
		background: #121316;
		color: #c4beb3;
		font-size: 0.72rem;
		line-height: 1.45;
	}
	.reward {
		margin-top: 0.65rem;
		padding: 0.65rem;
		border: 1px solid #463b30;
		background: #101216;
	}
	.reward span,
	.reward strong {
		display: block;
	}
	.reward strong {
		font-size: 0.7rem;
		line-height: 1.4;
	}
	@media (max-width: 760px) {
		.setup {
			padding: 0.7rem;
		}
		header > p {
			display: none;
		}
		.setup-grid {
			grid-template-columns: 1fr;
		}
		.monster-grid article {
			min-height: 8.5rem;
		}
		.threshold-choice {
			padding: 0.65rem;
		}
	}
</style>
