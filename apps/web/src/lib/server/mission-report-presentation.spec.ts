import type { EngineReplayReport } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { projectMissionReportForPublic } from './mission-report-presentation';

describe('mission report public projection', () => {
	it('keeps combat attributes while removing private mind and learning data', () => {
		const report = {
			snapshot: {
				state: {
					schemaVersion: 26,
					heroes: {
						hero: {
							mind: {
								personality: { openness: 91 },
								primaryValue: 'knowledge',
								dailyHabit: 'catalogs-tools'
							},
							capabilityProfile: {
								profileVersion: 'character-capability-v1',
								attributes: { strength: 21, agility: 43, vitality: 32, magic: 54 },
								learning: {
									cognitiveLearningScore: 87,
									domainAptitudes: { martial: 60 }
								}
							}
						}
					}
				}
			}
		} as unknown as EngineReplayReport;

		const projected = projectMissionReportForPublic(report);
		const serialized = JSON.stringify(projected);

		expect(serialized).not.toContain('cognitiveLearningScore');
		expect(serialized).not.toContain('domainAptitudes');
		expect(serialized).not.toContain('personality');
		expect(serialized).not.toContain('primaryValue');
		expect(serialized).not.toContain('dailyHabit');
		expect(projected.snapshot.state.heroes.hero).toMatchObject({
			capabilityProfile: {
				attributes: { strength: 21, agility: 43, vitality: 32, magic: 54 }
			}
		});
	});

	it('does not alter historical report shapes', () => {
		const report = {
			snapshot: { state: { schemaVersion: 20, heroes: { hero: { mind: { personality: {} } } } } }
		} as unknown as EngineReplayReport;

		expect(projectMissionReportForPublic(report)).toStrictEqual(report);
	});
});
