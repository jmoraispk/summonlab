# Prompt: Living Village screen owner

You own the unified Village and Roster screen. Build a polished browser prototype at
`/living-village-lab/village` that lets the player understand the Hearth, find and inspect its six
heroes, and give them direct orders without leaving the world surface.

## Product objective

Make the Village feel like a place rather than a menu. The player must see the Summoning Gate,
Training Court, Tower Threshold, and visible heroes; inspect a hero through a small anchored
popover; issue a useful order; zoom or pan comfortably; and recover the whole view instantly.

This prototype excludes construction, upgrades, society, schedules, dialogue, direct movement
control, and autonomous wandering. It is a static command surface with authored order-to-destination
movement for the fixed-six Living Village loop.

## Required interaction

- Use the existing Hearth environment and existing repository visual assets. Do not generate art.
- Provide pointer, wheel, touch-friendly, and keyboard-accessible zoom/pan behavior.
- Include visible zoom in/out, fit/reset controls, bounded minimum/maximum zoom, and a reliable
  recovery action if the player gets lost.
- Make Gate, Court, and Tower large, named hotspots—not precision-click targets.
- Selecting a hotspot opens a concise panel or overlay with its current action and state.
- Render exactly Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl as selectable
  Village residents using their existing identity anchors. Do not generate or add a face.
- Selecting a visible hero opens a compact anchored popover with portrait, name, level, Health,
  current activity, party state, and primary actions. Detailed attributes, skills, and equipment may
  expand into a drawer without becoming a separate route.
- Provide a compact roster ribbon or find-hero control as an accessibility and overlap fallback; it
  must select/focus the same in-world hero rather than open a separate roster screen.
- Prototype orders for local Court training and Tower species hunting. The activity agent owns
  production-quality movement; this screen may use a route-local transition placeholder showing
  the hero move toward the named destination.
- Show compact summaries for current party, training slots, highest floor, summon availability, and
  material inventory using clearly labeled local fixtures.
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
- A focused Playwright test proves hotspot selection, in-world hero selection, roster-ribbon focus,
  popover/drawer operation, one training order, zoom, reset/fit, and keyboard operation.
- Capture desktop and 390×844 screenshots.
- Run web typecheck, lint, focused test, and production build.
- Report the direct URL, three useful test actions, decisions those actions inform, commit hash,
  pushed branch, clean-worktree status, and unresolved product questions.

Do not merge your branch. The coordinator will review the isolated route first.
