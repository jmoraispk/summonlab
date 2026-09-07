# Task 5N — Clean deterministic catalog materialization report

## Outcome

- Materialized the complete cleanup candidate catalog exactly once in finalizer write mode.
- Created exactly 1,368 artifacts: 456 deterministic legacy interiors, 456 cleanup composites,
  and 456 structured result records.
- Finalizer write mode reported `ready: true`, `456/456` finalized, no pending shared-layer jobs,
  and zero drift.
- The immediate check-mode replay reported `ready: true`, `456/456` finalized, zero writes, zero
  drift, and no pending shared-layer jobs.
- Made no image-generation call and changed no shared layer, source art, packet, historical result,
  selection, promotion, or wiki asset.

## Preflight and immutable history

- Starting branch: `codex/skill-icon-quality-cleanup` at `7844dfebc4516a1a7111efc0a9a284f0ad83f445`.
- Starting working tree: clean.
- Destination roots `quality-cleanup-v1/interiors`, `quality-cleanup-v1/composites`, and
  `quality-cleanup-v1/results` were all absent.
- All eight canonical shared-layer candidate/result pairs were present: backing-v6 and
  F/E/D/C/B/A/S-v9.
- Read-only finalizer preflight: `ready: true`, total/finalized `456/456`, no pending jobs, zero
  writes, and exactly 1,368 expected missing destinations (`456/456/456`).
- Historical `mass-production-v1`: 2,465 files; snapshot-list SHA-256
  `55133003f54d931442ff9acb653dda821d735674ab87873a581d8b030f475339` before and after
  materialization.

## Deterministic write and replay

- The sole write-mode invocation called `finalizeSkillIconQualityCleanup({ mode: 'write' })` through
  `tsx` with compact report output.
- Write report: `ready: true`, total/finalized `456/456`, pending `[]`, written `1,368`, drifted
  `0`; written roots were exactly 456 interiors, 456 composites, and 456 results.
- Post-write materialized snapshot-list SHA-256:
  `7483e18aeb37be211ae7174f4eef69e78d75732c554711567b04b467d97fe330`.
- Check-mode replay: `ready: true`, total/finalized `456/456`, pending `[]`, written `0`, drifted
  `0`.
- Post-replay materialized snapshot-list SHA-256 remained
  `7483e18aeb37be211ae7174f4eef69e78d75732c554711567b04b467d97fe330`.
- The finalizer reported 865,744 near-white connected-component notices. These are non-fatal
  structural warnings from bright opaque artwork/frame highlights; the required representative
  visual audit found none of the rejection defects listed below.

## Representative visual audit

Each representative was inspected at the original 1024×1024 size and as a true 96×96 resize:

| Rank | Target | Composite |
| --- | --- | --- |
| F | `martial:blade:swordsmanship` | `quality-cleanup-v1/composites/martial-blade-swordsmanship.png` |
| E | `martial:blade:piercing-thrust` | `quality-cleanup-v1/composites/martial-blade-piercing-thrust.png` |
| D | `martial:blade:crescent-sweep` | `quality-cleanup-v1/composites/martial-blade-crescent-sweep.png` |
| C | `martial:blade:rising-moon` | `quality-cleanup-v1/composites/martial-blade-rising-moon.png` |
| B | `martial:blade:severing-intent` | `quality-cleanup-v1/composites/martial-blade-severing-intent.png` |
| A | `martial:blade:void-cut` | `quality-cleanup-v1/composites/martial-blade-void-cut.png` |
| S | `martial:blade:one-blade-one-world` | `quality-cleanup-v1/composites/martial-blade-one-blade-one-world.png` |

Verdict: no green or magenta screens, matte halos or residue, frame defects, non-regular
point-up hexagons, missing or duplicate crests, aperture seams, or art crossing the frame were
observed. All seven uppercase rank letters and central subjects remained readable at 96px.

## Validation evidence

- `corepack pnpm check:skill-icon-quality-cleanup`: PASS; 456 skills (`258 Martial`,
  `124 Magical`, `74 Craft`), zero written, zero drifted.
- `corepack pnpm validate:skill-icons`: PASS; 456 canonical, 456 mapped, skill icon assets valid.
- `corepack pnpm check:skill-icon-mass-production`: PASS; 705/705 current files, 124 families,
  456 skills, and 19 catalog pages.
- `corepack pnpm typecheck:skill-icons`: PASS.
- `corepack pnpm vitest run tools/skill-icon-quality-cleanup-lib.spec.ts --testTimeout=300000`:
  PASS; 1 file and 17/17 tests in 132.78 seconds.

The focused suite was first invoked with Vitest's default five-second timeout. Once the 1,368-file
catalog existed, its whole-cleanup-directory snapshot tests took about ten seconds, timed out, and
their still-running cleanup overlapped later drift fixtures. That cascade temporarily left
`manifest.json` containing the intentional test fixture. No test process remained; the manifest was
restored byte-for-byte from `HEAD` (SHA-256
`f7f4690d71b0786283c867f46ac5e48c9f48cd19fac9d969396f94a5f986b12b`). The timing hypothesis
was confirmed by running the unchanged snapshot test alone with the production-scale timeout, then
the full unchanged 17-test suite passed with that timeout. No repository code or test was modified.
