# Skill Taxonomy Consolidation Design

Status: **proposed for implementation planning**

Date: 2026-08-31

## Purpose

Replace the mixed skill hierarchy with one consistent model across Martial, Magical, and Craft:

```text
Domain → Family → Skill [optional labels]
```

Families own skills directly. Labels describe compatibility or affinity without becoming
intermediate progression nodes. The change consolidates Martial content, removes the Universal
Martial bucket, renames Magical Evocation to Elemental, and updates the canonical wiki and its
interactive index to express the new model.

## Current problem

The current framework uses `sector → family → subfamily → skill`, but applies those levels
unevenly:

- Martial families such as Blade and Hunt contain weapon-specific subfamilies.
- Craft families such as Forging and Alchemy are themselves complete ladders.
- Universal Martial sits outside the family structure.
- Evocation is divided by element as though elements were subfamilies, while Ward and Enchantment
  contain both neutral and affinity-dependent skills.
- Paired Blades and Thrown are modeled as independent ladders even though they describe a wielding
  configuration and an action performed with another tool.

The result makes equivalent concepts occupy different levels and encourages new hierarchy whenever
simple compatibility metadata would be enough.

## Goals

1. Make `Domain → Family → Skill` the only canonical ownership hierarchy.
2. Give every skill exactly one owning family.
3. Keep equipment and element information as optional labels on skills.
4. Remove Universal Martial and redistribute or consolidate every retained row.
5. Consolidate Martial into five player-facing families: Blade, Polearm, Ranged, Shield, and Body.
6. Treat Two Blades as a Blade skill, not a family, subfamily, equipment type, or label.
7. Remove Tracking and the generic Thrown ladder.
8. Rename Evocation to Elemental while preserving concrete elemental identity through labels.
9. Preserve an auditable record of every retained, renamed, merged, rehomed, and deleted catalog
   row.
10. Update the interactive wiki without inventing runtime balance values or executable mechanics.

## Non-goals

- No combat runtime implementation, mana costs, cooldowns, damage values, status rules, or balance
  pass.
- No new weapon inventory, animation, affinity, or equipment-slot runtime system.
- No requirement that every family have the same number of skills.
- No requirement that every skill carry a label.
- No new element, weapon type, or Craft family merely to make counts symmetrical.
- No preservation of the old 520-row total when consolidation intentionally merges or deletes rows.
- No attempt to finalize all future Polearm equipment; labels may expand when authored equipment
  actually requires them.

## Canonical model

### Ownership

Every skill has one and only one canonical path:

```text
Domain → Family → Skill
```

Labels never own skills, grant aptitude, create ladders, or appear between Domain and Family. They
are filterable metadata and may also be referenced by a skill's equipment or affinity requirement.

### Optional labels

Two label namespaces are introduced in authored wiki content:

- `Equipment: <value>` narrows a Martial skill to a concrete tool type.
- `Element: <value>` narrows or parameterizes a Magical skill by affinity.

A missing label means the family membership is sufficient. It does not mean that the skill is
universal or belongs to a hidden neutral category.

Examples:

```text
Measured Cut       Blade       [Equipment: Sword]
Quick Stab         Blade       [Equipment: Dagger]
Two Blades         Blade       no equipment label; requires two compatible Blade weapons
Parry              Body        no equipment label; effect declares compatible held tools
Ember              Elemental   [Element: Fire]
Elemental Guard    Ward        [Element: Attuned]
Shield Sigil       Ward        no element label
```

`Element: Attuned` means the skill inherits the user's current affinity. Concrete values are Fire,
Water, Wood, Earth, and Metal. Element-neutral skills omit the label; `Neutral` is not an element.

### Labels versus requirements

A label identifies a stable compatibility category. A requirement describes a transient loadout or
learning condition. Therefore **Two Blades is a skill**, and “equip two compatible Blade weapons” is
its requirement. `[Two Blades]` and `[Dual Wield]` are not equipment labels.

Skills that build on this configuration require mastery of Two Blades. They may work with two
swords, two daggers, or a compatible mixed pair without duplicating the ladder.

## Target Martial taxonomy

### Blade

Blade owns cutting and blade-handling techniques. Initial equipment labels are Sword, Dagger, and
Greatsword. Existing Paired Blades content is consolidated behind the Two Blades skill inside this
family.

The migration removes weapon-specific subfamilies. Existing foundations may remain as labeled
skills when they express real equipment proficiency, but they no longer create a hierarchy level.
Overlapping attacks and passives are merged where their distinction was only the old subfamily.

### Polearm

Polearm replaces Haft. It owns long-shafted melee weapons and communicates its fantasy more clearly
to players. Initial concrete labels are Spear, Glaive, Halberd, and Polehammer.

Existing Spear content maps primarily to Spear. Existing Axe and Hammer rows are reviewed against
their actual technique:

- reach, hooking, reaping, and bladed sweeps may map to Glaive or Halberd;
- crushing, stagger, and armor-breaking techniques may map to Polehammer;
- a row that only makes sense for a short axe or short hammer is rehomed to another valid family or
  deleted rather than mislabeled as a polearm.

The migration does not add Glaive, Halberd, or Polehammer skills solely to fill a label. Labels are
used only where a retained technique supports them.

### Ranged

Ranged owns Bow and Crossbow skills. Bow and Crossbow are equipment labels, not children in the
hierarchy. Hunt is removed as a family name.

Tracking is deleted. Prerequisites and effects that depended on Tracking are either rewritten from
the owning skill's existing purpose or removed. For example, Hunter's Mark remains a Ranged concept
only if it can stand on Ranged practice or Body awareness without reconstructing the Tracking
ladder.

The generic Thrown ladder is deleted. A retained throwing technique belongs to the family of the
tool being thrown: a thrown blade belongs to Blade, a thrown polearm belongs to Polearm, a shield
throw belongs to Shield, and an alchemical flask delivery belongs to Alchemy. Generic throwing does
not remain a family or compatibility label.

### Shield

Shield replaces Guard and owns shield handling, blocking, interception, formation protection, and
ally-covering techniques. Shield is both the family name and the default equipment expectation, so
an Equipment label is omitted unless a future shield subtype needs a meaningful distinction.

Protection content is not copied wholesale. Ally protection and positional control may merge into
existing Shield skills when they add a distinct effect. Redundant taunt, retaliation, line-holding,
or mitigation rows are merged or deleted.

### Body

Body owns unarmed strikes, grappling, movement, endurance, awareness, and general combat technique.
Unarmed is an optional equipment-state label only where the effect truly requires empty hands.
Grappling is folded directly into Body and no longer forms its own ladder.

Universal Martial is dissolved into Body unless a row is more honestly owned by a concrete tool
family. General skills such as Footing, Recovery, Second Wind, Combat Reading, and Parry naturally
belong here. Family ownership does not restrict applicability: a Body-owned Parry may declare that
it functions with compatible Blade, Polearm, or Shield equipment.

Protection content based on bodily resilience may be consolidated into Body. Endure, Set Jaw, and
Undying are candidates; armor-only progression and duplicate mitigation tiers are merged, rehomed,
or deleted rather than recreating Protection under another name.

## Target Magical taxonomy

Magical retains five families:

1. Elemental
2. Ward
3. Enchantment
4. Restoration
5. Mind

Elemental replaces Evocation. Fire, Water, Wood, Earth, and Metal are optional labels, not
subfamilies. Every existing Evocation skill moves directly under Elemental with its concrete Element
label.

Other families use labels only where the element changes compatibility or effect:

- Ward's Elemental Guard and Counter Sigil use `Element: Attuned`.
- Enchantment's Weapon Oil, Armor Imbuing, and Elemental Attunement use `Element: Attuned`.
- neutral Ward, Enchantment, Restoration, and Mind skills omit the label.

Requiring any affinity to learn magic remains a prerequisite, not an Element label. Labels answer
which element powers or parameterizes the skill; requirements answer who can learn or cast it.

## Craft taxonomy

Craft retains Forging, Alchemy, Cooking, Gathering, Beast, and Lore as direct families. Their skills
already fit the target ownership model. Existing pages gain label columns only if a concrete,
reviewed label improves filtering; the Martial and Magical migrations do not force speculative Craft
labels.

## Migration ledger

Before canonical tables are rewritten, the implementation creates a machine-readable or Markdown
ledger containing one record for every current skill row:

- old page and section;
- old display name and stable source identity;
- disposition: retain, rename, merge, rehome, or delete;
- target domain and family;
- optional Equipment or Element label;
- replacement prerequisites when old structural prerequisites disappear;
- destination skill when merged;
- short rationale for deletion or semantic change.

The ledger is the source-integrity boundary for this migration. Validation must prove that every old
row has exactly one disposition and that every retained target row traces back to at least one old
row. Intentional deletion is allowed but never implicit.

Known required dispositions include:

- all Tracking rows: delete unless an individually named effect is explicitly retained elsewhere;
- all Universal Martial rows: rehome or merge;
- all Grappling rows: rehome or merge into Body;
- all Protection rows: merge, rehome to Body or Shield, or explicitly delete;
- all Thrown rows: rehome to the owning tool family, merge, or delete;
- all Paired Blades rows: rehome or merge into Blade behind Two Blades;
- all Evocation rows: rehome to Elemental with a concrete Element label.

## Canonical wiki changes

The skill index becomes the authoritative overview of the new hierarchy and label semantics. The
framework removes Sector/Family/Subfamily terminology and replaces every structural example,
coverage table, aptitude reference, ladder rule, and merge example that depends on the old model.

Catalog pages may group several families in one Markdown file for maintainability, but headings,
links, counts, and prose must never imply an extra ownership level. Page packaging is not taxonomy.

The implementation will:

- remove Universal Martial from navigation and delete its canonical catalog page after its ledger
  dispositions are represented elsewhere;
- reorganize Martial catalog pages around Blade, Polearm, Ranged, Shield, and Body;
- rename the Evocation page and Wiki ID to Elemental, updating all internal references;
- retain grouped Magical discipline and Craft pages where grouping does not imply hierarchy;
- update the Living Village subset and all repository references to old family, subfamily, or skill
  prerequisites;
- replace the fixed 520-row source audit with pre-migration and post-migration counts plus ledger
  reconciliation.

Git history is the recovery path for removed source pages; no source page is deleted until its rows
are represented in the migration ledger.

## Interactive wiki changes

The current “two ways forward” tree is replaced by one path:

```text
Domain → Family → Skill
```

The Universal branch and reserved Universal lanes disappear. Domain selection remains interactive.
Each domain displays its families, representative or complete skill links as appropriate, and
filterable label chips. Equipment and Element chips narrow visible skills but do not create nested
tree nodes.

The interface must communicate:

- a skill's owning family;
- optional Equipment or Element labels;
- Two Blades as a Blade skill rather than a chip;
- Elemental as a family and Fire/Water/Wood/Earth/Metal as labels;
- neutral Magical skills without a fabricated Neutral label.

Existing keyboard behavior, reduced-motion support, responsive containment, canonical Markdown
below the interactive surface, and direct links to family catalog anchors remain required.

## Link and identity policy

Canonical hrefs and Wiki IDs change only when the old identity is false under the new model. All
repository-authored links are updated in the same change. The implementation checks for stale links
to Universal Martial, Evocation, Haft, Fist, Hunt, Guard, Motion, Tracking, Protection, Grappling,
Thrown, and Paired Blades as structural nodes.

Skill display names may remain unchanged when only ownership changes. Merged skills select one
canonical display name and record all absorbed rows in the ledger. New stable skill IDs must not be
derived solely from table position because consolidation changes order.

## Verification strategy

1. Add ledger validation before modifying source tables; make it fail on an unmapped or multiply
   mapped old row.
2. Add taxonomy validation that accepts only Domain → Family → Skill ownership and known label
   namespaces/values.
3. Validate all Markdown links, catalog entries, anchors, Wiki IDs, and asset references.
4. Test that Universal Martial, old structural nodes, and Evocation no longer appear in the index or
   interactive hierarchy.
5. Test that Two Blades is rendered as a Blade skill and never as a label or family.
6. Test concrete and Attuned Element labels as well as neutral Magical skills with no Element label.
7. Test representative tool rehoming for Blade, Polearm, Ranged, Shield, Body, and Alchemy.
8. Preserve keyboard, reduced-motion, and narrow-viewport browser coverage.
9. Run wiki validation, web lint, web typecheck, web unit tests, focused Playwright tests, and the
   production web build.
10. Perform a visual review of all three domains and a text audit of the generated catalog counts.

## Completion criteria

- The canonical framework defines only Domain, Family, Skill, and optional labels.
- Every retained skill has exactly one owning family and an auditable old-row lineage.
- Universal Martial, Tracking, generic Thrown, Grappling, Protection, and Paired Blades no longer
  exist as structural catalog nodes.
- Two Blades exists as a skill inside Blade and works through requirements rather than a label.
- Martial exposes exactly Blade, Polearm, Ranged, Shield, and Body as families.
- Magical exposes exactly Elemental, Ward, Enchantment, Restoration, and Mind as families.
- Every Elemental skill has one concrete Element label; neutral magic has none; affinity-inheriting
  magic uses `Element: Attuned`.
- Craft remains a direct six-family catalog.
- The skill index, framework, catalog pages, interactive tree, navigation, counts, and links agree.
- No old row disappears without a delete or merge disposition in the migration ledger.
- All required validation and browser checks pass.

## Rollback strategy

The migration is implemented in reviewable commits: ledger and validators first, canonical content
second, interactive wiki third. If content reconciliation fails, revert the canonical-content commit
rather than weakening ledger validation. If the interface fails, revert only the interactive commit;
the canonical Markdown remains reviewable independently. Deleted source pages remain recoverable
from Git history and are not removed before their ledger coverage is proven.
