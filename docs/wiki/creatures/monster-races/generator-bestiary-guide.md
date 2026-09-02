# Monster Race Bestiary — 30 Races with Visual Progression Tiers

Wiki ID: `monster-seed.generator-guidance`

Design status: **source draft**. This page preserves the supplied bestiary's shared generator
guidance and index. It is production input, not an instruction to agents and not proof that “race,”
five-tier progression, hostility, or any behavioral statement has been accepted as game canon.

A generator-ready reference. Each race has:

- **What they are** — a plain description of the species, written so that someone who has never encountered the creature still knows what to picture.
- **Visual constants** — silhouette, palette, material, ornamentation. These stay *fixed* across all five tiers so every tier reads as the same species.
- **Escalation axis** — the single physical property that grows from Tier 1 to Tier 5. Keep this phrase in the prompt at every tier.
- **Progression tiers** — T1 (fodder) through T5 (ruler), with the visual change spelled out.

## Consolidation target

The source has been audited: all 30 entries contain exactly one T1, T2, T3, T4, and T5 form, for
150 named forms total. Consolidation keeps that coverage but gives every tier a combat purpose as
well as a visual escalation. A form is a named combat class, not the same creature with only a
higher numerical level.

| Tier | Canonical function | Required distinction |
| --- | --- | --- |
| T1 — Initiate | Probe/fodder | introduces one family mechanic with obvious counterplay |
| T2 — Soldier | Reliable pressure | establishes the mature baseline body and repeatable combat grammar |
| T3 — Specialist | Signature pivot | delivers the family's defining specialist role or mechanical twist |
| T4 — Champion | Command/elite pressure | combines mechanics, supports lower tiers, or controls encounter space |
| T5 — Sovereign | Floor boss | caps the family with unique command, production, transformation, or arena behavior |

T3 is the first fully realized expression of the family, not merely a medium-sized specimen. T5 is
an authored boss that tests what T1–T4 taught; added health, scale, ornament, or glow alone cannot
make a valid Sovereign. Existing source names and visuals remain inputs until the consolidation
ledger maps each one to a final family form and combat archetype.

**Prompting note:** hold the silhouette and palette constant, change only the escalation axis and the ornamentation density. That is what makes a T1 and a T5 read as kin rather than two unrelated monsters.

## Index

| # | Race | Theme | Escalation axis |
|---|------|-------|-----------------|
| 1 | Goblins | Scavenger swarm | Scrap becomes treasure; posture straightens |
| 2 | Orcs | Brutal warrior clans | Muscle mass and tusk length |
| 3 | Giants | Living geology | Raw scale; stone spreading over flesh |
| 4 | Trolls | Grotesque regeneration | Wounds that heal wrong and pile up |
| 5 | Dragons | Apex reptilian tyranny | Wingspan and horn crown |
| 6 | Skeletons | Animated bone | Bone density and socket-fire brightness |
| 7 | Rotwalkers | Plague and decay | Decay reversing into cohesion |
| 8 | Wraiths | Incorporeal death | Formless mist to defined regal silhouette |
| 9 | Vampires | Predatory aristocracy | Bestial to aristocratic; rags to couture |
| 10 | Mummies | Entombed royalty | Wrappings become royal gold |
| 11 | Demons | Infernal hierarchy | Horn count; flesh giving way to fire |
| 12 | Celestials | Radiant order | Wing count and halo geometry |
| 13 | Harpies | Savage sky-hunters | Feather quality and talon size |
| 14 | Minotaurs | Bull-headed brutes | Horn spread and weapon mass |
| 15 | Nagas | Serpentine temple-dwellers | Coil length and hood ornamentation |
| 16 | Lizardfolk | Primitive reptilian tribes | Crest, spines, and plating |
| 17 | Insectoids | Hive caste society | Caste specialization and chitin gloss |
| 18 | Arachnids | Web-weaving predators | Eye count, leg span, silk finery |
| 19 | Slimes | Amorphous devourers | Internal structure emerging from formlessness |
| 20 | Golems | Constructed servants | Material quality: clay to gemstone |
| 21 | Elementals | Affinity-bodied magical entities | Form coherence, core complexity, and substance control |
| 22 | Treants | Ambulatory forest | Age, girth, and what grows on them |
| 23 | Fungalfolk | Spore and mycelium | Cap size, bioluminescence, spore density |
| 24 | Deep Ones | Abyssal ocean horror | Humanoid giving way to abyssal; bioluminescence |
| 25 | Werebeasts | Cursed shapeshifters | How far into the beast form the body is locked |
| 26 | Gargoyles | Animate architecture | Stone quality and wing architecture |
| 27 | Djinn | Bound spirits of air and fire | How much of the body is smoke |
| 28 | Fae | Alien beauty of the wild | Wing complexity and strangeness of beauty |
| 29 | Void Horrors | Cosmic wrongness | Subtraction — coherence lost, not gained |
| 30 | Doppelgangers | Stolen identity | Quality of the disguise and what leaks through |

The complete seed entries are preserved in five volumes:

- [Races 1–6](generator-bestiary-01.md)
- [Races 7–12](generator-bestiary-02.md)
- [Races 13–18](generator-bestiary-03.md)
- [Races 19–24](generator-bestiary-04.md)
- [Races 25–30](generator-bestiary-05.md)

## Prompting cheat sheet

- **Keep constant across tiers:** silhouette, palette, material. Change only ornamentation density and the escalation axis.
- **Keep the axis phrase in every prompt.** "Tusks curling past the cheekbones" at T3 and "tusks the length of daggers" at T5 read as the same creature aging. "Bigger orc" does not.
- **Scale is not the only axis.** Several races here deliberately escalate through refinement (Vampires, Golems), condensation (Wraiths), form coherence (Elementals), or subtraction (Void Horrors). Mixing the axis types keeps a 30-race roster from feeling repetitive.
- **T1 should look like it loses.** Give it bad posture, incomplete gear, and visible vulnerability. T5 should be composed, still, and heavily ornamented — the visual difference between a mob and a boss is usually confidence, not size.

## Canon and mechanics boundary

The five tiers are visual escalation proposals. They do not yet define combat level, tower floor,
rarity, star rank, age, species, life stage, office, caste, affinity, or evolution. Several entries
deliberately use different escalation modes, and several change anatomy, scale, equipment, social
office, or material at once despite the shared prompting rule. Each promoted family therefore needs
an explicit interpretation of what its tiers mean.

The source contains no monster statistics, floor assignments, rewards, encounter formulas, or
explicit affinity profiles. Family 21 Elementals are the exception: their five canonical forms each
have a Normal body and one body for every base affinity, while affinity substance changes material
without changing form identity or combat duty. Fire remains explicit in the source concepts for
Demons and Djinn, and air remains explicit for Djinn. Other affinity readings—such as Wind Harpies,
Earth Treants, Water Deep Ones, or Fire Void Horrors—would be new design decisions and must not be
inferred from palette, habitat, material, or name alone.
