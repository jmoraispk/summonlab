<script lang="ts">
	import { resolve } from '$app/paths';
	import playerVisualManifest from '../../static/runtime/player/manifest.json';

	const titlePhone = playerVisualManifest.assets.find((asset) => asset.usage === 'title-phone')!;
	const titleDesktop = playerVisualManifest.assets.find(
		(asset) => asset.usage === 'title-desktop'
	)!;

	let { form }: { form: { entryError?: string } | null } = $props();
</script>

<svelte:head>
	<title>Summonlab · Enter the Village</title>
	<meta
		name="description"
		content="Enter a living settlement, summon autonomous heroes, and prepare them for a hundred-floor Tower."
	/>
</svelte:head>

<main data-testid="campaign-title">
	<picture class="gateway-art" aria-hidden="true">
		<source media="(max-width: 650px)" srcset={titlePhone.publicPath} />
		<img
			class="key-art"
			src={titleDesktop.publicPath}
			width={titleDesktop.width}
			height={titleDesktop.height}
			fetchpriority="high"
			decoding="async"
			alt=""
		/>
	</picture>
	<div class="scene-veil" aria-hidden="true"></div>

	<header>
		<p class="wordmark" aria-hidden="true">
			<span>Summon</span><strong>lab</strong>
		</p>
		<a class="wiki-link" href={resolve('/wiki')} data-testid="open-wiki">Wiki</a>
	</header>

	<section class="entry">
		<h1>Summonlab</h1>
		<form method="POST">
			<button class="enter-village" type="submit" data-testid="enter-village" data-sound-cue="gate"
				>Enter Village</button
			>
		</form>
		{#if form?.entryError}
			<p class="entry-error" role="status" aria-live="polite">{form.entryError}</p>
		{/if}
	</section>
</main>

<style>
	:global(html) {
		background: #020304;
	}

	:global(body) {
		overflow: hidden;
		background: #020304;
		color: #f2eadb;
	}

	main {
		position: relative;
		display: grid;
		min-height: 100svh;
		overflow: hidden;
		isolation: isolate;
		background: #020304;
		font-family: Georgia, 'Times New Roman', serif;
	}

	.gateway-art,
	.gateway-art::after,
	.scene-veil {
		position: absolute;
		inset: 0;
	}

	.gateway-art {
		z-index: -3;
		display: block;
	}

	.gateway-art::after {
		content: '';
		background:
			linear-gradient(
				180deg,
				rgba(1, 2, 3, 0.34),
				transparent 24%,
				transparent 70%,
				rgba(1, 2, 3, 0.42)
			),
			linear-gradient(90deg, rgba(1, 2, 3, 0.16), transparent 42%);
	}

	.key-art {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		animation: gateway-breathe 14s ease-in-out infinite alternate;
	}

	.scene-veil {
		z-index: -2;
		pointer-events: none;
		background:
			radial-gradient(circle at 76% 54%, transparent 24%, rgba(0, 0, 0, 0.12) 58%),
			linear-gradient(180deg, rgba(0, 0, 0, 0.22), transparent 18%);
	}

	header {
		align-self: start;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: clamp(1.6rem, 4vw, 3.6rem) clamp(1.5rem, 4vw, 4rem);
	}

	.wordmark,
	.wiki-link {
		margin: 0;
		color: #efe8db;
		font-size: 0.95rem;
		letter-spacing: 0.3em;
		text-decoration: none;
		text-transform: uppercase;
		text-shadow: 0 2px 1.5rem #000;
	}

	.wordmark strong {
		color: #bf5b2b;
		font-weight: 400;
	}

	.wiki-link {
		padding: 0.7rem 0 0.7rem 0.7rem;
		color: rgba(239, 232, 219, 0.72);
		font-size: 0.72rem;
		transition: color 180ms ease;
	}

	.wiki-link:hover,
	.wiki-link:focus-visible {
		color: #fff5e5;
	}

	.entry {
		align-self: end;
		justify-self: start;
		margin: 0 1.5rem clamp(2.8rem, 7vh, 5.5rem) clamp(1.5rem, 7.5vw, 7rem);
	}

	form {
		margin: 0;
	}

	h1 {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.enter-village {
		appearance: none;
		display: grid;
		width: min(28rem, calc(100vw - 3rem));
		min-height: 6.5rem;
		place-items: center;
		border: 1px solid rgba(211, 153, 86, 0.88);
		background: rgba(4, 5, 5, 0.9);
		box-shadow:
			inset 0 0 0 1px rgba(255, 223, 169, 0.05),
			0 1.5rem 4rem rgba(0, 0, 0, 0.32);
		color: #f4ebdb;
		font-size: clamp(1.35rem, 2.3vw, 2rem);
		letter-spacing: 0.18em;
		text-align: center;
		text-decoration: none;
		text-shadow: 0 1px 0.8rem rgba(255, 209, 139, 0.22);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			border-color 180ms ease,
			background 180ms ease,
			box-shadow 180ms ease,
			color 180ms ease;
	}

	.entry-error {
		max-width: 28rem;
		margin: 0.8rem 0 0;
		color: #f2b59b;
		font-size: 0.9rem;
		text-shadow: 0 1px 0.5rem #000;
	}

	.enter-village:hover,
	.enter-village:focus-visible {
		border-color: #f0b96f;
		background: rgba(22, 14, 8, 0.94);
		box-shadow:
			inset 0 0 0 1px rgba(255, 223, 169, 0.12),
			0 0 2.5rem rgba(200, 118, 49, 0.18),
			0 1.5rem 4rem rgba(0, 0, 0, 0.4);
		color: #fff7e9;
	}

	.enter-village:active {
		background: rgba(35, 20, 10, 0.96);
	}

	@keyframes gateway-breathe {
		from {
			filter: saturate(0.94) brightness(0.96);
			transform: scale(1);
		}
		to {
			filter: saturate(1.04) brightness(1.02);
			transform: scale(1.012);
		}
	}

	@media (max-width: 650px) {
		header {
			padding: max(1.5rem, env(safe-area-inset-top)) 1.6rem 1rem;
		}

		.wordmark {
			font-size: 0.9rem;
			letter-spacing: 0.25em;
		}

		.wiki-link {
			font-size: 0.68rem;
		}

		.entry {
			justify-self: stretch;
			margin: 0 1.6rem max(3rem, calc(env(safe-area-inset-bottom) + 1.5rem));
		}

		.enter-village {
			width: 100%;
			min-height: 6.75rem;
			font-size: clamp(1.25rem, 6vw, 1.6rem);
			letter-spacing: 0.15em;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.key-art {
			animation: none;
		}

		.enter-village,
		.wiki-link {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.scene-veil,
		.gateway-art::after {
			display: none;
		}

		.wordmark,
		.wiki-link,
		.enter-village {
			color: LinkText;
		}
	}
</style>
