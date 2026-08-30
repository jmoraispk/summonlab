# Prompt: Tower species-hunt screen owner

You own one isolated, testable Tower species-hunt screen. Build a polished browser prototype at
`/living-village-lab/tower` that combines hunt setup, party confirmation, remaining-Health safety
rules, deterministic repeated combat, material collection, and automatic return.

## Product objective

The player sends a party to an unlocked Tower hunting ground to kill a chosen species until the
party reaches a selected safety threshold. The screen must make risk, expected rewards, current
Health, and the return reason understandable. This release has mechanical Floors 1–10 only—no tower
story, free-roaming expedition navigation, world discovery, or permanent injury.

## Required interaction

- Show Floors 1–10 as unlocked hunting grounds with available species, difficulty, known material
  drops, and first-clear versus repeat-hunt rewards.
- Let the player choose one known species, a three-hero party, and a remaining-Health return
  threshold such as 75%, 50%, or 25%. Explain that a threshold is checked after an encounter and
  cannot prevent one encounter from crossing it.
- Show the current three-hero party and block deployment when it is incomplete or unavailable.
- Use a transparent, seeded, route-local mathematical fixture; label it as a presentation fixture,
  not accepted final combat math.
- Resolve a bounded sequence of encounters and automatically stop when any hero is at or below the
  selected threshold, the next encounter is unsafe, inventory capacity is reached, or the fixture's
  encounter cap is reached.
- Present initiative/action order, important Health or Mana changes, skill/equipment/affinity
  contributions used by the fixture, statuses, and the decisive cause of victory or defeat.
- Provide replay/pause/speed controls for representative encounter presentation and respect reduced
  motion.
- The haul report must show species kills, level XP, practical skill progress, every material and
  quantity, remaining Health, and the exact return reason.
- Make **Return to Village** the primary completed-hunt action, with a clear secondary action for
  reviewing or assigning safe Court training.
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
- A focused Playwright test proves species/floor selection, deployment rejection, threshold choice,
  deterministic multi-encounter resolution, material haul, exact return reason, and Village return.
- Capture desktop and 390×844 screenshots.
- Run web typecheck, lint, focused test, and production build.
- Report the direct URL, three useful test actions, decisions those actions inform, commit hash,
  pushed branch, clean-worktree status, and unresolved product questions.

Do not merge your branch. The coordinator will review the isolated route first.
