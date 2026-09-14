# Weapons

Wiki ID: `mechanics.equipment.weapons`

Design status: **runtime-v1 visuals/definitions and initial engine-v26 combat delivery profiles
integrated**.
Equipment uses six canonical weapon classes. Named, monster-derived, or visually unusual weapons
still bind to one of these classes rather than creating another handling family.

Runtime-v1 implements one definition and lazy card/detail visual for every legal rank-bearing
material/class pairing; current Forging produces Standard instances only. Engine-v26 adds stable
load plus the initial Sword, Dagger, Bow, Staff, and Shield family tags and consumes them during
readiness legal-action assembly. Detailed weapon damage, handling tradeoffs, and the remaining
skill-family mappings remain later combat work.

## Canonical classes

| Weapon | Hands | Rank-bearing material | Combat identity |
| --- | --- | --- | --- |
| **Sword** | One or two | Metal | Versatile attack and defence |
| **Dagger** | One | Metal | Speed, precision, and concealment |
| **Spear** | Two | Metal | Reach, bracing, and control |
| **Bow** | Two | Wood | Ranged attacks |
| **Axe** | One or two | Metal | Heavy cuts and cleaving |
| **Mace** | One or two | Metal | Blunt force, stagger, and armour breaking |

The Spear's metal head determines its base rank. Its wood shaft is a required physical component
but does not contribute another rank. The same rule applies to an Axe or Mace haft, a Bow string,
and a Sword or Dagger grip: every weapon has exactly one rank-bearing material.

## Hand rules

- A one-handed Sword, Dagger, Axe, or Mace may leave the off-hand free for a Shield.
- A two-handed weapon occupies both hands. A two-handed Sword is still a Sword; it is not a separate
  Greatsword class.
- A Bow always occupies both hands.
- **Dual Wield** permits any pair of one-handed Swords or Daggers, including a Sword and Dagger. It
  does not apply to Spear, Bow, Axe, Mace, Shield, Staff, or Tool.
- Two-handed and Dual Wield are properties of a loadout. Neither creates another weapon class or
  full skill ladder.

## Greatsword visual family

Greatsword is a two-handed visual family within **Sword**, not a seventh mechanical Weapon class.
It uses a clearly two-hand grip, longer guard, broader blade, and heavier construction than the
standard hand-and-a-half Sword presentation while remaining a plausible wielded weapon rather than
an oversized slab. A Greatsword occupies the main hand and off-hand together and belongs to the
Heavy weight class.

The visual family follows the complete metal ladder from Bronze F through Sunsteel S. Rank remains
material-led and craftsmanship does not select separate art. All seven exact source images were
owner-approved on 2026-09-07 and live in the source-only
`assets/equipment/approved/two-handed-greatsword-v1/` catalog. Content definitions, runtime visuals,
acquisition, balance, and skill compatibility remain deferred; approval of source art does not
silently add another playable definition family.

## Skill boundary

An active skill is legal only when its delivery tags intersect both the equipped item's family tags
and the hero's trained tags for that skill. Training is family-based, not bound to one exact item
instance.

Current combat profiles publish:

| Equipment | Delivery family |
| --- | --- |
| Sword and Dagger | `one-handed-blade` |
| Bow | `bow` |
| Staff | `staff-focus` |
| Shield | `shield` |
| Spear, Axe, and Mace | no active delivery tag yet |

The contract also reserves `unarmed` and `two-handed-blade`, but no production equipment profile
should be inferred from a reserved tag. Basic Sword Strike and Basic Bow Shot are the first
hash-bound active skills using this boundary. The production catalog does not yet ship a magical
active skill.

Each weapon still needs only enough signature techniques to express its identity. General blocking,
parrying, movement, recovery, and power attacks can belong to shared Martial skills rather than an
independent catalog at every rank.

The larger shared skill taxonomy still contains imported ladders. Its owner must reconcile those
definitions with this six-weapon decision through a new versioned catalog; reserved delivery tags do
not silently make imported entries executable.

## Retired classes

Greatsword, paired blades, Glaive, Halberd, Polehammer, Crossbow, Sling, and dedicated unarmed
equipment are not canonical weapon classes. A large or unusually shaped named weapon must still
declare one of Sword, Dagger, Spear, Bow, Axe, or Mace as its mechanical class.

## Rank

The weapon design and selected material set the combined crafting difficulty. The material supplies
base rank, and Forging craftsmanship adds `+0`, `+1`, or `+2`, capped at S, as defined in
[Equipment rarity and craftsmanship](rarity-and-weight.md).

## Visual production rules

Material tiers within one Weapon class are comparison variants, not independent compositions.
Every tier therefore keeps the same camera, pivot, normalized size, and class-specific pose. An
item stands clear of the ground plane; it is never presented lying on the floor.

- Sword, Dagger, Spear, Axe, and Mace use a controlled upright pose with a slight right diagonal.
- Bow tiers preserve the same placement, cant, draw profile, and normalized height.
- Mace hafts remain shorter than a Sword but long enough to read as practical weapons rather than
  clubs.
- The primary material ladder uses a standard single-bit Axe. Double-bit war axes may be authored
  later as variants within the same Axe class; they are not a rank stage or another skill family.

These are visual-comparison rules. Weapons remain independent and do not need to match an Armour
set unless a later named set explicitly binds them.

## Open implementation questions

- Define the compact signature-technique set for each weapon with the Martial skill owner.
- Define detailed weapon magnitude, item difficulty, hand tradeoffs, and benefits of one-handed,
  two-handed, Shield, and Dual Wield loadouts.
- Bind Axe and Mace labels and retire obsolete labels only through the shared skill-taxonomy
  integration.
