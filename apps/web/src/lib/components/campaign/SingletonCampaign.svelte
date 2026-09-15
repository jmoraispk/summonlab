<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { AuthoritativeEvent } from '@summonlab/contracts';
	import { onDestroy } from 'svelte';

	import PlayerMenu from '$lib/components/PlayerMenu.svelte';
	import RunConnection from '$lib/components/RunConnection.svelte';
	import CityScreen from '$lib/components/city/CityScreen.svelte';
	import type { CityIntent, CitySummonIntent } from '$lib/city';
	import type { CampaignPageData } from '$lib/server/singleton-village-page';

	let { data }: { data: CampaignPageData } = $props();
	let eventCue = $state<AuthoritativeEvent | null>(null);
	let pendingCityIntent = $state<CityIntent | null>(null);
	let cityIntentError = $state<string | null>(null);
	let eventCueTimer: ReturnType<typeof setTimeout> | null = null;
	const pageTitle = $derived(
		data.city
			? `${data.city.mode[0].toUpperCase()}${data.city.mode.slice(1)} · Hearth 01 · summonlab`
			: 'Hearth 01 · summonlab'
	);

	onDestroy(() => {
		if (eventCueTimer) clearTimeout(eventCueTimer);
	});

	async function refreshProjection() {
		await invalidateAll();
	}

	async function responseMessage(response: Response, fallback: string): Promise<void> {
		const body = (await response.json().catch(() => ({}))) as { message?: string };
		if (!response.ok) throw new Error(body.message ?? fallback);
	}

	async function summonHero(intent: CitySummonIntent): Promise<void> {
		const response = await fetch(`/api/campaigns/${data.snapshot.runId}/summons`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(intent)
		});
		await responseMessage(response, 'The summoning threshold did not open.');
		await invalidateAll();
	}

	async function askFirstQuestion(heroId: string, exactText: string): Promise<void> {
		const response = await fetch(`/api/runs/${data.snapshot.runId}/conversations`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				targetHeroId: heroId,
				kind: 'ask',
				exactText,
				tone: 'reassuring',
				delivery: 'private',
				orderIntent: null
			})
		});
		await responseMessage(response, 'The hero did not answer.');
		await invalidateAll();
	}

	async function completeIntroduction(): Promise<void> {
		const response = await fetch(`/api/campaigns/${data.snapshot.runId}/onboarding`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ step: 3 })
		});
		await responseMessage(response, 'The introductions stayed open.');
		await invalidateAll();
	}

	async function submitCityIntent(intent: CityIntent) {
		if (pendingCityIntent) return;
		pendingCityIntent = intent;
		cityIntentError = null;
		try {
			const response = await fetch(`/api/runs/${data.snapshot.runId}/city-actions`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(intent)
			});
			await responseMessage(response, 'The resident action was not recorded.');
			await invalidateAll();
		} catch (error) {
			cityIntentError =
				error instanceof Error ? error.message : 'The resident action was not recorded.';
		} finally {
			pendingCityIntent = null;
		}
	}

	function showEventCue(event: AuthoritativeEvent) {
		eventCue = event;
		if (eventCueTimer) clearTimeout(eventCueTimer);
		eventCueTimer = setTimeout(() => (eventCue = null), 4_600);
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content="Enter Hearth 01 and guide its first summoned company." />
</svelte:head>

<main>
	<RunConnection
		runId={data.snapshot.runId}
		initialCursor={data.eventHead.eventCursor}
		onRefresh={refreshProjection}
		onEvent={showEventCue}
	/>
	{#if data.city}
		<CityScreen
			view={{ ...data.city, eventCue }}
			onIntent={submitCityIntent}
			onSummon={summonHero}
			onAskFirstQuestion={askFirstQuestion}
			onCompleteIntroduction={completeIntroduction}
			pendingIntent={pendingCityIntent}
			intentError={cityIntentError}
			onEquipmentChanged={refreshProjection}
			onTowerChanged={refreshProjection}
		/>
	{:else}
		<section class="unavailable" role="status">
			<h1>Hearth 01 is reconnecting.</h1>
			<p>The authoritative Village projection is temporarily unavailable.</p>
		</section>
	{/if}
</main>

{#if data.campaignView}
	<PlayerMenu
		runId={data.snapshot.runId}
		initialObjectives={data.campaignView.objectives}
		villageNavigation
		compact={data.city?.mode !== 'village'}
	/>
{/if}

<style>
	:global(body) {
		overflow-x: hidden;
		background: #080a0e;
	}

	main {
		min-height: 100vh;
		background: #080a0e;
	}

	.unavailable {
		display: grid;
		min-height: 70vh;
		place-content: center;
		padding: 2rem;
		color: #eee5d8;
		text-align: center;
	}

	.unavailable h1 {
		font-family: Georgia, serif;
		font-weight: 400;
	}

	.unavailable p {
		color: #eee5d888;
	}
</style>
