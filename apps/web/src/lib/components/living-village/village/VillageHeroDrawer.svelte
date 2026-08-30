<script lang="ts">
	import type { VillageHero, VillageHeroRuntime } from './types';

	let {
		hero,
		runtime,
		onClose
	}: {
		hero: VillageHero;
		runtime: VillageHeroRuntime;
		onClose: () => void;
	} = $props();
</script>

<aside class="drawer" aria-labelledby="hero-drawer-heading" data-testid="hero-drawer">
	<header>
		<div>
			<p>Resident record · Level {hero.level}</p>
			<h2 id="hero-drawer-heading">{hero.name}</h2>
		</div>
		<button type="button" aria-label="Close hero details" onclick={onClose}>×</button>
	</header>

	<div class="identity">
		<img src={hero.portrait} alt={hero.portraitAlt} width="1024" height="1536" />
		<div>
			<span>Current activity</span>
			<strong>{runtime.activity}</strong>
			<small>{hero.partyStatus}</small>
			{#if runtime.order}<em>{runtime.order}</em>{/if}
		</div>
	</div>

	<section aria-labelledby="attributes-heading">
		<h3 id="attributes-heading">Attributes</h3>
		<div class="attributes">
			{#each hero.attributes as attribute (attribute.label)}
				<div><span>{attribute.label}</span><strong>{attribute.value}</strong></div>
			{/each}
		</div>
	</section>

	<section aria-labelledby="skills-heading">
		<h3 id="skills-heading">Skills</h3>
		<ul>
			{#each hero.skills as skill (skill)}<li>{skill}</li>{/each}
		</ul>
	</section>

	<section aria-labelledby="equipment-heading">
		<h3 id="equipment-heading">Equipment</h3>
		<ul>
			{#each hero.equipment as item (item)}<li>{item}</li>{/each}
		</ul>
	</section>
</aside>

<style>
	.drawer {
		min-width: 0;
		padding: 1.15rem;
		border: 1px solid rgba(228, 203, 157, 0.2);
		background: linear-gradient(180deg, rgba(30, 29, 29, 0.98), rgba(12, 15, 19, 0.99)), #11151a;
		box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.35);
	}

	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
	}

	header p,
	h3,
	.identity span {
		margin: 0;
		color: #dba666;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h2 {
		margin: 0.25rem 0 0;
		font:
			400 2rem/1 Georgia,
			serif;
	}

	header button {
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid rgba(238, 224, 198, 0.25);
		background: rgba(255, 255, 255, 0.04);
		color: #f5ecdd;
		cursor: pointer;
		font-size: 1.4rem;
	}

	.identity {
		display: grid;
		grid-template-columns: 5.2rem 1fr;
		gap: 0.85rem;
		margin-top: 1rem;
		padding: 0.7rem;
		background: rgba(255, 255, 255, 0.035);
	}

	.identity img {
		width: 5.2rem;
		height: 6.5rem;
		object-fit: cover;
		object-position: 50% 18%;
	}

	.identity > div {
		display: grid;
		align-content: center;
		gap: 0.35rem;
		min-width: 0;
	}

	.identity strong {
		font:
			400 1rem/1.25 Georgia,
			serif;
	}

	.identity small {
		color: #82cdd0;
		font-size: 0.72rem;
	}

	.identity em {
		color: rgba(245, 236, 221, 0.54);
		font-size: 0.68rem;
		font-style: normal;
	}

	section {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(238, 224, 198, 0.1);
	}

	.attributes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
		margin-top: 0.55rem;
	}

	.attributes div {
		padding: 0.55rem;
		background: rgba(255, 255, 255, 0.035);
	}

	.attributes span,
	.attributes strong {
		display: block;
	}

	.attributes span {
		color: rgba(245, 236, 221, 0.46);
		font-size: 0.58rem;
	}

	.attributes strong {
		margin-top: 0.2rem;
		font:
			400 1.1rem Georgia,
			serif;
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0.55rem 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		padding: 0.42rem 0.5rem;
		border: 1px solid rgba(238, 224, 198, 0.12);
		color: rgba(245, 236, 221, 0.72);
		font-size: 0.68rem;
	}
</style>
