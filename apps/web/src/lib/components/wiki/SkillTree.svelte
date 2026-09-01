<script lang="ts">
	import { resolve } from '$app/paths';

	import { SKILL_DOMAINS, type SkillTreeFamily } from './skill-tree-data';

	type DomainId = (typeof SKILL_DOMAINS)[number]['id'];

	let selectedId = $state<DomainId | null>(null);
	let selectedLabels = $state<Record<string, string>>({});
	let activeDomain = $derived(
		selectedId ? (SKILL_DOMAINS.find((domain) => domain.id === selectedId) ?? null) : null
	);

	function toggleDomain(id: DomainId): void {
		selectedId = selectedId === id ? null : id;
	}

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

	<div class="tree-root" aria-hidden="true"><span>Skills</span></div>

	<nav class="domain-tree" aria-label="Skill domains">
		{#each SKILL_DOMAINS as domain (domain.id)}
			<button
				class:active={selectedId === domain.id}
				type="button"
				aria-expanded={selectedId === domain.id}
				aria-controls="skill-domain-branch"
				onclick={() => toggleDomain(domain.id)}
			>
				<span class="domain-node-image">
					<img src={domain.image} alt="" width="900" height="900" />
				</span>
				<strong>{domain.name}</strong>
				<small>{domain.families.length} families</small>
			</button>
		{/each}
	</nav>

	{#if activeDomain}
		<section
			id="skill-domain-branch"
			class="domain-branch"
			aria-label={`${activeDomain.name} families`}
		>
			<header class="branch-header">
				<div>
					<span>{activeDomain.families.length} family records</span>
					<h3>{activeDomain.name}</h3>
				</div>
				<p>{activeDomain.description}</p>
			</header>

			<div class="family-ledger">
				<header class="ledger-header">
					<span>Family records</span>
					<span>Representative skills</span>
				</header>
				{#each activeDomain.families as family, index (family.name)}
					{@const selectedLabel = selectedLabels[family.name]}
					{@const visibleFamilySkills = visibleSkills(family)}
					<section class="family-record">
						<div class="family-index" aria-hidden="true">
							{String(index + 1).padStart(2, '0')}
						</div>
						<header>
							<h4>
								<a href={resolve(family.href as `/wiki/${string}`)}
									>{family.name}<span aria-hidden="true">↗</span></a
								>
							</h4>
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
												aria-pressed={selectedLabel === label.value}
												onclick={() => selectLabel(family, label.value)}
											>
												{label.value}
											</button>
										{/each}
										{#if selectedLabel}
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

							{#if visibleFamilySkills.length > 0}
								<nav class="skill-links" aria-label={`${family.name} representative skills`}>
									{#each visibleFamilySkills as skill (skill.name)}
										<a href={resolve(skill.href as `/wiki/${string}`)}>
											<strong>{skill.name}</strong>
											{#each skill.labels as label (`${label.namespace}-${label.value}`)}
												<span>{label.value}</span>
											{/each}
											<i aria-hidden="true">↗</i>
										</a>
									{/each}
								</nav>
							{:else}
								<p class="empty-result">
									{family.emptyLabelMessages?.[selectedLabel] ??
										'No published representative skills match this label.'}
								</p>
							{/if}
						</div>
					</section>
				{/each}
			</div>
		</section>
	{/if}
</section>

<style>
	.skill-tree {
		--tree-paper: #f3ead9;
		--tree-muted: #aaa08e;
		--tree-ember: #d4773d;
		--tree-focus: #e5aa73;
		--tree-surface: #0c0b08;
		--tree-line: rgba(231, 206, 164, 0.14);
		width: min(76rem, calc(100% - 2rem));
		margin: 0 auto;
		padding: clamp(3.5rem, 6vw, 6rem) 0 0;
	}

	.tree-intro {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 3rem;
		margin-bottom: 3.5rem;
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
		color: rgba(243, 234, 217, 0.67);
		font-family: Georgia, serif;
		font-size: 1.02rem;
		line-height: 1.55;
		text-wrap: pretty;
	}

	.tree-root {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 3.25rem;
	}
	.tree-root span {
		display: grid;
		min-width: 7rem;
		min-height: 3.25rem;
		place-items: center;
		border: 1px solid var(--tree-line);
		background: var(--tree-surface);
		color: var(--tree-paper);
		font-family: Georgia, serif;
		font-size: 1rem;
	}
	.tree-root::after {
		position: absolute;
		top: 100%;
		left: 50%;
		width: 1px;
		height: 1.5rem;
		background: var(--tree-line);
		content: '';
	}

	.domain-tree {
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(0.5rem, 4vw, 3rem);
		margin-top: 1.5rem;
		padding: 1.75rem 0 2.5rem;
	}
	.domain-tree::before {
		position: absolute;
		top: 0;
		right: 16.666%;
		left: 16.666%;
		height: 1px;
		background: var(--tree-line);
		content: '';
	}
	.domain-tree button {
		position: relative;
		display: grid;
		min-width: 0;
		justify-items: center;
		gap: 0.45rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--tree-muted);
		text-align: center;
		cursor: pointer;
	}
	.domain-tree button::before {
		position: absolute;
		bottom: 100%;
		left: 50%;
		width: 1px;
		height: 1.75rem;
		background: var(--tree-line);
		content: '';
	}
	.domain-tree button::after {
		position: absolute;
		top: 100%;
		left: 50%;
		width: 1px;
		height: 2.5rem;
		background: var(--tree-ember);
		content: '';
		opacity: 0;
		transform: scaleY(0);
		transform-origin: top;
		transition:
			opacity 180ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.domain-node-image {
		display: block;
		width: clamp(5.5rem, 18vw, 13rem);
		aspect-ratio: 1;
		overflow: hidden;
		border: 1px solid var(--tree-line);
		border-radius: 50%;
		background: var(--tree-surface);
		transition:
			border-color 180ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.domain-node-image img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.72) contrast(1.08) brightness(0.82);
		transition: filter 180ms ease;
	}
	.domain-tree strong {
		color: rgba(243, 234, 217, 0.72);
		font-family: Georgia, serif;
		font-size: clamp(1.05rem, 2vw, 1.45rem);
		font-weight: 400;
		line-height: 1.1;
	}
	.domain-tree small {
		font:
			0.61rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.domain-tree button:hover .domain-node-image,
	.domain-tree button[aria-expanded='true'] .domain-node-image {
		border-color: rgba(229, 170, 115, 0.72);
		transform: translateY(-0.18rem);
	}
	.domain-tree button:hover .domain-node-image img,
	.domain-tree button[aria-expanded='true'] .domain-node-image img {
		filter: saturate(0.94) contrast(1.05) brightness(0.96);
	}
	.domain-tree button:hover strong,
	.domain-tree button[aria-expanded='true'] strong {
		color: var(--tree-paper);
	}
	.domain-tree button:active .domain-node-image {
		border-color: var(--tree-ember);
		transform: translateY(0);
	}
	.domain-tree button[aria-expanded='true']::after {
		opacity: 1;
		transform: scaleY(1);
	}

	.domain-branch {
		border-top: 1px solid var(--tree-line);
		border-bottom: 1px solid var(--tree-line);
		animation: domain-reveal 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	.branch-header {
		display: grid;
		grid-template-columns: minmax(12rem, 0.8fr) minmax(0, 1.2fr);
		align-items: end;
		gap: 2rem;
		padding: 1.5rem clamp(1.25rem, 3vw, 2.5rem);
		border-bottom: 1px solid var(--tree-line);
		background: rgba(12, 11, 8, 0.34);
	}
	.branch-header span,
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
	.branch-header h3 {
		margin: 0.45rem 0 0;
		font-family: Georgia, serif;
		font-size: clamp(2rem, 3vw, 3rem);
		font-weight: 400;
		line-height: 1;
		letter-spacing: -0.035em;
	}
	.branch-header p {
		max-width: 42rem;
		margin: 0;
		color: rgba(243, 234, 217, 0.67);
		font-family: Georgia, serif;
		line-height: 1.55;
	}

	.family-ledger {
		min-width: 0;
		background: rgba(12, 11, 8, 0.2);
	}
	.ledger-header {
		display: grid;
		grid-template-columns: minmax(13rem, 0.9fr) minmax(14rem, 1.1fr);
		gap: 2rem;
		padding: 1rem clamp(1.25rem, 2.8vw, 2.5rem) 1rem 4.6rem;
		border-bottom: 1px solid var(--tree-line);
		color: var(--tree-muted);
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
		color: rgba(212, 119, 61, 0.68);
	}
	.family-record > header h4 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(1.4rem, 2.3vw, 2rem);
		font-weight: 400;
		line-height: 1;
		letter-spacing: -0.025em;
	}
	.family-record > header h4 a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.55rem;
		color: var(--tree-paper);
		text-decoration: none;
	}
	.family-record > header h4 span {
		color: var(--tree-ember);
		font:
			0.8rem ui-monospace,
			monospace;
		transition: transform 180ms ease;
	}
	.family-record > header h4 a:hover span {
		transform: translate(0.18rem, -0.1rem);
	}
	.family-record > header p {
		margin: 0.55rem 0 0;
		color: rgba(243, 234, 217, 0.62);
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
		color: var(--tree-muted);
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
		color: rgba(243, 234, 217, 0.76);
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
	.skill-links a:last-child:nth-child(odd) {
		grid-column: 1 / -1;
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
	.empty-result {
		min-height: 3.25rem;
		margin: 0;
		padding: 0.85rem 1rem;
		border: 1px solid var(--tree-line);
		background: #0b0a07;
		color: var(--tree-muted);
		font-family: Georgia, serif;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.domain-tree button:focus-visible,
	.family-record > header h4 a:focus-visible,
	.label-filter button:focus-visible,
	.skill-links a:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid var(--tree-focus);
		outline-offset: 3px;
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

	@media (max-width: 860px) {
		.ledger-header {
			display: none;
		}
		.family-record {
			grid-template-columns: 1fr;
			gap: 1.1rem;
		}
	}

	@media (max-width: 640px) {
		.skill-tree {
			padding-top: 3rem;
		}
		.tree-intro {
			align-items: start;
			flex-direction: column;
			gap: 1.15rem;
			margin-bottom: 2.75rem;
		}
		.domain-tree {
			gap: 0.5rem;
		}
		.domain-tree small {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}
		.branch-header {
			grid-template-columns: 1fr;
			gap: 0.65rem;
			padding: 1.25rem;
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
		.domain-branch {
			animation: none;
		}
		.domain-tree button::after,
		.domain-node-image,
		.domain-node-image img,
		.family-record > header h4 span,
		.label-filter button,
		.skill-links a {
			transition: none;
		}
		.domain-tree button .domain-node-image,
		.domain-tree button:hover .domain-node-image,
		.domain-tree button:active .domain-node-image,
		.domain-tree button[aria-expanded='true'] .domain-node-image,
		.family-record > header h4 span,
		.family-record > header h4 a:hover span {
			transform: none;
		}
	}
</style>
