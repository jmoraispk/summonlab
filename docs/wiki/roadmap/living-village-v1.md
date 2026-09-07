# Living Village v1 release matrix

Wiki ID: `roadmap.living-village-v1`

Design status: **draft for owner review**

This matrix scopes the first release while the [Living Village milestone](../milestones/living-village.md)
defines its playable loop and acceptance test. Everything marked `off` remains fully documented in
the wiki and may continue through independent design or concept-art work.

## Product core

| Capability | State | Living Village v1 behavior |
| --- | --- | --- |
| Static Village | `on` | Fixed Summoning Gate, Training Court, and Tower Threshold; no construction or upgrades |
| Human summoning | `on` | One versioned Normal channel reveals the fixed six-person roster; no generated or replacement faces |
| Village/Hero inspection | `on` | Six visible heroes, anchored popovers, expandable details, attributes, affinity, skills, loadout, availability, and visual identity on one surface |
| Visible local training | `on` | Player selects one enabled attribute or owned skill, confirms a block, and sees the hero walk to the Court and train |
| One three-hero party | `on` | One prepared party and one active attempt |
| Tower species hunts | `on` | Sequential Floors 1–10 expose known species hunts with a remaining-Health return threshold and material haul |
| Material inventory | `partial` | Engine-v24 persists bounded seeded material lots and exposes their Forging uses; full Gathering acquisition is not implemented |
| Forging and Gathering loop | `partial` | Standard Forging consumes one seeded rank-bearing lot; Gathering remains the enabled source family but has no complete node/harvest economy yet |
| Combat | `on` | Shipped operator-owned `legacy-auto-v1` is the beta default; **Continue battle** advances its automatic seeded policy, while `agent-readiness-v1` remains planned and unavailable |
| Rewards and engagement | `placeholder` | First-clear, training, repeat-hunt, material, and daily-return claims use a small versioned reward table |
| Save/reload/replay | `on` | Canonical state and deterministic receipts survive reload |
| Core visuals | `on` | The fixed six heroes, three runtime monster races, initial skill effects/icons, 140 lazy Equipment card/detail pairs, one Hearth, one tower backdrop |

Combat mode is release configuration, not a player preference. Each prepared attempt stores its
mode/rules/content binding; a later operator-default change cannot switch an active attempt. The
player cannot submit a mode, actor action, target, policy, or choice batch. Per-hero intent calls,
readiness windows, collision arbitration, and purpose-keyed hit/critical resolution belong to the
[agent-readiness combat plan](../../superpowers/plans/2026-09-06-agent-readiness-combat.md), not this
shipped legacy slice.

## Fixed hero roster

Living Village uses only these six hero identities. The summon system acquires a pre-authored
person from this table; it does not create a new face or select from the broader human catalog.

| Slot | Identity | Prototype availability | Visual status |
| --- | --- | --- | --- |
| `lv-hero-01` | Dara Zev | starting summon | approved identity |
| `lv-hero-02` | Mara Vey | starting summon | approved identity |
| `lv-hero-03` | Jori Daro | starting summon | approved identity |
| `lv-hero-04` | Kira Toren | Floor-3 Normal token | candidate identity; finish existing packet only |
| `lv-hero-05` | Iven Orra | Floor-6 Normal token | candidate identity; finish existing packet only |
| `lv-hero-06` | Remy Nahl | Floor-9 Normal token | approval candidate; finish existing packet only |

The starting reveal order may remain seeded, but the first three results are those three fixed
starter IDs and each identity can be acquired only once. Floor tokens reveal their bound identity;
they do not roll a larger pool. Face generation, rerolls, duplicates, replacement identities, and a
seventh roster slot are outside this release.

## Skill availability

The immutable legacy inventory preserves all 520 supplied definitions. The
[skill wiki](../mechanics/skills/README.md) presents the reconciled 492-skill active target.

| Skill area | State | Release behavior |
| --- | --- | --- |
| Selected Martial families | `on` | Use a reviewed allowlist drawn from only a few Martial families; exact selection remains a combat-owner decision |
| Other Martial skills | `off` | Catalog and concept work allowed; runtime acquisition and actions rejected |
| Selected Magical families | `on` | Use a reviewed allowlist drawn from one or two Magical families; exact selection remains a combat-owner decision |
| Other Magical skills | `off` | Catalog and concept work allowed; runtime acquisition and actions rejected |
| Forging | `on` | One of the only two enabled Craft families; produces the scoped prototype Weapons and Armour |
| Alchemy | `off` | No brewing, reagents, potions, poisons, Alchemy UI, or Alchemy reward |
| Cooking | `off` | No food/upkeep loop, meals, buffs, or Cooking assignment |
| Gathering | `partial` | One of the only two enabled Craft families; runtime-v1 proves its material-lot contract with seeded lots while node and harvest actions remain deferred |
| Knowledge | `off` | No appraisal, research, cartography, language, or aptitude-reveal action |
| Skill mastery beyond initial slice | `off` | No higher mastery promotions or practice-profile bonuses |
| Teaching and mentorship | `off` | No teacher assignment or Guidance multiplier |
| Skill merging | `off` | Recipes stay documented; no preview, catalyst, consumption, or result generation |

An `off` family must also be absent from summon packages and reward pools. A disabled skill ID in a
runtime command is a deterministic rejection, not a hidden no-op.

## Other documented systems

| Capability | State | Reason |
| --- | --- | --- |
| Agentic dialogue and petitions | `off` | First release excludes agentic interactions |
| Personality, mood, relationships, and society | `off` | Direct mechanics loop comes first |
| Settlement construction/expansion | `off` | Village stats and layout remain fixed |
| Campaign story and world exploration | `off` | Floors are mechanical encounters only |
| Expedition navigation and discoveries | `off` | Mission selection leads directly to resolution/presentation |
| Multiple parties | `off` | One party proves reservation and return |
| Advanced and Special summon channels | `off` | The fixed six-person Normal sequence is the complete prototype roster |
| Equipment crafting | `on` | A bounded Forging selection proves seeded material lot → Standard Weapon, Armour piece, Shield, or Staff → persisted inventory |
| Enchanting, set bonuses, wear, and repair | `off` | The prototype proves ordinary equipment creation before adding overlays or maintenance |
| Hero affinity awakening, affinity ranks, dual affinity, and derived affinity | `off` | Every 1★ prototype hero remains Unaligned; a base affinity may appear only in an explicitly enabled monster fixture |
| Hero promotion above the first band | `off` | Runtime remains 1★ and levels 1–10 |
| Synthesis | `off` | Irreversible social/economic loop is not needed for v1 |
| Portals, neighbors, airships, and mounts | `off` | Later world/base milestones |
| Permanent death, injury, and recovery | `off` | Return resets Health and Mana in the legacy automatic loop |

## Reward decisions

The complete reward design belongs to [Rewards and Engagement](../mechanics/rewards-and-engagement.md).
For v1, these remain `decision` until owner review and economy simulation:

- exact daily gem grant—the current proposal is “a couple,” represented initially as 2;
- whether v1 omits gems in favor of a directly useful fixed-roster reward;
- missed-day behavior;
- exact first-clear, repeat-hunt, material, training, and milestone reward values.

Advanced and Special summoning are now explicitly `off` for this prototype because they would imply
additional identities or duplicates. A daily currency with no visible use is not sufficient
motivation, so gems should either be clearly marked as future account currency or replaced in this
slice by a directly useful progression, training, or equipment reward.

## Release gates

- The executable allowlist rejects every `off` skill and capability from all entry points.
- Forging and Gathering are the only enabled Craft families; the current proof uses bounded seeded
  lots and does not claim a complete Gathering economy. No recipe or reward silently depends on an
  off Craft family.
- Summoning rejects every hero identity outside the fixed six and cannot grant one identity twice.
- A new player completes summon → inspect/equip in Village → Court training or species hunt →
  visible return → improved retry.
- Every consequential action produces immediate feedback plus an honest durable benefit where one
  is promised.
- Reward sources cannot be claimed twice through retry, clock manipulation, or replay.
- Missing a day never deletes already earned currency or permanently damages the run.
- The complete Floor-1 loop passes before Floors 2–10 multiply content.
