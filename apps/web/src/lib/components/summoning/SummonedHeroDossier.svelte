<script lang="ts">
	import { onMount, tick } from 'svelte';

	import type { CitySummonHero } from '$lib/city';
	import { focusDialog, handleModalKeydown } from '$lib/modal-focus';

	let { hero, onClose }: { hero: CitySummonHero; onClose: () => void } = $props();
	let dialog: HTMLDialogElement;
	let returnFocus: HTMLElement | null = null;

	onMount(() => {
		returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		void tick().then(() => focusDialog(dialog));
	});

	async function close() {
		onClose();
		await tick();
		returnFocus?.focus();
	}

	const details = $derived([
		['Age', String(hero.adultAge)],
		['Height', `${hero.heightCm} cm`],
		['Build', hero.bodyBuild],
		['Voice', hero.voice],
		['Role', hero.role],
		['Primary value', hero.primaryValue],
		['Drive', hero.primaryDrive],
		['Social style', hero.socialStyle],
		['Under stress', hero.stressResponse],
		['Daily habit', hero.dailyHabit]
	] as const);
</script>

<div class="backdrop">
	<dialog
		bind:this={dialog}
		open
		aria-modal="true"
		aria-label={`${hero.name} details`}
		tabindex="-1"
		onkeydown={(event) => handleModalKeydown(event, dialog, close)}
	>
		<button class="close" type="button" onclick={close} aria-label={`Close ${hero.name} details`}>
			×
		</button>
		<div class="portrait">
			<img
				src={hero.summonArt.publicPath}
				width={hero.summonArt.width}
				height={hero.summonArt.height}
				alt={`${hero.name} summon portrait`}
			/>
		</div>
		<section>
			<p>Summon {String(hero.ordinal).padStart(2, '0')}</p>
			<h2>{hero.name}</h2>
			<span class="boundary">Observable mind · no hidden reasoning</span>
			<dl>
				{#each details as detail (detail[0])}
					<div>
						<dt>{detail[0]}</dt>
						<dd>{detail[1].replaceAll('-', ' ')}</dd>
					</div>
				{/each}
			</dl>
			{#if hero.firstReply}
				<blockquote>
					<p>“{hero.firstReply.exactText}”</p>
					<footer>{hero.firstReply.publicReason}</footer>
				</blockquote>
			{/if}
		</section>
	</dialog>
</div>

<style>
	.backdrop {
		position: fixed;
		z-index: 160;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: #010304d9;
	}

	dialog {
		position: relative;
		display: grid;
		grid-template-columns: minmax(15rem, 0.8fr) minmax(18rem, 1fr);
		width: min(62rem, 96vw);
		max-height: 90vh;
		margin: 0;
		padding: 0;
		overflow: auto;
		border: 1px solid #d3a35b66;
		background: #080a0b;
		color: #f2e8d8;
	}

	.close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 2;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid #f2e8d844;
		background: #080a0be6;
		color: inherit;
		cursor: pointer;
		font-size: 1.5rem;
	}

	.portrait {
		min-height: 34rem;
		background: radial-gradient(circle at 50% 35%, #62462955, #080a0b 68%);
	}

	.portrait img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center bottom;
	}

	section {
		padding: clamp(1.4rem, 4vw, 3rem);
	}

	section > p,
	.boundary,
	dt {
		color: #c89854;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h2 {
		margin: 0.35rem 0 1.25rem;
		font-family: Georgia, serif;
		font-size: clamp(2rem, 5vw, 3.8rem);
		font-weight: 400;
	}

	dl {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		margin: 1.5rem 0;
		background: #d3a35b22;
	}

	dl div {
		padding: 0.85rem;
		background: #0e1011;
	}

	dd {
		margin: 0.25rem 0 0;
		text-transform: capitalize;
	}

	blockquote {
		margin: 1.5rem 0 0;
		padding: 1rem;
		border-left: 2px solid #cc8a42;
		background: #6f2d181f;
		font-family: Georgia, serif;
	}

	blockquote footer {
		color: #c6b7a288;
		font-family: system-ui, sans-serif;
		font-size: 0.75rem;
	}

	@media (max-width: 650px) {
		dialog {
			grid-template-columns: 1fr;
		}

		.portrait {
			min-height: 20rem;
		}
	}
</style>
