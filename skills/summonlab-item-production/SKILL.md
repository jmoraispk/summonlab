---
name: summonlab-item-production
description: Use when adding or expanding a Summonlab item, equipment class, material family, rank ladder, armour set, weapon, consumable, loot item, or item visual in the repository.
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
acceptance, generate dedicated individual renders bound to that anchor. Current Armour is one empty,
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
