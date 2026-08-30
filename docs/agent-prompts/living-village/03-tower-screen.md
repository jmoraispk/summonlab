# Prompt: Tower and combat screen owner

You own one isolated, testable Tower screen. Build a polished browser prototype at
`/living-village-lab/tower` that combines floor selection, party confirmation, deterministic combat
presentation, results, rewards, and the return-to-training handoff.

## Product objective

The player should understand what floor is available, whether the party is ready, why combat was
won or lost, what changed, and what useful action comes next. This release has mechanical Floors
1–10 only—no tower story, expedition navigation, world discovery, or permanent injury.

## Required interaction

- Show Floors 1–10 with sequential unlocks, cleared state, current selection, encounter preview,
  and first-clear versus replay rewards.
- Show the current three-hero party and block deployment when it is incomplete or unavailable.
- Use a transparent, seeded, route-local mathematical fixture; label it as a presentation fixture,
  not accepted final combat math.
- Present initiative/action order, important Health or Mana changes, skill/equipment/affinity
  contributions used by the fixture, statuses, and the decisive cause of victory or defeat.
- Provide replay/pause/speed controls for the combat presentation and respect reduced motion.
- Make **Train returning heroes** the primary result action, with the eligible heroes already
  identified. Also provide return to Village.
- Use existing monster and tower visual assets as screen fixtures. Do not generate or canonize a
  new race.
- Make desktop and 390×844 layouts deliberately composed, keyboard accessible, and usable at 200%
  browser zoom.

## Ownership boundary

Own only:

```text
apps/web/src/routes/living-village-lab/tower/**
apps/web/src/lib/components/living-village/tower/**
docs/evidence/living-village-tower-*
```

You may read `/mission-lab`, the progression/skills/equipment/monster material, and the Living
Village milestone. Do not edit existing mission routes, shared layouts, homepage navigation,
production routes, contracts, content catalogs, other lab routes, or another agent's component
folder. Use route-local typed fixtures. Record the proposed `CombatReceipt` fields in the handoff.

Suggested branch: `codex/lv-tower-screen` in its own worktree, based on the latest
`codex/shared-system-architecture`.

## Acceptance evidence

- Direct route loads without database or model-provider access.
- A focused Playwright test proves floor selection, deployment rejection, deterministic result
  playback, result explanation, and the training-return action.
- Capture desktop and 390×844 screenshots.
- Run web typecheck, lint, focused test, and production build.
- Report the direct URL, three useful test actions, decisions those actions inform, commit hash,
  pushed branch, clean-worktree status, and unresolved product questions.

Do not merge your branch. The coordinator will review the isolated route first.
