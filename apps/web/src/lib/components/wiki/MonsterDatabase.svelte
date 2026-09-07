<script lang="ts">
	import { resolve } from '$app/paths';

	type Variant = {
		affinity: string;
		thumbnailPath: string;
		width: number;
		height: number;
	};

	type Form = {
		id: string;
		name: string;
		tier: string;
		variants: Variant[];
	};

	type Family = {
		familyId: string;
		displayName: string;
		forms: Form[];
	};

	let { families }: { families: readonly Family[] } = $props();

	const formCount = $derived(families.reduce((total, family) => total + family.forms.length, 0));
	const coordinateCount = $derived(formCount * 5);
	const normalVariant = (form: Form) =>
		form.variants.find((variant) => variant.affinity === 'normal');
</script>

<section class="database" aria-labelledby="monster-database-heading">
	<header class="database-heading">
		<div>
			<p>{families.length} families · {formCount} forms · {coordinateCount} images</p>
			<h1 id="monster-database-heading">Monster bestiary</h1>
			<span
				>Scan each family from T1 to T5. Open a family for all affinities and combat detail.</span
			>
		</div>
		<nav aria-label="Monster families">
			{#each families as family (family.familyId)}
				<a href={`#database-${family.familyId}`}>{family.displayName}</a>
			{/each}
		</nav>
	</header>

	{#each families as family (family.familyId)}
		<section class="family" id={`database-${family.familyId}`}>
			<header>
				<p>Family {String(families.indexOf(family) + 1).padStart(2, '0')}</p>
				<h2>
					<a href={resolve(`/wiki/creatures/monsters/families/${family.familyId}`)}>
						{family.displayName}<span>View 25-image atlas →</span>
					</a>
				</h2>
			</header>
			<div class="monster-grid">
				{#each family.forms as form (form.id)}
					{@const normal = normalVariant(form)}
					<a class="monster-card" href={resolve(`/wiki/creatures/monsters/${form.id}`)}>
						{#if normal}
							<img
								src={normal.thumbnailPath}
								alt={`${form.name}, Normal affinity`}
								width={normal.width}
								height={normal.height}
								loading="lazy"
							/>
						{/if}
						<span>{form.tier}</span>
						<strong>{form.name}</strong>
					</a>
				{/each}
			</div>
		</section>
	{/each}

	<footer class="reference-links">
		<a href={resolve('/wiki/creatures/taxonomy')}>Creature taxonomy</a>
		<a href={resolve('/wiki/creatures/monsters/reconciliation')}>Historical reconciliation</a>
		<a href={resolve('/wiki/creatures/fauna-family-expansion')}>Fauna expansion</a>
	</footer>
</section>

<style>
	.database {
		--line: rgba(225, 211, 184, 0.16);
		padding: clamp(2.5rem, 5vw, 5rem) clamp(1rem, 5vw, 5rem);
		background:
			radial-gradient(circle at 82% 3%, rgba(49, 147, 163, 0.13), transparent 25rem),
			linear-gradient(180deg, #090d12, #090805);
	}
	.database-heading,
	.family {
		max-width: 100rem;
		margin-inline: auto;
	}
	.database-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.72fr);
		gap: clamp(2rem, 5vw, 6rem);
		align-items: end;
		margin-bottom: clamp(3rem, 7vw, 7rem);
	}
	p {
		margin: 0 0 0.7rem;
		color: #70c7d2;
		font:
			800 0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font:
			400 clamp(3.4rem, 8vw, 7rem) / 0.87 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	.database-heading div > span {
		display: block;
		max-width: 38rem;
		margin-top: 1.4rem;
		color: rgba(243, 234, 217, 0.64);
		font:
			1rem/1.6 Georgia,
			serif;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	nav a {
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--line);
		color: rgba(243, 234, 217, 0.68);
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.06em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.family {
		margin-bottom: clamp(3.5rem, 7vw, 7rem);
		scroll-margin-top: 6rem;
	}
	.family > header {
		margin-bottom: 0.9rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0;
		font:
			400 clamp(2rem, 3.2vw, 3.2rem) Georgia,
			serif;
		letter-spacing: -0.035em;
	}
	h2 a {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		color: #f3ead9;
		text-decoration: none;
	}
	h2 span {
		color: #70c7d2;
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.monster-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.7rem;
	}
	.monster-card {
		display: grid;
		min-width: 0;
		padding-bottom: 0.8rem;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 0.3rem;
		background: #080b0f;
		color: #f3ead9;
		text-decoration: none;
		transition:
			transform 180ms ease,
			border-color 180ms ease;
	}
	.monster-card:hover {
		transform: translateY(-3px);
		border-color: rgba(112, 199, 210, 0.55);
	}
	.monster-card img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		object-fit: cover;
	}
	.monster-card span,
	.monster-card strong {
		margin-inline: 0.7rem;
	}
	.monster-card span {
		margin-top: 0.65rem;
		color: #70c7d2;
		font:
			0.56rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
	}
	.monster-card strong {
		margin-top: 0.2rem;
		overflow: hidden;
		font:
			400 clamp(0.9rem, 1.5vw, 1.2rem) Georgia,
			serif;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.reference-links {
		display: flex;
		max-width: 100rem;
		flex-wrap: wrap;
		gap: 0.55rem 1.5rem;
		margin: 0 auto;
		padding-top: 1.2rem;
		border-top: 1px solid var(--line);
	}
	.reference-links a {
		color: #70c7d2;
		font:
			0.6rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	@media (max-width: 64rem) {
		.database-heading {
			grid-template-columns: 1fr;
		}
		.monster-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 34rem) {
		h1 {
			font-size: 3.2rem;
		}
		h2 a {
			align-items: start;
			flex-direction: column;
			gap: 0.25rem;
		}
		.monster-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
