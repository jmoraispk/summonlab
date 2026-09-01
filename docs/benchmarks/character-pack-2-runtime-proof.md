# Character Pack 2 runtime proof

> **Historical evidence:** ADR 0065 retired the procedural character renderer and its dedicated
> runtime proof route. This record is preserved to explain the earlier experiment, not to describe
> current product behavior.

Status: **implemented; Pack 2 premium approval pending**

Route: `/forge/pack-2/runtime`

## Boundary under test

The proof deliberately separates two lanes:

- The production lane filters by both `sourceApproval === 'approved'` and
  `summonEligibility === 'eligible'`, requires a deployed portrait URL, then uses a deterministic
  seeded draw. Its first rendered state already contains the cached portrait; there is no
  placeholder-to-premium identity swap and no image-generation request.
- The staging lane draws from all 18 Pack 2 `human-v4` manifests and renders `HeroRig` immediately.
  Equipment, treatment, and level state are local procedural changes. Because every Pack 2 bitmap
  is still a candidate, this lane reports `0 of 18 eligible` and cannot enter the production pool.

The production proof reuses three already approved Pack 1 runtime identities. This tests the real
approval/export/draw mechanism without falsely promoting Pack 2 candidates. Once a Pack 2 anchor is
human-approved and exported, it can use the same path without changing the draw algorithm.

## Performance gate

The browser test measures from the approved-draw handler through Svelte's DOM flush and the next
animation frame. The focused Playwright assertion requires the interaction to complete below
100 ms. This measures interactive selection and representation, not image-model authoring. Static
portrait transfer is handled by the existing content-addressed runtime bundle and its separate byte
budgets.

Run:

```sh
pnpm --filter @summonlab/web exec playwright test src/routes/forge/pack-2/runtime.e2e.ts
```

Unit coverage also proves that candidate, blocked, and portrait-missing identities are excluded and
that an all-candidate pool returns no player-facing draw:

```sh
pnpm --filter @summonlab/web test:unit -- src/lib/approved-summon-pool.spec.ts
```

## Level and evolution rule

The runtime control computes the maximum level as `rarityStars × 10` and clamps level gain at that
cap. Equipment changes do not change stars or the cap. Star evolution supplies a new cap; it is not
ordinary leveling.
