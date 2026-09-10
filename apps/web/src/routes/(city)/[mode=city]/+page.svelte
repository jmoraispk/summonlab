<script lang="ts">
	import SingletonCampaign from '$lib/components/campaign/SingletonCampaign.svelte';
	import SingletonOnboarding from '$lib/components/campaign/SingletonOnboarding.svelte';

	let { data } = $props();
</script>

{#if data.stage === 'onboarding'}
	<SingletonOnboarding data={data.onboarding} />
{:else}
	<SingletonCampaign data={data.campaign} />
{/if}
