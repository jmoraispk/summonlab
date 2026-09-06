# Persistent Village Shell Implementation Plan

**Goal:** Promote the approved Living Village navigation shell into the persistent campaign route, with real Residents and Missions views and a phone-safe four-button navigation bar.

**Architecture:** Keep `/play/[runId]` as the persistent campaign boundary. Select one of four validated modes through `?mode=village|residents|inventory|missions`, render server-derived campaign data for each mode, and share one responsive navigation component between desktop and phone. Do not promote fixture-backed lab state or imply that the unresolved shared-inventory contract exists.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest, Playwright

---

## Task 1: Define and validate Village modes

**Files:**
- Create: `apps/web/src/lib/village-shell.ts`
- Test: `apps/web/src/lib/village-shell.spec.ts`

1. Write a failing unit test proving the four valid mode values are accepted and all missing or invalid values fall back to `village`.
2. Run `pnpm --filter @summonlab/web test -- village-shell.spec.ts` and confirm the expected module/export failure.
3. Implement the narrow `VillageMode` type, mode metadata, and parser.
4. Re-run the focused unit test and confirm it passes.

## Task 2: Build the responsive persistent shell

**Files:**
- Create: `apps/web/src/lib/components/village-shell/VillageModeIcon.svelte`
- Create: `apps/web/src/lib/components/village-shell/VillageModeNav.svelte`
- Create: `apps/web/src/lib/components/village-shell/VillageResidentsPanel.svelte`
- Create: `apps/web/src/lib/components/village-shell/VillageMissionsPanel.svelte`
- Create: `apps/web/src/lib/components/village-shell/VillageInventoryPanel.svelte`
- Modify: `apps/web/src/lib/components/PlayerMenu.svelte`
- Modify: `apps/web/src/routes/play/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/play/[runId]/+page.svelte`
- Test: `apps/web/src/routes/village-shell.e2e.ts`

1. Write a failing Playwright test that creates an arrived campaign and checks the four destination links, real resident names, real mission data, honest Inventory state, and phone target sizes/safe placement.
2. Run the focused Playwright test and confirm it fails against the old page.
3. Parse `url.searchParams.get('mode')` on the server and return a serializable real-data resident projection with runtime portraits.
4. Add a slim desktop top navigation and a fixed phone bottom navigation. Each phone control must have a distinct engraved icon, a visible label, `aria-current`, at least a 44px target, and safe-area padding.
5. Preserve the current real settlement scene as Village. Render the campaign roster as Residents and campaign objectives as Missions. Render the existing workshop only when its actual equipment projection exists; otherwise explain that shared Village Inventory is not established for this campaign yet.
6. Offset the existing Player Menu objective control above the phone bar and verify no horizontal overflow.
7. Re-run the focused Playwright test until it passes.

## Task 3: Record the accepted product boundary

**Files:**
- Modify: `apps/web/DESIGN.md`

1. Record the accepted four-mode information architecture, desktop/phone navigation behavior, persistent-data rule, and Inventory limitation.
2. Keep the lab routes as visual-development surfaces; do not link them as player-facing persistent destinations.

## Task 4: Validate and deliver

1. Run focused unit and end-to-end tests.
2. Run the web package's full type/check, unit, and relevant end-to-end validation commands from its package scripts.
3. Inspect the phone and desktop slice in the browser, including navigation placement and overflow.
4. Review `git diff` and `git status` to ensure only in-scope files changed.
5. Commit with `feat(web): add persistent village shell` and push `main` to its configured remote.
