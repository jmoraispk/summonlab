# Summonable Hero Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the 200 approved one-star identities into the finite player summon pool with exact summon-portrait and combat-chibi bindings.

**Architecture:** Generate one strict approved catalog from immutable experiment evidence, then expose its stable `human-v6` drafts through the character package. Export a separate lazy runtime visual manifest and route player-facing campaign/summon creation through deterministic, duplicate-free selection while preserving all legacy generators and visual manifests.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, Sharp, SvelteKit 2, PixiJS 8 asset manifests, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-05-summonable-hero-roster-design.md`

## Global Constraints

- The roster contains exactly 200 owner-approved one-star heroes.
- Every hero binds one summon portrait and one combat chibi.
- The nineteen approved v3 corrections override their earlier regenerated chibis.
- Candidate files remain immutable provenance; canonical and runtime state are separate.
- Player-facing selection is deterministic and three-hero companies contain no duplicate identity.
- Legacy procedural character generation and existing runtime portraits remain compatible.
- The unrelated modified wiki skill-frame image must never be staged.

---

### Task 1: Canonical roster contracts and promotion

**Files:**
- Create: `packages/contracts/src/summonable-hero.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `tools/summonable-hero-roster-lib.ts`
- Create: `tools/summonable-hero-roster-lib.spec.ts`
- Create: `tools/promote-summonable-hero-roster.ts`
- Create: `assets/heroes/approved/summonable-roster-v1/catalog.json`

**Interfaces:**
- Consumes: the selected pairs in the original 200-hero review manifest, the five-head source roster,
  the five-head regeneration results, the nineteen-entry v3 approval receipt, and immutable PNGs.
- Produces: `SummonableHeroCatalogSchema` and a catalog containing full stable drafts plus two exact
  approved source records per hero.

- [ ] **Step 1: Write failing contract and promotion tests**

  Test that duplicate hero IDs, character IDs, manifest hashes, or asset keys are rejected; that a
  real promotion build yields exactly 200 entries; that every input hash is verified; and that the
  nineteen correction IDs resolve to v3 while all others resolve to five-head regeneration.

- [ ] **Step 2: Run the focused tests and observe the missing-schema/missing-builder failure**

  Run: `pnpm vitest run packages/contracts/src/contracts.spec.ts tools/summonable-hero-roster-lib.spec.ts`

- [ ] **Step 3: Implement the schemas and pure promotion builder**

  Define strict source-asset, approved-entry, and catalog schemas. Build stable `human-v6` drafts by
  starting from deterministic character generation and overriding the approved identity's name,
  age, presentation, height, physique, face/hair/wardrobe cues, native stars, art key, and provenance.
  Verify file bytes, dimensions, and SHA-256 before emitting any entry.

- [ ] **Step 4: Run tests, write the canonical catalog, and re-run in check mode**

  Run: `pnpm vitest run packages/contracts/src/contracts.spec.ts tools/summonable-hero-roster-lib.spec.ts`

  Run: `pnpm tsx tools/promote-summonable-hero-roster.ts --write`

  Run: `pnpm tsx tools/promote-summonable-hero-roster.ts --check`

- [ ] **Step 5: Commit the canonical roster batch**

  Commit subject: `feat(heroes): promote summonable hero roster`

### Task 2: Deterministic finite-pool character generation

**Files:**
- Create: `packages/characters/src/summonable.ts`
- Create: `packages/characters/src/summonable.spec.ts`
- Modify: `packages/characters/src/index.ts`
- Modify: `packages/contracts/src/character.ts`
- Modify: `apps/web/src/lib/server/campaign.ts`
- Create: `apps/web/src/lib/server/campaign.spec.ts`
- Modify: `apps/web/src/routes/api/runs/+server.ts`

**Interfaces:**
- Consumes: the canonical catalog and `human-v6` recipes.
- Produces: `listSummonableHeroDrafts()`, `generateSummonableCharacterDraft(recipe)`, and
  `generateSummonableCompany(seed, count)`.

- [ ] **Step 1: Write failing character-pool tests**

  Assert a 200-entry unique pool, 100 women/100 men, all native 1★, deterministic single selection,
  three unique company members, replay through `generateCharacterDraft(human-v6 recipe)`, and legacy
  manifest-hash stability.

- [ ] **Step 2: Run tests and observe the missing pool API failure**

  Run: `pnpm --filter @summonlab/characters test`

- [ ] **Step 3: Implement catalog-backed generation and update player entry points**

  Resolve `human-v6` canonical recipes from the approved catalog, select finite-pool entries with a
  stable SHA-256 ordering function, and select companies without replacement. Change only the
  player campaign and standalone summon endpoint to call the new API.

- [ ] **Step 4: Run character and web unit tests**

  Run: `pnpm --filter @summonlab/characters test`

  Run: `pnpm --filter @summonlab/web test:unit`

- [ ] **Step 5: Commit the summon-selection batch**

  Commit subject: `feat(summoning): select from approved hero pool`

### Task 3: Lazy runtime visual export and lookup

**Files:**
- Create: `tools/summonable-hero-runtime-lib.ts`
- Create: `tools/summonable-hero-runtime-lib.spec.ts`
- Create: `tools/export-summonable-hero-runtime.ts`
- Modify: `package.json`
- Create: `apps/web/static/runtime/summonable-heroes-v1/manifest.json`
- Create: `apps/web/static/runtime/summonable-heroes-v1/heroes/*/*.webp`
- Modify: `apps/web/src/lib/server/runtime-portraits.ts`
- Modify: `apps/web/src/lib/server/runtime-portraits.spec.ts`

**Interfaces:**
- Consumes: exact approved source records and stable manifest hashes.
- Produces: a lazy two-asset bundle per hero and runtime lookup for `summon`, `dialogue`, `roster`,
  and `combat-chibi` usages.

- [ ] **Step 1: Write failing exporter and resolver tests**

  Assert source-hash rejection, deterministic runtime records, 200 lazy bundles/400 assets, and both
  summon/chibi lookup for a known catalog hero while retaining a legacy portrait lookup.

- [ ] **Step 2: Run focused tests and observe missing exporter/usage failures**

  Run: `pnpm vitest run tools/summonable-hero-runtime-lib.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts`

- [ ] **Step 3: Implement and export lazy WebP bundles**

  Add the `combat-chibi` usage, encode summon sources at width 768 and chibis at width 384 with
  stripped metadata, and keep the catalog out of the existing eight-megabyte initial payload.

- [ ] **Step 4: Generate outputs and validate byte-for-byte check mode**

  Run: `pnpm export:summonable-hero-runtime`

  Run: `pnpm validate:summonable-hero-runtime`

  Run: `pnpm validate:runtime-visuals`

- [ ] **Step 5: Commit the runtime visual batch**

  Commit subject: `feat(heroes): export bound runtime visuals`

### Task 4: Wiki decision record and final validation

**Files:**
- Create: `docs/decisions/0069-generated-heroes-are-the-summonable-roster.md`
- Modify: `docs/wiki/art/hero-identity-and-evolution.md`
- Modify: `docs/wiki/systems/summoning-progression-combat.md`

**Interfaces:**
- Consumes: the completed canonical and runtime contracts.
- Produces: durable documentation of the 200-hero pool, native-star rule, identity bindings, and
  candidate/approved/runtime lifecycle.

- [ ] **Step 1: Document the accepted decision and operative paths**

  Record that these 200 identities are the finite summon pool; all start at 1★; the nineteen v3
  chibis are overrides; and legacy experiments remain provenance rather than runtime selectors.

- [ ] **Step 2: Run focused and repository validation**

  Run: `pnpm format:check`

  Run: `pnpm lint`

  Run: `pnpm typecheck`

  Run: `pnpm test`

  Run: `pnpm build`

  Run: `pnpm validate:summonable-hero-roster`

  Run: `pnpm validate:summonable-hero-runtime`

- [ ] **Step 3: Inspect scope and ensure the unrelated wiki image is unstaged**

  Run: `git status --short && git diff --check && git diff --stat origin/main...HEAD`

- [ ] **Step 4: Commit documentation and push the branch**

  Commit subject: `docs(heroes): record summonable roster binding`

  Push: `git push -u origin codex/bind-summonable-hero-roster`

