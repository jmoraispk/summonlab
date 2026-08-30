<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ENEMY_AFFINITY_ARCHETYPE_LINKS,
		ENEMY_AFFINITY_FAMILY_PILOTS,
		ENEMY_ARCHETYPES,
		ENEMY_REVIEW_FAMILIES,
		PACK_TWO_MONSTER_ARCHETYPES,
		PACK_TWO_MONSTER_FAMILIES
	} from '@summonlab/content';
	import beasts from '../../../../../../../assets/enemies/review/beasts-v1.webp';
	import constructs from '../../../../../../../assets/enemies/review/constructs-v1.webp';
	import goblinoids from '../../../../../../../assets/enemies/review/goblinoids-v1.webp';
	import largeThreats from '../../../../../../../assets/enemies/review/large-threats-v1.webp';
	import arachnids from '../../../../../../../assets/enemies/review/pack-2/arachnids-v1.png';
	import arcaneHostiles from '../../../../../../../assets/enemies/review/pack-2/arcane-hostiles-v1.png';
	import draconic from '../../../../../../../assets/enemies/review/pack-2/draconic-v1.png';
	import dungeonPredators from '../../../../../../../assets/enemies/review/pack-2/dungeon-predators-v1.png';
	import elementals from '../../../../../../../assets/enemies/review/pack-2/elementals-v1.png';
	import monsterGrades from '../../../../../../../assets/enemies/review/pack-2/monster-grade-escalation-v1.png';
	import stoneBreaker from '../../../../../../../assets/enemies/review/pack-2/benchmarks/stone-breaker-anchor-v1.png';
	import undead from '../../../../../../../assets/enemies/review/pack-2/undead-v1.png';

	type EnemyPack = 'pack-1' | 'pack-2';
	type PackFilter = 'all' | EnemyPack;

	interface FamilyPlate {
		id: string;
		name: string;
		category: string;
		pack: EnemyPack;
		packLabel: string;
		image: string;
		assetKey: string;
		affinityPilot: (typeof ENEMY_AFFINITY_FAMILY_PILOTS)[number] | null;
	}

	interface GalleryEnemy {
		id: string;
		name: string;
		familyId: string;
		familyName: string;
		category: string;
		pack: EnemyPack;
		packLabel: string;
		image: string;
		plateIndex: number;
		role: string;
		metricLabel: string;
		metricValue: string;
		tacticsLabel: string;
		tactics: string;
		counterLabel: string;
		counter: string;
		affinitySpeciesId: string | null;
	}

	const affinityPilotByFamily: ReadonlyMap<string, (typeof ENEMY_AFFINITY_FAMILY_PILOTS)[number]> =
		new Map(ENEMY_AFFINITY_FAMILY_PILOTS.map((pilot) => [pilot.familyId, pilot] as const));
	const affinitySpeciesByArchetype: ReadonlyMap<string, string> = new Map(
		ENEMY_AFFINITY_ARCHETYPE_LINKS.map(
			(link) => [link.archetypeId, link.affinitySpeciesId] as const
		)
	);

	const plateImages: Record<string, string> = {
		'goblinoids-v1': goblinoids,
		'beasts-v1': beasts,
		'constructs-v1': constructs,
		'large-threats-v1': largeThreats,
		'elementals-v1': elementals,
		'arcane-hostiles-v1': arcaneHostiles,
		'arachnids-v1': arachnids,
		'undead-v1': undead,
		'draconic-v1': draconic,
		'dungeon-predators-v1': dungeonPredators
	};

	const categoryByFamily: Record<string, string> = {
		goblinoids: 'Goblins',
		beasts: 'Animals',
		constructs: 'Constructs',
		'large-threats': 'Giants & brutes',
		elementals: 'Elementals',
		'arcane-hostiles': 'Mages',
		arachnids: 'Giant spiders',
		undead: 'Undead',
		draconic: 'Dragons',
		'dungeon-predators': 'Dungeon creatures'
	};

	const familyPlates: FamilyPlate[] = [
		...ENEMY_REVIEW_FAMILIES.map((family) => ({
			id: family.id,
			name: family.name,
			category: categoryByFamily[family.id]!,
			pack: 'pack-1' as const,
			packLabel: 'Pack 1',
			image: plateImages[family.plate]!,
			assetKey: family.plate,
			affinityPilot: affinityPilotByFamily.get(family.id) ?? null
		})),
		...PACK_TWO_MONSTER_FAMILIES.map((family) => ({
			id: family.id,
			name: family.name,
			category: categoryByFamily[family.id]!,
			pack: 'pack-2' as const,
			packLabel: 'Pack 2',
			image: plateImages[family.plate]!,
			assetKey: family.plate,
			affinityPilot: affinityPilotByFamily.get(family.id) ?? null
		}))
	];

	const familyById = new Map(familyPlates.map((family) => [family.id, family]));
	const packOneFamilyById = new Map(ENEMY_REVIEW_FAMILIES.map((family) => [family.id, family]));
	const packTwoFamilyById = new Map(PACK_TWO_MONSTER_FAMILIES.map((family) => [family.id, family]));

	const enemies: GalleryEnemy[] = [
		...ENEMY_ARCHETYPES.map((entry) => {
			const family = familyById.get(entry.family)!;
			const sourceFamily = packOneFamilyById.get(entry.family)!;
			const familyEnemyIds: readonly string[] = sourceFamily.enemyIds;
			return {
				id: entry.id,
				name: entry.name,
				familyId: family.id,
				familyName: family.name,
				category: family.category,
				pack: family.pack,
				packLabel: family.packLabel,
				image: family.image,
				plateIndex: familyEnemyIds.indexOf(entry.id),
				role: entry.role,
				metricLabel: 'Debut',
				metricValue: `Floor ${String(entry.debutFloor).padStart(2, '0')}`,
				tacticsLabel: 'Skills',
				tactics: entry.skills.join(' · '),
				counterLabel: 'Teaches',
				counter: entry.teaches.join(' · '),
				affinitySpeciesId: affinitySpeciesByArchetype.get(entry.id) ?? null
			};
		}),
		...PACK_TWO_MONSTER_ARCHETYPES.map((entry) => {
			const family = familyById.get(entry.family)!;
			const sourceFamily = packTwoFamilyById.get(entry.family)!;
			const familyMonsterIds: readonly string[] = sourceFamily.monsterIds;
			return {
				id: entry.id,
				name: entry.name,
				familyId: family.id,
				familyName: family.name,
				category: family.category,
				pack: family.pack,
				packLabel: family.packLabel,
				image: family.image,
				plateIndex: familyMonsterIds.indexOf(entry.id),
				role: entry.duty,
				metricLabel: 'Base size',
				metricValue: entry.sizeBand,
				tacticsLabel: 'Telegraph',
				tactics: entry.telegraph,
				counterLabel: 'Weak point',
				counter: entry.weakPoint,
				affinitySpeciesId: affinitySpeciesByArchetype.get(entry.id) ?? null
			};
		})
	];

	let packFilter = $state<PackFilter>('all');
	let familyFilter = $state('all');
	let query = $state('');

	const visibleFamilies = $derived(
		familyPlates.filter(
			(family) =>
				(packFilter === 'all' || family.pack === packFilter) &&
				(familyFilter === 'all' || family.id === familyFilter)
		)
	);
	const filteredEnemies = $derived(
		enemies.filter((enemy) => {
			const normalizedQuery = query.trim().toLocaleLowerCase();
			return (
				(packFilter === 'all' || enemy.pack === packFilter) &&
				(familyFilter === 'all' || enemy.familyId === familyFilter) &&
				(!normalizedQuery ||
					[enemy.name, enemy.familyName, enemy.category, enemy.role]
						.join(' ')
						.toLocaleLowerCase()
						.includes(normalizedQuery))
			);
		})
	);

	function selectPack(pack: PackFilter) {
		packFilter = pack;
		if (familyFilter !== 'all' && pack !== 'all' && familyById.get(familyFilter)?.pack !== pack) {
			familyFilter = 'all';
		}
	}
</script>

<svelte:head>
	<title>Complete enemy gallery · Summoning Forge</title>
	<meta
		name="description"
		content="Browse all 40 generated Summonlab enemies across goblins, animals, constructs, elementals, mages, spiders, undead, dragons, giants, and dungeon creatures."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Creature Forge</span><strong>Complete enemy archive</strong></div>
		<nav>
			<a href={resolve('/forge/enemies')}>Pack 1 details</a>
			<a href={resolve('/forge/enemies/pack-2')}>Pack 2 grades</a>
			<a href={resolve('/forge/pack-2/revision')}>Revision proofs</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">Enemy archive · Packs 1–2</p>
			<h1>Every threat.<br /><em>One field guide.</em></h1>
		</div>
		<div class="intro-copy">
			<p>
				All generated enemy artwork currently in the Forge: goblins, animals, constructs, giants,
				elementals, mages, spiders, undead, dragons, and dungeon creatures. Family plates remain
				approval candidates; the directory below identifies every possible archetype represented in
				them.
			</p>
			<div class="totals" aria-label="Enemy archive totals">
				<div>
					<strong data-testid="enemy-total">{enemies.length}</strong><span>Archetypes</span>
				</div>
				<div>
					<strong data-testid="family-total">{familyPlates.length}</strong><span>Families</span>
				</div>
				<div><strong data-testid="asset-total">12</strong><span>Generated images</span></div>
			</div>
		</div>
	</section>

	<section class="controls" aria-label="Enemy gallery filters">
		<div class="pack-tabs">
			{#each [{ value: 'all', label: 'All enemies', count: 40 }, { value: 'pack-1', label: 'Pack 1', count: 16 }, { value: 'pack-2', label: 'Pack 2', count: 24 }] as option (option.value)}
				<button
					type="button"
					class:active={packFilter === option.value}
					onclick={() => selectPack(option.value as PackFilter)}
				>
					{option.label}<span>{option.count}</span>
				</button>
			{/each}
		</div>
		<label>
			<span>Family</span>
			<select bind:value={familyFilter} aria-label="Enemy family">
				<option value="all">All ten families</option>
				{#each familyPlates.filter((family) => packFilter === 'all' || family.pack === packFilter) as family (family.id)}
					<option value={family.id}>{family.category} · {family.name}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Search</span>
			<input bind:value={query} type="search" placeholder="Name, family, or battlefield role" />
		</label>
		<p><strong data-testid="visible-enemy-count">{filteredEnemies.length}</strong> visible</p>
	</section>

	<section class="atlas" aria-labelledby="atlas-title">
		<header class="section-heading">
			<div>
				<span>01</span>
				<h2 id="atlas-title">Generated family plates</h2>
			</div>
			<p>
				{visibleFamilies.length} full, uncropped source plate{visibleFamilies.length === 1
					? ''
					: 's'}
			</p>
		</header>
		<div class="plate-grid">
			{#each visibleFamilies as family (family.id)}
				<article data-testid="all-enemy-family">
					<div class="plate-image">
						<img src={family.image} alt={`${family.name} full family plate`} />
					</div>
					<div class="plate-caption">
						<div>
							<span>{family.packLabel} · {family.category}</span>
							<h3>{family.name}</h3>
							{#if family.affinityPilot}
								<a
									class="affinity-link"
									data-testid="family-affinity-pilot"
									href="{resolve('/forge/enemies/affinity-workflow')}#affinity-{family.affinityPilot
										.affinitySpeciesId}">{family.affinityPilot.label} · six variants →</a
								>
							{/if}
						</div>
						<code>{family.assetKey}</code>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="directory" aria-labelledby="directory-title">
		<header class="section-heading">
			<div>
				<span>02</span>
				<h2 id="directory-title">Complete enemy directory</h2>
			</div>
			<p>Each crop points back to its full family plate above.</p>
		</header>
		{#if filteredEnemies.length}
			<div class="enemy-grid">
				{#each filteredEnemies as enemy (enemy.id)}
					<article data-testid="all-enemy-card">
						<div class="enemy-crop">
							<img
								src={enemy.image}
								alt={`${enemy.name}, cropped from the ${enemy.familyName} family plate`}
								style:transform={`translateX(-${enemy.plateIndex * 25}%)`}
								loading="lazy"
							/>
							<span>{enemy.packLabel}</span>
						</div>
						<header>
							<p>{enemy.category} · {enemy.familyName}</p>
							<h3>{enemy.name}</h3>
							<strong>{enemy.role}</strong>
						</header>
						<dl>
							<div>
								<dt>{enemy.metricLabel}</dt>
								<dd>{enemy.metricValue}</dd>
							</div>
							<div>
								<dt>{enemy.tacticsLabel}</dt>
								<dd>{enemy.tactics}</dd>
							</div>
							<div>
								<dt>{enemy.counterLabel}</dt>
								<dd>{enemy.counter}</dd>
							</div>
						</dl>
						{#if enemy.affinitySpeciesId}
							<a
								class="affinity-link enemy-affinity-link"
								data-testid="enemy-affinity-link"
								href="{resolve(
									'/forge/enemies/affinity-workflow'
								)}#affinity-{enemy.affinitySpeciesId}"
								>Explore Normal + five elemental affinities →</a
							>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<strong>No matching enemy.</strong>
				<p>Try a different family or clear the search.</p>
				<button
					type="button"
					onclick={() => {
						query = '';
						familyFilter = 'all';
						selectPack('all');
					}}>Clear filters</button
				>
			</div>
		{/if}
	</section>

	<section class="proofs" aria-labelledby="proofs-title">
		<header class="section-heading">
			<div>
				<span>03</span>
				<h2 id="proofs-title">Focused generated proofs</h2>
			</div>
			<p>Two additional enemy images beyond the ten family plates.</p>
		</header>
		<div class="proof-grid">
			<article data-testid="enemy-proof">
				<img src={stoneBreaker} alt="Individual Stone Breaker production anchor" loading="lazy" />
				<div>
					<span>Individual anchor · candidate</span>
					<h3>Stone Breaker</h3>
					<code>stone-breaker-anchor-v1</code>
				</div>
			</article>
			<article data-testid="enemy-proof">
				<img
					src={monsterGrades}
					alt="Death Knight and Tower Archmage grade escalation proof"
					loading="lazy"
				/>
				<div>
					<span>Grades 4 · 7 · 10</span>
					<h3>Monster escalation</h3>
					<code>monster-grade-escalation-v1</code>
				</div>
			</article>
		</div>
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
			radial-gradient(circle at 52% 16rem, rgba(124, 76, 35, 0.18), transparent 36rem),
			linear-gradient(#080a0f, #0b0d12 70%, #07080b);
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
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(6, 8, 12, 0.84);
	}
	.wordmark,
	.eyebrow {
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.2em;
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
		color: #d4a15b;
		font-size: 0.5rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1rem;
		color: rgba(244, 239, 229, 0.54);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.intro,
	.controls,
	.atlas,
	.directory,
	.proofs {
		max-width: 100rem;
		margin-inline: auto;
		padding-inline: clamp(1rem, 3vw, 3rem);
	}
	.intro {
		display: grid;
		grid-template-columns: 1.15fr 0.85fr;
		align-items: end;
		gap: clamp(2rem, 6vw, 6rem);
		padding-block: clamp(4rem, 8vw, 8rem) 4rem;
	}
	.eyebrow {
		margin: 0 0 0.8rem;
		color: #d4a15b;
	}
	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 0;
		font:
			400 clamp(3.4rem, 8vw, 7.8rem) / 0.86 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	h1 em {
		color: #d4a15b;
		font-weight: 400;
	}
	.intro-copy > p {
		color: rgba(244, 239, 229, 0.62);
		line-height: 1.72;
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		margin-top: 2rem;
		border-block: 1px solid rgba(255, 255, 255, 0.1);
	}
	.totals div {
		padding: 1rem 0;
	}
	.totals div + div {
		padding-left: 1rem;
		border-left: 1px solid rgba(255, 255, 255, 0.1);
	}
	.totals strong,
	.totals span {
		display: block;
	}
	.totals strong {
		font:
			400 2.1rem Georgia,
			serif;
	}
	.totals span {
		margin-top: 0.2rem;
		color: rgba(244, 239, 229, 0.42);
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.controls {
		display: grid;
		grid-template-columns: auto minmax(14rem, 1fr) minmax(14rem, 1fr) auto;
		align-items: end;
		gap: 0.8rem;
		padding-block: 1rem;
		border-block: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(7, 9, 13, 0.72);
	}
	.pack-tabs {
		display: flex;
		gap: 0.35rem;
	}
	button,
	select,
	input {
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 0;
		color: #f4efe5;
		background: #0a0d13;
	}
	button {
		padding: 0.72rem 0.85rem;
		cursor: pointer;
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	button span {
		margin-left: 0.5rem;
		color: rgba(244, 239, 229, 0.4);
	}
	button.active {
		border-color: #d4a15b;
		background: rgba(212, 161, 91, 0.12);
	}
	.controls label {
		display: grid;
		gap: 0.35rem;
	}
	.controls label > span,
	.controls > p {
		margin: 0;
		color: rgba(244, 239, 229, 0.44);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	select,
	input {
		box-sizing: border-box;
		width: 100%;
		min-height: 2.65rem;
		padding: 0.65rem 0.75rem;
	}
	.controls > p {
		min-width: 5rem;
		padding-bottom: 0.85rem;
		text-align: right;
	}
	.controls > p strong {
		color: #d4a15b;
		font-size: 0.8rem;
	}
	.atlas,
	.directory,
	.proofs {
		padding-block: clamp(3rem, 7vw, 7rem);
	}
	.directory,
	.proofs {
		border-top: 1px solid rgba(255, 255, 255, 0.09);
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 2rem;
	}
	.section-heading > div {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}
	.section-heading span {
		color: #d4a15b;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
	}
	h2 {
		margin-bottom: 0;
		font:
			400 clamp(2rem, 5vw, 4.5rem) Georgia,
			serif;
		letter-spacing: -0.035em;
	}
	.section-heading > p {
		margin-bottom: 0.45rem;
		color: rgba(244, 239, 229, 0.42);
		font-size: 0.7rem;
	}
	.plate-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.2rem;
	}
	.plate-grid article,
	.enemy-grid article,
	.proof-grid article {
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: #090c12;
	}
	.plate-image {
		aspect-ratio: 3 / 2;
		overflow: hidden;
		background: #050609;
	}
	.plate-image img,
	.proof-grid img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.plate-caption {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
	}
	.plate-caption span,
	.proof-grid span {
		color: #d4a15b;
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h3 {
		margin-bottom: 0;
		font:
			400 1.55rem Georgia,
			serif;
	}
	code {
		color: rgba(244, 239, 229, 0.34);
		font-size: 0.54rem;
	}
	.affinity-link {
		display: inline-flex;
		margin-top: 0.7rem;
		color: #76d2e3;
		font-size: 0.54rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		line-height: 1.45;
		text-transform: uppercase;
	}
	.affinity-link:hover,
	.affinity-link:focus-visible {
		color: #b7f2fc;
		text-decoration: underline;
		text-underline-offset: 0.25rem;
	}
	.enemy-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.enemy-crop {
		position: relative;
		aspect-ratio: 0.92;
		overflow: hidden;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		background: #050609;
	}
	.enemy-crop img {
		display: block;
		width: 400%;
		height: 100%;
		max-width: none;
		object-fit: cover;
		object-position: center;
	}
	.enemy-crop > span {
		position: absolute;
		top: 0.7rem;
		left: 0.7rem;
		padding: 0.3rem 0.45rem;
		color: #f4efe5;
		background: rgba(5, 6, 9, 0.78);
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.enemy-grid article > header {
		min-height: 8rem;
		padding: 1rem;
	}
	.enemy-grid article > header p {
		margin-bottom: 0.5rem;
		color: #d4a15b;
		font-size: 0.5rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.enemy-grid article > header strong {
		display: block;
		margin-top: 0.5rem;
		color: rgba(244, 239, 229, 0.55);
		font-size: 0.65rem;
		font-weight: 500;
		line-height: 1.45;
	}
	dl {
		margin: 0;
		padding: 0 1rem 1rem;
	}
	dl > div {
		padding-block: 0.65rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	dt {
		color: rgba(244, 239, 229, 0.35);
		font-size: 0.48rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	dd {
		margin: 0.25rem 0 0;
		color: rgba(244, 239, 229, 0.68);
		font-size: 0.62rem;
		line-height: 1.5;
		text-transform: capitalize;
	}
	.enemy-affinity-link {
		margin: 0 1rem 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(118, 210, 227, 0.22);
	}
	.proof-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.2rem;
	}
	.proof-grid article > img {
		aspect-ratio: 3 / 2;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.proof-grid article > div {
		padding: 1rem;
	}
	.proof-grid h3 {
		margin: 0.25rem 0 0.7rem;
	}
	.empty-state {
		padding: 5rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		text-align: center;
	}
	.empty-state p {
		color: rgba(244, 239, 229, 0.45);
	}
	@media (max-width: 1100px) {
		.controls {
			grid-template-columns: 1fr 1fr;
		}
		.controls > p {
			text-align: left;
		}
		.enemy-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 800px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.topbar nav {
			gap: 0.55rem;
		}
		.intro {
			grid-template-columns: 1fr;
		}
		.plate-grid,
		.proof-grid {
			grid-template-columns: 1fr;
		}
		.enemy-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 560px) {
		.topbar nav a:nth-child(3) {
			display: none;
		}
		.controls,
		.enemy-grid {
			grid-template-columns: 1fr;
		}
		.pack-tabs {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
		}
		.section-heading {
			display: block;
		}
		.section-heading > p {
			margin-top: 1rem;
		}
	}
</style>
