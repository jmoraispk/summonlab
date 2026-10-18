<script lang="ts">
	import { resolve } from '$app/paths';
	import MonsterArtwork from './MonsterArtwork.svelte';
	import type { MonsterArtworkImage } from './monster-artwork';

	type Variant = {
		affinity: string;
		thumbnailPath: string;
		sourcePath: string;
		width: number;
		height: number;
	};

	type Form = {
		id: string;
		name: string;
		tier: string;
		role: string;
		signatureMechanic: string | null;
		variants: Variant[];
	};

	type Family = {
		familyId: string;
		displayName: string;
		escalationAxis: string;
		forms: Form[];
	};

	let { families }: { families: readonly Family[] } = $props();

	const formCount = $derived(families.reduce((total, family) => total + family.forms.length, 0));
	const coordinateCount = $derived(formCount * 5);
	const normalVariant = (form: Form) =>
		form.variants.find((variant) => variant.affinity === 'normal');
	const gallery = $derived<MonsterArtworkImage[]>(
		families.flatMap((family) =>
			family.forms.flatMap((form) => {
				const variant = normalVariant(form);
				return variant
					? [
							{
								src: variant.thumbnailPath,
								sourcePath: variant.sourcePath,
								alt: `${form.name}, Normal affinity`
							}
						]
					: [];
			})
		)
	);
	const roleName = (role: string) => role.replace(/\s+\([^)]*\)$/u, '');
	const mechanicName = (mechanic: string | null) => mechanic?.split(':', 1)[0]?.trim() ?? null;
</script>

<section class="database" aria-labelledby="monster-database-heading">
	<header class="database-heading">
		<div>
			<p>{families.length} families · {formCount} forms · {coordinateCount} images</p>
			<h1 id="monster-database-heading">Monster bestiary</h1>
			<span
				>Scan each family from T1 to T5. Select an image to zoom, or open a name for combat detail.</span
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
				<span class="escalation">{family.escalationAxis}</span>
			</header>
			<div class="monster-grid">
				{#each family.forms as form (form.id)}
					{@const normal = normalVariant(form)}
					<article class="monster-card">
						{#if normal}
							<MonsterArtwork
								{gallery}
								src={normal.thumbnailPath}
								sourcePath={normal.sourcePath}
								alt={`${form.name}, Normal affinity`}
								width={normal.width}
								height={normal.height}
								loading="lazy"
							/>
						{/if}
						<a class="card-copy" href={resolve(`/wiki/creatures/monsters/${form.id}`)}>
							<span>{form.tier}</span>
							<strong>{form.name}</strong>
							<small>{roleName(form.role)}</small>
							{#if mechanicName(form.signatureMechanic)}
								<em>{mechanicName(form.signatureMechanic)}</em>
							{/if}
						</a>
					</article>
				{/each}
			</div>
		</section>
	{/each}

	<footer class="reference-links">
		<a href={resolve('/wiki/creatures/monster-races')}>Monster Races</a>
		<a href={resolve('/wiki/creatures/monster-races#creature-taxonomy')}>Creature taxonomy</a>
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
	.escalation {
		display: -webkit-box;
		max-width: 70rem;
		margin-top: 0.55rem;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		color: rgba(243, 234, 217, 0.54);
		font:
			0.86rem/1.45 Georgia,
			serif;
	}
	.monster-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.7rem;
	}
	.monster-card {
		display: grid;
		grid-template-rows: auto 1fr;
		min-width: 0;
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
	.card-copy {
		color: inherit;
		text-decoration: none;
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: start;
		padding: 0.65rem 0.7rem 0.8rem;
	}
	.card-copy span {
		color: #70c7d2;
		font:
			0.56rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
	}
	.card-copy strong {
		margin-top: 0.2rem;
		overflow: hidden;
		font:
			400 clamp(0.9rem, 1.5vw, 1.2rem) Georgia,
			serif;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.card-copy small {
		margin-top: 0.45rem;
		color: rgba(243, 234, 217, 0.58);
		font:
			0.7rem/1.3 Georgia,
			serif;
	}
	.card-copy em {
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
