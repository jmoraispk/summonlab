<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		PACK_TWO_MONSTER_ARCHETYPES,
		PACK_TWO_MONSTER_FAMILIES,
		PACK_TWO_MONSTER_ROSTER_VERSION,
		type PackTwoMonsterId
	} from '@summonlab/content';
	import arachnids from '../../../../../../../assets/enemies/review/pack-2/arachnids-v1.png';
	import arcaneHostiles from '../../../../../../../assets/enemies/review/pack-2/arcane-hostiles-v1.png';
	import draconic from '../../../../../../../assets/enemies/review/pack-2/draconic-v1.png';
	import dungeonPredators from '../../../../../../../assets/enemies/review/pack-2/dungeon-predators-v1.png';
	import elementals from '../../../../../../../assets/enemies/review/pack-2/elementals-v1.png';
	import undead from '../../../../../../../assets/enemies/review/pack-2/undead-v1.png';

	const plates: Record<string, string> = {
		'elementals-v1': elementals,
		'arachnids-v1': arachnids,
		'arcane-hostiles-v1': arcaneHostiles,
		'undead-v1': undead,
		'draconic-v1': draconic,
		'dungeon-predators-v1': dungeonPredators
	};
	const monsterById = new Map(PACK_TWO_MONSTER_ARCHETYPES.map((monster) => [monster.id, monster]));
	const monster = (id: PackTwoMonsterId) => monsterById.get(id)!;
</script>

<svelte:head>
	<title>Pack 2 monsters · Summoning Forge</title>
	<meta
		name="description"
		content="Review 24 Character Pack 2 monster archetypes by family, silhouette, battlefield duty, telegraph, and weak point."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Creature Forge</span><strong>Pack 2 threat language</strong></div>
		<nav>
			<a href={resolve('/forge/enemies')}>Pack 1 monsters</a>
			<a href={resolve('/forge/pack-2')}>Pack 2 humans</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{PACK_TWO_MONSTER_ROSTER_VERSION} · 24 canonical archetypes</p>
			<h1>Read the duty.<br /><em>Then survive it.</em></h1>
		</div>
		<div class="intro-copy">
			<p>
				Monster variation lives between species, duties, ranks, ages, and subtypes—not through the
				human body randomizer. These six plates are taxonomy candidates; production anchors follow
				only after human approval.
			</p>
			<div>
				<span><b>6</b> families</span><span><b>24</b> duties</span><span><b>0</b> approved</span>
			</div>
		</div>
	</section>

	<section class="families" aria-labelledby="families-title">
		<header class="section-heading">
			<div>
				<span>01</span>
				<h2 id="families-title">Battlefield taxonomy</h2>
			</div>
			<p>Each lineup runs left to right in the same order as its duty cards.</p>
		</header>

		{#each PACK_TWO_MONSTER_FAMILIES as family, familyIndex (family.id)}
			<article class="family" data-testid="pack-two-monster-family">
				<header>
					<div>
						<span>{String(familyIndex + 1).padStart(2, '0')}</span>
						<h3>{family.name}</h3>
					</div>
					<strong>Candidate · human review required</strong>
				</header>
				<img src={plates[family.plate]} alt={`${family.name}: four battlefield-duty concepts`} />
				<div class="duties">
					{#each family.monsterIds as monsterId (monsterId)}
						{@const entry = monster(monsterId)}
						<div data-testid="pack-two-monster-duty">
							<span>{entry.sizeBand} · {entry.duty}</span>
							<h4>{entry.name}</h4>
							<p>{entry.dutyCue}</p>
							<dl>
								<div>
									<dt>Tell</dt>
									<dd>{entry.telegraph}</dd>
								</div>
								<div>
									<dt>Counter</dt>
									<dd>{entry.weakPoint}</dd>
								</div>
							</dl>
						</div>
					{/each}
				</div>
			</article>
		{/each}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #07090d;
	}
	main {
		min-height: 100vh;
		color: #f4efe5;
		background:
			radial-gradient(circle at 50% 18rem, #9b683317, transparent 36rem),
			linear-gradient(#080a0f, #0b0d12);
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		min-height: 5rem;
		padding: 0 clamp(1rem, 3vw, 3rem);
		border-bottom: 1px solid #ffffff14;
		background: #06080cd9;
	}
	.wordmark,
	.eyebrow {
		font-size: 0.63rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.topbar > div {
		text-align: center;
	}
	.topbar > div span,
	.topbar > div strong {
		display: block;
	}
	.topbar > div span {
		color: #d7a85f;
		font-size: 0.5rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1.2rem;
		color: #f4efe580;
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	.intro,
	.families {
		max-width: 96rem;
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 5rem) clamp(1rem, 3vw, 3rem);
	}
	.intro {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 4rem;
		align-items: end;
	}
	.eyebrow {
		color: #d7a85f;
	}
	h1 {
		margin: 0.8rem 0 0;
		font:
			400 clamp(3.4rem, 8vw, 7.5rem)/0.82 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	h1 em {
		color: #d7a85f;
		font-weight: 400;
	}
	.intro-copy > p {
		color: #f4efe5a6;
		line-height: 1.7;
	}
	.intro-copy > div {
		display: flex;
		gap: 1.5rem;
		margin-top: 2rem;
	}
	.intro-copy span {
		color: #f4efe56b;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.intro-copy b {
		display: block;
		color: #f4efe5;
		font:
			400 1.8rem Georgia,
			serif;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 2rem;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #ffffff17;
	}
	.section-heading > div {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}
	.section-heading > div > span {
		color: #d7a85f;
		font-size: 0.65rem;
	}
	h2 {
		margin: 0;
		font:
			400 clamp(2rem, 4vw, 3.5rem) Georgia,
			serif;
	}
	.section-heading > p {
		color: #f4efe575;
		font-size: 0.7rem;
	}
	.family {
		margin: 0 0 5rem;
		border: 1px solid #ffffff16;
		background: #090c12;
	}
	.family > header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.2rem;
	}
	.family > header div {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}
	.family > header span {
		color: #d7a85f;
		font-size: 0.6rem;
	}
	.family > header h3 {
		margin: 0;
		font:
			400 2rem Georgia,
			serif;
	}
	.family > header > strong {
		color: #edc980;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.family > img {
		display: block;
		width: 100%;
		border-block: 1px solid #ffffff16;
	}
	.duties {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
	}
	.duties > div {
		padding: 1.2rem;
		border-right: 1px solid #ffffff12;
	}
	.duties > div:last-child {
		border: 0;
	}
	.duties span {
		color: #d7a85f;
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	h4 {
		margin: 0.35rem 0 0.7rem;
		font:
			400 1.25rem Georgia,
			serif;
	}
	.duties p {
		min-height: 3.6rem;
		color: #f4efe58c;
		font-size: 0.68rem;
		line-height: 1.5;
	}
	dl {
		display: grid;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}
	dl div {
		padding-top: 0.6rem;
		border-top: 1px solid #ffffff10;
	}
	dt {
		color: #f4efe550;
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	dd {
		margin: 0.25rem 0 0;
		color: #f4efe5b0;
		font-size: 0.62rem;
		line-height: 1.4;
	}
	@media (max-width: 850px) {
		.intro {
			grid-template-columns: 1fr;
		}
		.duties {
			grid-template-columns: repeat(2, 1fr);
		}
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.family > header,
		.section-heading {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
