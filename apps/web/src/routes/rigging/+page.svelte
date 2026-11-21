<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { rigBenchEntryFromMessage, rigBenchOrigin, rigBenchSource } from '$lib/rig-bench';
	import { onMount } from 'svelte';

	// Read once: the bench reports later selections itself, so the frame is never reloaded.
	const src = rigBenchSource(page.url.searchParams.get('entry'));
	let frame: HTMLIFrameElement | undefined = $state();

	onMount(() => {
		const onMessage = (event: MessageEvent) => {
			const entry = rigBenchEntryFromMessage(event.origin, event.data);
			if (!entry || page.url.searchParams.get('entry') === entry) return;
			const url = `${resolve('/rigging')}?entry=${encodeURIComponent(entry)}`;
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- the route pathname is resolved above before the query is appended
			replaceState(url, page.state);
		};
		window.addEventListener('message', onMessage);
		// The bench may have loaded before this page hydrated; ask which entry it shows.
		frame?.contentWindow?.postMessage({ type: 'rig-bench-hello' }, rigBenchOrigin);
		return () => window.removeEventListener('message', onMessage);
	});
</script>

<svelte:head>
	<title>Summonlab · Rig test bench</title>
	<meta
		name="description"
		content="Rigged 3D heroes, monsters and equipment generated for Summonlab: clips, hit regions, weapons and ragdolls."
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<iframe
	bind:this={frame}
	class="bench"
	title="Rig test bench"
	{src}
	allow="fullscreen"
	referrerpolicy="strict-origin-when-cross-origin"
></iframe>

<style>
	.bench {
		position: fixed;
		inset: 0;
		z-index: 10;
		width: 100%;
		height: 100%;
		border: 0;
		background: #14161a;
	}
</style>
