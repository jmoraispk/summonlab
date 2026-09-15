# Task 7 implementation report

## Outcome

- Added additive `combat-skill-v1`, learned per-skill mastery, named resistance source, and `combat-equipment-profile-v1` contracts.
- Kept the frozen `equipment-definition-v1` catalog and all 140 existing IDs/content hash unchanged.
- Added deeply frozen runtime profiles for all existing equipment definitions and stable starter skill records for `equipment-bronze-sword` / `equipment-ash-bow` delivery.
- Added deterministic loadout eligibility and legal combat-skill enumeration based on the three-way intersection of equipped, authored, and trained family tags.
- Separated intrinsic Might requirements from effective `equipment-load` Might tolerance. No Vitality gate or universal poise was introduced.

## RED evidence

1. Initial contract/content/engine tests failed because `combat-skill.ts`, `combat-skills.ts`, and `legal-actions.ts` did not exist.
2. Follow-up contract/content tests failed when authored equipment Break meters were rejected and spears were incorrectly assigned `two-handed-blade`.
3. A contract test failed while learned passive skills could not represent an empty delivery-tag set.
4. A content test failed because nested skill/equipment mechanics were mutable despite their versioned schema IDs.
5. All five engine tests failed after changing fixtures to separate `intrinsicMight` from `effectiveLoadMight`, proving the former single-field implementation could not preserve intrinsic/effective scope.

## GREEN evidence

- `pnpm --filter @summonlab/contracts exec vitest run --maxWorkers=1`: 14 files, 117 tests passed.
- `pnpm --filter @summonlab/content exec vitest run --maxWorkers=1`: 13 files, 64 tests passed.
- `pnpm --filter @summonlab/engine exec vitest run src/domains/combat/legal-actions.spec.ts src/domains/combat/capability.spec.ts src/domains/settlement/equipment.spec.ts src/compatibility/replay-vectors.spec.ts --maxWorkers=1`: 4 files, 27 tests passed.
- Contracts, content, and engine package typechecks passed.
- ESLint passed for every touched file; Prettier check passed for every touched file.
- `pnpm validate:equipment-content-bindings` passed with the original `equipment-content-v1` hash `42a8ffc1899ee458ca8360d33dffbeac3713864548734b7345ce489c3599035c`, 140 definitions, and 280 runtime assets.
- `git diff --check` passed.

## Self-review

- The legacy equipment definition schema and catalog records were not extended or rehashed; new mechanics live in a separately versioned profile layer.
- Family familiarization is stored as trained family tags, never as an equipment item instance. The engine requires one tag shared by equipment, skill delivery, and training.
- Per-skill mastery changes only authored accuracy, reliability, and refinement unlocks in this slice; it does not synthesize damage, critical chance, Mana efficiency, or cadence bonuses.
- Explicit heavy-item Might requirements consume intrinsic Might. Aggregate load tolerance consumes separately supplied effective `equipment-load` Might so temporary scoped effects cannot satisfy permanent eligibility gates.
- Only content records may opt into `breakMeter`; strict schemas reject a `poise` field.
- Resistance tags reuse the Task 5 canonical `ResistanceTagSchema` and cover `cut`, `pierce`, `impact`, `burn`, `frost`, `shock`, and `arcane` across equipment, passive-skill, and physiology source records.
- The plan omitted `packages/contracts/src/index.ts`; the controller authorized the minimal root export seam for the new combat-skill contract. No snapshot update was required because the full contract suite remained green.

## Concerns and deferred verification

- A package-wide engine Vitest invocation again stalled with no output and was terminated; the task-focused plus adjacent engine set passed 27/27. This matches the execution behavior already recorded by the controller for this branch and is not presented as a full-engine pass.
- Full contracts lint still reports the three pre-existing unused-variable errors in `capability.spec.ts` recorded during Task 5. Touched-file lint is clean.
- The concrete load, minimum-Might, and resistance values are first versioned content candidates for the Task 9 balance harness, not claimed final tuning.

## Fix round 1: authoritative content bindings and resistance receipts

### Findings addressed

- Split authoritative combat mechanics into immutable `combat-skills-v1` and `combat-equipment-profiles-v1` catalogs. Each catalog has its own schema/version/hash and verification loader. The existing `equipment-content-v1` catalog remains a separate legacy/visual definition catalog with the unchanged hash `42a8ffc1899ee458ca8360d33dffbeac3713864548734b7345ce489c3599035c`.
- Added field-level drift coverage proving delivery tags, mastery accuracy, load, explicit Might/proficiency requirements, and named resistance grants invalidate the relevant combat catalog hash.
- Added immutable `COMBAT_CONTENT_BINDING`, whose aggregate hash `1abef40c18eb97d4c1694c674f9b4917f286053e6d810d5b4282760f2ab4c2a7` is calculated only from sorted component `{ contentVersion, contentHash }` pairs. Reordering components or attaching a non-authoritative runtime field does not change the aggregate; changing a component hash does.
- Added the typed `resistanceGrantReceiptsFromAuthoredSources` adapter for equipment profiles, passive skills, and physiology records. It emits canonical `ResistanceGrantReceiptSchema` values with additive stacking, the stricter authored/global cap, `combat-rules-v1`, and collision-safe deterministic receipt/grant IDs derived from JSON-encoded identity tuples.
- Proved the adapter is connected rather than inert: ten actual heavy-armor cut grants enter `namedResistanceReduction` and are capped at the global `COMBAT_RULES_V1` limit of 7,500 basis points.

### RED evidence

1. The first contract run failed five assertions because resistance grants had no authored cap, the two combat catalog schemas did not exist, and physiology was not accepted as a canonical receipt source.
2. The first content run failed on the new authored-cap expectation and on placeholder/missing catalog-binding implementation.
3. The first engine run failed to resolve the new `resistance-grants` adapter module.
4. After temporarily removing the adapter's source-kind and duplicate-source guards, three of five focused tests failed, proving those validation tests exercise production behavior.
5. The separator-ambiguity regression failed one of six tests because two distinct physiology identity tuples produced the same deterministic ID; JSON tuple encoding made the regression green.

### GREEN evidence

- `pnpm --filter @summonlab/contracts exec vitest run --maxWorkers=1`: 14 files, 119 tests passed.
- `pnpm --filter @summonlab/content exec vitest run --maxWorkers=1`: 13 files, 66 tests passed.
- `pnpm --filter @summonlab/engine exec vitest run src/domains/combat/legal-actions.spec.ts src/domains/combat/resistance-grants.spec.ts src/domains/combat/capability.spec.ts src/domains/settlement/equipment.spec.ts src/compatibility/replay-vectors.spec.ts --maxWorkers=1`: 5 files, 34 tests passed.
- The focused resistance adapter suite passed 7/7, including actual heavy-armor integration, authored/global cap selection, deterministic ordering, collision resistance, canonical schema validation, and invalid-source rejection.
- Contracts, content, and engine typechecks passed. Touched-file ESLint, Prettier, and `git diff --check` passed.
- `pnpm validate:equipment-content-bindings` passed with the unchanged legacy hash, 140 definitions, and 280 runtime assets.

### Task 8 handoff

- Task 8 should bind encounter/replay provenance to `COMBAT_CONTENT_BINDING` directly: record its `bindingVersion`, aggregate `contentHash`, and, where the Task 8 schema permits, its component version/hash pairs as audit evidence.
- Task 8 must not overwrite, reinterpret, or use `EQUIPMENT_DEFINITION_CATALOG.contentHash` as the combat-mechanics aggregate. That legacy hash remains dedicated to `equipment-content-v1`.

### Deferred minor

- The previously reviewed absence of an upper bound on supplied effective equipment-load Might remains deferred to whole-plan review. This fix does not change Task 7 load eligibility or any v1-v24 reducer/command semantics.
