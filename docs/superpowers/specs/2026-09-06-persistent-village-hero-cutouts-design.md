# Persistent Village Hero Cutouts Design

**Status:** Approved
**Date:** 2026-09-06

## Goal

Show every actual campaign resident inside the persistent Hearth 01 Village using an approved,
normal-proportion transparent character cutout, while keeping one canonical hero-visual catalog and
an honest non-character state for heroes whose cutouts have not been approved yet.

The first production wave covers the current review campaign's three residents: Yaso Dreno, Oren
Sorin, and Joror Pelleth. It establishes the reusable contract and rendering path before any wider
backfill of the 200-hero summonable roster.

## Accepted product decisions

- Village characters use normal-proportion `village-cutout` artwork derived from summon portraits.
- Combat chibis remain combat-only.
- Opaque portrait cards and invented vector characters never appear in the Village scene.
- Only heroes in the current campaign projection appear. The six fictional Living Village lab
  residents are not substituted into persistent play.
- Missing cutouts produce a labeled non-character marker; they never fall back to a chibi or opaque
  summon portrait.
- The existing persistent Village presentation remains intact. This work restores resident overlays,
  not the rejected scene-first redesign.

## Chosen architecture: extend the existing catalog

The approved summonable-hero catalog remains the single owner of each hero's visual assets. Its JSON
schema advances to v2 while its content identity remains `summonable-heroes-v1`, because the 200
identities and deterministic selection pool do not change.

Each catalog entry retains its required `summon` and `combatChibi` assets and gains an optional
`villageCutout` asset. Optionality permits a controlled partial backfill without claiming that all 200
heroes are already Village-ready. When present, `villageCutout` is approved artwork and must bind:

- the same `heroId`, immutable `characterId`, and character-manifest hash as the entry;
- the exact summon source asset key and content hash used as its pixel authority;
- an approved transparent PNG source with role `village-cutout`;
- its source experiment and explicit approval record.

The runtime manifest also advances to v2. A hero bundle contains the existing two assets plus a
`village-cutout` asset only when the approved source exists. Runtime files stay beneath
`apps/web/static/runtime/summonable-heroes-v1/<hero-id>/`; no second catalog, route-local lookup, or
duplicate runtime tree is introduced.

The runtime cutout is a transparent WebP no wider than 384 pixels with a 120 KB per-image budget. It
is loaded only for the three residents in the active campaign, so it does not enter the initial phone
payload. The checked-in runtime derivative means Vercel and ordinary local development do not need
Docker, Python, `rembg`, or an image model.

### Rejected alternatives

1. A separate Village-cutout sidecar catalog would allow independent rollout, but it would create the
   ownership ambiguity this cleanup is meant to remove.
2. A route-local map would be quick for the current campaign but would reproduce the lab's dead-end
   fixture architecture.
3. Deriving transparency in the browser would avoid asset production but cannot reliably remove the
   background, preserve identity, or meet the true-alpha contract.

## Source production and approval

Historical roster heroes predate the new three-artifact hero-creation contract, so their cutouts use
a dedicated backfill batch rather than pretending to be newly created heroes.

The first batch lives at
`assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/`. Each hero directory
records:

- the catalog-bound summon source path, asset key, content hash, and manifest hash;
- the background-isolation toolchain: `rembg==2.0.83`, model `u2net_human_seg`, the model-file
  SHA-256 observed at production time, and the exact alpha-matting parameters;
- the untouched provider result and candidate PNG;
- candidate dimensions, byte count, SHA-256, and alpha inspection result;
- a review image showing source and transparent cutout together.

Background isolation removes only the parchment field and grounding shadow. The accepted character
pixels, pose, crop, face, anatomy, clothes, and normal proportions remain unchanged. The candidate
must be `1024x1536`, contain true alpha, leave all four canvas edges transparent, and retain a bounded
visible silhouette. Alpha validation is mechanical; identity and edge quality still require visual
approval.

No candidate enters the approved catalog until the user explicitly approves the three-image review
sheet. A rejected candidate remains immutable evidence and a correction uses a new version.

## Persistent Village data flow

The `/play/[runId]` server load already owns the authoritative join between campaign heroes,
settlement occupants, social state, and runtime portraits. It will also resolve `village-cutout` by
immutable manifest hash and summon art key and attach the result to each `VillageResident` as
`sceneArt`.

`LivingHearthScene.svelte` receives the existing resident projection. It iterates the authoritative
`presentation.occupants` rather than selecting only the primary hero. Each occupant is joined to its
campaign resident by `heroId`, projected along its current route or node, and rendered as:

- an `<img>` containing the approved transparent cutout when `sceneArt` exists; or
- a compact neutral marker labeled `Art pending` when it does not.

The existing name and activity label remain readable. Each resident overlay is a semantic link to
`/play/[runId]?mode=residents#resident-<heroId>`, and the corresponding Residents article receives that
stable anchor. No new drawer or duplicate resident-detail component is introduced.

When two or more occupants share one node, a deterministic horizontal spread based on campaign
ordinal prevents exact overlap. It preserves the authoritative node and clamps overlays inside the
scene. Travel progress, pose effects, activity text, day phase, building state, and all other scene
data continue to come from the server-owned settlement presentation.

## Legacy lab boundary

The six cutouts beneath `apps/web/src/routes/living-village-lab/village/cutouts/` remain route-local
prototype evidence. Their hero IDs do not exist in the approved 200-hero roster, so they cannot be
copied into the canonical catalog or selected as persistent residents.

Their README will explicitly identify the directory as legacy lab-only evidence and point to the
approved summonable-hero catalog as the only production owner. Removing the lab itself is outside
this slice; it may be retired after persistent play reaches the useful interaction parity worth
keeping.

## Failure behavior

- Unknown manifest hash or missing approved cutout: show the labeled non-character marker.
- Opaque, edge-touching, oversized, hash-mismatched, or over-budget source: fail export; do not emit a
  runtime file.
- Runtime manifest mismatch: fail the repository validation command.
- Missing campaign resident for an authoritative occupant: show a neutral `Resident unavailable`
  marker using the occupant ID only in accessible diagnostic text; do not invent a name or image.
- Failed image load in the browser: preserve the marker-sized footprint and reveal `Art pending`.

## Testing and evidence

Contract and exporter tests will prove that:

- the v2 catalog accepts a partial set of correctly bound cutouts;
- summon and combat-chibi assets remain required;
- cutout identity/source mismatches are rejected;
- transparent inputs preserve alpha in the runtime WebP;
- opaque or edge-touching sources and stale runtime output fail validation;
- bundles without a cutout remain valid and resolve to `null`.

Server and component tests will prove that all three campaign occupants are projected, shared-node
spreading is deterministic, and missing art never falls back to another character image.

The persistent Village Playwright test will use the fixed campaign seed
`village-shell-19aa1947-bcad-4fab-b2f8-e0e34a9b7eb3`, which resolves Yaso Dreno, Oren Sorin, and
Joror Pelleth. On desktop and a `390x844` phone viewport it will verify:

- three authoritative resident overlays and no fixture residents;
- real alpha at an image corner for every promoted cutout;
- links reach the matching Residents article;
- the phone navigation remains unobstructed and the document does not overflow horizontally;
- the Village still retains its current environment, status plaques, building chips, and campaign
  controls.

Review evidence consists of the three-image cutout approval sheet plus desktop and phone screenshots
of the persistent Village after promotion.

## Rollout boundaries

This design delivers the reusable catalog/runtime/UI path and the current three-resident production
wave. It does not generate or approve the other 197 cutouts, redesign the Residents ledger, restore
every Living Village lab interaction, change settlement simulation rules, or add a new deployment
service. Wider backfill proceeds only after the first three demonstrate acceptable identity,
silhouette readability, phone scale, and edge quality.
