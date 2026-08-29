<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ENEMY_ARCHETYPES,
		ENEMY_REVIEW_FAMILIES,
		ENEMY_REVIEW_ROSTER_VERSION,
		TOWER_PROGRESSION_PREVIEW,
		TOWER_PROGRESSION_PREVIEW_VERSION,
		type EnemyArchetypeId
	} from '@summonlab/content';
	import beasts from '../../../../../../assets/enemies/review/beasts-v1.webp';
	import constructs from '../../../../../../assets/enemies/review/constructs-v1.webp';
	import goblinoids from '../../../../../../assets/enemies/review/goblinoids-v1.webp';
	import largeThreats from '../../../../../../assets/enemies/review/large-threats-v1.webp';

	const plates: Record<string, string> = {
		'goblinoids-v1': goblinoids,
		'beasts-v1': beasts,
		'constructs-v1': constructs,
		'large-threats-v1': largeThreats
	};
	const enemyById = new Map(ENEMY_ARCHETYPES.map((enemy) => [enemy.id, enemy]));
	const enemy = (id: EnemyArchetypeId) => enemyById.get(id)!;
	const bands = [1, 2, 3, 4].map((band) => ({
		band,
		floors: TOWER_PROGRESSION_PREVIEW.filter((floor) => floor.band === band)
	}));
</script>

<svelte:head>
	<title>Enemy roster · Summoning Forge</title>
	<meta
		name="description"
		content="Review sixteen realistic enemy archetypes and the first twenty floors of tower pressure."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Forge component</span><strong>Enemy & progression lab</strong></div>
		<nav>
			<a href={resolve('/forge/enemies/pack-2')}>Pack 2 monsters</a>
			<a href={resolve('/forge')}>Hero summons</a><a href={resolve('/forge/contact-sheet')}
				>Seed audit</a
			>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">{ENEMY_REVIEW_ROSTER_VERSION} · 16 archetypes</p>
			<h1>Recognize the threat<br /><em>before it moves.</em></h1>
		</div>
		<div>
			<p>
				These are realistic family plates for art-direction review. Each enemy has one battlefield
				job and trains a different player response; stronger floors combine pressures instead of
				only inflating health.
			</p>
			<span>Review candidates · not final individual combat rigs</span>
		</div>
	</section>

	<section class="families" aria-labelledby="families-heading">
		<div class="section-heading">
			<div>
				<span>01</span>
				<h2 id="families-heading">Four visual families</h2>
			</div>
			<p>Judge anatomy, material realism, silhouette separation, and shared world language.</p>
		</div>
		{#each ENEMY_REVIEW_FAMILIES as family (family.id)}
			<article class="family" data-testid="enemy-family">
				<div class="plate">
					<img src={plates[family.plate]} alt={`${family.name}: four realistic enemy concepts`} />
					<div class="plate-number">
						{String(ENEMY_REVIEW_FAMILIES.indexOf(family) + 1).padStart(2, '0')}
					</div>
				</div>
				<header>
					<p class="eyebrow">Family plate</p>
					<h3>{family.name}</h3>
				</header>
				<div class="enemy-labels">
					{#each family.enemyIds as enemyId (enemyId)}
						{@const entry = enemy(enemyId)}
						<div>
							<span>Debut · Floor {String(entry.debutFloor).padStart(2, '0')}</span>
							<strong>{entry.name}</strong>
							<p>{entry.role}</p>
							<small>{entry.skills.join(' · ')}</small>
						</div>
					{/each}
				</div>
			</article>
		{/each}
	</section>

	<section class="progression" aria-labelledby="progression-heading">
		<div class="section-heading">
			<div>
				<span>02</span>
				<h2 id="progression-heading">First 20 floors</h2>
			</div>
			<p>
				{TOWER_PROGRESSION_PREVIEW_VERSION} · level, skill test, and new pressure on every floor.
			</p>
		</div>
		<div class="curve-note">
			<div><strong>1–20</strong><span>Introduce the combat language</span></div>
			<div><strong>21–50</strong><span>Combine roles and promotion checks</span></div>
			<div><strong>51–80</strong><span>Counter mastered habits</span></div>
			<div><strong>81–100</strong><span>Demand level 70 mastery</span></div>
		</div>
		<div class="bands">
			{#each bands as band (band.band)}
				<article>
					<header>
						<span>Band {String(band.band).padStart(2, '0')}</span><strong
							>Floors {band.floors[0]?.floor}–{band.floors.at(-1)?.floor}</strong
						>
					</header>
					{#each band.floors as floor (floor.floor)}
						<div class:threshold={floor.threshold} class="floor" data-testid="progression-floor">
							<div class="floor-number">
								<span>F</span><strong>{String(floor.floor).padStart(2, '0')}</strong>
							</div>
							<div class="floor-threats">
								<strong>{floor.enemyIds.map((id) => enemy(id).name).join(' + ')}</strong>
								<span>{floor.newPressure}</span>
							</div>
							<div class="floor-skills">
								<span>Exercises</span><strong>{floor.skillTest}</strong>
							</div>
							<div class="floor-level">
								<span>Level</span><strong
									>{floor.recommendedLevels[0]}–{floor.recommendedLevels[1]}</strong
								>
							</div>
						</div>
					{/each}
				</article>
			{/each}
		</div>
		<footer>
			<p>
				The full 100-floor target follows a 0.7-level-per-floor curve: approximately level 7 at
				Floor 10, 35 at Floor 50, and 70 at Floor 100. Every fifth floor is a threshold; every tenth
				is a boss and promotion-readiness check.
			</p>
			<a href={resolve('/forge')}>Return to hero summons <span>→</span></a>
		</footer>
	</section>
</main>

<style>
	:global(body) {
		background: #07090d;
	}
	main {
		min-height: 100vh;
		color: #f4efe5;
		background:
			radial-gradient(circle at 50% 18rem, rgba(91, 72, 147, 0.14), transparent 34rem),
			linear-gradient(#080a0f, #0b0d12 65%, #07080b);
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
		background: rgba(6, 8, 12, 0.82);
	}
	.wordmark {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.23em;
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
		color: #d2a04d;
		font-size: 0.48rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.topbar > div strong {
		margin-top: 0.2rem;
		font:
			400 1rem Georgia,
			serif;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1.2rem;
		color: rgba(244, 239, 229, 0.5);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.intro,
	.families,
	.progression {
		max-width: 96rem;
		margin-inline: auto;
	}
	.intro {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		align-items: end;
		gap: 5rem;
		padding: clamp(4rem, 8vw, 8rem) clamp(1.2rem, 4vw, 4rem) 4rem;
	}
	.eyebrow {
		margin: 0 0 0.7rem;
		color: #d2a04d;
		font-size: 0.56rem;
		font-weight: 750;
		letter-spacing: 0.17em;
		text-transform: uppercase;
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
			400 clamp(3.6rem, 7vw, 7.2rem)/0.9 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	h1 em {
		color: #d9b875;
		font-weight: 400;
	}
	.intro > div:last-child p {
		color: rgba(244, 239, 229, 0.62);
		line-height: 1.75;
	}
	.intro > div:last-child span {
		color: #76d2e3;
		font-size: 0.55rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
	.families,
	.progression {
		padding: 0 clamp(1.2rem, 4vw, 4rem) 5rem;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.2rem;
	}
	.section-heading > div {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}
	.section-heading > div > span {
		color: #d2a04d;
		font:
			0.72rem ui-monospace,
			monospace;
	}
	.section-heading h2 {
		margin: 0;
		font:
			400 clamp(1.8rem, 3vw, 3rem) Georgia,
			serif;
	}
	.section-heading > p {
		max-width: 31rem;
		margin-bottom: 0.2rem;
		color: rgba(244, 239, 229, 0.42);
		font-size: 0.68rem;
		text-align: right;
	}
	.family {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 15rem;
		margin-bottom: 1.4rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: #0b0d12;
	}
	.plate {
		position: relative;
		grid-row: 1/3;
		min-width: 0;
		overflow: hidden;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}
	.plate img {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 31rem;
		object-fit: cover;
	}
	.plate-number {
		position: absolute;
		top: 1rem;
		left: 1rem;
		padding: 0.45rem 0.55rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		background: rgba(4, 5, 8, 0.66);
		color: #d2a04d;
		font:
			0.55rem ui-monospace,
			monospace;
	}
	.family > header {
		padding: 1.4rem;
	}
	.family > header h3 {
		margin: 0;
		font:
			400 1.7rem Georgia,
			serif;
	}
	.enemy-labels {
		display: grid;
		align-self: end;
	}
	.enemy-labels > div {
		padding: 0.9rem 1.2rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}
	.enemy-labels span,
	.enemy-labels strong,
	.enemy-labels small {
		display: block;
	}
	.enemy-labels span {
		color: #d2a04d;
		font-size: 0.45rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.enemy-labels strong {
		margin-top: 0.25rem;
		font-size: 0.73rem;
	}
	.enemy-labels p {
		margin: 0.2rem 0;
		color: rgba(244, 239, 229, 0.45);
		font-size: 0.55rem;
	}
	.enemy-labels small {
		color: #76d2e3;
		font-size: 0.45rem;
		line-height: 1.4;
	}
	.progression {
		padding-top: 5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.curve-note {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin-bottom: 1.2rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.curve-note div {
		padding: 1rem;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}
	.curve-note div:last-child {
		border: 0;
	}
	.curve-note strong,
	.curve-note span {
		display: block;
	}
	.curve-note strong {
		color: #d9b875;
		font:
			400 1.4rem Georgia,
			serif;
	}
	.curve-note span {
		margin-top: 0.3rem;
		color: rgba(244, 239, 229, 0.4);
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.bands {
		display: grid;
		gap: 1rem;
	}
	.bands > article {
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(10, 12, 18, 0.84);
	}
	.bands > article > header {
		display: flex;
		justify-content: space-between;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		color: #d2a04d;
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.floor {
		display: grid;
		grid-template-columns: 4rem minmax(12rem, 1fr) minmax(12rem, 1fr) 5rem;
		align-items: center;
		min-height: 4.6rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.floor:last-child {
		border: 0;
	}
	.floor.threshold {
		background: linear-gradient(90deg, rgba(210, 160, 77, 0.11), transparent 60%);
		box-shadow: inset 0.15rem 0 #d2a04d;
	}
	.floor > div {
		min-width: 0;
		padding: 0.75rem 1rem;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
	}
	.floor > div:last-child {
		border: 0;
	}
	.floor-number span,
	.floor-number strong {
		display: block;
	}
	.floor-number span,
	.floor-threats span,
	.floor-skills span,
	.floor-level span {
		color: rgba(244, 239, 229, 0.3);
		font-size: 0.43rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.floor-number strong {
		color: #d9b875;
		font:
			400 1.3rem Georgia,
			serif;
	}
	.floor-threats strong,
	.floor-threats span,
	.floor-skills strong,
	.floor-skills span,
	.floor-level strong,
	.floor-level span {
		display: block;
	}
	.floor-threats strong,
	.floor-skills strong {
		overflow: hidden;
		font-size: 0.62rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.floor-threats span {
		margin-top: 0.28rem;
		color: #76d2e3;
	}
	.floor-skills strong {
		margin-top: 0.28rem;
		color: rgba(244, 239, 229, 0.6);
	}
	.floor-level {
		text-align: center;
	}
	.floor-level strong {
		margin-top: 0.25rem;
		color: #d9b875;
		font-size: 0.72rem;
	}
	.progression footer {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: 3rem;
		margin-top: 1.5rem;
	}
	.progression footer p {
		max-width: 48rem;
		margin: 0;
		color: rgba(244, 239, 229, 0.46);
		font-size: 0.65rem;
		line-height: 1.7;
	}
	.progression footer a {
		color: #76d2e3;
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	@media (max-width: 900px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.intro {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
		.family {
			grid-template-columns: 1fr;
		}
		.plate {
			grid-row: auto;
			border-right: 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}
		.plate img {
			min-height: 0;
		}
		.enemy-labels {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.floor {
			grid-template-columns: 3.5rem 1fr 5rem;
		}
		.floor-skills {
			grid-column: 2/4;
			border-top: 1px solid rgba(255, 255, 255, 0.05);
		}
		.curve-note {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.progression footer {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.topbar nav {
			gap: 0.7rem;
			font-size: 0.46rem;
		}
		h1 {
			font-size: 3.2rem;
		}
		.section-heading {
			display: block;
		}
		.section-heading > p {
			margin-top: 0.7rem;
			text-align: left;
		}
		.enemy-labels {
			grid-template-columns: 1fr;
		}
		.curve-note {
			grid-template-columns: 1fr;
		}
	}
</style>
