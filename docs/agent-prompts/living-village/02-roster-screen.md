# Prompt: Roster and Hero screen owner

You own one isolated, testable Roster/Hero screen. Build a polished browser prototype at
`/living-village-lab/roster` for inspecting, equipping, grouping, and directly training the six
Living Village heroes.

## Product objective

Make six persistent people easy to recognize and mechanically compare without turning the screen
into a spreadsheet. The screen combines the roster and selected hero sheet. It must support the
short path: select hero → select training focus → confirm.

The only hero identities are Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl.
Use their existing anchors and actual approval labels. Do not generate, rename, duplicate, or add a
face.

## Required interaction

- Provide a fixed-six roster with portrait, availability, level, and party/training state.
- Show the selected hero's portrait, stars, level/XP, six attributes, affinity, enabled skills,
  equipment slots, and availability.
- Provide a readable compare/equip/unequip prototype using a small route-local item fixture.
- Support add/remove from the one three-hero party.
- Support direct training in at most three decisions: hero, attribute or owned enabled skill,
  confirm. Show the exact projected change before confirmation.
- Prevent a deployed hero from training and a training hero from being deployed; explain the
  rejection in the interface.
- Make desktop and 390×844 layouts deliberately composed, keyboard accessible, and usable at 200%
  browser zoom.

## Ownership boundary

Own only:

```text
apps/web/src/routes/living-village-lab/roster/**
apps/web/src/lib/components/living-village/roster/**
docs/evidence/living-village-roster-*
```

You may read the progression, skill, equipment, fixed-roster, and Living Village wiki pages plus
existing hero assets. Do not edit shared layouts, homepage navigation, production routes, shared
contracts/content, catalogs, other lab routes, or another agent's component folder. Use small,
clearly labeled route-local fixtures; do not attempt to implement the complete compendia.

Suggested branch: `codex/lv-roster-screen` in its own worktree, based on the latest
`codex/shared-system-architecture`.

## Acceptance evidence

- Direct route loads without database or model-provider access.
- A focused Playwright test proves hero selection, party editing, one equipment change, successful
  training preview/confirmation, and one availability rejection.
- Capture desktop and 390×844 screenshots.
- Run web typecheck, lint, focused test, and production build.
- Report the direct URL, three useful test actions, decisions those actions inform, commit hash,
  pushed branch, clean-worktree status, and unresolved product questions.

Do not merge your branch. The coordinator will review the isolated route first.
