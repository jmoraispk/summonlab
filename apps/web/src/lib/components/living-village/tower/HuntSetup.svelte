<script lang="ts">
	import type { FloorFixture, HealthThreshold, SpeciesFixture } from './tower-fixtures';

	let {
		floor,
		species,
		availableSpecies,
		threshold,
		onSpecies,
		onThreshold
	}: {
		floor: FloorFixture;
		species: SpeciesFixture;
		availableSpecies: SpeciesFixture[];
		threshold: HealthThreshold;
		onSpecies: (id: SpeciesFixture['id']) => void;
		onThreshold: (threshold: HealthThreshold) => void;
	} = $props();
</script>

<section class="setup" aria-labelledby="hunt-setup-heading">
	<header>
		<p class="eyebrow">02 · Hunt order</p>
		<h2 id="hunt-setup-heading">Target and return rule</h2>
	</header>

	<div class="setup-grid">
		<fieldset class="species-choice">
			<legend>Known species on Floor {floor.number}</legend>
			{#each availableSpecies as candidate (candidate.id)}
				<label class:active={candidate.id === species.id}>
					<input
						type="radio"
						name="hunt-species"
						value={candidate.id}
						checked={candidate.id === species.id}
						onchange={() => onSpecies(candidate.id)}
					/>
					<span>
						<strong>{candidate.name}</strong>
						<small>{candidate.family} · {candidate.affinity} · {candidate.role}</small>
					</span>
				</label>
			{/each}
		</fieldset>

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
				Checked after each complete encounter. One fight can cross below {threshold}% before the
				party returns.
			</p>
		</fieldset>
	</div>

	<div class="brief" data-testid="species-preview">
		<div>
			<span>Selected target</span>
			<strong>{species.name}</strong>
			<p>{species.description}</p>
		</div>
		<div>
			<span>Known material drops</span>
			<ul>
				{#each species.materials as material (material.id)}
					<li>
						<strong>{material.name}</strong><small
							>{material.minimum}–{material.maximum} / kill</small
						>
					</li>
				{/each}
			</ul>
		</div>
		<div>
			<span>{floor.state === 'frontier' ? 'First-clear reward' : 'Repeat-hunt reward'}</span>
			<strong>{floor.state === 'frontier' ? floor.firstClearReward : floor.repeatReward}</strong>
			<p>Species materials are collected in either reward mode.</p>
		</div>
	</div>
</section>

<style>
	.setup {
		padding: clamp(1.25rem, 3vw, 2.25rem);
		border: 1px solid rgba(225, 188, 121, 0.22);
		background: rgba(14, 15, 18, 0.94);
	}
	.eyebrow,
	.brief span {
		margin: 0 0 0.45rem;
		color: #d99b54;
		font:
			0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0 0 1.5rem;
		font-family: Georgia, serif;
		font-size: clamp(1.65rem, 3vw, 2.35rem);
		font-weight: 400;
	}
	.setup-grid {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		gap: 1rem;
	}
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 1rem;
		border: 1px solid #34322d;
	}
	legend {
		padding: 0 0.5rem;
		color: #bbb3a5;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.species-choice label,
	.threshold-choice label {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		min-height: 3.3rem;
		padding: 0.7rem;
		border: 1px solid transparent;
		background: #17191d;
		cursor: pointer;
	}
	.species-choice label + label {
		margin-top: 0.5rem;
	}
	.species-choice label.active,
	.threshold-choice label.active {
		border-color: #d99b54;
		background: #2b2117;
	}
	input {
		width: 1.15rem;
		height: 1.15rem;
		accent-color: #df9e4d;
	}
	label span,
	label strong,
	label small {
		display: block;
	}
	label small {
		margin-top: 0.2rem;
		color: #99958c;
		font-size: 0.72rem;
	}
	.threshold-choice > div {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.45rem;
	}
	.threshold-choice label {
		justify-content: center;
		padding: 0.7rem 0.35rem;
	}
	.threshold-choice p {
		margin: 1rem 0 0;
		padding: 0.8rem;
		border-left: 3px solid #d99b54;
		background: #121316;
		color: #c4beb3;
		font-size: 0.78rem;
		line-height: 1.5;
	}
	.brief {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		margin-top: 1rem;
		background: #36332d;
	}
	.brief > div {
		min-width: 0;
		padding: 1rem;
		background: #121418;
	}
	.brief strong {
		display: block;
		font-family: Georgia, serif;
		font-size: 1.05rem;
		font-weight: 400;
		line-height: 1.3;
	}
	.brief p {
		margin: 0.5rem 0 0;
		color: #96928a;
		font-size: 0.75rem;
		line-height: 1.5;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0;
	}
	li strong {
		font-family: inherit;
		font-size: 0.82rem;
	}
	li small {
		color: #a8a197;
		font-size: 0.7rem;
	}
	@media (max-width: 760px) {
		.setup-grid,
		.brief {
			grid-template-columns: 1fr;
		}
	}
</style>
