<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		loadLocalPlaytestConsent,
		PLAYTEST_CONSENT_EVENT,
		trackPlaytestEvent,
		type LocalPlaytestConsent
	} from '$lib/playtest-analytics';

	type PlayerRoute = 'title' | 'onboarding' | 'hearth' | 'replay';

	function routeContext(pathname: string): { route: PlayerRoute; runId: string | null } | null {
		if (pathname === '/') return { route: 'title', runId: null };
		const match = pathname.match(/^\/(onboarding|play|replay)\/([a-f0-9-]+)$/u);
		if (!match) return null;
		return {
			route: match[1] === 'play' ? 'hearth' : (match[1] as Exclude<PlayerRoute, 'title'>),
			runId: match[2] ?? null
		};
	}

	function trackRoute(pathname: string) {
		const context = routeContext(pathname);
		if (context) void trackPlaytestEvent({ eventType: 'route_viewed', ...context });
	}

	onMount(() => {
		const consent = loadLocalPlaytestConsent();
		document.documentElement.dataset.playtestConsent = consent.decision;
		trackRoute(window.location.pathname);
		const onConsent = (event: Event) => {
			const next = (event as CustomEvent<LocalPlaytestConsent>).detail;
			if (next.decision === 'granted') trackRoute(window.location.pathname);
		};
		window.addEventListener(PLAYTEST_CONSENT_EVENT, onConsent);
		return () => window.removeEventListener(PLAYTEST_CONSENT_EVENT, onConsent);
	});

	afterNavigate(({ from, to }) => {
		if (!to || from?.url.pathname === to.url.pathname) return;
		trackRoute(to.url.pathname);
	});
</script>
