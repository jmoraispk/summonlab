# Monster Family, Floor, and Affinity Image Production Design

Status: **approved for implementation planning**

Date: 2026-09-01

## Purpose

Consolidate the supplied thirty-family bestiary and the existing forty-class visual database into
one coherent monster model, then produce a reviewable five-affinity image set for every canonical
form. The model must support species-targeted Expeditions, one primary family per authored floor,
and five-form family progression without confusing visual tier, combat archetype, numerical level,
affinity, or runtime approval.

## Accepted direction

1. The supplied thirty-entry bestiary is the starting family roster.
2. Every family has exactly five canonical forms: T1 through T5.
3. A form changes combat archetype and visual expression; it is not only a higher level of the same
   combatant.
4. T3 is the family's signature Specialist and T5 is its Sovereign floor boss.
5. Each authored floor has one primary family.
6. Expeditions and Towers are separate combat modes.
7. A Tower Challenge contains five consecutive, unusually difficult floor battles.
8. Tower Exploration practices one floor and may run concurrently for multiple independent parties.
9. Species practice uses an authored unlock sequence in which victories against the current species
   unlock the next species; exact counts belong to later combat tuning.
10. Every canonical form targets Normal, Fire, Earth, Wind, and Water artwork.
11. Wood and Metal receive no new production. Their candidate pixels and active production records
    are deleted outright; Git history is the only recovery path.
12. Images remain candidates until explicit review; this design does not promote runtime assets.

## Verified source coverage

The five generator-bestiary volumes contain exactly thirty numbered family sections. Every section
contains exactly one T1, T2, T3, T4, and T5 row. The audited source therefore supplies 150 named
forms with no missing or duplicate tier position.

The count is complete, but the mechanics are not yet normalized. Source tiers variously represent
age, caste, office, equipment, mutation, material quality, size, magical refinement, or social
authority. Consolidation preserves useful visual ideas while making each tier's combat purpose
explicit.

## Canonical vocabulary

| Term | Meaning |
| --- | --- |
| Family | Shared production and encounter grammar; the conversational word “race” may be used, but personhood or ancestry is never inferred from it |
| Form | One named T1–T5 member of a family with a stable identity and primary combat archetype |
| Archetype | The form's battlefield duty, teaching goal, telegraph, mechanic, and counterplay |
| Level | Numerical combat scaling within content; separate from family and form |
| Affinity variant | Normal, Fire, Earth, Wind, or Water expression applied without replacing family, form, or archetype identity |
| Candidate | Generated image awaiting review; neither approved nor runtime |

The existing creature taxonomy remains authoritative for distinguishing species, sapient peoples,
origins, factions, duties, and variants. Consolidation may rename a production family without
making unsupported biological or moral claims.

## Canonical five-form grammar

| Tier | Title | Encounter function | Visual function |
| --- | --- | --- | --- |
| T1 | Initiate | Probe/fodder that introduces one readable family mechanic | Incomplete, young, crude, unstable, lightly equipped, or newly formed |
| T2 | Soldier | Reliable pressure that repeats the family grammar in ordinary encounters | Mature baseline anatomy, construction, and recognizable equipment |
| T3 | Specialist | Signature pivot that adds the family's defining specialist role or mechanical twist | First fully realized family identity with its decisive specialization visible |
| T4 | Champion | Elite, commander, support, or space-controller that combines established mechanics | Prestigious, adapted, scarred, refined, or ceremonially equipped without losing counterplay |
| T5 | Sovereign | Floor boss that commands, produces, transforms, or weaponizes the lower-tier grammar | Unique apex/ruler silhouette that remains unmistakably the same family |

### T3 Specialist contract

T3 must create a qualitative encounter change. It may become a caster, controller, armored guard,
hunter, aerial threat, support unit, or other family-specific specialization. It must expose one
signature mechanic, one telegraph, and one counterplay lesson that distinguish the family from
neighboring floors. Size, Health, damage, or ornament alone cannot satisfy T3.

### T5 Sovereign contract

T5 is an authored boss rather than an enlarged T4. It must:

- test mechanics introduced by T1–T4;
- add a unique arena, phase, command, production, or transformation behavior;
- interact meaningfully with at least one lower form when encounter composition permits;
- preserve the family's stable anatomy or construction grammar;
- expose specific, learnable counterplay;
- communicate authority through composition, material hierarchy, behavior, and silhouette rather
  than glow or size alone.

## Thirty-family consolidation ledger

The implementation must create one machine-readable ledger row for every supplied form and every
existing class. A source form or class may not disappear implicitly.

Each target family record contains:

```text
familyId
displayName
sourceRaceNumber
classificationNotes
visualConstants
escalationAxis
floorSlot
forms[5]
```

Each form contains:

```text
tier
formId
displayName
primaryArchetype
battlefieldDuty
teachingGoal
signatureMechanic
telegraph
counterplay
visualDelta
lowerFormInteraction
sourceReferences[]
```

Every current one of the forty classes receives exactly one disposition:

- `map`: retained as the canonical form without semantic change;
- `rename-map`: retained under a consolidated form name;
- `secondary-archetype`: useful additional role, excluded from the initial 150 primary forms;
- `fauna`: ordinary expedition creature outside the thirty primary floor families;
- `retire`: removed from current production after its provenance is recorded.

The forty classes are inputs to the 150-form ledger, not forty additional mandatory forms. Existing
candidate art may be reused only when the target form, archetype, identity, and review criteria still
match.

## Floor and combat-mode relationship

### One primary family per floor

Each authored floor teaches and tests one primary family. Its T1–T4 forms create the floor's normal
encounter language, and its T5 Sovereign is the capstone boss. Other entities may appear only when
the later floor specification gives them an explicit supporting role without displacing the primary
family.

Thirty families provide thirty primary-family floor identities. Five floors per Tower Challenge
make six five-floor tower groups mathematically possible if every family appears once. This design
reserves that capacity but does not choose tower order, regions, rewards, balance values, or release
grouping.

### Expeditions

Expeditions provide open-world, voluntarily terminable combat against increasingly difficult
enemies. Players may select an unlocked species for practice. Defeating the configured number of
the current species unlocks the next species in the authored sequence. Expeditions may scale levels
and encounter composition without changing the target's canonical family or form.

### Tower Challenge

A challenge requires parties and five consecutive floor battles. The initial version may require
one party; individual floors may later require multiple parties through versioned content. Tower
combat is substantially harder than expedition combat. Exact party counts, recovery, substitution,
failure, and carryover rules belong to the later combat specification.

### Tower Exploration

Exploration practices a selected tower floor before challenge completion. Multiple independent
parties may explore the same floor simultaneously. Each owns separate combat state, retreat,
receipts, and rewards. Exploration does not satisfy the five-battle challenge sequence.

## Difficulty axes

Difficulty must not collapse into one tier number. Later combat content composes four independent
axes:

1. floor or region rating;
2. form tier and archetype complexity;
3. numerical level and authored statistics;
4. affinity and encounter-composition modifiers.

This separation permits a late-expedition T1 Initiate to have higher statistics than an early-floor
T5 Sovereign while remaining mechanically simpler inside its own family. The image program encodes
family, form, duty, and affinity readability; it does not encode numerical level through arbitrary
size or glow.

## Affinity visual contract

Every affinity preserves the family, form, battlefield duty, load-bearing anatomy, telegraph, and
counterplay anchor. An affinity must alter at least two declared construction dimensions such as
material, silhouette, anatomy, motion, equipment, attack telegraph, environmental wake, or exposed
counterplay. A palette or glow overlay is insufficient.

| Target | Shared construction theme | Required counterplay signal | Reject |
| --- | --- | --- | --- |
| Normal | Species-native materials, restrained neutral effects, no unexplained elemental anatomy | The established form weak point remains unchanged | Elemental glow, elemental material substitution, or magical anatomy added only for spectacle |
| Fire | Heat-blackened surfaces, internal ember seams, controlled combustion, smoke, and heat distortion | Core, vent, or heat sink exposed between combustion cycles | Uniform orange wash or emission that destroys material detail |
| Earth | Compressed mineral mass, sediment layers, load-bearing stone or crystal growth, rooted weight, and localized dust | Fracture seam, binding joint, or load-bearing fault exposed after committed movement | Brown recolor, pasted rocks, generic foliage, or mass that hides the original body plan |
| Wind | Directional fur or cloth, vapor channels, debris flow, aerodynamic displacement, and pressure distortion | Still center or pressure anchor visible between directional attacks | Pale recolor, transparency alone, or effects without readable force direction |
| Water | Pressurized flow, wet reflection, mist, coherent fluid transitions, and a readable structural core | Pressure loss exposes the binding core after a committed attack | Shapeless blue body or generic blue glow with no coherent structure |

Form tier and affinity remain separate axes. T5 Fire is a Fire expression of the same Sovereign, not
a sixth form. Normal remains intentionally unaffiliated and receives the same rendering quality as
elemental variants.

For bodies made primarily from affinity substance, construction must be readable in the body edge,
internal flow, motion, and environmental wake—not only in hue. Fire should visibly combust and shed
embers; Wind should partially dissipate into directional pressure sheets and filaments; Water should
show layered liquid currents, surface tension, refraction, and droplets; Earth should remain a
coherent flowing spell-form surrounded by detached mineral fragments and dust rather than becoming
a solid rock statue. Each coordinate is rendered and retained as its own full-resolution image.

## Image target model

The canonical production matrix is:

```text
30 families × 5 forms × 5 targets = 750 image targets
```

The five targets are Normal, Fire, Earth, Wind, and Water. Dual-affinity images are rare exceptions
and require separate manifests outside this matrix.

One target attempt owns one versioned target JSON, one versioned assignment JSON, one collision-safe
candidate path, and one result receipt. A rejected attempt allocates a new version rather than
overwriting any of those files. Generated images never update a shared catalog directly.

## Production sequence

### Phase 1 — Consolidate identities

Complete the thirty-family ledger, map all forty current classes, assign the five canonical forms,
and validate every T3 and T5 contract. No broad image generation starts while a target identity or
archetype remains ambiguous.

### Phase 2 — Retire Wood and Metal

Remove Wood and Metal candidates, thumbnails, targets, assignments, and result receipts from active
experiments and galleries. Do not create a legacy folder, hash ledger, or retirement catalog. Tests
must resolve the exact repository-owned paths before deletion and must prove afterward that no
active Wood or Metal target, artifact, thumbnail, result, or wiki reference remains. Git history is
the sole recovery mechanism.

### Phase 3 — Earth bridge wave

Map the forty missing Earth coordinates to their consolidated forms. Generate Earth candidates
first for every retained class whose identity remains valid. Renamed targets use new paths; retired
classes receive no replacement merely to preserve the old count. Mapped primary forms may reuse an
accepted bridge candidate inside the 750-target matrix. Retained secondary archetypes and fauna use
bridge-only targets outside that matrix so the canonical count remains 750. This wave may use a
hash-bound, provisional mapped Normal reference before the complete Normal anchor gate; its Earth
output cannot reach approved-review until the canonical Normal anchor passes. The wave validates
the Earth theme before the 750-target program expands.

### Phase 4 — Normal identity anchors

Produce or approve one Normal anchor for every canonical form. Existing Normal candidates may be
reused only after form mapping and review. Each anchor proves family constants, tier distinction,
combat duty, anatomy, safe framing, and counterplay without elemental assistance.

### Phase 5 — Four-affinity expansion

Generate Fire, Earth, Wind, and Water from each approved Normal form anchor. Work proceeds in
family-bound waves so reviewers can judge T1–T5 continuity and affinity consistency together.
Earth candidates accepted during the bridge wave are reused rather than regenerated.

### Phase 6 — Review and promotion handoff

Build per-family contact sheets and a full matrix index. Human review records identity, tier,
archetype, anatomy, affinity, counterplay, composition, and finish findings. Passing images remain
approved review assets until a separate runtime integration request names exact destinations and
catalog changes.

There is no fixed lifetime limit on generated attempts. Each assignment still has a bounded retry
ceiling, and revisions create new versioned attempts so provenance remains auditable.

## Subagent production architecture

The implementation plan should use independent workers with narrow ownership:

1. **Family designers:** one task per family produces its T1–T5 ledger packet and source mapping.
2. **Taxonomy reviewers:** separate workers check that source races, duties, factions, and ordinary
   fauna were not conflated.
3. **Manifest builders:** produce deterministic target and assignment files from accepted family
   packets; they do not generate pixels.
4. **Image producers:** one manifest-bound target per job, collision-safe output, bounded retry, and
   result verification.
5. **Family reviewers:** inspect five-form continuity and twenty-five-image affinity matrices
   without editing producer receipts.
6. **Integration controller:** alone updates aggregate indexes, evidence, and any approved catalog.

Workers run in bounded waves sized to available concurrency. Shared manifests and catalogs are
controller-owned to prevent write collisions. A producer never describes a candidate as approved.

## Review gates

Every retained candidate must pass:

- family/species recognition;
- correct T1–T5 form recognition;
- primary archetype and battlefield-duty readability;
- complete, coherent anatomy and ground contact;
- preserved telegraph and counterplay anchor;
- affinity recognition without full-body color wash;
- within-family continuity across five forms;
- full-frame composition without crop, text, watermark, or extra featured subjects;
- source, reference, prompt, candidate, and result hash verification.

T3 and T5 receive additional blind review. T3 must be recognized as the family Specialist rather
than a generic stronger unit. T5 must read as the family capstone and not as an unrelated species or
an enlarged T4.

## Evidence and validation

The implementation must provide:

- executable validation for thirty families, five unique tiers per family, and 150 canonical forms;
- exact reconciliation for all forty current classes and all 150 supplied source forms;
- exact target counts by family, tier, and affinity;
- zero active Wood/Metal targets, artifacts, thumbnails, results, or wiki references after direct
  deletion;
- manifest, assignment, result, candidate, and reference hash checks;
- per-family contact sheets and review summaries;
- explicit separation of candidate, approved-review, and runtime status;
- clean wiki generation and no broken asset references after legacy retirement.

## Non-goals

- No exact enemy statistics, XP curve, victory count, reward table, or floor ordering in this design.
- No runtime combat implementation or shared engine-contract change.
- No dual-affinity bulk generation.
- No automatic approval based on generation or self-review.
- No inference that every family is a sapient people or universally hostile.
- No requirement to preserve a current class when consolidation proves it redundant or taxonomically
  invalid.
- No requirement to generate all 750 images in one wave.

## Implementation-planning gate

The detailed plan begins only after owner review of this specification. It will decompose roster
consolidation, combat-document alignment, legacy retirement, manifest/schema work, the Earth bridge
wave, full production, review, and evidence into independently testable batches with explicit
subagent ownership and integration checkpoints.
