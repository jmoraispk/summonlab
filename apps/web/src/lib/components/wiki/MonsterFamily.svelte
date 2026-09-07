<script lang="ts">
	import { resolve } from '$app/paths';

	type Affinity = 'normal' | 'fire' | 'earth' | 'wind' | 'water';

	type Variant = {
		affinity: Affinity;
		thumbnailPath: string;
		width: number;
		height: number;
	};

	type Form = {
		id: string;
		name: string;
		tier: string;
		role: string;
		battlefieldDuty: string;
		teachingGoal: string;
		signatureMechanic: string | null;
		telegraph: string | null;
		counterplay: string | null;
		lowerFormInteraction: string | null;
		variants: Variant[];
	};

	type Family = {
		familyId: string;
		displayName: string;
		sourceRaceNumber: number;
		sourcePage: string;
		classificationNotes: string;
		escalationAxis: string;
		visualConstants: string[];
		floorSlot: null;
		forms: Form[];
	};

	let { family }: { family: Family } = $props();
	let selectedAffinity = $state<Affinity>('normal');

	const affinities = ['normal', 'fire', 'earth', 'wind', 'water'] as const;
	const label = (value: string) => value[0]?.toUpperCase() + value.slice(1);
	const detail = (value: string | null) => value ?? 'Not applicable for this form.';
	const roleName = (role: string) => role.replace(/\s+\([^)]*\)$/u, '');
	const mechanicName = (mechanic: string | null) => mechanic?.split(':', 1)[0]?.trim() ?? null;
	const sourceUrl = (path: string) => `https://github.com/jmoraispk/summonlab/blob/main/${path}`;
</script>

<section
	class="monster-family"
	id={`monster-family-${family.familyId}`}
	aria-labelledby="monster-family-heading"
>
	<header class="family-heading">
		<a href={resolve('/wiki/creatures/monsters')}>← Monster bestiary</a>
		<p>
			Family {String(family.sourceRaceNumber).padStart(2, '0')} · 5 forms · 25 images · Floor
			{family.floorSlot ?? 'unassigned'}
		</p>
		<h1 id="monster-family-heading">{family.displayName}</h1>
		<span>{family.escalationAxis}</span>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external canonical repository source -->
		<a class="source-link" href={sourceUrl(family.sourcePage)}>Canonical family source ↗</a>
	</header>

	<section class="atlas-section" aria-labelledby="family-atlas-heading">
		<header>
			<p>Viewing {label(selectedAffinity)} across T1–T5</p>
			<h2 id="family-atlas-heading">Affinity atlas</h2>
		</header>
		<div class="affinity-controls" role="group" aria-label="Choose one affinity for every tier">
			{#each affinities as affinity (affinity)}
				<button
					type="button"
					aria-label={`Show ${label(affinity)} affinity`}
					aria-pressed={selectedAffinity === affinity}
					onclick={() => (selectedAffinity = affinity)}
				>
					{label(affinity)}
				</button>
			{/each}
		</div>
		<div class="family-atlas">
			{#each family.forms as form (form.id)}
				{@const variant = form.variants.find(({ affinity }) => affinity === selectedAffinity)}
				{#if variant}
					<a class="family-form-card" href={resolve(`/wiki/creatures/monsters/${form.id}`)}>
						<div class="image-wrap">
							<img
								src={variant.thumbnailPath}
								alt={`${form.name}, ${label(variant.affinity)} affinity`}
								width={variant.width}
								height={variant.height}
								loading="lazy"
							/>
							<span>{label(variant.affinity)}</span>
						</div>
						<div class="form-copy">
							<span>{form.tier}</span>
							<strong>{form.name}</strong>
							<small>{roleName(form.role)}</small>
							{#if mechanicName(form.signatureMechanic)}
								<em>{mechanicName(form.signatureMechanic)}</em>
							{/if}
						</div>
					</a>
				{/if}
			{/each}
		</div>
	</section>

	<section class="family-details" aria-labelledby="family-details-heading">
		<div>
			<p>Encounter identity</p>
			<h2 id="family-details-heading">Family constants</h2>
			<span>{family.classificationNotes}</span>
		</div>
		<ul>
			{#each family.visualConstants as constant (constant)}
				<li>{constant}</li>
			{/each}
		</ul>
	</section>

	<section class="progression-section" aria-labelledby="family-progression-heading">
		<header>
			<p>Canonical encounter design</p>
			<h2 id="family-progression-heading">T1–T5 combat progression</h2>
		</header>
		<div class="table-scroll">
			<table class="family-progression">
				<thead>
					<tr>
						<th>Tier / form</th>
						<th>Primary archetype</th>
						<th>Battlefield duty</th>
						<th>Teaching goal</th>
						<th>Signature mechanic</th>
						<th>Telegraph</th>
						<th>Counterplay</th>
						<th>Lower-form interaction</th>
					</tr>
				</thead>
				<tbody>
					{#each family.forms as form (form.id)}
						<tr>
							<th
								><a href={resolve(`/wiki/creatures/monsters/${form.id}`)}
									>{form.tier} · {form.name}</a
								></th
							>
							<td>{form.role}</td>
							<td>{form.battlefieldDuty}</td>
							<td>{form.teachingGoal}</td>
							<td>{detail(form.signatureMechanic)}</td>
							<td>{detail(form.telegraph)}</td>
							<td>{detail(form.counterplay)}</td>
							<td>{detail(form.lowerFormInteraction)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</section>

<style>
	.monster-family {
		--line: rgba(225, 211, 184, 0.16);
		padding: clamp(2.5rem, 5vw, 5rem) clamp(1rem, 5vw, 5rem) clamp(5rem, 9vw, 9rem);
		background:
			radial-gradient(circle at 80% 2%, rgba(49, 147, 163, 0.14), transparent 28rem),
			linear-gradient(180deg, #090d12, #090805);
	}
	.family-heading,
	.atlas-section,
	.family-details,
	.progression-section {
		max-width: 100rem;
		margin-inline: auto;
	}
	.family-heading {
		margin-bottom: clamp(3rem, 7vw, 6rem);
	}
	.family-heading > a {
		display: inline-block;
		margin-bottom: 2.5rem;
		color: rgba(243, 234, 217, 0.66);
		font:
			0.64rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-decoration: none;
		text-transform: uppercase;
	}
	p {
		margin: 0 0 0.65rem;
		color: #70c7d2;
		font:
			800 0.64rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font:
			400 clamp(3.8rem, 9vw, 7.5rem) / 0.86 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	.family-heading > span,
	.family-details > div > span {
		display: block;
		max-width: 62rem;
		margin-top: 1.5rem;
		color: rgba(243, 234, 217, 0.66);
		font:
			1rem/1.65 Georgia,
			serif;
	}
	.source-link {
		display: inline-block;
		margin-top: 1rem;
		color: #70c7d2;
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		font:
			400 clamp(2rem, 4vw, 3.8rem) / 1 Georgia,
			serif;
		letter-spacing: -0.04em;
	}
	.atlas-section > header,
	.progression-section > header {
		margin-bottom: 1.25rem;
	}
	.affinity-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-bottom: 1.25rem;
	}
	.affinity-controls button {
		padding: 0.6rem 0.85rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: #080b0f;
		color: rgba(243, 234, 217, 0.62);
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.affinity-controls button[aria-pressed='true'] {
		border-color: #70c7d2;
		background: rgba(112, 199, 210, 0.1);
		color: #bcebf0;
	}
	.family-atlas {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.65rem;
	}
	.family-form-card {
		display: grid;
		grid-template-rows: auto 1fr;
		min-width: 0;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 0.25rem;
		background: #070a0e;
		color: rgba(243, 234, 217, 0.66);
		text-decoration: none;
	}
	.image-wrap {
		position: relative;
	}
	.family-form-card img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		object-fit: cover;
	}
	.image-wrap > span {
		position: absolute;
		right: 0.5rem;
		bottom: 0.5rem;
		padding: 0.32rem 0.45rem;
		background: rgba(4, 7, 9, 0.84);
		color: #bcebf0;
		font:
			0.56rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.form-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: start;
		padding: 0.65rem 0.7rem 0.8rem;
	}
	.form-copy > span {
		color: #70c7d2;
		font:
			0.56rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
	}
	.form-copy strong {
		margin-top: 0.2rem;
		font:
			400 1.15rem Georgia,
			serif;
	}
	.form-copy small {
		margin-top: 0.45rem;
		color: rgba(243, 234, 217, 0.58);
		font:
			0.7rem/1.3 Georgia,
			serif;
	}
	.form-copy em {
		margin-top: auto;
		padding-top: 0.65rem;
		color: #c9a66b;
		font:
			0.52rem/1.25 ui-monospace,
			monospace;
		font-style: normal;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.family-details {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: clamp(2rem, 6vw, 7rem);
		margin-top: clamp(5rem, 9vw, 9rem);
		padding-top: clamp(2rem, 4vw, 4rem);
		border-top: 1px solid var(--line);
	}
	.family-details ul {
		margin: 0;
		padding-left: 1.2rem;
	}
	.family-details li {
		margin-bottom: 0.8rem;
		color: rgba(243, 234, 217, 0.75);
		font:
			0.95rem/1.55 Georgia,
			serif;
	}
	.progression-section {
		margin-top: clamp(5rem, 9vw, 9rem);
	}
	.table-scroll {
		overflow-x: auto;
		border: 1px solid var(--line);
	}
	table {
		width: 100%;
		min-width: 105rem;
		border-collapse: collapse;
		background: #080b0f;
	}
	th,
	td {
		padding: 0.85rem;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		vertical-align: top;
		color: rgba(243, 234, 217, 0.68);
		font:
			0.76rem/1.5 Georgia,
			serif;
		text-align: left;
	}
	thead th {
		color: #70c7d2;
		font:
			0.56rem/1.4 ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	tbody th {
		width: 9rem;
		font-size: 0.86rem;
		font-weight: 400;
	}
	tbody th a {
		color: #f3ead9;
		text-decoration: none;
	}
	@media (max-width: 64rem) {
		.family-details {
			grid-template-columns: 1fr;
		}
		.family-atlas {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 40rem) {
		.family-atlas {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
