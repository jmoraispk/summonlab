# Prompt: Living Village screen owner

You own one isolated, testable Living Village screen. Build a polished browser prototype at
`/living-village-lab/village` that lets the player understand and operate the static Hearth.

## Product objective

Make the Village feel like a place rather than a menu while keeping interaction direct. The player
must be able to see the Summoning Gate, Training Court, and Tower Threshold; understand important
status at a glance; zoom or pan comfortably; and recover the whole view instantly.

This prototype excludes construction, upgrades, society, schedules, dialogue, and free-walking
heroes. It is a static command surface for the fixed-six Living Village loop.

## Required interaction

- Use the existing Hearth environment and existing repository visual assets. Do not generate art.
- Provide pointer, wheel, touch-friendly, and keyboard-accessible zoom/pan behavior.
- Include visible zoom in/out, fit/reset controls, bounded minimum/maximum zoom, and a reliable
  recovery action if the player gets lost.
- Make Gate, Court, and Tower large, named hotspots—not precision-click targets.
- Selecting a hotspot opens a concise panel or overlay with its current action and state.
- Show compact summaries for owned heroes, current party, training slots, highest floor, and summon
  availability using clearly labeled local fixtures.
- Make desktop and 390×844 layouts feel deliberately composed.
- Respect `prefers-reduced-motion` and preserve usability at 200% browser zoom.

## Ownership boundary

Own only:

```text
apps/web/src/routes/living-village-lab/village/**
apps/web/src/lib/components/living-village/village/**
docs/evidence/living-village-village-*
```

You may read `HearthScene.svelte`, `LivingHearthScene.svelte`, `/settlement-lab`, the Living Village
wiki pages, and existing assets. Do not edit shared layouts, homepage navigation, production routes,
contracts, catalogs, other lab routes, or another agent's component folder. Use route-local typed
fixtures. Propose shared interfaces in the handoff instead of editing them.

Suggested branch: `codex/lv-village-screen` in its own worktree, based on the latest
`codex/shared-system-architecture`.

## Acceptance evidence

- Direct route loads without database or model-provider access.
- A focused Playwright test proves hotspot selection, zoom, reset/fit, and keyboard operation.
- Capture desktop and 390×844 screenshots.
- Run web typecheck, lint, focused test, and production build.
- Report the direct URL, three useful test actions, decisions those actions inform, commit hash,
  pushed branch, clean-worktree status, and unresolved product questions.

Do not merge your branch. The coordinator will review the isolated route first.
