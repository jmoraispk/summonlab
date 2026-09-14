import type { EngineReplayReport } from '@summonlab/contracts';

/**
 * The mission screen still consumes the historical replay shape. For capability
 * runs, remove the private cognition/personality branch before Svelte serializes
 * page data while preserving the public combat attributes used by the UI.
 */
export function projectMissionReportForPublic(report: EngineReplayReport): EngineReplayReport {
	if (report.snapshot.state.schemaVersion !== 25 && report.snapshot.state.schemaVersion !== 26) {
		return report;
	}
	const projected = structuredClone(report);
	for (const hero of Object.values(projected.snapshot.state.heroes)) {
		const publicHero = hero as unknown as Record<string, unknown>;
		delete publicHero.mind;
		const profile = publicHero.capabilityProfile;
		if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
			delete (profile as Record<string, unknown>).learning;
		}
	}
	return projected;
}
