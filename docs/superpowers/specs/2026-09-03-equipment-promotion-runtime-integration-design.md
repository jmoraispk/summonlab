# Equipment Promotion and Runtime Integration Design

Status: **owner-approved direction; awaiting written-spec review**

Date: 2026-09-03

## Purpose

Promote the 161 owner-accepted Equipment v3 candidates into an immutable approved-source library,
export phone-sized runtime derivatives for the 140 equippable items, and connect those items to one
simple content model shared by Forging, inventory, equipment, and uncommon drops.

The primary acquisition path is:

```text
Gathering → rank-bearing material → Forging → equipment item
```

A drop may create the same item occasionally. It does not create a parallel item catalog or require
different artwork.

## Confirmed product decisions

- Forging and Gathering are the enabled Craft families for the first equipment slice.
- Equipment uses six Weapon classes: Sword, Dagger, Spear, Bow, Axe, and Mace.
- Shield and Staff are separate equipment classes.
- Heavy Armour, Light Armour, and Robes each have Head, Torso, Legs, and Boots items.
- Every item has one rank-bearing material.
- Material supplies base rank. Craftsmanship may add `+0`, `+1`, or `+2`, capped at S.
- Ranking is mechanically important, but an item's approved illustration remains tied to its
  material and form. Better craftsmanship does not substitute another material's image.
- All 161 final v3 candidates are owner-accepted.
- Candidate, approved-source, and runtime states remain separate and independently auditable.
- Exact craftsmanship thresholds, benefits, and optional quality-specific visual treatment remain
  deferred. The first runtime integration must not generate additional craftsmanship variants.

## Counts and roles

| Role | Count | Approved source | Runtime item visual | Item definition |
| --- | ---: | --- | --- | --- |
| Weapon, Shield, and Staff items | 56 | yes | yes | yes |
| Armour pieces | 84 | yes | yes | yes |
| Complete Armour-set references | 21 | yes | no | no |
| **Total** | **161** | **161** | **140** | **140** |

The complete-set sources are approved because they are the authoritative visual continuity record
for their four pieces. They are not fifth Armour items and do not enter inventory.

## Design principles

1. **Promote exact bytes.** Approval copies selected candidate bytes; it never regenerates art.
2. **One definition, two acquisition routes.** Forge and drop provenance differ, but the item does
   not.
3. **Generate catalogs from rules.** Do not hand-author 140 near-identical definitions or recipes.
4. **Keep art and mechanics orthogonal.** Material and form select artwork; craftsmanship and final
   rank select mechanical benefits and UI treatment.
5. **Load only what the screen needs.** The phone client never downloads the entire Equipment
   library at startup.
6. **Preserve engine history.** Existing state versions, events, replays, and the two legacy item
   templates remain valid.

## 1. Approved-source promotion

### Layout

```text
assets/equipment/approved/material-equipment-v1/
  manifest.json
  items/<rank>/<material>/<artifact>.png
  armour-set-references/<rank>/<material>/<armour-class>.png
  receipts/promotion-v1.json
```

The promotion input is the checked-in proposal at
`assets/equipment/experiments/material-equipment-v3/reviews/proposed-promotions/candidate-promotion-v1.json`.
The promotion tool resolves each of its 161 selected paths and verifies:

- proposal, manifest, and checkpoint hashes;
- 161 unique target IDs and approved output paths;
- 140 equippable roles and 21 Armour-set-reference roles;
- exact candidate hash, PNG decoding, and required dimensions;
- no destination collision, symlink escape, or path outside `assets/equipment/approved`.

Every approved record contains:

- stable approved asset key;
- role: `item` or `armour-set-reference`;
- rank, material, equipment class, and optional Armour slot;
- v3 target ID;
- selected candidate path and SHA-256;
- checkpoint receipt path and canonical SHA-256;
- approved path, dimensions, byte count, and SHA-256.

The approved copy must have the same SHA-256 as its candidate. The receipt binds the complete
approved manifest, source proposal, promotion tool version, operator, timestamp, and basis commit.
Check mode reconstructs all expected metadata and rejects drift or extra files.

The experiment tree remains immutable evidence. Approval does not delete, rename, or rewrite it.

## 2. Runtime visual export

Equipment receives a dedicated catalog rather than being added to the character visual catalog:

```text
apps/web/static/runtime/equipment-v1/
  manifest.json
  <approved-asset-key>/card.<hash>.webp
  <approved-asset-key>/detail.<hash>.webp
```

Only the 140 approved `item` records are exported.

| Usage | Maximum dimensions | Purpose |
| --- | --- | --- |
| `card` | 256×256 | inventory, rewards, forge lists, and loadout slots |
| `detail` | 512×512 | item inspection and forge confirmation |

Both profiles use deterministic, metadata-stripped WebP encoding with source hashes, encoder
versions, output hashes, dimensions, byte counts, and per-file budgets recorded in the manifest.
The manifest itself may load with the play surface; image files load on demand by public path. No
Equipment image joins the initial player payload merely because it is approved.

The exporter has separate `write` and zero-write `check` modes. Check mode re-encodes every output,
compares exact bytes, rejects stale manifests and unexpected files, and confirms that every runtime
record points to an approved source rather than an experiment candidate.

Complete-set references are excluded from this runtime catalog. A later forge collection screen may
receive a separate preview profile if product testing proves it useful.

## 3. Equipment content catalog

The engine-independent catalog lives in `packages/content` behind strict contracts in
`packages/contracts`. It is deterministically expanded from:

- 28 canonical materials and their base ranks;
- the allowed material-to-form mapping;
- six Weapon classes, Shield, Staff, and twelve Armour slot forms;
- the 140 approved visual asset keys.

Each definition contains only stable authored facts:

```text
definitionId
displayName
materialId
materialRank
equipmentClass
slot
handedness
weightClass
approvedVisualAssetKey
runtimeCardAlias
runtimeDetailAlias
forgeable
```

Definition IDs are deterministic and readable, for example:

```text
equipment-bronze-sword
equipment-worldtree-limb-staff
equipment-iron-heavy-armour-head
equipment-fateweave-robes-boots
```

The catalog validator requires exactly 140 definitions, one approved item visual per definition,
no Armour-set reference masquerading as an item, and no illegal material/form combination.

### Recipe derivation

Forging recipes are derived from an equipment definition rather than stored as 140 independent
documents:

```text
recipe = equipment definition + one normalized lot of its rank-bearing material
```

A normalized material lot represents the amount prepared for one equipment item. This keeps the
first slice independent of kilograms, subcomponents, and balance-specific quantities. Later balance
work may replace the uniform lot cost with a compact cost table without changing definition IDs or
visual assets.

Item and material difficulty remain distinct inputs to Forging resolution. The exact margin needed
for Fine or Masterwork is deferred. Until that table is owner-approved, the production command may
create Standard (`+0`) items only; schemas may already represent the three accepted craftsmanship
labels so adding the resolver does not require another content migration.

## 4. Item instances and equipment slots

The current engine item has only `practice-blade` and `short-bow` templates and heroes have only a
`mainHand` slot. Integration therefore requires a new versioned engine state rather than mutating an
old schema.

A new item instance references content instead of duplicating authored definition fields:

```text
itemId
definitionId
ownerId
equippedById
craftsmanship: standard | fine | masterwork
craftsmanshipBonus: 0 | 1 | 2
finalRank
durability
maxDurability
origin
```

`origin` is one of:

```text
forged: forge event and crafter IDs
dropped: mission/reward and source IDs
legacy: migration identity for existing bootstrap items
```

The item factory computes and validates:

```text
finalRank = min(S, materialRank + craftsmanshipBonus)
```

The new loadout supports:

```text
mainHand, offHand, head, torso, legs, boots
```

Handedness and class determine main/off-hand legality. Armour slot legality comes directly from the
definition. A later Accessory slot is outside this slice.

Old state schemas and events remain frozen. The next engine version adds the new item and loadout
shape, a deterministic legacy adapter for `practice-blade` and `short-bow`, compatibility fixtures,
and replay vectors before changing bootstrap behavior.

## 5. Forging flow

Forging is implemented as a settlement/workshop activity, not through the existing top-level
`/forge` web route, which is the character portrait Forge.

The minimum legal flow is:

```text
select gathered material lot
→ list compatible equipment definitions
→ select one definition
→ validate workshop, Forging access, material ownership, and difficulty
→ reserve the material and start the activity
→ resolve completion deterministically
→ create one Standard item instance
→ place it in company inventory
```

The command is idempotent through the existing command/event discipline. Material is reserved or
consumed exactly once. The resulting item ID is deterministic from the authoritative event identity,
and replay reconstructs the same item without reading mutable runtime files.

The first UI belongs inside the existing play/workshop surface. It shows the approved runtime image,
material, form, base rank, current producible rank, and required material lot. It does not implement
quality rolls, enchantment, repair, set bonuses, or hero-body compositing.

Armour is forged one piece at a time. A future “forge complete set” control may submit four ordinary
piece recipes as a convenience; it must not create a fifth inventory object.

## 6. Drop flow

A standard equipment drop references one of the same 140 definition IDs and calls the same item
factory. It changes only `origin` and initial condition.

The integration provides the content and event seam, plus one deterministic fixture proving the
path. It does not set a global drop chance or broad loot table. Those values belong to later reward
and encounter balancing; the intended product behavior remains that standard equipment drops are
possible but uncommon.

Monster-specific equipment later follows one of two paths:

- reuse a standard definition when the dropped object is ordinary Equipment; or
- add a new definition and approved visual source when its monster material or unique form matters.

It never changes the six Weapon classes or creates a parallel inventory type.

## 7. Presentation semantics

Material and form select the illustration. Final rank and craftsmanship are presentation overlays:

```text
Bronze Sword illustration + Fine label + D-rank frame
```

The first slice needs only text and the existing rank visual language. Exact quality frames,
particles, lighting, glints, or separate Standard/Fine/Masterwork treatments are deferred. This is
the durable extension point for the later quality discussion and does not multiply Equipment art.

## 8. Implementation batches and ownership

### Batch A — Approved sources

- Add Equipment approval contracts and deterministic promotion/check tools.
- Copy all 161 selected sources into the approved namespace.
- Record the promotion receipt and approval manifest.
- Validate exact bytes, roles, counts, paths, and provenance.

This batch is Equipment-owned and does not change runtime or engine contracts.

### Batch B — Runtime derivatives

- Add the Equipment-specific WebP exporter and runtime manifest.
- Export 280 derivatives from 140 approved item sources.
- Add payload, stale-output, source-status, and public-path tests.
- Produce a phone-sized review page for card/detail inspection.

This touches the web static runtime boundary and should be reviewed with the web/runtime owner.

### Batch C — Content definitions

- Add strict material, class, slot, handedness, definition, and catalog contracts.
- Generate and validate the 140-definition content catalog.
- Bind each definition to approved and runtime visual keys.
- Keep stats, detailed benefits, and quality thresholds out.

This touches shared contracts and `packages/content`; review with their owners before merge.

### Batch D — Versioned inventory and loadout

- Add the next engine state version and compatibility adapter.
- Expand item instances and loadout slots.
- Add item-factory, equip-legality, replay, and migration evidence.
- Preserve all historical engine schemas and hashes.

This is engine-owned integration and requires an explicit engine-owner checkpoint.

### Batch E — Forge vertical slice

- Activate the workshop path needed for Forging.
- Add material-lot inventory, recipe derivation, commands, events, scheduling, and reduction.
- Add the play/workshop forge UI and one end-to-end Standard-item flow.
- Make all 140 definitions available subject to material ownership and difficulty.

### Batch F — Uncommon-drop seam

- Add one deterministic reward fixture using an existing definition.
- Prove that forged and dropped instances share definition, visuals, equip legality, and persistence.
- Leave actual probabilities and broad loot tables deferred.

Each batch is independently validated, committed, pushed, and reviewable. No later batch is folded
into an earlier approval.

## Error handling and invariants

The implementation rejects:

- stale or non-accepted candidate selection;
- approved-byte mismatch or runtime export from an experiment path;
- missing, duplicate, or unbound visual keys;
- illegal material/form combinations;
- final rank inconsistent with material rank and craftsmanship bonus;
- equipping an item into the wrong slot or violating handedness;
- forging without the required material lot, workshop access, or Forging permission;
- duplicate material consumption or item creation during command retry/replay;
- drops referencing unknown definitions;
- startup payload changes that eagerly include Equipment binaries.

Failures are explicit and atomic. A failed forge attempt neither consumes material nor creates an
item unless an authoritative event has already recorded the corresponding transition.

## Validation

### Asset and catalog validation

- 161 approved sources: 140 items and 21 set references;
- exact approved/source hash equality;
- 280 deterministic runtime derivatives;
- approved-only runtime inputs and content-hashed paths;
- exact 140-definition coverage and legal material/form mapping;
- phone card/detail decode, dimensions, and byte budgets;
- no unexpected approved or runtime files.

### Engine validation

- historical state and replay compatibility;
- deterministic migration of both legacy templates;
- final-rank property tests across F–S and bonuses 0–2;
- every slot and handedness legality combination;
- command idempotency and replay-stable item IDs;
- atomic material reservation/consumption;
- forged/drop origin preservation;
- database and API serialization of the new state version.

### Product validation

On a phone-sized viewport:

1. gather or receive one material lot;
2. open the workshop and select a compatible item;
3. forge it, inspect it, and equip it;
4. observe its material art, final-rank treatment, and provenance;
5. acquire the deterministic drop fixture and confirm it behaves like the forged item.

The test decides whether card/detail resolution is sufficient, whether definition names are clear,
and whether one-piece Armour forging is understandable. It does not decide quality-specific visual
treatment.

## Non-goals

- No new image generation or craftsmanship art variants.
- No automatic promotion from future candidate runs.
- No full Armour set as an inventory item.
- No Tool, Accessory, Potion, Food, enchantment, repair, wear-balance, or set-bonus system.
- No global equipment drop rates or complete reward tables.
- No monster-derived material catalog in this implementation.
- No hero-body equipment compositing or rig changes.
- No mutation of historical engine schemas, events, candidate evidence, or v3 manifests.

## Rollout and rollback

Approved sources, runtime derivatives, content definitions, and engine activation use separate
versioned manifests. Before the engine batch, the new assets and definitions are inert. After engine
activation, a feature gate controls the workshop Forging flow and standard-equipment drop seam.

Rollback disables that feature gate and restores the previous content binding. Content-hashed
runtime files and immutable approved sources may remain checked in because they have no behavior by
themselves. Historical events continue to resolve against their bound content and engine versions.
