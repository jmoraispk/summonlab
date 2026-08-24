<script lang="ts">
	import { resolve } from '$app/paths';
	import prototypeHtml from '../../../../../prototype/index.html?raw';
</script>

<svelte:head>
	<title>Summonlab · Original design reference</title>
</svelte:head>

<header>
	<a href={resolve('/')}>← Foundation health</a>
	<div>
		<p>Preserved prototype</p>
		<h1>Tower command interface</h1>
	</div>
</header>

<iframe title="Original interactive Summonlab prototype" srcdoc={prototypeHtml}></iframe>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 2rem;
		min-height: 5.5rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: #090b12;
	}

	a {
		color: #f4ce7a;
		font-size: 0.74rem;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}

	p,
	h1 {
		margin: 0;
	}

	p {
		color: rgba(247, 242, 232, 0.45);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin-top: 0.2rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.35rem;
		font-weight: 400;
	}

	iframe {
		display: block;
		width: 100%;
		height: calc(100vh - 5.5rem);
		border: 0;
		background: #070911;
	}

	@media (max-width: 560px) {
		header {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.65rem;
		}
	}
</style>
