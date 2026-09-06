# Village Scene-First Phone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the persistent Village route present the authoritative settlement as the full phone home surface, framed by a compact status header and the approved four-mode navigation.

**Architecture:** Keep `/play/[runId]` and its real campaign projection as the owner. Revise the existing Svelte scene overlay to render every real campaign resident and measured facility callouts over the canonical Hearth artwork; revise the shell only for campaign Village mode, leaving legacy transition and non-Village modes intact.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, CSS, Playwright

**Spec:** `docs/superpowers/specs/2026-09-02-living-village-client-visual-direction-design.md`

## Global Constraints

- Preserve the four global modes: `Village`, `Residents`, `Inventory`, and `Missions`.
- The settlement fills the usable phone viewport between the status header and fixed safe-area navigation.
- Visible residents come from the real campaign roster; do not add decorative people.
- Facility labels are runtime overlays attached to known scene anchors, not painted into the artwork.
- Do not add point-to-move, resident inspection, shared inventory, or mission packing in this slice.

---

### Task 1: Lock the persistent phone contract

**Files:**
- Modify: `apps/web/src/routes/village-shell.e2e.ts`

**Interfaces:**
- Consumes: the existing arrived-campaign helper and `/play/[runId]` route.
- Produces: browser assertions for the compact status header, three scene residents, five facility callouts, scene-first viewport geometry, and absence of developer overlays.

- [ ] **Step 1: Write the failing browser assertions**

Add assertions using `data-testid` hooks for `campaign-status-header`, `village-scene-resident`, and `village-facility-callout`; assert five player-facing facility names, a scene height occupying the available phone area, a compact menu control, and no visible `Authoritative world` or occupancy ledger.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts`

Expected: FAIL because the compact header and multi-resident/callout hooks do not exist.

### Task 2: Make the authoritative scene carry the Village

**Files:**
- Modify: `apps/web/src/lib/components/LivingHearthScene.svelte`
- Modify: `apps/web/src/routes/play/[runId]/+page.svelte`

**Interfaces:**
- Consumes: `VillageResident[]`, `SettlementPresentation`, and `SettlementSceneDefinition` from the server load.
- Produces: all real residents placed from authoritative occupants when available, honest courtyard fallbacks when no projected node exists, and five resize-aware facility callouts.

- [ ] **Step 1: Pass the real roster into the scene**

Extend `LivingHearthScene` with a readonly `residents` prop and pass `data.residents` from the persistent route.

- [ ] **Step 2: Render real resident markers**

Match residents to projected occupants by hero ID, calculate travel/node positions where present, and use stable courtyard positions only for roster members without a settlement projection. Expose names and real activity/location text to assistive technology.

- [ ] **Step 3: Replace debug chips with facility callouts**

Rename the five scene facilities to Portal Tower, Kitchen, Forge, Residence, and Training Grounds. Draw fine cyan leader lines from known hotspot anchors and measure label rectangles after resize, suppressing lower-priority collisions.

- [ ] **Step 4: Remove player-facing debug overlays**

Remove the state hash seal and occupancy counter ledger from the normal scene. Retain transient world-event cues.

### Task 3: Frame the scene with compact campaign controls

**Files:**
- Modify: `apps/web/src/routes/play/[runId]/+page.svelte`
- Modify: `apps/web/src/lib/components/PlayerMenu.svelte`

**Interfaces:**
- Consumes: server-owned day, phase, time, objective projection, replay route, and existing journal callback.
- Produces: a compact Hearth status header; a single menu trigger over the Village; journal/replay access inside the pause menu; and full-height phone/desktop Village geometry.

- [ ] **Step 1: Replace campaign header chrome**

Render `Hearth 01` plus real day/watch status for campaign views. Keep the current header only for non-campaign transition histories.

- [ ] **Step 2: Consolidate utilities in the pause menu**

Show the Village pause trigger without the floating objective card, add Journal access through a callback, and preserve replay/title/restart access in the menu.

- [ ] **Step 3: Size Village mode to the usable viewport**

Set the scene minimum block size from `100dvh` minus the compact header and the appropriate desktop or phone navigation height. Keep the later First Ember and historical proof sections below the initial scene.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts`

Expected: PASS.

### Task 4: Record and verify the accepted slice

**Files:**
- Modify: `apps/web/DESIGN.md`

**Interfaces:**
- Consumes: the implemented persistent Village behavior.
- Produces: durable documentation of the compact header, real-resident rule, dynamic callouts, and debug-overlay boundary.

- [ ] **Step 1: Record the accepted scene-first behavior**

Extend the Persistent Village shell section without reopening the approved navigation or future inspection/movement work.

- [ ] **Step 2: Run full web verification**

Run: `pnpm --filter @summonlab/web typecheck && pnpm --filter @summonlab/web lint && pnpm --filter @summonlab/web test:unit && pnpm --filter @summonlab/web test:e2e`

Expected: all commands exit 0.

- [ ] **Step 3: Inspect phone and desktop screenshots**

Capture the persistent Village at 390×844 and a desktop viewport. Confirm no horizontal overflow, the scene owns the initial viewport, all three residents are identifiable, labels avoid controls, and the four approved navigation icons remain exact.

- [ ] **Step 4: Commit and push**

Commit only the plan, test, scene, shell, menu, and design-context changes with a concise Conventional Commit subject, then push the configured current branch.
