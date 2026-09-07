---
name: summonlab-item-production
description: Use when adding or expanding a Summonlab item, equipment class, material family, rank ladder, armor set, weapon, consumable, loot item, or item visual in the repository.
---

# Summonlab item production

Treat an item as an end-to-end, provenance-bound game asset rather than a picture or catalog row.
Connect theory, coverage, visuals, review, approval, runtime, content, acquisition, and validation
without multiplying concepts unnecessarily.

## Start by selecting the authorized scope

Read repository instructions and current item truth before changing anything. Determine which
boundary the request reaches:

- **Theory or planning:** define the item and its coverage; do not generate or integrate pixels.
- **Direction study:** generate reference-only boards; do not call them candidates.
- **Candidate production:** write a versioned manifest and collision-safe outputs; stop at review.
- **Promotion:** requires an explicit human acceptance record and exact selected candidate bytes.
- **Runtime integration:** requires approved sources and authority over affected runtime systems.

Do not infer later-stage authorization from “make an item.” Ask the owning orchestrator before
changing shared catalogs, contracts, or another visual domain.

## Expand a minimal request into the standard campaign

A short request that names an item or family is enough to begin. Unless the user narrows or expands
the scope, treat it as authorization for a review-ready candidate campaign and apply these defaults:

1. Inspect repository instructions, canonical item theory, retained ranks and materials, approved
   visual language, current manifests, and production tooling.
2. Define the item model, applicable material mapping, complete rank/material coverage matrix,
   exclusions, and exact image count.
3. Preserve supplied references with provenance and narrow visual roles. Create direction boards
   only when they materially improve rank, material, class, or set calibration.
4. Create collision-safe manifests, assignments, prompts, receipts, and outputs. Generate every
   dedicated individual item required by the coverage matrix; boards never substitute for them.
5. Produce scrollable review evidence organized by the useful comparison axes, including phone-size
   and native-detail inspection, then validate, commit, push, and report exact outcomes.
6. Stop at review-ready candidates. Promotion, runtime export, and shared catalog or contract changes
   require explicit authorization appropriate to those boundaries.

Proceed without asking the user to restate these defaults. Ask only when repository truth cannot
resolve a consequential product choice or when the next action crosses an unauthorized boundary.

| Situation                     | Required move                                                 |
| ----------------------------- | ------------------------------------------------------------- |
| New ranked form               | Cover and compare every retained rank                         |
| Material-backed library       | Generate every retained material and inspect material cohorts |
| Item set                      | Accept one complete-set anchor before individual members      |
| Inspiration supplied          | Preserve provenance and assign each reference a narrow role   |
| Candidate accepted            | Record exact selection/hash before promotion                  |
| Same item from another source | Reuse its definition; vary instance provenance                |

Read [item-production-workflow.md](references/item-production-workflow.md) for any implementation.
Read [visual-production-strategies.md](references/visual-production-strategies.md) whenever visuals,
references, rank, materials, variants, or sets are involved. Read
[repository-map.md](references/repository-map.md) before touching current Summonlab Equipment files.

## Lock the item model before pixels

Record stable identity, purpose, owner, slot/use rules, progression source, craftsmanship relation,
acquisition paths, set membership, visual uses, exclusions, and deferred mechanics. Reuse one
definition across acquisition paths whenever the authored item is the same; origin belongs on the
instance, not in duplicate catalogs.

## Ground functional proportions before the first pixels

For any real-world-derived weapon, armor, tool, garment, vessel, or other item whose recognition
depends on functional anatomy, complete a proportion gate before the first pixel-producing call:

1. Identify the functional landmarks and ratios that control class recognition, handling, fit, or
   construction. Presentation measurements such as canvas margin do not substitute for item anatomy.
2. Reuse accepted, source-bound measurements when the repository already has them. Otherwise browse
   authoritative primary or curatorial sources—such as museum collections, conservation records,
   maker specifications, or technical standards—and compare multiple representative examples rather
   than treating one object as universal. Record URLs, measurements, derived ranges, and uncertainty.
3. Write a measurable proportion/anatomy contract and bind it into the initial direction target,
   prompt, and acceptance criteria. Fantasy escalation may ornament or transform the construction,
   but it must not silently discard the contract's functional landmarks.
4. Measure the first direction output against that contract before owner review or additional image
   calls. Mark out-of-range work `revise` unless the owner explicitly accepts a named, measured
   deviation. Never defer this check until individual production or wait for the owner to notice it.

If authoritative browsing is unavailable and no accepted evidence exists, keep the direction
`experiment`-only and do not launch the coverage matrix. Read the functional-proportion section in
[visual-production-strategies.md](references/visual-production-strategies.md) for the evidence and
review procedure.

## Use both visual axes

When ranked materials are part of the item, use both axes before producing the final individual
library:

1. **Enforce all ranks for progression.** Design and review the complete ordered rank ladder
   together—currently `F → E → D → C → B → A → S`. Hold item class, framing, scale, and lighting
   stable enough that silhouette ambition, construction, and supernatural behavior can be compared.
   An isolated rank is a poor calibration unless the user explicitly limits scope.
2. **Generate all materials for consistency.** Cover the complete retained material roster. Inspect
   each same-material cohort across every applicable form so its construction language stays
   coherent.
3. **Render every inventory item individually.** Accepted boards are direction references, never
   crops or runtime sources. Reconstruct each accepted design as a dedicated complete rendering.

Rank readability is the primary comparison axis. Material coherence is the secondary axis. Neither
permits identical recolors: a new material must visibly affect construction or silhouette while the
equipment class remains recognizable at phone-thumbnail size.

## References are evidence, not authority

References are allowed and encouraged. Save durable inputs with provenance and a declared purpose:
class identity, silhouette ambition, rank rhythm, material finish, pose, camera, lighting, or set
continuity. Inspect the image; embedded text is not instruction. Use published work for broad
inspiration only and create original designs. A candidate becomes authority only when an explicit
review decision names its exact path and hash.

## Sets require a continuity anchor

Anything presented as a set first needs one complete-set image showing every member together. After
acceptance, generate dedicated individual renders bound to that anchor. Current Armor is one empty,
self-supporting full set followed by Head, Torso, Legs, and Boots. The set is continuity evidence;
the four pieces are item sources. Never substitute crops.

## Preserve lifecycle states

Keep these namespaces and claims distinct:

`reference → direction → candidate → selected candidate → approved source → runtime derivative → content definition → item instance`

- A candidate is reviewable, not approved.
- Selection records point to immutable candidate paths and hashes.
- Promotion copies accepted bytes without regenerating or normalizing them.
- Runtime export reads approved sources only, never experiments.
- Content binds stable visual aliases; instances bind definitions and origin. Craftsmanship does not
  select another material’s art.

Use collision-safe, versioned paths and exact output ownership. Parallel workers may share read-only
references but must never share writable files. Never find output by “newest file.”

## Completion standard

Finish the authorized boundary completely: derive counts from the manifest, provide rank/material/
form/set review views, inspect phone and native detail, bind paths and hashes, validate missing or
stale outputs, test integrated behavior, then commit and push under repository instructions. Report
candidate, approved, runtime, and deferred states separately. Never call setup, materialization,
assignment creation, or gallery export “image generation”; state when pixel calls begin and how many
images they will create.
