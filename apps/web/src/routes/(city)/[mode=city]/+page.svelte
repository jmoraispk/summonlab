<script lang="ts">
	import SingletonCampaign from '$lib/components/campaign/SingletonCampaign.svelte';

	let { data } = $props();
</script>

<SingletonCampaign {data} />
