# Task 3 Report: Toma v5 Motion Gates

## Outcome

Implemented the Task 3 quality contract without creating any v5 placeholder assets. The new v5
validator requires the exact CLI, source-bound unique advance evidence, ordered support and
measurements, direct runtime alpha bounds, the approved geometry thresholds, and decoded equality
for all 15 non-advance v4/v5 frames. The evidence writer now preserves repeated measurements in CLI
order while retaining byte-identical v4 output when no measurements are supplied.

The deterministic rebuild spec contains exactly one state-dependent skip: the committed-artifact
byte comparison. Its skip reason lists the missing Task 4 paths, and the assertion automatically
runs when all six v5 inputs/outputs exist. A separate always-active assertion exercises v5
preservation mode and compares all 15 decoded non-advance frames with v4 now; once Task 4 provides
the committed v5 manifest, that same assertion compares the committed v5 cells directly.

## Changed files

- `tools/validate-iron-guardian-motion-v5.mjs` — exact three-flag CLI and v5 source, geometry,
  alpha-bound, uniqueness, and preservation validation.
- `tools/validate-iron-guardian-motion-v5.spec.mjs` — real PNG/JSON fixtures for every required
  acceptance and rejection gate, plus ordered measurement-writer coverage.
- `tools/rebuild-iron-guardian-motion-v5.spec.mjs` — Task 4 byte-rebuild contract and always-active
  15-frame decoded preservation comparison.
- `tools/write-realtime-combat-motion-support-evidence.mjs` — repeated `--measurement` parsing with
  exact grammar, ordered frames, support parity, and optional emission.
- `.superpowers/sdd/2026-09-04-combat-animation-polish/task-3-report.md` — this execution report.

## TDD evidence

Initial red command:

```bash
node --test tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs
```

Result: exit 1; 17 tests, 1 pass, 15 failures, 1 authorized skip. The validator cases failed because
`tools/validate-iron-guardian-motion-v5.mjs` did not exist. The writer acceptance test showed
`measurements` was absent, and its duplicate/missing-frame test showed the old writer returned zero.
The always-active preservation-mode test already passed its 15 decoded comparisons.

A threshold-edge test then exposed the initial relative-range denominator:

```bash
node --test --test-name-pattern='five-percent boundary' \
  tools/validate-iron-guardian-motion-v5.spec.mjs
```

Result: exit 1; 1 test, 1 failure. A 95–100 shield-diameter range was rejected as greater than 5%.
The implementation was corrected to compute `(max - min) / max`, after which the boundary and the
above-threshold rejection both passed.

Green focused command:

```bash
node --test tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs
```

Result: exit 0; 19 tests, 18 passes, 0 failures, exactly 1 authorized Task 4 artifact skip.

## Regression and format evidence

```bash
node --test tools/rebuild-iron-guardian-motion-v4.spec.mjs
```

Result: exit 0; 4/4 passed. This includes byte-for-byte equality of the committed v4 support
evidence generated without measurement flags.

```bash
node --test tools/validate-realtime-combat-motion-pack.spec.mjs
```

Result: exit 0; 18/18 passed.

```bash
pnpm exec prettier --check \
  tools/validate-iron-guardian-motion-v5.mjs \
  tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs \
  tools/write-realtime-combat-motion-support-evidence.mjs
git diff --check
```

Result: both exited zero; all listed JavaScript files match Prettier and the diff has no whitespace
errors.

## Self-review

- Verified the exact support order is compared without string coercion.
- Verified evidence contains five unique lowercase SHA-256 values and recomputed each hash from the
  decoded source cell in playback order before applying geometry gates.
- Verified the airborne frame uses the fixed `y=246` contact line and accepts only a 4–10 pixel gap.
- Verified crown spread is at most 16 pixels, shield relative range is at most 5%, frames 1 and 4
  differ by at most 8% in stride width, and torso-top distance is at most 8 pixels.
- Verified `crownY` and `lowestOpaqueY` are recomputed from alpha values greater than 18 in each
  256×256 runtime advance cell and must equal the evidence exactly.
- Verified decoded idle and attack pixel mutations are rejected as non-advance preservation
  failures; all idle, attack, hit, and down frames are compared by decoded RGBA in production.
- Verified the only state skip is derived from absent v5 paths; no validator fixture or v4
  regression test skips.
- Verified the diff does not alter Toma v4 or create any v5 art/runtime artifact.

## Delivery status and concerns

Required commit subject: `test(combat): define Toma v5 motion gates`.
Required push destination: `origin/codex/realtime-combat-study`.
The final commit hash and push receipt are reported in the agent handoff because a commit cannot
contain its own stable hash.

Current expected skip lists all six Task 4 files because none exist yet. Task 4 must record actual
runtime `crownY` and `lowestOpaqueY` values exactly and keep each measurement flag in frames 1–5
order. Shield diameter, stride width, and torso top remain human review annotations; their ordered
association is made tamper-evident by the same source-cell hashes, but they are not derivable from
alpha alone.
