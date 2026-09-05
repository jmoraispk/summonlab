# Combat Animation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Ground Nessa's idle presentation and replace Toma's owner-rejected v4 run with an
immutable, reproducible v5 compact heavy-run candidate.

**Architecture:** Nessa's correction remains a clip-specific runtime registration value, leaving
her raster and world-space shadow untouched. Toma v5 is generated as one five-pose temporal strip,
assembled over v4's advance row, built through preservation mode so every other decoded clip stays
identical, and guarded by source-bound geometry evidence plus runtime playback tests.

**Tech Stack:** TypeScript, Vitest, PixiJS v8, Svelte 5, Node.js 24 ESM, Sharp, Playwright, Codex
image generation.

**Spec:** `docs/superpowers/specs/2026-09-04-agentic-skills-and-combat-polish-design.md`

## Global Constraints

- Synchronize from `origin/main`, never the locally ahead `main` checkout.
- Nessa idle uses runtime registration only; her raster, scale, bow, health bar, shadow art, world
  point, and down pose remain unchanged.
- Nessa `advance`, `attack`, and `hit` retain `bodyOffsetY: -4`; `down` retains `bodyOffsetY: 0`.
- Toma v4 remains byte-for-byte immutable and is recorded as owner-rejected for run motion.
- Toma v5 replaces only `advance`; every decoded `idle`, `attack`, `hit`, and `down` frame remains
  identical to v4.
- Toma's action authority is `classical-human-run-5` with exact support
  `left, left, none, right, right`.
- Toma v5 keeps his gray topknot, beard, face, stocky adult proportions, navy/teal armor, bronze
  shield on the left arm, compact mace in the right hand, three-quarter up-field camera, scale, and
  lighting.
- No high front kick, knee above belt, deep crouch, frog legs, split leap, duplicated contact, foot
  at camera, wild mace, baked shadow, scenery, text, crop, mirror, or equipment swap.
- Do not change combat simulation, pathfinding, attack cadence, actor scale, shadow position,
  presentation projection, or any other character animation.
- Toma v5 remains `candidate` until explicit owner playback approval.

---

### Task 1: Confirm Synchronization and Combat Baselines

**Files:**

- Modify through merge only if `origin/main` is not already an ancestor of `HEAD`.
- Do not modify: the locally ahead `main` branch.

**Interfaces:**

- Consumes: remote ref `origin/main` and the result of the agentic-skills wiki plan when executed
  first.
- Produces: a synchronized branch and baseline results for registration, motion, and browser tests.

- [ ] **Step 1: Make synchronization idempotent**

Run:

```bash
git status --short --branch
git fetch origin main
git merge-base --is-ancestor origin/main HEAD || \
  git merge --no-ff origin/main -m "chore(repo): synchronize combat study with main"
git merge-base --is-ancestor origin/main HEAD
```

Expected: the final ancestry check exits zero and the working tree contains no unrelated files.

- [ ] **Step 2: Run the pre-change combat baseline**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts \
  src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-animator.spec.ts
node --test tools/rebuild-iron-guardian-motion-v4.spec.mjs
node --test tools/validate-realtime-combat-motion-pack.spec.mjs
```

Expected: all commands pass. Preserve the output so any later failure can be classified against this
baseline.

- [ ] **Step 3: Push a merge commit if this task created one**

Run:

```bash
git push origin codex/realtime-combat-study
```

Expected: remote and local branch tips match.

### Task 2: Ground Nessa with Clip-Specific Registration

**Files:**

- Modify: `apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.ts`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts`

**Interfaces:**

- Consumes: `actorVisualRegistration(actorId, role, clip)` and the existing fixed world-space
  shadow.
- Produces: Nessa (`moss-archer`) offsets `idle: -10`, `advance: -4`, `attack: -4`, `hit: -4`,
  `down: 0`, with unchanged `45×14` shadow radii.

- [ ] **Step 1: Write the failing clip-specific registration test**

Replace the current single idle assertion with this table:

```ts
it.each([
	['idle', -10],
	['advance', -4],
	['attack', -4],
	['hit', -4],
	['down', 0]
] as const)('registers Nessa %s at body offset %i', (clip, bodyOffsetY) => {
	expect(actorVisualRegistration('moss-archer', 'archer', clip)).toEqual({
		bodyOffsetY,
		shadowRadiusX: 45,
		shadowRadiusY: 14
	});
});
```

Retain the Toma and unrelated-hero assertions.

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts
```

Expected: only the Nessa idle row fails, receiving `-4` instead of `-10`.

- [ ] **Step 3: Implement the smallest approved idle-only lift**

Replace the nested offset expression with explicit actor/clip registration:

```ts
function bodyOffsetY(actorId: string, clip: CombatClip): number {
	if (clip === 'down') return 0;
	if (actorId === 'moss-archer') return clip === 'idle' ? -10 : -4;
	if (actorId === 'iron-guardian') return -3;
	return 0;
}
```

Call this helper from `actorVisualRegistration()`. Do not move or nest the shadow with the body.

- [ ] **Step 4: Run registration, animator, and type checks**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-animator.spec.ts
pnpm --filter @summonlab/web typecheck
```

Expected: all checks pass.

- [ ] **Step 5: Inspect Nessa in all presentation modes**

Start the app with:

```bash
pnpm --filter @summonlab/web dev --host 0.0.0.0 --port 5173
```

At `http://10.110.24.218:5173/living-village-lab/realtime-combat`, pause while Nessa is idle and
inspect desktop and 390×844 viewports in 2D, 2.5D, and 2.5D V2. Confirm both boots retain a visible
contact edge, the shadow center stays at the actor world point, idle does not read as hovering, and
idle ↔ advance does not create a conspicuous pop.

- [ ] **Step 6: Commit the Nessa correction**

```bash
git add apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.ts \
  apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts
git commit -m "fix(combat): ground Nessa idle stance"
```

### Task 3: Add Toma v5 Geometry and Preservation Gates

**Files:**

- Create: `tools/validate-iron-guardian-motion-v5.mjs`
- Create: `tools/validate-iron-guardian-motion-v5.spec.mjs`
- Create: `tools/rebuild-iron-guardian-motion-v5.spec.mjs`
- Modify: `tools/write-realtime-combat-motion-support-evidence.mjs`

**Interfaces:**

- Consumes: v5 source sheet, support evidence, runtime atlas/JSON/manifest, and Toma v4 runtime
  manifest.
- Produces: a zero-exit validator requiring five bound unique advance cells, support
  `left,left,none,right,right`, a 4–10 pixel airborne gap above the established atlas contact line
  `y=246`, crown-height spread at most 16 pixels, measured shield-diameter variance at most 5%,
  opposite contact similarity, and decoded equality of all 15 non-advance v4/v5 frames.

- [ ] **Step 1: Define v5 measurement evidence in failing fixtures**

Extend the existing support-evidence shape in the v5 validator tests with:

```js
const validMeasurements = [
	{ frame: 1, support: 'left', crownY: 17, lowestOpaqueY: 245, shieldDiameter: 76, strideWidth: 91, torsoTop: 38 },
	{ frame: 2, support: 'left', crownY: 21, lowestOpaqueY: 245, shieldDiameter: 75, strideWidth: 83, torsoTop: 42 },
	{ frame: 3, support: 'none', crownY: 13, lowestOpaqueY: 239, shieldDiameter: 77, strideWidth: 78, torsoTop: 36 },
	{ frame: 4, support: 'right', crownY: 18, lowestOpaqueY: 245, shieldDiameter: 75, strideWidth: 88, torsoTop: 39 },
	{ frame: 5, support: 'right', crownY: 20, lowestOpaqueY: 245, shieldDiameter: 76, strideWidth: 82, torsoTop: 41 }
];
```

The test fixture binds these measurements to the same five decoded cell SHA-256 values already
stored in support evidence.

- [ ] **Step 2: Write one failing test for every rejection gate**

Clone the fixture and mutate one field per test:

```js
assertRejects({ support: ['left', 'left', 'left', 'right', 'right'] }, /support sequence/i);
assertRejects({ measurements: withFrame(3, { lowestOpaqueY: 245 }) }, /airborne gap/i);
assertRejects({ measurements: withFrame(3, { lowestOpaqueY: 230 }) }, /airborne gap/i);
assertRejects({ measurements: withFrame(3, { crownY: 0 }) }, /crown-height spread/i);
assertRejects({ measurements: withFrame(4, { shieldDiameter: 84 }) }, /shield.*5%/i);
assertRejects({ measurements: withFrame(4, { strideWidth: 68 }) }, /opposite contacts.*stride/i);
assertRejects({ measurements: withFrame(4, { torsoTop: 51 }) }, /opposite contacts.*torso/i);
```

Add decoded-pixel tests that replace one v5 idle pixel and one v5 attack pixel, then assert each is
rejected as a non-advance preservation failure. Add a CLI fixture that passes all five repeated
`--measurement` flags and asserts the writer preserves their frame order and numeric fields.

- [ ] **Step 3: Run the v5 tests and verify red**

Run:

```bash
node --test tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs
```

Expected: FAIL because the v5 validator and v5 artifacts do not exist.

- [ ] **Step 4: Implement the focused validator**

The CLI is exact:

```text
node tools/validate-iron-guardian-motion-v5.mjs \
  --manifest V5_MANIFEST_JSON \
  --evidence V5_SUPPORT_JSON \
  --preserve-from-manifest V4_MANIFEST_JSON
```

Implement these numeric gates after verifying the evidence hashes against decoded source cells:

```js
assert.deepEqual(evidence.support, ['left', 'left', 'none', 'right', 'right']);
assert.equal(new Set(evidence.cellSha256).size, 5);
const airborneGap = 246 - evidence.measurements[2].lowestOpaqueY;
assert.ok(airborneGap >= 4 && airborneGap <= 10);
assert.ok(range(evidence.measurements.map(({ crownY }) => crownY)) <= 16);
assert.ok(relativeRange(evidence.measurements.map(({ shieldDiameter }) => shieldDiameter)) <= 0.05);
assert.ok(relativeDifference(frame1.strideWidth, frame4.strideWidth) <= 0.08);
assert.ok(Math.abs(frame1.torsoTop - frame4.torsoTop) <= 8);
```

Extract each runtime frame with Sharp and require decoded RGBA equality for `idle`, `attack`, `hit`,
and `down` between the v4 and v5 manifests. Compute `crownY` and `lowestOpaqueY` directly from each
runtime cell and require exact equality with the recorded values; the remaining three measurements
are review annotations bound to the same source-cell hashes.

- [ ] **Step 5: Extend the evidence writer for ordered v5 measurements**

Parse repeated `--measurement` values with this exact grammar and reject duplicate/missing frames:

```js
const measurementPattern = /^(\d+):(left|none|right):(\d+):(\d+):(\d+):(\d+):(\d+)$/;
const measurements = valuesFor('--measurement').map(parseMeasurement);
assert.deepEqual(measurements.map(({ frame }) => frame), [1, 2, 3, 4, 5]);
assert.deepEqual(measurements.map(({ support }) => support), support);
```

Keep v4 output byte-identical by omitting the `measurements` property when no measurement flags are
provided.

- [ ] **Step 6: Implement the deterministic rebuild test contract**

`tools/rebuild-iron-guardian-motion-v5.spec.mjs` must rebuild into a temporary directory using the
commands from Task 4, then compare the source sheet, atlas PNG, atlas JSON, manifest JSON, and
support evidence byte-for-byte with the committed v5 files. It must separately compare every
decoded non-advance v5 cell to v4.

- [ ] **Step 7: Keep the tests red for the right reason**

Run:

```bash
node --test tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs
```

Expected: validator unit fixtures pass; the rebuild test fails only because v5 source/runtime files
have not yet been created.

- [ ] **Step 8: Commit the v5 quality contract**

```bash
git add tools/validate-iron-guardian-motion-v5.mjs \
  tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs \
  tools/write-realtime-combat-motion-support-evidence.mjs
git commit -m "test(combat): define Toma v5 motion gates"
```

### Task 4: Produce and Build the Immutable Toma v5 Candidate

**Files:**

- Create: `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v5.png`
- Create: `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v5.png`
- Create: `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v5.json`
- Create: `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v5.png`
- Create: `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v5.json`
- Create: `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v5.json`
- Modify: `assets/heroes/visuals/realtime-combat-study-v1/PROVENANCE.md`

**Interfaces:**

- Consumes: `summonlab-character-animations`, `imagegen`, Toma v4 source sheet, Toma's runtime
  identity image, and `classical-human-run-5`.
- Produces: one new full five-pose v5 run strip, a v5 source sheet, source-bound measurements, and a
  5×4 runtime atlas whose non-advance clips are preserved from v4.

- [ ] **Step 1: Read the animation-production authority and fill the clip brief**

Read the complete `summonlab-character-animations` skill and its `known-actions.md` reference. Use
this exact motion sentence and beat order in the clip brief:

```text
Toma advances in a compact armored run: a short left contact loads into a controlled push, a low
passing flight moves the opposite knee forward, a short right contact absorbs the weight, and a
right-supported recovery prepares the loop without changing torso scale or guard.

1 left contact; 2 modest left compression/push; 3 low airborne pass;
4 short right contact opposite frame 1; 5 right recovery toward the loop seam.
```

- [ ] **Step 2: Record v4 rejection before generating v5**

Append a provenance decision stating that v4 is immutable and mechanically valid but
owner-rejected because the high kick, deep squat, oversized flight, and mismatched stride shapes do
not read as one heavy run. Record that no v4 bytes are replaced or deleted.

- [ ] **Step 3: Generate one complete five-pose temporal strip**

Use image generation with these references:

```text
assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png
apps/web/static/runtime/combat/realtime-study-v1/hero-iron-guardian-ready-v1.png
skills/summonlab-character-animations/references/classical-human-run.svg
```

The exact production prompt must say:

```text
Create one horizontal five-cell temporal animation strip for Toma's compact armored run, shown in
playback order from the same steep three-quarter up-field camera. Beat 1: short anatomical-left boot
contact, right leg trailing, shield leading. Beat 2: modest left-leg compression and push, hips only
slightly lower. Beat 3: low airborne passing pose, neither boot planted, right knee below the belt.
Beat 4: short anatomical-right boot contact, visibly opposite beat 1, with matching stride and torso
height. Beat 5: right-supported recovery returning toward beat 1. Preserve exact gray topknot,
beard, face, stocky adult proportions, navy-and-teal armor, bronze shield on left arm, compact mace
in right hand, constant scale, common lighting, full-body clearance, and painterly 2.5D finish. Pure
uniform white matte only. No shadow, scenery, text, dividers, crop, mirror, equipment swap, high
front kick, knee above belt, deep crouch, frog legs, split leap, foot aimed at camera, wild mace,
duplicate pose, hidden boot, or extra limb.
```

- [ ] **Step 4: Inspect the strip at source resolution before persistence**

Reject the result unless all five full bodies and both boots are visible, support reads exactly
`left,left,none,right,right`, frame 3 has a low clear air gap, frames 1 and 4 are opposite but similar
contacts, shield diameter is visually stable, the mace remains below waist/behind hip, and frames 5
to 1 form a plausible seam. Persist only the accepted generated original to the v5 strip path and
record its generation identifier and SHA-256.

- [ ] **Step 5: Assemble v5 over v4 with shared scale**

Run:

```bash
node tools/compose-realtime-combat-motion-rows.mjs \
  --base assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png \
  --out assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v5.png \
  --replace 1:assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v5.png \
  --scale-mode shared \
  --cell-y-offset 1:2:-7
```

Expected: only zero-based row 1 differs from v4.

- [ ] **Step 6: Build v5 in preservation mode**

Run:

```bash
node tools/build-realtime-combat-motion-pack.mjs \
  --actor iron-guardian \
  --input assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v5.png \
  --out-dir apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian \
  --version 5 \
  --preserve-from-manifest apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json \
  --replace-clip advance \
  --frame-y-offset advance:3:-7
```

Expected: new v5 PNG, atlas JSON, and manifest appear; v1–v4 hashes do not change.

- [ ] **Step 7: Write source-bound support and geometry evidence**

Use the evidence writer's repeated
`--measurement frame:support:crownY:lowestOpaqueY:shieldDiameter:strideWidth:torsoTop` values. Run it
for the five visually measured v5 cells:

```bash
node tools/write-realtime-combat-motion-support-evidence.mjs \
  --source-sheet assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v5.png \
  --source-sheet-path iron-guardian-motion-sheet-source-v5.png \
  --out assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v5.json \
  --version 5 --actor iron-guardian --clip advance --grid 5x4@1 \
  --action-authority classical-human-run-5 --support left,left,none,right,right \
  --measurement 1:left:17:245:76:91:38 \
  --measurement 2:left:21:245:75:83:42 \
  --measurement 3:none:13:239:77:78:36 \
  --measurement 4:right:18:245:75:88:39 \
  --measurement 5:right:20:245:76:82:41
```

The numeric example is the test fixture, not permission to invent production measurements. Replace
each numeric measurement in the production command with the actual inspected v5 coordinate while
retaining all validator thresholds and the exact support labels.

- [ ] **Step 8: Run v5 validation and deterministic rebuild**

Run:

```bash
node tools/validate-iron-guardian-motion-v5.mjs \
  --manifest apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v5.json \
  --evidence assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v5.json \
  --preserve-from-manifest apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json
node --test tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs
```

Expected: all geometry, support, source-binding, decoded-preservation, and byte-rebuild gates pass.

- [ ] **Step 9: Finish provenance and commit the candidate**

Record the exact prompt, reference hashes, generated source identifier/hash, all v5 artifact hashes,
actual measurements, support sequence, build commands, validator results, decoded non-advance
equality, visual inspection, and `candidate` status. Then commit:

```bash
git add \
  assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v5.png \
  assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v5.png \
  assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v5.json \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v5.png \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v5.json \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v5.json \
  assets/heroes/visuals/realtime-combat-study-v1/PROVENANCE.md
git commit -m "feat(combat): produce Toma heavy run v5"
```

### Task 5: Activate Toma v5 and Add Runtime Evidence

**Files:**

- Modify: `apps/web/src/lib/components/living-village/realtime-combat/motion-pack-config.ts`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts`
- Modify: `apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts`

**Interfaces:**

- Consumes: `iron-guardian-motion-v5.json` with the unchanged `createMotionPack()` contract.
- Produces: diagnostic string
  `asha:2,iron-guardian:5,moss-archer:2,rat-brute:1,lesser-rat:2` and browser evidence for all three
  presentation modes without resetting the fight.

- [ ] **Step 1: Update unit and browser expectations first**

Change both expected version strings to:

```text
asha:2,iron-guardian:5,moss-archer:2,rat-brute:1,lesser-rat:2
```

Add an E2E loop that clicks `2D Fixed scale`, `2.5D Depth staged`, and `2.5D V2 Trapezoid on`,
asserting `data-applied-presentation-mode` equals `2d`, `2.5d`, and `2.5d-v2` respectively while
`data-motion-pack-versions` retains the v5 string.

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts
pnpm --filter @summonlab/web test:e2e -- \
  src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
```

Expected: both fail because runtime still loads `iron-guardian-motion-v4.json`.

- [ ] **Step 3: Switch only Toma's motion source to v5**

Change:

```ts
'iron-guardian': createMotionPack(
	`${ART_ROOT}/animation-canary-v1/iron-guardian/iron-guardian-motion-v5.json`
),
```

Do not change FPS, animator transitions, registration, spatial logic, or other actor versions.

- [ ] **Step 4: Run focused runtime checks**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-animator.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web test:e2e -- \
  src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
```

Expected: all checks pass.

- [ ] **Step 5: Perform the owner-facing motion review**

At `http://10.110.24.218:5173/living-village-lab/realtime-combat`, watch at least three complete
Toma run loops in 2D, 2.5D, and 2.5D V2 at desktop and 390×844 widths. Exercise idle → run → attack
and run → idle. Confirm alternating contacts, low flight, stable torso/scale, restrained shield lag,
compact mace motion, clean 5→1 seam, no collision-regression impression, and unchanged non-run
clips. Recheck Nessa's five idle frames in the same modes.

- [ ] **Step 6: Commit runtime activation**

```bash
git add apps/web/src/lib/components/living-village/realtime-combat/motion-pack-config.ts \
  apps/web/src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts \
  apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
git commit -m "fix(combat): activate Toma heavy run v5"
```

### Task 6: Final Verification and Delivery

**Files:**

- Modify only files already listed in this plan if verification exposes an in-scope defect.

**Interfaces:**

- Consumes: Tasks 1–5.
- Produces: a pushed clean branch, exact verification report, and owner review checkpoint while v5
  remains a candidate.

- [ ] **Step 1: Run the complete focused verification suite**

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts \
  src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-animator.spec.ts
node --test tools/validate-realtime-combat-motion-pack.spec.mjs
node --test tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs
node tools/validate-iron-guardian-motion-v5.mjs \
  --manifest apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v5.json \
  --evidence assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v5.json \
  --preserve-from-manifest apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web test:e2e -- \
  src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
pnpm exec prettier --check \
  apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.ts \
  apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts \
  apps/web/src/lib/components/living-village/realtime-combat/motion-pack-config.ts \
  apps/web/src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts \
  apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts \
  tools/validate-iron-guardian-motion-v5.mjs tools/validate-iron-guardian-motion-v5.spec.mjs \
  tools/rebuild-iron-guardian-motion-v5.spec.mjs \
  assets/heroes/visuals/realtime-combat-study-v1/PROVENANCE.md
git diff --check
```

Expected: every focused command passes.

- [ ] **Step 2: Run broad checks and classify only inherited failures**

Run:

```bash
pnpm test
pnpm lint
```

Expected: both pass. Reproduce any unrelated failure at the synchronized baseline before reporting
it; fix every in-scope regression.

- [ ] **Step 3: Verify historical immutability and repository scope**

Run:

```bash
sha256sum \
  assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/*v4* \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/*v4* \
  assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/moss-archer/* \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/moss-archer/*
git status --short
git diff --check
```

Expected: Toma v4 retains source-sheet hash `0a751496ecd72743dba97051231f5c34fb67e7dbab0637df0a6e0531399481dc`,
support hash `da2c1491c6796a61919287f86e960d6a35524eac287e7ae6bd78759ec21964cf`, strip
hash `a7d82acca4a132d2f8a5fc399e7c8dddc7c7844f0e98a99bf692901752f04b80`, runtime atlas
hash `af035edbe4162062742d5b1a8dc797d92e2af71a95c16053d1d45862f8d52fec`, atlas JSON
hash `e1374eafacc56543d12288a1149d30ef932376d2c29e9b6e4c17cc8cdb0d5641`, and manifest
hash `11b380e65128e86ee3d102817d2ed0acd1186b3c0ea18cfc03e725a3911a7fc8`.
Nessa v2 retains source-sheet hash `97cab854e83a8b90d1f0e23556338300d5c06b19521b4f572e1451f0ed3021ed`,
runtime atlas hash `03bcc9b118b98f1aa44a80f60ac75c5b911ffb0896149bdd3e5a4bf9440afd38`,
atlas JSON hash `0d72cb27e53a5eaaf1f6946201c648a88a8ddc3568445ac1442d3947ee49c2ef`, and
manifest hash `d39afddb9ce6cb89d0add65ea808433e0c702bd96c37ed3dc844e6588a0693d4`.
No scratch generation file is tracked; all in-scope work is committed; and the working tree is clean.

- [ ] **Step 4: Push the completed branch**

Run:

```bash
git push origin codex/realtime-combat-study
```

Expected: all implementation commits reach `origin/codex/realtime-combat-study`.

- [ ] **Step 5: Deliver the candidate checkpoint**

Report every commit hash and subject, push destination, clean-tree status, exact verification
results, and `http://10.110.24.218:5173/living-village-lab/realtime-combat`. Ask the owner to decide
whether Toma's opposite contacts, low flight, heavy equipment rhythm, and loop seam now deserve
approval, and whether Nessa's idle reads grounded without hovering in all three modes.
