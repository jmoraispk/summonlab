<script lang="ts">
	import { resolve } from '$app/paths';

	import { SKILL_DOMAINS, type SkillTreeFamily } from './skill-tree-data';

	type DomainId = (typeof SKILL_DOMAINS)[number]['id'];

	let selectedId = $state<DomainId>('martial');
	let selectedLabels = $state<Record<string, string>>({});
	let activeDomain = $derived(
		SKILL_DOMAINS.find((domain) => domain.id === selectedId) ?? SKILL_DOMAINS[0]
	);

	function selectLabel(family: SkillTreeFamily, value: string): void {
		selectedLabels = { ...selectedLabels, [family.name]: value };
	}

	function resetLabel(family: SkillTreeFamily): void {
		const next = { ...selectedLabels };
		delete next[family.name];
		selectedLabels = next;
	}

	function visibleSkills(family: SkillTreeFamily) {
		const selected = selectedLabels[family.name];
		if (!selected) return family.skills;
		return family.skills.filter(
			(skill) => skill.labels.length === 0 || skill.labels.some((label) => label.value === selected)
		);
	}
</script>

<section class="skill-tree" aria-label="Interactive skill tree">
	<header class="tree-intro">
		<div>
			<p>Field guide · Domain → Family → Skill</p>
			<h2>Follow one clear path to mastery.</h2>
		</div>
		<span>
			Families own skills directly. Equipment and Element labels narrow compatibility without
			creating another branch.
		</span>
	</header>

	<div class="root" aria-hidden="true">
		<span>Skills</span>
		<i>Domain</i>
		<i>Family</i>
		<i>Skill</i>
	</div>

	<nav class="domain-switcher" aria-label="Skill domains">
		{#each SKILL_DOMAINS as domain (domain.id)}
			<button
				type="button"
				aria-pressed={selectedId === domain.id}
				onclick={() => (selectedId = domain.id)}
			>
				<span>{domain.name}</span>
				<i>{domain.families.length} families</i>
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
					<span>{activeDomain.families.length} families</span>
					<strong>{activeDomain.name}</strong>
					<p>{activeDomain.description}</p>
				</figcaption>
			</figure>

			<div class="family-ledger" aria-label={`${activeDomain.name} families`}>
				<header class="ledger-header">
					<span>Family records</span>
					<span>Representative skills</span>
				</header>
				{#each activeDomain.families as family, index (family.name)}
					<section class="family-record">
						<div class="family-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
						<header>
							<h3>
								<a href={resolve(family.href as `/wiki/${string}`)}
									>{family.name}<span aria-hidden="true">↗</span></a
								>
							</h3>
							<p>{family.description}</p>
						</header>

						<div class="family-content">
							{#if family.labels.length > 0}
								<div class="label-filter" aria-label={`Filter ${family.name} skills`}>
									<span>{family.labels[0]?.namespace}</span>
									<div>
										{#each family.labels as label (label.value)}
											<button
												type="button"
												aria-pressed={selectedLabels[family.name] === label.value}
												onclick={() => selectLabel(family, label.value)}
											>
												{label.value}
											</button>
										{/each}
										{#if selectedLabels[family.name]}
											<button
												class="reset-filter"
												type="button"
												aria-label={`Show all ${family.name} skills`}
												onclick={() => resetLabel(family)}
											>
												Show all
											</button>
										{/if}
									</div>
								</div>
							{/if}

							<nav class="skill-links" aria-label={`${family.name} representative skills`}>
								{#each visibleSkills(family) as skill (skill.name)}
									<a href={resolve(skill.href as `/wiki/${string}`)}>
										<strong>{skill.name}</strong>
										{#each skill.labels as label (`${label.namespace}-${label.value}`)}
											<span>{label.value}</span>
										{/each}
										<i aria-hidden="true">↗</i>
									</a>
								{/each}
							</nav>
						</div>
					</section>
				{/each}
			</div>
		</div>
	{/key}
</section>

<style>
	.skill-tree {
		--tree-paper: #f3ead9;
		--tree-muted: #aaa08e;
		--tree-ember: #d4773d;
		--tree-focus: #e5aa73;
		--tree-surface: #0c0b08;
		--tree-line: rgba(231, 206, 164, 0.16);
		width: min(78rem, calc(100% - 2rem));
		margin: 0 auto;
		padding: clamp(3.5rem, 6vw, 6rem) 0 0;
	}

	.tree-intro {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 3rem;
		margin-bottom: 2.75rem;
	}
	.tree-intro p {
		margin: 0 0 0.8rem;
		color: var(--tree-ember);
		font:
			0.68rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.tree-intro h2 {
		max-width: 42rem;
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(2.35rem, 4.5vw, 4.35rem);
		font-weight: 400;
		line-height: 0.98;
		letter-spacing: -0.04em;
		text-wrap: balance;
	}
	.tree-intro > span {
		max-width: 27rem;
		padding-bottom: 0.25rem;
		color: rgba(243, 234, 217, 0.62);
		font-family: Georgia, serif;
		font-size: 1.02rem;
		line-height: 1.55;
		text-wrap: pretty;
	}

	.root {
		display: flex;
		align-items: center;
		gap: 0;
		min-height: 3.4rem;
		border-top: 1px solid var(--tree-line);
		color: var(--tree-muted);
		font:
			0.61rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.root span {
		align-self: stretch;
		display: grid;
		min-width: 7rem;
		place-items: center;
		border-right: 1px solid var(--tree-line);
		color: var(--tree-paper);
		font-family: Georgia, serif;
		font-size: 1rem;
		letter-spacing: 0;
		text-transform: none;
	}
	.root i {
		font-style: normal;
	}
	.root i::before {
		margin: 0 0.75rem;
		color: var(--tree-ember);
		content: '→';
	}

	.domain-switcher {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 1px solid var(--tree-line);
		border-bottom: 1px solid var(--tree-line);
	}
	.domain-switcher button {
		position: relative;
		display: flex;
		min-width: 0;
		min-height: 5.5rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem clamp(0.8rem, 2vw, 1.5rem);
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
	.domain-switcher button:active {
		background: rgba(212, 119, 61, 0.1);
	}
	.domain-switcher button[aria-pressed='true']::after {
		transform: scaleX(1);
	}
	.domain-switcher button span {
		font-family: Georgia, serif;
		font-size: clamp(1.1rem, 2vw, 1.5rem);
	}
	.domain-switcher button i {
		color: var(--tree-muted);
		font:
			0.61rem ui-monospace,
			monospace;
		font-style: normal;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.domain-stage {
		display: grid;
		grid-template-columns: minmax(18rem, 0.72fr) minmax(0, 1.65fr);
		border-bottom: 1px solid var(--tree-line);
		animation: domain-reveal 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	.domain-stage > figure {
		position: relative;
		min-width: 0;
		min-height: 42rem;
		margin: 0;
		overflow: hidden;
		border-right: 1px solid var(--tree-line);
		background: var(--tree-surface);
	}
	.domain-stage > figure::after {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 48%, rgba(7, 6, 4, 0.97));
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
			filter 220ms ease,
			transform 220ms ease;
	}
	.domain-stage figure:hover img {
		transform: scale(1.018);
		filter: saturate(0.94) contrast(1.04);
	}
	.domain-stage figcaption {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 1;
		padding: 2rem;
	}
	.domain-stage figcaption > span,
	.ledger-header,
	.label-filter > span,
	.family-index {
		color: var(--tree-ember);
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.domain-stage figcaption strong {
		display: block;
		margin-top: 0.55rem;
		font-family: Georgia, serif;
		font-size: clamp(2rem, 3vw, 3rem);
		font-weight: 400;
		letter-spacing: -0.035em;
	}
	.domain-stage figcaption p {
		max-width: 30rem;
		margin: 0.6rem 0 0;
		color: rgba(243, 234, 217, 0.65);
		font-family: Georgia, serif;
		line-height: 1.55;
	}

	.family-ledger {
		min-width: 0;
		background: rgba(12, 11, 8, 0.34);
	}
	.ledger-header {
		display: grid;
		grid-template-columns: minmax(13rem, 0.9fr) minmax(14rem, 1.1fr);
		gap: 2rem;
		padding: 1rem clamp(1.25rem, 2.8vw, 2.5rem) 1rem 4.6rem;
		border-bottom: 1px solid var(--tree-line);
		color: rgba(243, 234, 217, 0.38);
	}
	.family-record {
		position: relative;
		display: grid;
		grid-template-columns: minmax(13rem, 0.9fr) minmax(14rem, 1.1fr);
		gap: 2rem;
		padding: 1.6rem clamp(1.25rem, 2.8vw, 2.5rem) 1.7rem 4.6rem;
		border-bottom: 1px solid var(--tree-line);
	}
	.family-record:last-child {
		border-bottom: 0;
	}
	.family-index {
		position: absolute;
		top: 1.9rem;
		left: 1.5rem;
		color: rgba(212, 119, 61, 0.62);
	}
	.family-record > header h3 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(1.4rem, 2.3vw, 2rem);
		font-weight: 400;
		line-height: 1;
		letter-spacing: -0.025em;
	}
	.family-record > header h3 a {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 2.75rem;
		color: var(--tree-paper);
		text-decoration: none;
	}
	.family-record > header h3 span {
		color: var(--tree-ember);
		font:
			0.8rem ui-monospace,
			monospace;
		transition: transform 180ms ease;
	}
	.family-record > header h3 a:hover span {
		transform: translate(0.18rem, -0.1rem);
	}
	.family-record > header p {
		margin: 0.55rem 0 0;
		color: rgba(243, 234, 217, 0.55);
		font-family: Georgia, serif;
		font-size: 0.93rem;
		line-height: 1.5;
	}
	.family-content {
		min-width: 0;
	}

	.label-filter {
		display: flex;
		align-items: start;
		gap: 0.85rem;
		margin-bottom: 0.7rem;
	}
	.label-filter > span {
		flex: 0 0 auto;
		padding-top: 0.62rem;
		color: rgba(243, 234, 217, 0.38);
	}
	.label-filter > div {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.label-filter button {
		min-height: 2.5rem;
		padding: 0.45rem 0.72rem;
		border: 1px solid var(--tree-line);
		border-radius: 0.2rem;
		background: transparent;
		color: var(--tree-muted);
		font:
			0.64rem ui-monospace,
			monospace;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition:
			background 180ms ease,
			border-color 180ms ease,
			color 180ms ease;
	}
	.label-filter button:hover {
		border-color: rgba(229, 170, 115, 0.56);
		color: var(--tree-paper);
	}
	.label-filter button:active,
	.label-filter button[aria-pressed='true'] {
		border-color: rgba(212, 119, 61, 0.72);
		background: rgba(212, 119, 61, 0.12);
		color: var(--tree-paper);
	}
	.label-filter .reset-filter {
		border-color: transparent;
		color: var(--tree-focus);
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.skill-links {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		border: 1px solid var(--tree-line);
		background: var(--tree-line);
	}
	.skill-links a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.2rem 0.55rem;
		min-height: 3.25rem;
		padding: 0.55rem 0.7rem;
		background: #0b0a07;
		color: rgba(243, 234, 217, 0.72);
		text-decoration: none;
		transition:
			background 180ms ease,
			color 180ms ease;
	}
	.skill-links a:hover {
		background: rgba(212, 119, 61, 0.09);
		color: var(--tree-paper);
	}
	.skill-links a:active {
		background: rgba(212, 119, 61, 0.15);
	}
	.skill-links strong {
		min-width: 0;
		font-family: Georgia, serif;
		font-size: 0.9rem;
		font-weight: 400;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
	.skill-links a > span {
		grid-column: 1;
		color: var(--tree-muted);
		font:
			0.55rem ui-monospace,
			monospace;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.skill-links a > i {
		grid-column: 2;
		grid-row: 1 / span 2;
		color: var(--tree-ember);
		font:
			0.7rem ui-monospace,
			monospace;
		font-style: normal;
	}

	.domain-switcher button:focus-visible,
	.family-record > header h3 a:focus-visible,
	.label-filter button:focus-visible,
	.skill-links a:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid var(--tree-focus);
		outline-offset: -3px;
	}

	@keyframes domain-reveal {
		from {
			opacity: 0.72;
			transform: translateY(0.35rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 1080px) {
		.domain-stage {
			grid-template-columns: minmax(16rem, 0.58fr) minmax(0, 1.42fr);
		}
		.ledger-header {
			display: none;
		}
		.family-record {
			grid-template-columns: 1fr;
			gap: 1.1rem;
		}
	}

	@media (max-width: 700px) {
		.skill-tree {
			padding-top: 3rem;
		}
		.tree-intro {
			align-items: start;
			flex-direction: column;
			gap: 1.15rem;
			margin-bottom: 2rem;
		}
		.root {
			overflow: hidden;
		}
		.root span {
			min-width: 5rem;
		}
		.root i::before {
			margin: 0 0.35rem;
		}
		.domain-switcher button {
			min-height: 4.8rem;
			align-items: start;
			flex-direction: column;
			gap: 0.2rem;
			justify-content: center;
		}
		.domain-switcher button i {
			font-size: 0.52rem;
			letter-spacing: 0.02em;
		}
		.domain-stage {
			display: block;
		}
		.domain-stage > figure {
			min-height: 0;
			aspect-ratio: 4 / 3;
			border-right: 0;
			border-bottom: 1px solid var(--tree-line);
		}
		.domain-stage figcaption {
			padding: 1.25rem;
		}
		.domain-stage figcaption p {
			font-size: 0.9rem;
		}
		.family-record {
			padding: 1.45rem 1.1rem 1.5rem 3.35rem;
		}
		.family-index {
			top: 1.8rem;
			left: 1rem;
		}
		.label-filter {
			align-items: stretch;
			flex-direction: column;
			gap: 0.4rem;
		}
		.label-filter > span {
			padding-top: 0;
		}
		.skill-links {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.domain-stage {
			animation: none;
		}
		.domain-stage img,
		.domain-switcher button,
		.domain-switcher button::after,
		.family-record > header h3 span,
		.label-filter button,
		.skill-links a {
			transition: none;
		}
	}
</style>
