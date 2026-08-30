# Prompt: Hero activity and animation owner

You own one isolated, testable hero-activity lab. Build a polished browser prototype at
`/living-village-lab/hero-activity` that proves the six fixed heroes can visibly walk through the
Village, arrive at a named destination, and perform readable activity animations.

## Product objective

The unified Village/roster screen only works if an order visibly becomes behavior. Build the small,
deterministic presentation system behind that promise without creating a full simulation, physics
engine, autonomous schedule, or agentic society.

The only hero identities are Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl.
Use existing visual anchors or compact existing figures. Do not generate, rename, duplicate, or add
a face.

## Required interaction

- Display a simplified Hearth activity stage with named Gate, Court, idle, and return points.
- Let the owner choose one of the six heroes and issue a local-training or Tower-departure order.
- Animate deterministic phases: `idle → walking → arriving → training` and
  `idle → walking → departing → deployed → returning → idle`.
- Provide at least two readable Court loops, such as strength drill and skill practice, without
  implying that every skill already has a unique animation.
- Show the same hero's identity, current destination, phase, and progress throughout the sequence.
- Use authored routes or waypoints. Do not build general-purpose pathfinding or collision physics.
- Provide pause, 1×/2× speed, replay, skip-to-arrival, and a reduced-motion mode that preserves
  state clarity without spatial animation.
- Demonstrate two heroes moving at the same time without overlap making either identity or activity
  unreadable. The runtime target remains only six heroes.
- Make desktop and 390×844 layouts deliberately composed, keyboard accessible, and usable at 200%
  browser zoom.

## Proposed presentation boundary

Use a route-local typed state machine and report the fields that should eventually become the
shared hero-activity projection: hero ID, activity ID, phase, origin, destination, route progress,
activity progress, start/end timing, presentation variant, and reduced-motion state. Do not create
or edit the shared contract in this branch.

## Ownership boundary

Own only:

```text
apps/web/src/routes/living-village-lab/hero-activity/**
apps/web/src/lib/components/living-village/hero-activity/**
docs/evidence/living-village-hero-activity-*
```

You may read `HearthScene.svelte`, `LivingHearthScene.svelte`, `HeroRig.svelte`, `/settlement-lab`,
existing hero assets, and the Living Village wiki pages. Do not edit the unified Village route,
shared layouts, homepage navigation, production routes, contracts, catalogs, other lab routes, or
another agent's component folder.

Suggested branch: `codex/lv-hero-activity` in its own worktree, based on the latest
`codex/shared-system-architecture`.

## Acceptance evidence

- Direct route loads without database or model-provider access.
- A focused Playwright test proves hero/order selection, movement phases, arrival, two local
  training loops, departure/return, simultaneous heroes, pause/speed/replay, and reduced motion.
- Capture desktop and 390×844 screenshots plus a short frame sequence or recording that makes
  motion quality reviewable.
- Run web typecheck, lint, focused test, and production build.
- Report the direct URL, three useful test actions, decisions those actions inform, proposed shared
  projection fields, commit hash, pushed branch, clean-worktree status, and unresolved questions.

Do not merge your branch. The coordinator will review the isolated route first.
