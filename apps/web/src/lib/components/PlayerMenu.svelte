<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CampaignObjectiveProjection } from '@summonlab/contracts';
	import { onMount, tick } from 'svelte';
	import PlayerSettingsPanel from './PlayerSettingsPanel.svelte';
	import { loadPlayerSettings } from '$lib/player-settings';
	import { trackPlaytestEvent } from '$lib/playtest-analytics';
	import { focusDialog, handleModalKeydown } from '$lib/modal-focus';

	let {
		runId,
		initialObjectives,
		villageNavigation = false,
		compact = false
	}: {
		runId: string;
		initialObjectives: CampaignObjectiveProjection;
		villageNavigation?: boolean;
		compact?: boolean;
	} = $props();
	let objectives = $derived(initialObjectives);
	let open = $state(false);
	let tab = $state<'objectives' | 'settings'>('objectives');
	let confirmRestart = $state(false);
	let restarting = $state(false);
	let errorMessage = $state('');
	let menuDialog = $state<HTMLDivElement>(null!);
	let returnFocus: HTMLElement | null = null;
	const activeObjective = $derived(
		objectives.objectives.find((objective) => objective.status === 'current') ?? null
	);

	onMount(() => {
		loadPlayerSettings();
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || event.defaultPrevented) return;
			if (open) void closeMenu();
			else void openMenu('objectives');
		};
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});

	async function openMenu(nextTab: typeof tab) {
		const wasOpen = open;
		if (!open) {
			returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		}
		tab = nextTab;
		open = true;
		confirmRestart = false;
		await tick();
		focusDialog(menuDialog);
		if (!wasOpen) {
			void trackPlaytestEvent({
				eventType: 'pause_opened',
				route: window.location.pathname.startsWith('/play/') ? 'hearth' : 'onboarding',
				runId,
				completedObjectiveCount: objectives.completedCount
			});
		}
		const response = await fetch(`/api/campaigns/${runId}`);
		if (response.ok) {
			const body = (await response.json()) as { objectives: CampaignObjectiveProjection };
			objectives = body.objectives;
		}
	}

	async function closeMenu() {
		open = false;
		confirmRestart = false;
		await tick();
		returnFocus?.focus();
	}

	async function restartSameSeed() {
		if (!confirmRestart) {
			confirmRestart = true;
			return;
		}
		restarting = true;
		errorMessage = '';
		try {
			const response = await fetch(`/api/campaigns/${runId}/restart`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					seedMode: 'same',
					controlMode: loadPlayerSettings().controlMode
				})
			});
			const body = (await response.json()) as {
				campaign?: { runId: string };
				message?: string;
			};
			if (!response.ok || !body.campaign) throw new Error(body.message ?? 'Restart failed.');
			await trackPlaytestEvent({
				eventType: 'campaign_restarted',
				route: window.location.pathname.startsWith('/play/') ? 'hearth' : 'onboarding',
				runId,
				seedMode: 'same'
			});
			await goto(resolve('/onboarding/[runId]', { runId: body.campaign.runId }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Restart failed.';
			restarting = false;
		}
	}
</script>

<div
	class="objective-chip"
	class:village-navigation={villageNavigation}
	class:compact
	data-testid="active-objective"
>
	<button type="button" onclick={() => openMenu('objectives')}>
		<span>{activeObjective?.chapter ?? 'Campaign record'}</span>
		<strong>{activeObjective?.title ?? 'All current objectives complete'}</strong>
	</button>
	<button
		class="pause"
		type="button"
		onclick={() => openMenu('objectives')}
		aria-label="Pause menu"
		data-sound-cue="menu"
	>
		<span>Ⅱ</span><small>ESC</small>
	</button>
</div>

{#if open}
	<div class="backdrop" role="presentation">
		<div
			bind:this={menuDialog}
			class="menu"
			role="dialog"
			aria-modal="true"
			aria-label="Paused campaign menu"
			tabindex="-1"
			onkeydown={(event) => handleModalKeydown(event, menuDialog, closeMenu)}
		>
			<header>
				<div>
					<span>HEARTH 01 / CAMPAIGN</span>
					<h2>PAUSED</h2>
				</div>
				<button type="button" onclick={closeMenu} aria-label="Resume game" data-sound-cue="menu"
					>Resume ×</button
				>
			</header>
			<p class="clock-note">Interface paused · the server-owned settlement clock continues.</p>
			<nav aria-label="Pause menu sections">
				<button
					class:active={tab === 'objectives'}
					type="button"
					onclick={() => (tab = 'objectives')}>Objectives</button
				>
				<button class:active={tab === 'settings'} type="button" onclick={() => (tab = 'settings')}
					>Settings</button
				>
			</nav>

			{#if tab === 'objectives'}
				<div class="objective-list" data-testid="campaign-objectives">
					{#each objectives.objectives as objective, index (objective.objectiveId)}
						<article
							class:current={objective.status === 'current'}
							class:complete={objective.status === 'complete'}
						>
							<div class="ordinal">{String(index + 1).padStart(2, '0')}</div>
							<div>
								<span>{objective.chapter}</span>
								<h3>{objective.title}</h3>
								<p>{objective.detail}</p>
								{#if objective.evidence[0]}<small>{objective.evidence[0]}</small>{/if}
							</div>
							<b
								>{objective.status === 'complete'
									? '✓'
									: objective.status === 'current'
										? 'NOW'
										: '—'}</b
							>
						</article>
					{/each}
				</div>
			{:else}
				<PlayerSettingsPanel />
				<div class="run-actions">
					<div>
						<span>Run permanence</span>
						<p>
							Restarting preserves this run’s replay and begins a fresh copy of the same seeded
							company.
						</p>
					</div>
					<button
						class:confirm={confirmRestart}
						type="button"
						onclick={restartSameSeed}
						disabled={restarting}
						data-sound-cue="warning"
					>
						{restarting
							? 'Opening the gate…'
							: confirmRestart
								? 'Confirm restart'
								: 'Restart same seed'}
					</button>
					<a href={resolve('/replay/[runId]', { runId })}>Inspect this replay</a>
					<a href={resolve('/')}>Return to title</a>
				</div>
				{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	.objective-chip {
		position: fixed;
		right: 1.2rem;
		bottom: 1.2rem;
		z-index: 70;
		display: grid;
		grid-template-columns: minmax(14rem, 24rem) 3.6rem;
		box-shadow: 0 1.4rem 4rem rgba(0, 0, 0, 0.45);
	}

	.objective-chip button {
		border: 1px solid rgba(239, 201, 129, 0.26);
		background: rgba(8, 8, 8, 0.92);
		color: #f4e9d5;
		text-align: left;
		cursor: pointer;
	}

	.objective-chip.compact {
		grid-template-columns: 3.6rem;
	}

	.objective-chip.compact > button:first-child {
		display: none;
	}

	.objective-chip button:first-child {
		padding: 0.8rem 1rem;
	}
	.objective-chip span,
	.menu span {
		display: block;
		color: #c76f31;
		font-family: ui-monospace, monospace;
		font-size: 0.57rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.objective-chip strong {
		display: block;
		margin-top: 0.3rem;
		font-family: Georgia, serif;
		font-size: 0.92rem;
		font-weight: 400;
	}
	.objective-chip .pause {
		display: grid;
		place-items: center;
		border-left: 0;
		text-align: center;
	}
	.pause span {
		color: #f4e9d5;
		font-size: 1rem;
		letter-spacing: 0;
	}
	.pause small {
		color: rgba(244, 233, 213, 0.42);
		font-size: 0.5rem;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.82);
		backdrop-filter: blur(12px);
	}

	.menu {
		width: min(58rem, 100%);
		max-height: min(54rem, calc(100vh - 2rem));
		overflow: auto;
		border: 1px solid rgba(239, 201, 129, 0.25);
		background: linear-gradient(145deg, #13100d, #080808 65%);
		box-shadow: 0 2rem 8rem rgba(0, 0, 0, 0.72);
	}

	.menu > header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 1.5rem 1.7rem 1rem;
	}

	.menu h2 {
		margin: 0.3rem 0 0;
		font-family: Georgia, serif;
		font-size: 2.8rem;
		font-weight: 400;
		letter-spacing: -0.05em;
	}
	.menu header button {
		border: 0;
		background: none;
		color: rgba(244, 233, 213, 0.65);
		cursor: pointer;
	}
	.clock-note {
		margin: 0;
		padding: 0 1.7rem 1rem;
		color: rgba(244, 233, 213, 0.42);
		font-size: 0.68rem;
	}
	.menu nav {
		display: flex;
		border-top: 1px solid rgba(239, 201, 129, 0.14);
		border-bottom: 1px solid rgba(239, 201, 129, 0.14);
	}
	.menu nav button {
		flex: 1;
		padding: 0.9rem;
		border: 0;
		background: transparent;
		color: rgba(244, 233, 213, 0.42);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.menu nav button.active {
		background: rgba(185, 72, 26, 0.15);
		color: #ffd99b;
	}

	.objective-list {
		padding: 0 1.7rem 1.7rem;
	}
	.objective-list article {
		display: grid;
		grid-template-columns: 2.5rem 1fr auto;
		gap: 1rem;
		padding: 1.15rem 0;
		border-bottom: 1px solid rgba(239, 201, 129, 0.1);
		opacity: 0.38;
	}
	.objective-list article.current,
	.objective-list article.complete {
		opacity: 1;
	}
	.objective-list article.current {
		padding-left: 1rem;
		border-left: 2px solid #cd6429;
	}
	.ordinal {
		color: rgba(244, 233, 213, 0.26);
		font-family: Georgia, serif;
		font-size: 1.2rem;
	}
	.objective-list h3 {
		margin: 0.25rem 0 0.35rem;
		font-family: Georgia, serif;
		font-size: 1.18rem;
		font-weight: 400;
	}
	.objective-list p {
		margin: 0;
		color: rgba(244, 233, 213, 0.56);
		font-size: 0.75rem;
		line-height: 1.55;
	}
	.objective-list small {
		display: block;
		margin-top: 0.4rem;
		color: #70bd92;
		font-size: 0.62rem;
	}
	.objective-list b {
		align-self: center;
		color: #70bd92;
		font-size: 0.64rem;
	}

	:global(.settings) {
		margin: 0 1.7rem;
	}
	.run-actions {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.7rem 1rem;
		align-items: center;
		margin: 1rem 1.7rem 1.7rem;
		padding-top: 0.5rem;
	}
	.run-actions p {
		max-width: 34rem;
		margin: 0.3rem 0 0;
		color: rgba(244, 233, 213, 0.5);
		font-size: 0.7rem;
		line-height: 1.5;
	}
	.run-actions button,
	.run-actions a {
		padding: 0.75rem 1rem;
		border: 1px solid rgba(239, 201, 129, 0.2);
		background: transparent;
		color: rgba(244, 233, 213, 0.68);
		font-size: 0.6rem;
		letter-spacing: 0.09em;
		text-align: center;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}
	.run-actions button.confirm {
		border-color: #c44e25;
		background: #9c311b;
		color: white;
	}
	.error {
		margin: -1rem 1.7rem 1.7rem;
		color: #ff987c;
		font-size: 0.75rem;
	}

	@media (max-width: 650px) {
		.objective-chip {
			right: 0.55rem;
			bottom: 0.55rem;
			left: 0.55rem;
			grid-template-columns: 1fr 2.9rem;
		}
		.objective-chip.village-navigation {
			bottom: calc(5.25rem + env(safe-area-inset-bottom));
		}
		.objective-chip.compact {
			right: 0.65rem;
			left: auto;
			grid-template-columns: 3rem;
		}
		.objective-chip button:first-child {
			padding: 0.62rem 0.75rem;
		}
		.objective-chip button:first-child > span {
			display: none;
		}
		.objective-chip strong {
			margin-top: 0;
			font-size: 0.76rem;
			line-height: 1.2;
		}
		.menu h2 {
			font-size: 2.2rem;
		}
		.objective-list,
		.menu > header {
			padding-right: 1rem;
			padding-left: 1rem;
		}
		.objective-list small {
			overflow-wrap: anywhere;
		}
		.run-actions {
			grid-template-columns: 1fr;
			margin-right: 1rem;
			margin-left: 1rem;
		}
	}
</style>
