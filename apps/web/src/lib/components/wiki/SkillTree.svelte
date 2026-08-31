<script lang="ts">
	import { resolve } from '$app/paths';

	type DomainId = 'martial' | 'magical' | 'craft';

	type BranchedSkillFamily = {
		kind: 'branch';
		name: string;
		children: { name: string; href: string }[];
	};

	type LinkedSkillFamily = {
		kind: 'link';
		name: string;
		href: string;
	};

	type SkillFamily = BranchedSkillFamily | LinkedSkillFamily;

	type SkillDomain = {
		id: DomainId;
		name: string;
		image: string;
		description: string;
		families: SkillFamily[];
	};

	const domains: SkillDomain[] = [
		{
			id: 'martial',
			name: 'Martial',
			image: '/wiki-media/skills/martial-domain.webp',
			description: 'Technique, weapons, defense, endurance, and general combat practice.',
			families: [
				{
					kind: 'branch',
					name: 'Blade',
					children: [
						['Sword', 'sword'],
						['Dagger', 'dagger'],
						['Greatsword', 'greatsword'],
						['Two Blades', 'blade']
					].map(([name, anchor]) => ({
						name,
						href: `/wiki/mechanics/skills/martial-blade#${anchor}`
					}))
				},
				{
					kind: 'branch',
					name: 'Polearm',
					children: ['Spear', 'Glaive', 'Halberd', 'Polehammer'].map((name) => ({
						name,
						href: '/wiki/mechanics/skills/martial-polearm'
					}))
				},
				{
					kind: 'branch',
					name: 'Ranged',
					children: ['Bow', 'Crossbow'].map((name) => ({
						name,
						href: '/wiki/mechanics/skills/martial-ranged'
					}))
				},
				{
					kind: 'link',
					name: 'Shield',
					href: '/wiki/mechanics/skills/martial-shield'
				},
				{
					kind: 'link',
					name: 'Body',
					href: '/wiki/mechanics/skills/martial-body'
				}
			]
		},
		{
			id: 'magical',
			name: 'Magical',
			image: '/wiki-media/skills/magical-domain.webp',
			description: 'Affinity expression, wards, enchantment, restoration, and the mind.',
			families: [
				{
					kind: 'branch',
					name: 'Elemental',
					children: ['Fire', 'Water', 'Wood', 'Earth', 'Metal'].map((name) => ({
						name,
						href: '/wiki/mechanics/skills/magical-elemental'
					}))
				},
				...['Ward', 'Enchantment', 'Restoration', 'Mind'].map((name): LinkedSkillFamily => ({
					kind: 'link',
					name,
					href: `/wiki/mechanics/skills/magical-disciplines#${name.toLowerCase()}`
				}))
			]
		},
		{
			id: 'craft',
			name: 'Craft',
			image: '/wiki-media/skills/craft-domain.webp',
			description: 'Making, gathering, care, field knowledge, and material transformation.',
			families: ['Forging', 'Alchemy', 'Cooking', 'Gathering', 'Beast', 'Lore'].map(
				(name): LinkedSkillFamily => ({
					kind: 'link',
					name,
					href: `/wiki/mechanics/skills/craft-and-life#${name.toLowerCase()}`
				})
			)
		}
	];

	let selectedId = $state<DomainId>('martial');
	let activeDomain = $derived(domains.find((domain) => domain.id === selectedId) ?? domains[0]);
</script>

<section class="skill-tree" aria-label="Interactive skill tree">
	<header class="tree-intro">
		<div>
			<p>Three domains · two ways forward</p>
			<h2>Choose where mastery begins.</h2>
		</div>
		<span
			>Choose a domain, then follow a family skill graph with optional equipment or Element labels.</span
		>
	</header>

	<div class="root" aria-hidden="true">
		<span>Skills</span>
	</div>

	<nav class="domain-switcher" aria-label="Skill domains">
		{#each domains as domain}
			<button
				type="button"
				aria-pressed={selectedId === domain.id}
				onclick={() => (selectedId = domain.id)}
			>
				<span>{domain.name}</span>
				<i>{domain.families.length} {domain.families.length === 1 ? 'family' : 'families'}</i>
			</button>
		{/each}
	</nav>

	{#key activeDomain.id}
		<div class="domain-stage">
			<figure>
				<img
					src={activeDomain.image}
					alt={`${activeDomain.name} domain emblem`}
					width="900"
					height="900"
					loading="eager"
				/>
				<figcaption>
					<strong>{activeDomain.name}</strong>
					<span>{activeDomain.description}</span>
				</figcaption>
			</figure>

			<div class="branches">
				<section class="branch family-branch">
					<header>
						<span>Family paths</span>
						<h3>Skill families</h3>
						<p>
							Each family owns its skills directly; labels describe compatible equipment or Element.
						</p>
					</header>
					<div class="family-list">
						{#each activeDomain.families as family}
							{#if family.kind === 'branch'}
								<details open>
									<summary>
										<span>{family.name}</span>
										<i>{family.children.length}</i>
									</summary>
									<nav aria-label={`${family.name} labels`}>
										{#each family.children as child}
											<a href={resolve(child.href as `/wiki/${string}#${string}`)}
												>{child.name}<span>↗</span></a
											>
										{/each}
									</nav>
								</details>
							{:else}
								<a class="family-link" href={resolve(family.href as `/wiki/${string}#${string}`)}
									>{family.name}<span>↗</span></a
								>
							{/if}
						{/each}
					</div>
				</section>
			</div>
		</div>
	{/key}
</section>

<style>
	.skill-tree {
		--tree-paper: #f3ead9;
		--tree-muted: #aaa08e;
		--tree-ember: #d4773d;
		--tree-line: rgba(231, 206, 164, 0.16);
		width: min(76rem, calc(100% - 2rem));
		margin: 0 auto;
		padding: clamp(4rem, 7vw, 7rem) 0 0;
	}
	.tree-intro {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 3rem;
		margin-bottom: 3.25rem;
	}
	.tree-intro p,
	.branch header > span {
		margin: 0 0 0.75rem;
		color: var(--tree-ember);
		font:
			0.68rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.tree-intro h2 {
		max-width: 43rem;
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(2.7rem, 5vw, 5rem);
		font-weight: 400;
		line-height: 0.95;
		letter-spacing: -0.04em;
		text-wrap: balance;
	}
	.tree-intro > span {
		max-width: 26rem;
		padding-bottom: 0.35rem;
		color: rgba(243, 234, 217, 0.62);
		font-family: Georgia, serif;
		font-size: 1.05rem;
		line-height: 1.6;
		text-wrap: pretty;
	}
	.root {
		position: relative;
		display: flex;
		justify-content: center;
		padding-bottom: 2.2rem;
	}
	.root::after {
		position: absolute;
		bottom: 0;
		left: 50%;
		width: 1px;
		height: 2.2rem;
		background: var(--tree-line);
		content: '';
	}
	.root span {
		display: grid;
		width: 5.5rem;
		aspect-ratio: 1;
		place-items: center;
		border: 1px solid rgba(212, 119, 61, 0.5);
		border-radius: 50%;
		background: radial-gradient(circle, rgba(212, 119, 61, 0.14), transparent 70%);
		color: var(--tree-paper);
		font-family: Georgia, serif;
		font-size: 1.1rem;
	}
	.domain-switcher {
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 1px solid var(--tree-line);
		border-bottom: 1px solid var(--tree-line);
	}
	.domain-switcher button {
		position: relative;
		display: flex;
		min-width: 0;
		min-height: 5.6rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.15rem clamp(0.8rem, 2vw, 1.5rem);
		border: 0;
		border-right: 1px solid var(--tree-line);
		background: transparent;
		color: rgba(243, 234, 217, 0.54);
		text-align: left;
		cursor: pointer;
		transition:
			background 180ms ease,
			color 180ms ease;
	}
	.domain-switcher button:last-child {
		border-right: 0;
	}
	.domain-switcher button::after {
		position: absolute;
		right: 1rem;
		bottom: -1px;
		left: 1rem;
		height: 2px;
		background: var(--tree-ember);
		content: '';
		transform: scaleX(0);
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.domain-switcher button:hover,
	.domain-switcher button[aria-pressed='true'] {
		background: rgba(212, 119, 61, 0.055);
		color: var(--tree-paper);
	}
	.domain-switcher button[aria-pressed='true']::after {
		transform: scaleX(1);
	}
	.domain-switcher button:focus-visible,
	.family-list summary:focus-visible,
	.family-list a:focus-visible {
		outline: 2px solid #e5aa73;
		outline-offset: -3px;
	}
	.domain-switcher button span {
		font-family: Georgia, serif;
		font-size: clamp(1.15rem, 2vw, 1.55rem);
	}
	.domain-switcher button i {
		color: var(--tree-muted);
		font:
			0.62rem ui-monospace,
			monospace;
		font-style: normal;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.domain-stage {
		display: grid;
		grid-template-columns: minmax(18rem, 0.82fr) minmax(0, 1.8fr);
		min-height: 41rem;
		border-bottom: 1px solid var(--tree-line);
		animation: domain-reveal 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	.domain-stage > figure {
		position: relative;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		border-right: 1px solid var(--tree-line);
		background: #0b0a08;
	}
	.domain-stage > figure::after {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 52%, rgba(7, 6, 4, 0.96));
		content: '';
		pointer-events: none;
	}
	.domain-stage img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.8) contrast(1.04);
		transition:
			filter 300ms ease,
			transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.domain-stage figure:hover img {
		transform: scale(1.025);
		filter: saturate(0.96) contrast(1.04);
	}
	.domain-stage figcaption {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 2rem;
	}
	.domain-stage figcaption strong {
		font-family: Georgia, serif;
		font-size: clamp(2rem, 3vw, 3rem);
		font-weight: 400;
		letter-spacing: -0.035em;
	}
	.domain-stage figcaption span {
		max-width: 30rem;
		color: rgba(243, 234, 217, 0.65);
		font-family: Georgia, serif;
		line-height: 1.55;
	}
	.branches {
		display: grid;
		min-width: 0;
	}
	.branch {
		position: relative;
		display: grid;
		grid-template-columns: minmax(12rem, 0.72fr) minmax(0, 1.28fr);
		gap: clamp(1.5rem, 3vw, 3rem);
		padding: clamp(1.7rem, 3vw, 3rem);
	}
	.branch::before {
		position: absolute;
		top: 50%;
		left: -0.34rem;
		width: 0.65rem;
		aspect-ratio: 1;
		border: 1px solid var(--tree-ember);
		background: #090805;
		content: '';
		transform: rotate(45deg);
	}
	.branch header h3 {
		margin: 0 0 0.8rem;
		font-family: Georgia, serif;
		font-size: clamp(1.75rem, 3vw, 2.5rem);
		font-weight: 400;
		line-height: 1;
		letter-spacing: -0.035em;
	}
	.branch header p {
		margin: 0;
		color: rgba(243, 234, 217, 0.56);
		font-family: Georgia, serif;
		line-height: 1.55;
	}
	.family-list a span {
		display: inline-block;
		transition: transform 180ms ease;
	}
	.family-list a:hover span {
		transform: translateX(0.2rem);
	}
	.family-list {
		display: grid;
		align-content: start;
		gap: 0.55rem;
	}
	.family-list details {
		border-bottom: 1px solid var(--tree-line);
	}
	.family-list > .family-link {
		justify-content: space-between;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--tree-line);
		color: var(--tree-paper);
		font-size: 1rem;
	}
	.family-list summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0;
		color: var(--tree-paper);
		font-family: Georgia, serif;
		cursor: pointer;
		list-style: none;
	}
	.family-list summary::-webkit-details-marker {
		display: none;
	}
	.family-list summary i {
		display: grid;
		width: 1.75rem;
		aspect-ratio: 1;
		place-items: center;
		border: 1px solid var(--tree-line);
		border-radius: 50%;
		color: var(--tree-muted);
		font:
			0.62rem ui-monospace,
			monospace;
		font-style: normal;
	}
	.family-list nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.15rem;
		padding: 0.2rem 0 0.85rem;
	}
	.family-list a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2rem;
		color: rgba(243, 234, 217, 0.62);
		font-family: Georgia, serif;
		font-size: 0.92rem;
		text-decoration: none;
	}
	.family-list a:hover {
		color: #e5aa73;
	}
	.family-list a span {
		color: var(--tree-ember);
		font-family: ui-monospace, monospace;
	}

	@keyframes domain-reveal {
		from {
			opacity: 0.7;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 960px) {
		.tree-intro {
			align-items: start;
			flex-direction: column;
			gap: 1.25rem;
		}
		.domain-stage {
			grid-template-columns: minmax(15rem, 0.72fr) minmax(0, 1.28fr);
		}
		.branch {
			grid-template-columns: 1fr;
			gap: 1.35rem;
		}
	}

	@media (max-width: 700px) {
		.skill-tree {
			padding-top: 3.5rem;
		}
		.tree-intro {
			margin-bottom: 2.5rem;
		}
		.root {
			padding-bottom: 1.5rem;
		}
		.root::after {
			height: 1.5rem;
		}
		.root span {
			width: 4.5rem;
		}
		.domain-switcher button {
			min-height: 4.7rem;
			align-items: start;
			flex-direction: column;
			gap: 0.25rem;
			justify-content: center;
		}
		.domain-switcher button i {
			font-size: 0.54rem;
			letter-spacing: 0.03em;
		}
		.domain-stage {
			display: block;
			min-height: 0;
		}
		.domain-stage > figure {
			aspect-ratio: 4 / 3;
			border-right: 0;
			border-bottom: 1px solid var(--tree-line);
		}
		.domain-stage figcaption {
			padding: 1.25rem;
		}
		.domain-stage figcaption span {
			font-size: 0.92rem;
		}
		.branch {
			padding: 1.5rem 1.25rem;
		}
		.branch::before {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.domain-stage {
			animation: none;
		}
		.domain-stage img,
		.domain-switcher button,
		.domain-switcher button::after,
		.family-list a span {
			transition: none;
		}
	}
</style>
