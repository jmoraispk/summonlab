# Linux continuation handoff — 2026-08-25

## Resume target

Continue the active Summonlab implementation goal phase by phase from
`docs/implementation-plan.md`. The current slice is `FIN-003`: finish onboarding, objectives,
pause, settings, and restart. Completing `FIN-003` does **not** complete the broader implementation
goal; continue with the next planned phase only after this slice is validated and reviewed.

Use this kickoff prompt in the new Codex task:

> Continue the Summonlab implementation from `docs/linux-handoff-2026-08-25.md`. Resume the active
> implementation-plan goal at FIN-003, fix the known CI lint failure, complete browser and visual
> validation, update the durable design/architecture records, run the full check, commit, push, and
> ask me for focused playtest feedback. Do not mark the broader goal complete when FIN-003 finishes.

## Git checkpoint

- Repository: `https://github.com/jmoraispk/summonlab.git`
- Branch: `main`
- Code checkpoint: `c2ae69d00570179cab0147d52bd54eb75a2a4601`
- Subject: `feat(campaign): add player journey shell`
- The checkpoint was pushed to `origin/main` from a clean working tree.
- Hosted CI run
  [32891173226](https://github.com/jmoraispk/summonlab/actions/runs/32891173226) failed only at
  web lint. Four new navigations must use SvelteKit `resolve()`:
  - `apps/web/src/lib/components/PlayerMenu.svelte:64`
  - `apps/web/src/routes/+page.svelte:29`
  - `apps/web/src/routes/onboarding/[runId]/+page.svelte:95`
  - `apps/web/src/routes/onboarding/[runId]/+page.svelte:113`

This handoff note is committed immediately after that code checkpoint, so use the latest `main` and
confirm that the code checkpoint remains in its history.

## What is implemented

- The original PNG is the player-facing title image; developer labs are secondary links.
- A seeded campaign creates three stable adult human heroes from the `ember`, `vow`, and `lark`
  seed roles.
- The engine remains `engine-v13`; additional campaign heroes enter through a proper top-level
  bootstrap boundary instead of a development scenario.
- The first-person onboarding has four beats: wake on reserve power, reach/open the gate, inspect
  three summoned minds, and hear one canonical answer from each hero.
- Observable dossiers include age, height, build, voice, value, drive, social style, stress response,
  and daily habit. They do not expose hidden reasoning.
- The first hero makes the canonical preparation-destination choice before play moves to Hearth 01.
- Seven objectives are derived from canonical engine/proof state, hash-bound to the engine snapshot,
  and shown through a persistent objective chip and pause menu.
- Player preferences persist locally: reading scale, motion, and Wait/5-second decision timing.
- The pause menu pauses player interaction only. The server-owned settlement clock continues.
- Restarting the same seed creates a new run, marks the prior campaign as superseded, and preserves
  the prior append-only replay.
- Migration `0011_campaign_experience.sql` adds replay-adjacent campaign metadata. Canonical game
  truth remains in the engine event stream.

## Validation already completed

- Contracts, engine, database, and web typechecks passed; Svelte check reported zero errors and zero
  warnings after the last fixes.
- `packages/engine/src/objectives.spec.ts` passed.
- With PostgreSQL running, these targeted integration tests passed:
  - `packages/database/src/campaign.integration.spec.ts`
  - `packages/database/src/migration.integration.spec.ts`
- The campaign test proves sequential onboarding, the three required conversations, replay-preserving
  restart, and strict replay verification of the superseded run.
- Full lint, full `pnpm check`, campaign browser E2E, and visual QA have not passed yet.

## Native Linux bootstrap

Requirements: current Ubuntu, Git, Docker Engine with Compose, Node `24.14.1` (see `.node-version`),
and Corepack/pnpm `10.33.0`.

```bash
git clone https://github.com/jmoraispk/summonlab.git
cd summonlab
git checkout main
git pull --ff-only origin main
node --version
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm db:start
pnpm db:migrate
```

Defaults require no secret and use:

- PostgreSQL: `postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab`
- Policy mode: `scripted`
- Web: `0.0.0.0:5173`
- Simulation speed: `4x`

Do not add an OpenAI key for this slice. The deterministic/scripted path is the test authority.

## Immediate continuation sequence

1. Fix the four `svelte/no-navigation-without-resolve` lint errors and run `pnpm lint`.
2. Add a campaign Playwright test covering:
   - title and seeded creation;
   - wake and gate steps;
   - exactly three stable heroes;
   - one question/reply per hero;
   - first autonomous destination and entry into `/play/:runId`;
   - objective and pause menus;
   - persisted local settings;
   - same-seed restart to a new run ID;
   - verified replay access for the old run.
3. Run the journey at desktop and phone viewports. Capture screenshots and visually inspect them,
   especially the title composition, gate, hero tabs/dossiers, objective chip, and pause menu.
4. Make only evidence-led visual/accessibility corrections. Confirm reduced motion and large text do
   not break the onboarding.
5. Add an ADR covering the replay-adjacent campaign shell, derived objectives, interface-only pause,
   and replay-preserving restart. Update `docs/implementation-plan.md`, `docs/progress.md`, and
   `docs/architecture.md` when FIN-003 passes.
6. Run the repository-wide `pnpm check`, targeted PostgreSQL integration suite, and campaign E2E.
7. Commit and push, watch hosted CI to completion, and hand the user exact local playtest commands and
   two or three focused feedback questions.

## Product and architecture assumptions to preserve

- Three initial heroes are strangers and clean slates; summoning does not create allegiance.
- Hero personality, habit, and agency affect choices, but agents never mutate game state directly.
- The engine alone applies legal commands and owns canonical events.
- Onboarding progress and display preferences are presentation metadata, not game truth.
- Objectives may reference presentation progress but derive game accomplishments from canonical state.
- Restart never deletes or rewrites the prior chronicle.
- The player may direct or converse with heroes; deterministic fallback remains available without a
  provider key.
- The settlement continues while the interface is closed or paused.
- The first vertical slice remains adult-only and human-only.

## Known follow-up risks

- `createPlayerCampaign` creates the proof/engine run before registering campaign metadata. A campaign
  registration failure can leave an unlisted proof run, although it does not supersede the prior run.
- Creating an entirely new chronicle does not supersede other active chronicles; the title continues
  the most recently created active one. Decide whether multiple active chronicles need an explicit
  selector after playtesting.
- `PlayerMenu` refreshes objectives when opened. If objectives must update while it stays closed, add
  an event/projection refresh rather than duplicating completion state in the client.
- Campaign play currently enters the existing Hearth 01 presentation, whose primary-hero proof shell
  predates the three-hero campaign. Verify that all three heroes are legible in the settlement before
  expanding gameplay.
