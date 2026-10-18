<script lang="ts">
	import { tick } from 'svelte';

	let {
		src,
		sourcePath,
		alt,
		width,
		height,
		loading = 'lazy',
		fetchpriority = 'auto'
	}: {
		src: string;
		sourcePath: string;
		alt: string;
		width: number;
		height: number;
		loading?: 'lazy' | 'eager';
		fetchpriority?: 'high' | 'low' | 'auto';
	} = $props();
	let dialog: HTMLDialogElement;
	let viewport = $state<HTMLDivElement>();
	let opened = $state(false);
	let zoom = $state(1);
	let sourceFailed = $state(false);
	let loaded = $state(false);
	const original = $derived(
		`https://media.githubusercontent.com/media/jmoraispk/summonlab/main/${sourcePath}`
	);

	async function open() {
		opened = true;
		zoom = 1;
		sourceFailed = false;
		loaded = false;
		await tick();
		dialog.showModal();
	}

	async function changeZoom(next: number) {
		const area = viewport;
		if (!area) return;
		const centerX = (area.scrollLeft + area.clientWidth / 2) / zoom;
		const centerY = (area.scrollTop + area.clientHeight / 2) / zoom;
		zoom = next;
		await tick();
		area.scrollLeft = centerX * zoom - area.clientWidth / 2;
		area.scrollTop = centerY * zoom - area.clientHeight / 2;
	}
</script>

<button class="thumbnail" type="button" aria-label={`Enlarge ${alt}`} onclick={open}>
	<img {src} {alt} {width} {height} {loading} {fetchpriority} />
	<span>Zoom ↗</span>
</button>

<dialog bind:this={dialog} class="artwork-dialog" aria-label={alt} onclose={() => (opened = false)}>
	{#if opened}
		<header>
			<strong>{alt}</strong>
			<button type="button" onclick={() => dialog.close()} aria-label="Close image">Close ×</button>
		</header>
		<div class="controls" role="group" aria-label="Image zoom">
			<button
				type="button"
				disabled={zoom === 1}
				onclick={() => changeZoom(zoom - 0.5)}
				aria-label="Zoom out">−</button
			>
			<span role="status">{Math.round(zoom * 100)}%</span>
			<button
				type="button"
				disabled={zoom === 4}
				onclick={() => changeZoom(zoom + 0.5)}
				aria-label="Zoom in">+</button
			>
			<button type="button" onclick={() => changeZoom(1)}>Fit image</button>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- full-resolution repository raster -->
			<a href={original} target="_blank" rel="noreferrer">Open original image ↗</a>
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable artwork needs keyboard focus for native arrow/Page scrolling.) -->
		<div
			class="viewport"
			bind:this={viewport}
			tabindex="0"
			role="region"
			aria-label="Enlarged artwork; scroll to inspect when zoomed"
		>
			<img
				src={sourceFailed ? src : original}
				{alt}
				style:width={`${zoom * 100}%`}
				style:height={`${zoom * 100}%`}
				onload={() => (loaded = true)}
				onerror={() => (sourceFailed = true)}
			/>
		</div>
		<p aria-live="polite">
			{#if sourceFailed}Original image unavailable. Showing the smaller preview.
			{:else if !loaded}Loading original image…
			{:else}Zoom in, then scroll to inspect details.{/if}
		</p>
	{/if}
</dialog>

<style>
	.thumbnail {
		position: relative;
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: #080b0f;
		color: #f3ead9;
		cursor: zoom-in;
	}
	.thumbnail img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		object-fit: contain;
	}
	.thumbnail span {
		position: absolute;
		right: 0.4rem;
		bottom: 0.4rem;
		padding: 0.3rem 0.45rem;
		background: #080b0fe6;
		font:
			0.65rem ui-monospace,
			monospace;
	}
	.thumbnail:focus-visible {
		outline: 2px solid #70c7d2;
		outline-offset: -3px;
	}
	.artwork-dialog {
		width: min(90rem, calc(100vw - 2rem));
		max-width: none;
		max-height: calc(100dvh - 2rem);
		padding: 1rem;
		border: 1px solid #47616b;
		border-radius: 0.5rem;
		background: #080b0f;
		color: #f3ead9;
		box-sizing: border-box;
	}
	.artwork-dialog::backdrop {
		background: #010304e6;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	strong {
		font:
			1.25rem Georgia,
			serif;
	}
	.controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-block: 0.75rem;
	}
	.controls span {
		min-width: 3rem;
		text-align: center;
		font:
			0.8rem ui-monospace,
			monospace;
	}
	button:not(.thumbnail),
	a {
		min-height: 2.75rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid #47616b;
		border-radius: 0.25rem;
		background: #131c22;
		color: #bcebf0;
		font:
			0.8rem ui-monospace,
			monospace;
		text-decoration: none;
		cursor: pointer;
		box-sizing: border-box;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.viewport {
		height: min(65dvh, 60rem);
		overflow: auto;
		background: #030507;
	}
	.viewport img {
		display: block;
		max-width: none;
		object-fit: contain;
	}
	p {
		margin: 0.65rem 0 0;
		color: #b3b9bc;
		font:
			0.75rem/1.4 ui-monospace,
			monospace;
	}
	@media (max-width: 40rem) {
		.artwork-dialog {
			width: calc(100vw - 1rem);
			padding: 0.75rem;
		}
		strong {
			font-size: 1rem;
		}
		.viewport {
			height: 55dvh;
		}
	}
</style>
