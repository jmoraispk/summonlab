# Living Village hero visual packet

Wiki ID: `art.living-village-heroes`

Design status: **fixed prototype roster; production packets incomplete**.

The `living-village-v1` fixture uses exactly six persistent adult human identities: Dara Zev, Mara
Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl. This is the complete prototype face pool.
Three are available at the start and one is unlocked by each Normal token from Floors 3, 6, and 9.
No summon path, reward, seed, or visual worker may introduce another hero identity during this
milestone. A mechanical role package never defines a person's face, body, culture, personality,
morality, worth, or visual quality.

## Fixed roster slots

| Slot | Availability | Fixed identity | Current asset status |
| --- | --- | --- | --- |
| `lv-hero-01` | starting pull | Dara Zev | approved identity anchor |
| `lv-hero-02` | starting pull | Mara Vey | approved identity anchor |
| `lv-hero-03` | starting pull | Jori Daro | approved identity anchor |
| `lv-hero-04` | Floor-3 token | Kira Toren | candidate identity anchor |
| `lv-hero-05` | Floor-6 token | Iven Orra | candidate identity anchor |
| `lv-hero-06` | Floor-9 token | Remy Nahl | approval-candidate identity anchor |

Each slot keeps its existing character ID, manifest hash, asset directory, and catalog provenance.
Workers may complete missing derivatives for their assigned identity, but must not redesign,
replace, or add faces; choose a different body, role, or culture; or edit the shared wiki catalog or
runtime summon pool.

## Stable visual direction

- Premium realistic painterly dark-fantasy adults, not dolls, mannequins, fashion anatomy, or
  sexualized collectibles.
- Height, frame, build, mass, body fat, muscle, limb/torso proportions, face, skin, hair, durable
  marks, posture, and handedness are explicit manifest fields.
- Practical clothing may draw from different cultures and eras while remaining physically coherent
  within one outfit. Tattoos and piercings are allowed as separate durable identity features.
- Starting star rank or combat role may affect equipment construction, never beauty, dignity,
  ethnicity, body quality, or apparent moral character.
- Six identities must remain distinguishable without relying only on face, color, or costume.
- Equipment visuals are icons in Living Village v1. The identity anchor uses one declared starting
  clothing/equipment state; changing a loadout does not regenerate the person's body or face.

Use the full [art bible](../../art-bible.md) and
[human art direction](../../character-pack-2-art-direction.md) as the production authority.

## Required packet per hero

| Artifact | Source requirement | Living Village use |
| --- | --- | --- |
| Full-body identity anchor | `1024 × 1536`, neutral three-quarter, full body, common floor plane | summon reveal source and identity review |
| Continuity sheet | `1536 × 1024`, front/profile/back plus three state/action panels | anatomy and cross-view approval |
| Roster crop/export | derived from the approved anchor; runtime dimensions set by the existing export pipeline | Roster/Hero and party selection |
| Compact combat figure | transparent background, common camera/floor/scale across all six | deterministic combat presentation |
| Recognition evidence | full-size, roster-size, true-scale lineup, and combat-size checks | promotion decision |
| Provenance record | prompt, references/roles, manifest hash, dimensions, byte/hash/time, review status | audit and collision-safe handoff |

The compact combat figure's exact pixel dimensions and animation/cutout method must be frozen in the
shared presentation fixture before agents generate it. No worker should guess a private camera or
scale.

## Cohort gate

The six slots are approved as a set only if they show meaningful variation in height, build,
proportion, age within the adult range, phenotype, hair mass, posture, clothing construction, and
non-facial silhouette. Variation must not correlate starting mechanics with cultural, bodily, or
social stereotypes.

Every identity must remain recognizable in summon, Roster/Hero, Village, training, and combat. If
the compact view cannot carry at least four non-facial cues, revise the source identity or the view;
do not claim face recognition below useful resolution.

## Owner roster decision

Owner review on 2026-08-29 first replaced Elian Ro and Lio Dae with Mara Vey and Remy Nahl in the
online presentation, then froze all six displayed identities as the complete Living Village
prototype roster. Broader procedural human generation remains future work and is not a parallel
production lane for this milestone.

## Handoff boundary

A hero visual worker returns candidate bytes and a manifest fragment only. One integration owner
checks IDs and hashes, records human review, exports runtime derivatives, registers assets, and
changes asset approval. Summon eligibility is limited to the fixed table above. A generated image
cannot define a new anatomy fact, role, skill, equipment property, personality, or backstory without
returning that idea as a separate proposal.
