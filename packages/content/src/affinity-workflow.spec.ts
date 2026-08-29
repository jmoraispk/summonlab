import { describe, expect, it } from 'vitest';

import {
	AFFINITY_IDS,
	AFFINITY_SPECIES,
	ALL_AFFINITY_TARGETS,
	BASE_AFFINITY_TARGETS,
	BREADTH_AFFINITY_RELEASE_GATE,
	BREADTH_AFFINITY_TARGETS,
	CORRECTION_REGRESSION_TARGETS,
	CONTROLLED_AFFINITY_TARGETS,
	ELEMENTAL_REGRESSION_TARGETS,
	FINAL_FRAMING_REGRESSION_TARGETS,
	GOBLIN_AFFINITY_AUDIT_60,
	GOBLIN_AFFINITY_AUDIT_600,
	GOBLIN_ATTRIBUTE_OPTIONS,
	createAffinityWorkflowTarget,
	createElementalRegressionTarget,
	createGoblinAffinityAttributes,
	summarizeGoblinManifestAudit
} from './affinity-workflow.js';

describe('affinity workflow content', () => {
	it('preserves the complete 48-target base matrix and adds eleven explicit regression targets', () => {
		expect(AFFINITY_SPECIES).toHaveLength(8);
		expect(AFFINITY_IDS).toHaveLength(6);
		expect(CONTROLLED_AFFINITY_TARGETS).toHaveLength(24);
		expect(BREADTH_AFFINITY_TARGETS).toHaveLength(24);
		expect(BASE_AFFINITY_TARGETS).toHaveLength(48);
		expect(ELEMENTAL_REGRESSION_TARGETS).toHaveLength(6);
		expect(CORRECTION_REGRESSION_TARGETS).toHaveLength(5);
		expect(FINAL_FRAMING_REGRESSION_TARGETS).toHaveLength(1);
		expect(ALL_AFFINITY_TARGETS).toHaveLength(60);
		expect(new Set(ALL_AFFINITY_TARGETS.map((target) => target.targetId)).size).toBe(60);

		for (const species of AFFINITY_SPECIES) {
			const speciesTargets = BASE_AFFINITY_TARGETS.filter(
				(target) => target.speciesId === species.id
			);
			expect(speciesTargets.map((target) => target.affinity).sort()).toEqual(
				[...AFFINITY_IDS].sort()
			);
		}

		expect(CONTROLLED_AFFINITY_TARGETS.every((target) => target.cohort === 'controlled')).toBe(
			true
		);
		expect(BREADTH_AFFINITY_TARGETS.every((target) => target.cohort === 'breadth')).toBe(true);
		expect(BREADTH_AFFINITY_RELEASE_GATE).toMatchObject({
			requiresCohort: 'controlled',
			requiredCompletedTargets: 24,
			requiredSpeciesRecognitions: 23,
			requiredAffinityRecognitions: 20,
			requiresWorkflowPass: true
		});
	});

	it('adds one bounded final framing sentinel for the successful Metal construction', () => {
		const target = FINAL_FRAMING_REGRESSION_TARGETS[0];
		expect(target).toMatchObject({
			targetId: 'affinity-workflow-v1-death-knight-metal-v3',
			cohort: 'regression',
			promptProtocol: 'safe-frame-v4',
			authoringProtocol: 'semantic-v2'
		});
		expect(target.references[0]).toMatchObject({
			path: 'assets/enemies/experiments/affinity-workflow-v1/candidates/regression/death-knight/metal-v2.png',
			contentHash: '24715b4bbb1fa648a547034cc6eec56a29ade33bc093a22f9070a8f4779625bd'
		});
		expect(target.presentation.composition).toContain('shorter sword');
		expect(target.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
			'bounded-sword-safe-frame'
		);
	});

	it('versions all five known corrections under the repaired safe-frame protocol', () => {
		expect(CORRECTION_REGRESSION_TARGETS.map((target) => target.targetId)).toEqual([
			'affinity-workflow-v1-death-knight-metal-v2',
			'affinity-workflow-v1-grey-wolf-fire-v2',
			'affinity-workflow-v1-cave-bear-wood-v2',
			'affinity-workflow-v1-cave-bear-wind-v2',
			'affinity-workflow-v1-elemental-fire-v3'
		]);
		for (const target of CORRECTION_REGRESSION_TARGETS) {
			expect(target).toMatchObject({
				cohort: 'regression',
				promptProtocol: 'safe-frame-v4',
				authoringProtocol: 'semantic-v2'
			});
			expect(target.output.candidatePath).toBe(
				`assets/enemies/experiments/affinity-workflow-v1/candidates/regression/${target.speciesId}/${target.affinity}-${target.targetId.endsWith('-v3') ? 'v3' : 'v2'}.png`
			);
			expect(target.output.resultPath).toBe(
				`assets/enemies/experiments/affinity-workflow-v1/results/regression/${target.speciesId}-${target.affinity}-${target.targetId.endsWith('-v3') ? 'v3' : 'v2'}.json`
			);
			expect(target.references[0]?.path).toContain(
				'assets/enemies/experiments/affinity-workflow-v1/candidates/'
			);
			expect(target.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
				'protocol-provenance'
			);
		}
	});

	it('strengthens only the observed correction failures while retaining source invariants', () => {
		const target = (speciesId: string, affinity: string) =>
			CORRECTION_REGRESSION_TARGETS.find(
				(candidate) => candidate.speciesId === speciesId && candidate.affinity === affinity
			)!;
		const deathKnight = target('death-knight', 'metal');
		expect(deathKnight.identityInvariants).toEqual(
			expect.arrayContaining(
				createAffinityWorkflowTarget('death-knight', 'metal').identityInvariants
			)
		);
		expect(deathKnight.affinityDesign.expression).toContain('load-bearing plates');
		expect(deathKnight.affinityDesign.expression).toContain('metallic marrow');
		expect(deathKnight.prohibitedTraits.join(' ')).toContain('Normal Death Knight');
		expect(deathKnight.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
			'forged-body-distinction'
		);

		const wolf = target('grey-wolf', 'fire');
		expect(wolf.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
			'canonical-provenance-rerun'
		);
		expect(wolf.references[0]?.contentHash).toBe(
			'e845d07374a1d7709b520570f84c36cc441170012b57dc4c64808cea9243cfed'
		);

		for (const affinity of ['wood', 'wind']) {
			const bear = target('cave-bear', affinity);
			expect(bear.anatomyInvariants.join(' ')).toContain('all four paws');
			expect(bear.presentation.composition).toContain('broadside-to-three-quarter');
			expect(bear.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
				'four-readable-paws'
			);
		}

		const elemental = target('elemental', 'fire');
		expect(elemental.identityInvariants).toEqual(
			expect.arrayContaining(createElementalRegressionTarget('fire').identityInvariants)
		);
		expect(elemental.presentation.composition).toContain('inner eighty-four percent');
		expect(elemental.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
			'bounded-combustion-safe-frame'
		);
	});

	it('defines a semantic safe-frame v3 Elemental regression across all six affinities', () => {
		expect(ELEMENTAL_REGRESSION_TARGETS.map((target) => target.affinity).sort()).toEqual(
			[...AFFINITY_IDS].sort()
		);
		for (const target of ELEMENTAL_REGRESSION_TARGETS) {
			expect(target).toMatchObject({
				cohort: 'regression',
				speciesId: 'elemental',
				chassisId: 'bound-vanguard-elemental',
				promptProtocol: 'safe-frame-v3',
				authoringProtocol: 'semantic-v2'
			});
			expect(target.targetId).toBe(`affinity-workflow-v1-elemental-${target.affinity}-v2`);
			expect(target.output.candidatePath).toContain(
				`/candidates/regression/elemental/${target.affinity}-v2.png`
			);
			expect(target.output.resultPath).toContain(
				`/results/regression/elemental-${target.affinity}-v2.json`
			);
			expect(target.identityInvariants.join(' ')).toContain('shallow concave');
			expect(target.identityInvariants.join(' ')).toContain('pale arcane sternum core');
			expect(target.anatomyInvariants.join(' ')).toContain('no head');
			const objectiveIds = target.acceptanceCriteria
				.filter((criterion) => criterion.kind === 'objective' && criterion.required)
				.map((criterion) => criterion.criterionId);
			expect(objectiveIds).toContain('manifest-fidelity');
			expect(objectiveIds).toContain('fixed-chassis-fidelity');
			expect(objectiveIds).toContain(
				target.affinity === 'normal' ? 'neutral-composite-body' : 'declared-substance-body'
			);
		}
	});

	it('keeps dispatched v3 prompts immutable and assigns the repaired v4 lock to future work', () => {
		expect(
			CONTROLLED_AFFINITY_TARGETS.find(
				(target) => target.speciesId === 'cave-bear' && target.affinity === 'fire'
			)?.promptProtocol
		).toBe('safe-frame-v3');
		expect(
			CONTROLLED_AFFINITY_TARGETS.find(
				(target) => target.speciesId === 'cave-bear' && target.affinity === 'metal'
			)?.promptProtocol
		).toBe('safe-frame-v4');
		expect(
			BREADTH_AFFINITY_TARGETS.every((target) => target.promptProtocol === 'safe-frame-v4')
		).toBe(true);
	});

	it('binds regression chassis and material references to separate declared purposes', () => {
		for (const target of ELEMENTAL_REGRESSION_TARGETS) {
			const [chassis, material] = target.references;
			expect(chassis).toMatchObject({
				path: 'assets/enemies/review/pack-2/benchmarks/bound-vanguard-neutral-anchor-v1.png',
				contentHash: 'a934483cc02570e674c16b6c51d0120aeb05029370b8ef0ab0dd9e96727156a1'
			});
			expect(chassis?.purpose).toContain('Exact Bound Vanguard headless shallow-concave chassis');
			expect(material?.path).toBe('assets/enemies/review/pack-2/elementals-v1.png');
			expect(material?.purpose).toContain('only the declared substance material behavior');
			expect(material?.purpose).toContain('do not transfer any depicted anatomy');
		}
	});

	it('makes every regression affinity a load-bearing substance contract with explicit exclusions', () => {
		const requiredTerms = {
			normal: ['ceramic composite', 'no elemental read'],
			wood: ['grain', 'growth rings', 'roots', 'no stone'],
			fire: ['flame', 'plasma', 'minimal slag'],
			metal: ['specular planes', 'articulated joints', 'metallic marrow'],
			water: ['continuous coherent liquid', 'ice'],
			wind: ['compressed air', 'vapor', 'negative space', 'rock']
		} as const;
		for (const target of ELEMENTAL_REGRESSION_TARGETS) {
			const contract = [
				target.affinityDesign.expression,
				...target.prohibitedTraits,
				...target.acceptanceCriteria.map((criterion) => criterion.description)
			].join(' ');
			for (const term of requiredTerms[target.affinity]) expect(contract).toContain(term);
		}
	});

	it('holds Elite presentation fixed and claims canonical grade only for Pack 2 archetypes', () => {
		for (const target of ALL_AFFINITY_TARGETS) {
			expect(target.threat.presentationTier).toBe('elite');
			expect(target.threat.referenceGrade).toBe(4);
			expect(target.threat.canonicalGrade).toBe(
				['death-knight', 'cave-drake', 'tower-basilisk'].includes(target.speciesId) ? 4 : null
			);
			expect(target.presentation.canvas).toMatchObject({
				width: 1536,
				height: 1024,
				safeMarginPercent: 8
			});
		}
	});

	it('uses a fixed Bound Vanguard chassis for all six elemental targets', () => {
		const elementals = CONTROLLED_AFFINITY_TARGETS.filter(
			(target) => target.speciesId === 'elemental'
		);
		expect(elementals).toHaveLength(6);
		for (const target of elementals) {
			expect(target.chassisId).toBe('bound-vanguard-elemental');
			expect(target.identityInvariants.join(' ')).toContain(
				'same Bound Vanguard Elemental chassis'
			);
			expect(target.anatomyInvariants).toContain(
				'affinity substance changes while chassis proportions remain fixed'
			);
		}
	});

	it('binds every reference to a repository path, SHA-256, and explicit purpose', () => {
		for (const target of ALL_AFFINITY_TARGETS) {
			expect(target.references.length).toBeGreaterThanOrEqual(2);
			for (const reference of target.references) {
				expect(reference.path).toMatch(
					/^assets\/enemies\/(?:review|experiments\/affinity-workflow-v1\/candidates)\//
				);
				expect(reference.path).not.toContain('..');
				expect(reference.contentHash).toMatch(/^[a-f0-9]{64}$/);
				expect(reference.purpose.length).toBeGreaterThan(30);
			}
		}
	});

	it('keeps the Tower Basilisk explicitly six-legged and rejects four- or eight-legged drift', () => {
		const basilisk = createAffinityWorkflowTarget('tower-basilisk', 'wind');
		expect(basilisk.anatomyInvariants).toContain(
			'exactly six grounded legs visible as three coherent pairs'
		);
		expect(basilisk.prohibitedTraits).toContain('ordinary four-legged lizard');
		expect(basilisk.prohibitedTraits).toContain('eight legs');
	});

	it('derives repeatable goblin attributes from independent named seed streams', () => {
		const first = createGoblinAffinityAttributes('repeatable-goblin');
		const second = createGoblinAffinityAttributes('repeatable-goblin');
		const different = createGoblinAffinityAttributes('different-goblin');
		expect(first).toEqual(second);
		expect(different).not.toEqual(first);
		expect(() => createGoblinAffinityAttributes('   ')).toThrow(/seed cannot be empty/i);
		expect(first.weaponOrFocus.length).toBeGreaterThan(5);
	});

	it('gives the six-image goblin cohort all affinities and useful compound variation', () => {
		const goblins = BREADTH_AFFINITY_TARGETS.filter((target) => target.speciesId === 'goblin');
		const variations = goblins.map((target) => target.goblinVariation!);
		expect(goblins.map((target) => target.affinity).sort()).toEqual([...AFFINITY_IDS].sort());
		expect(new Set(variations.map((entry) => entry.battlefieldDuty)).size).toBeGreaterThanOrEqual(
			4
		);
		expect(new Set(variations.map((entry) => entry.build)).size).toBe(4);
		expect(new Set(variations.map((entry) => entry.face.shape)).size).toBe(6);
		expect(new Set(variations.map((entry) => entry.clothingSilhouette)).size).toBe(6);
	});

	it('publishes passing 60- and 600-manifest coverage and correlation gates', () => {
		for (const audit of [GOBLIN_AFFINITY_AUDIT_60, GOBLIN_AFFINITY_AUDIT_600]) {
			expect(audit.sampleSize).toBeOneOf([60, 600]);
			expect(audit.coverage.every((entry) => entry.passed)).toBe(true);
			expect(audit.correlations.every((entry) => entry.passed)).toBe(true);
			expect(audit.gates).toEqual({
				coveragePassed: true,
				correlationPassed: true,
				passed: true
			});
		}
	});

	it('rejects a deliberately affinity-locked goblin stereotype', () => {
		const rows = Array.from({ length: 60 }, (_, index) => {
			const affinityId = AFFINITY_IDS[index % AFFINITY_IDS.length]!;
			const attributes = createGoblinAffinityAttributes(`locked-${index}`);
			return {
				affinityId,
				attributes: {
					...attributes,
					duty: GOBLIN_ATTRIBUTE_OPTIONS.duty[index % AFFINITY_IDS.length]!
				}
			};
		});
		const audit = summarizeGoblinManifestAudit(rows, 'deliberate-stereotype');
		const dutyCorrelation = audit.correlations.find((entry) => entry.rightAxis === 'duty');
		expect(dutyCorrelation?.passed).toBe(false);
		expect(audit.gates.correlationPassed).toBe(false);
		expect(audit.gates.passed).toBe(false);
	});
});
