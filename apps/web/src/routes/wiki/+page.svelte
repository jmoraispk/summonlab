<script lang="ts">
	import { resolve } from '$app/paths';
	import hearthEnvironment from '../../../../../assets/settlements/hearth-01/hearth-01-environment-v1.png';
	import rosterHero from '../../../../../assets/heroes/approved/summonable-roster-v1/sources/aear-soro/summon.png';
	import goblinoids from '../../../../../assets/enemies/review/goblinoids-v1.webp';
	import elementals from '../../../../../assets/enemies/review/pack-2/elementals-v1.png';
</script>

<svelte:head>
	<title>Summonlab Wiki · The living archive</title>
</svelte:head>

<main>
	<section class="hero">
		<img
			src={hearthEnvironment}
			alt="The Hearth settlement encircling its summoning gate beneath the tower"
			width="1536"
			height="1024"
			fetchpriority="high"
		/>
		<div class="veil"></div>
		<div class="hero-copy">
			<p>The living archive · established 2026</p>
			<h1>Every rule.<br /><em>Every life.</em><br />One shared world.</h1>
			<span>
				The rulebook, artwork, bestiary, and production memory for the town beneath the
				hundred-floor tower.
			</span>
			<div class="hero-actions">
				<a href={resolve('/wiki/mechanics/equipment')}>Equipment artwork <b>→</b></a>
				<a href={resolve('/wiki/mechanics/skills/visual-catalog')}>Skill artwork</a>
				<a href={resolve('/wiki/creatures/monsters')}>Monster bestiary</a>
			</div>
		</div>
		<div class="edition">
			<span>Browse by subject</span><strong>Art and rules</strong><i>Archive</i>
		</div>
	</section>

	<section class="manifesto">
		<p>Canon is not a pitch deck.</p>
		<h2>
			Each page begins as design, becomes art and mechanics, and returns with evidence from the
			game.
		</h2>
		<a href={resolve('/wiki/contributing')}>How the archive grows →</a>
	</section>

	<section class="collections" aria-labelledby="collections-title">
		<header>
			<p>Primary collections</p>
			<h2 id="collections-title">Read the systems. See the world.</h2>
		</header>
		<div class="collection-grid">
			<a class="collection visual" href={resolve('/wiki/heroes')}>
				<img src={rosterHero} alt="Approved summonable hero Aear Soro" width="1024" height="1536" />
				<div>
					<span>Heroes · portraits</span>
					<h3>The hero archive</h3>
					<p>
						736 named identities: 200 approved heroes, historical candidates, earlier studies, and
						combat prototypes.
					</p>
				</div>
			</a>
			<a class="collection" href={resolve('/wiki/mechanics/progression')}>
				<span>Mechanics · growth</span>
				<h3>Progression</h3>
				<p>Stars, levels, attributes, affinity, training, summoning, and long-term potential.</p>
				<b>Explore system →</b>
			</a>
			<a class="collection" href={resolve('/wiki/mechanics/skills/visual-catalog')}>
				<span>Compendium · 457 skill images</span>
				<h3>Skills</h3>
				<p>Browse martial, magical, crafting, and support artwork alongside the skill rules.</p>
				<b>Open compendium →</b>
			</a>
			<a class="collection" href={resolve('/wiki/mechanics/equipment')}>
				<span>Compendium · equipment</span>
				<h3>Arms and artifacts</h3>
				<p>
					All 168 approved equipment images, including 21 complete armor sets and individual pieces.
				</p>
				<b>Browse equipment →</b>
			</a>
		</div>
	</section>

	<section class="bestiary" aria-labelledby="bestiary-title">
		<header>
			<div>
				<p>The bestiary</p>
				<h2 id="bestiary-title">What waits above</h2>
			</div>
			<a href={resolve('/wiki/creatures/monsters')}>Open the monster bestiary →</a>
		</header>
		<div>
			<figure>
				<img
					src={goblinoids}
					alt="Goblinoid warband concept candidates"
					width="1536"
					height="768"
				/>
				<figcaption><span>Coordinated threat</span><strong>Goblinoid warband</strong></figcaption>
			</figure>
			<figure>
				<img
					src={elementals}
					alt="Elemental monster-family candidates"
					width="1536"
					height="1024"
				/>
				<figcaption><span>Affinity made flesh</span><strong>Elemental family</strong></figcaption>
			</figure>
		</div>
	</section>

	<section class="roadmap">
		<div>
			<p>Release discipline</p>
			<h2>The wiki remembers everything.<br />The roadmap chooses what wakes.</h2>
		</div>
		<p>
			Archived prototypes and future systems remain documented with their intended scope and
			implementation status.
		</p>
		<a href={resolve('/wiki/roadmap')}>View release roadmap →</a>
	</section>
</main>

<style>
	main {
		overflow: hidden;
	}
	.hero {
		position: relative;
		min-height: min(52rem, calc(100svh - 4.5rem));
		isolation: isolate;
	}
	.hero > img {
		position: absolute;
		inset: 0;
		z-index: -3;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 56% center;
		filter: saturate(0.72) contrast(1.06) brightness(0.76);
	}
	.veil {
		position: absolute;
		inset: 0;
		z-index: -2;
		background:
			linear-gradient(
				90deg,
				#080704 3%,
				rgba(8, 7, 4, 0.91) 24%,
				rgba(8, 7, 4, 0.38) 66%,
				rgba(8, 7, 4, 0.68)
			),
			linear-gradient(0deg, #090805 0%, transparent 38%);
	}
	.hero-copy {
		width: min(43rem, calc(100% - 2rem));
		padding: clamp(5rem, 13vh, 9rem) 0 8rem clamp(1rem, 8vw, 8rem);
	}
	.hero-copy > p,
	.manifesto > p,
	section > header p,
	.roadmap > div p {
		margin: 0 0 1.1rem;
		color: #d47a43;
		font:
			0.72rem ui-monospace,
			monospace;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(3.5rem, 7vw, 7rem);
		font-weight: 400;
		line-height: 0.84;
		letter-spacing: -0.065em;
		text-wrap: balance;
	}
	h1 em {
		color: #e5aa73;
		font-weight: 400;
	}
	.hero-copy > span {
		display: block;
		max-width: 35rem;
		margin-top: 2rem;
		color: rgba(243, 234, 217, 0.7);
		font-family: Georgia, serif;
		font-size: clamp(1.08rem, 1.5vw, 1.25rem);
		line-height: 1.65;
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 2.3rem;
	}
	.hero-actions a {
		padding: 0.9rem 1.1rem;
		border: 1px solid rgba(232, 199, 149, 0.28);
		color: #f3ead9;
		font:
			0.72rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.hero-actions a:first-child {
		background: #c96634;
		color: #140a05;
		border-color: #c96634;
		font-weight: 800;
	}
	.hero-actions b {
		margin-left: 0.8rem;
	}
	.edition {
		position: absolute;
		right: 2rem;
		bottom: 2rem;
		display: grid;
		grid-template-columns: auto auto;
		align-items: end;
		gap: 0.25rem 0.7rem;
		padding: 1rem;
		border: 1px solid rgba(232, 199, 149, 0.22);
		background: rgba(8, 7, 4, 0.7);
		backdrop-filter: blur(12px);
	}
	.edition span {
		grid-column: 1 / -1;
		color: #9d917f;
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.edition strong {
		font-family: Georgia, serif;
		font-weight: 400;
	}
	.edition i {
		color: #d47a43;
		font:
			0.8rem ui-monospace,
			monospace;
		font-style: normal;
	}
	.manifesto {
		display: grid;
		grid-template-columns: 12rem minmax(0, 1fr) auto;
		gap: 2rem;
		align-items: start;
		padding: clamp(4rem, 8vw, 8rem);
		border-bottom: 1px solid rgba(231, 206, 164, 0.12);
	}
	.manifesto h2,
	.collections h2,
	.bestiary h2,
	.roadmap h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(2rem, 4vw, 4rem);
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: -0.035em;
	}
	.manifesto a,
	.bestiary header a,
	.roadmap > a {
		color: #d98652;
		font:
			0.72rem ui-monospace,
			monospace;
		letter-spacing: 0.09em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.collections,
	.bestiary {
		padding: clamp(4rem, 8vw, 8rem);
	}
	.collections > header,
	.bestiary > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 2.5rem;
	}
	.collection-grid {
		display: grid;
		grid-template-columns: 1.3fr 1fr 1fr;
		gap: 1px;
		background: rgba(231, 206, 164, 0.12);
		border: 1px solid rgba(231, 206, 164, 0.12);
	}
	.collection {
		min-height: 18rem;
		padding: 2rem;
		background: #0d0c08;
		color: #f3ead9;
		text-decoration: none;
	}
	.collection.visual {
		grid-row: span 2;
		position: relative;
		min-height: 37rem;
		display: flex;
		align-items: end;
		overflow: hidden;
		padding: 0;
	}
	.collection.visual img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.68) brightness(0.72);
		transition: transform 350ms ease;
	}
	.collection.visual:hover img {
		transform: scale(1.025);
	}
	.collection.visual div {
		position: relative;
		width: 100%;
		padding: 5rem 2rem 2rem;
		background: linear-gradient(transparent, rgba(8, 7, 4, 0.95));
	}
	.collection span {
		color: #b96c40;
		font:
			0.68rem ui-monospace,
			monospace;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	.collection h3 {
		margin: 0.9rem 0;
		font-family: Georgia, serif;
		font-size: clamp(1.6rem, 2.5vw, 2.5rem);
		font-weight: 400;
		line-height: 1;
	}
	.collection p {
		margin: 0;
		color: rgba(243, 234, 217, 0.58);
		font-family: Georgia, serif;
		font-size: 1.08rem;
		line-height: 1.6;
	}
	.collection > b {
		display: block;
		margin-top: 2rem;
		color: #d98652;
		font:
			0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.bestiary {
		background: #0c0b08;
	}
	.bestiary > div {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	figure {
		position: relative;
		margin: 0;
		overflow: hidden;
	}
	figure img {
		display: block;
		width: 100%;
		height: clamp(19rem, 34vw, 34rem);
		object-fit: cover;
		filter: saturate(0.72) contrast(1.04);
	}
	figcaption {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding: 4rem 1.5rem 1.25rem;
		background: linear-gradient(transparent, rgba(5, 5, 4, 0.94));
	}
	figcaption span {
		color: #d98652;
		font:
			0.67rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	figcaption strong {
		font-family: Georgia, serif;
		font-size: 1.42rem;
		font-weight: 400;
	}
	.roadmap {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(16rem, 0.8fr);
		gap: 2rem 5rem;
		align-items: end;
		padding: clamp(4rem, 8vw, 8rem);
		background: radial-gradient(circle at 10% 40%, rgba(164, 70, 35, 0.14), transparent 28rem);
	}
	.roadmap > p {
		margin: 0;
		color: rgba(243, 234, 217, 0.58);
		font-family: Georgia, serif;
		font-size: 1.18rem;
		line-height: 1.7;
	}
	.roadmap > a {
		grid-column: 2;
	}
	@media (max-width: 1000px) {
		.manifesto {
			grid-template-columns: 1fr;
		}
		.collection-grid {
			grid-template-columns: 1fr 1fr;
		}
		.collection.visual {
			grid-column: 1 / -1;
			grid-row: auto;
			min-height: 32rem;
		}
	}
	@media (max-width: 700px) {
		.hero {
			min-height: 46rem;
		}
		.hero-copy {
			padding-top: 6rem;
		}
		.edition {
			display: none;
		}
		.manifesto,
		.collections,
		.bestiary,
		.roadmap {
			padding: 4rem 1rem;
		}
		.collection-grid,
		.bestiary > div,
		.roadmap {
			grid-template-columns: 1fr;
		}
		.collection.visual {
			min-height: 27rem;
		}
		.roadmap > a {
			grid-column: auto;
		}
	}
</style>
