# Prompt: Summoning Portal screen owner

You own one isolated, testable Summoning Portal experience. Build a polished browser prototype at
`/living-village-lab/summon` using this supplied layout reference:

`/home/joao/.codex/attachments/7597b0a2-3574-4ef4-8248-a55b12d3403c/codex-clipboard-22dd3848-c517-4c2b-9a22-056f521c71c0.png`

Treat the reference as an information-hierarchy brief, not a visual style to copy. Translate it
into the realistic, dark, premium Summonlab/Hearth identity.

## Product objective

Make the portal desirable, trustworthy, and spectacular. The player should always see their
currencies, selected banner, featured identity, guarantee progress, rates, costs, and the difference
between one summon and the **10 + 1 bonus** offer before spending.

Living Village still has exactly six visual identities: Dara Zev, Mara Vey, Jori Daro, Kira Toren,
Iven Orra, and Remy Nahl. Use only existing hero anchors. Do not call image generation, invent a
seventh face, or persist duplicate hero instances.

## Required portal hierarchy

- Top currency counters for a free/earned summon resource and premium gems.
- Compact banner selector with Standard active; Limited and Equipment may appear as clearly labeled
  future/previews rather than working economies.
- Large featured-hero art, name, short identity line, and restrained motion as the emotional anchor.
- Visible pity/guarantee progress plus a one-action Rates and details panel.
- Two primary actions with costs printed on them: **Summon ×1** and
  **Summon ×10 + 1 bonus**.
- Prototype values must be labeled as fixtures; do not invent canonical prices, probabilities,
  pity thresholds, or currency grants.
- The batch action is a non-committing presentation simulation using only the fixed six identities.
  It must not create eleven durable heroes. Surface this honestly in the lab without making the
  player-facing composition feel like developer tooling.

## Animation experiment

Build a selector that lets the owner replay and compare all three reveal directions against the
same fixed test receipt:

1. **Gate ignition** — layered portal charge, silhouette crossing, identity reveal, then mechanics.
2. **Constellation assembly** — affinity/skill marks gather into a person before the portrait.
3. **Immediate identity** — portrait-first with premium restrained parallax, then staged details.

Each version must have skip, replay, a visible reduced-motion-safe alternative, muted-by-default
sound hooks, no unskippable delay after the face is known, and a measurable time to first
recognizable identity. Finish with an attractive single-result and `10 + 1` result presentation.
Aim for exceptional pacing and polish using HTML/CSS/Svelte and existing assets rather than a
generic card flip.

## Ownership boundary

Own only:

```text
apps/web/src/routes/living-village-lab/summon/**
apps/web/src/lib/components/living-village/summon/**
docs/evidence/living-village-summon-*
```

You may read current hero assets, summoning/progression wiki pages, and
the Living Village milestone. Do not edit existing summon routes/APIs, shared layouts, homepage
navigation, production contracts/economy, catalogs, other lab routes, or another agent's component
folder. Use route-local typed fixtures and record proposed summon view-model fields in the handoff.

Suggested branch: `codex/lv-summon-screen` in its own worktree, based on the latest
`codex/shared-system-architecture`.

## Acceptance evidence

- Direct route loads without database, paid image generation, or model-provider access.
- A focused Playwright test proves banner/rates interaction, visible costs, `10 + 1` communication,
  all three animation choices, skip/replay, and reduced-motion behavior.
- Capture desktop and 390×844 screenshots plus one short capture or frame sequence that makes the
  animation comparison reviewable.
- Run web typecheck, lint, focused test, and production build.
- Report the direct URL, three useful test actions, the recommended animation direction, decisions
  those actions inform, commit hash, pushed branch, clean-worktree status, and unresolved economy
  questions.

Do not merge your branch. The coordinator will review the isolated route first.
