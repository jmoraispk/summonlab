<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';

	type Variant = {
		affinity: string;
		status: string;
		thumbnailPath: string;
	};

	type Monster = {
		id: string;
		name: string;
		familyId: string;
		familyName: string;
		role: string;
		variants: Variant[];
	};

	let { monsters }: { monsters: readonly Monster[] } = $props();

	const families = $derived.by(() => {
		const grouped = new SvelteMap<string, { id: string; name: string; monsters: Monster[] }>();
		for (const monster of monsters) {
			const family = grouped.get(monster.familyId) ?? {
				id: monster.familyId,
				name: monster.familyName,
				monsters: []
			};
			family.monsters.push(monster);
			grouped.set(monster.familyId, family);
		}
		return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name));
	});
</script>

<section class="database" aria-labelledby="monster-database-heading">
	<header>
		<div>
			<p>Summonlab bestiary · 40 identities · 240 visual candidates</p>
			<h1 id="monster-database-heading">Monster database</h1>
			<span>
				Every monster identity anchors five affinity variants. Open an identity to compare the
				complete set and inspect its current combat language.
			</span>
		</div>
		<nav aria-label="Monster families">
			{#each families as family (family.id)}
				<a href={`#database-${family.id}`}>{family.name}<i>{family.monsters.length}</i></a>
			{/each}
		</nav>
	</header>

	{#each families as family (family.id)}
		<section class="family" id={`database-${family.id}`}>
			<header>
				<h2>{family.name}</h2>
				<span>{family.monsters.length} known classes</span>
			</header>
			<div class="monster-grid">
				{#each family.monsters as monster (monster.id)}
					{@const base = monster.variants[0]}
					<a class="monster-card" href={resolve(`/wiki/creatures/monsters/${monster.id}`)}>
						<img
							src={base?.thumbnailPath ?? ''}
							alt={`${monster.name} visual candidate`}
							width="720"
							height="480"
							loading="lazy"
						/>
						<div class="affinity-pips" aria-label="Five affinity variants available">
							{#each monster.variants.slice(1) as variant (variant.affinity)}
								<i class={`affinity-${variant.affinity}`}></i>
							{/each}
						</div>
						<span>{monster.familyName}</span>
						<strong>{monster.name}</strong>
						<small>{monster.role}</small>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</section>

<style>
	.database {
		--line: rgba(225, 211, 184, 0.15);
		padding: clamp(3rem, 6vw, 6rem);
		background:
			radial-gradient(circle at 82% 3%, rgba(49, 147, 163, 0.13), transparent 25rem),
			linear-gradient(180deg, #090d12, #090805);
	}
	.database > header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.58fr);
		gap: clamp(2rem, 6vw, 7rem);
		align-items: end;
		max-width: 92rem;
		margin: 0 auto 5rem;
	}
	p {
		margin: 0 0 0.8rem;
		color: #70c7d2;
		font:
			0.68rem ui-monospace,
			monospace;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font:
			400 clamp(3.5rem, 8vw, 7.4rem) / 0.84 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	.database > header div > span {
		display: block;
		max-width: 45rem;
		margin-top: 1.7rem;
		color: rgba(243, 234, 217, 0.66);
		font:
			1.08rem/1.65 Georgia,
			serif;
	}
	nav {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		border: 1px solid var(--line);
		background: var(--line);
	}
	nav a {
		display: flex;
		justify-content: space-between;
		gap: 0.7rem;
		padding: 0.7rem;
		background: rgba(8, 12, 16, 0.96);
		color: rgba(243, 234, 217, 0.72);
		font:
			0.63rem ui-monospace,
			monospace;
		letter-spacing: 0.07em;
		text-decoration: none;
		text-transform: uppercase;
	}
	nav i {
		color: #70c7d2;
		font-style: normal;
	}
	.family {
		max-width: 92rem;
		margin: 0 auto 5rem;
		scroll-margin-top: 6rem;
	}
	.family > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		padding-bottom: 0.8rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0;
		font:
			400 clamp(1.9rem, 3vw, 3rem) Georgia,
			serif;
		letter-spacing: -0.035em;
	}
	.family > header span {
		color: rgba(243, 234, 217, 0.42);
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.monster-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.7rem;
	}
	.monster-card {
		position: relative;
		display: grid;
		min-width: 0;
		padding-bottom: 1rem;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 0.35rem;
		background: #080b0f;
		color: #f3ead9;
		text-decoration: none;
		transition:
			transform 180ms ease,
			border-color 180ms ease;
	}
	.monster-card:hover {
		transform: translateY(-3px);
		border-color: rgba(112, 199, 210, 0.5);
	}
	.monster-card img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		filter: saturate(0.78);
	}
	.monster-card > span,
	.monster-card > strong,
	.monster-card > small {
		margin-inline: 0.9rem;
	}
	.monster-card > span {
		margin-top: 0.8rem;
		color: #70c7d2;
		font:
			0.55rem ui-monospace,
			monospace;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
	.monster-card > strong {
		margin-top: 0.25rem;
		font:
			400 1.22rem Georgia,
			serif;
	}
	.monster-card > small {
		margin-top: 0.35rem;
		overflow: hidden;
		color: rgba(243, 234, 217, 0.5);
		font:
			0.72rem/1.35 Georgia,
			serif;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.affinity-pips {
		position: absolute;
		top: 0.65rem;
		right: 0.65rem;
		display: flex;
		gap: 0.22rem;
		padding: 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 2rem;
		background: rgba(4, 6, 8, 0.78);
		backdrop-filter: blur(10px);
	}
	.affinity-pips i {
		width: 0.42rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--affinity);
	}
	.affinity-wood {
		--affinity: #87a85c;
	}
	.affinity-fire {
		--affinity: #e26f3d;
	}
	.affinity-metal {
		--affinity: #c0b07e;
	}
	.affinity-water {
		--affinity: #4fa8cf;
	}
	.affinity-wind {
		--affinity: #c7e8ec;
	}
	@media (max-width: 74rem) {
		.monster-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 54rem) {
		.database {
			padding-inline: 1rem;
		}
		.database > header {
			grid-template-columns: 1fr;
			margin-bottom: 3rem;
		}
		.monster-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 34rem) {
		h1 {
			font-size: 3.2rem;
		}
		nav {
			grid-template-columns: 1fr;
		}
		.monster-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
