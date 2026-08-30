# Monster database

Wiki ID: `creatures.monster-database`

This is the visual identity index for the **40 currently authored monster archetypes**. Every card
opens a dedicated monster page. Each page leads with the unaffiliated class reference and keeps
Wood, Fire, Metal, Water, and Wind directly beneath it as variants of the same identity.

The online images are web derivatives of hash-bound production candidates. Candidate and revision
labels remain visible; appearing in this database does not silently approve an image for runtime.

## Arcane hostiles

- [Hex Adept](hex-adept.md) — Debuff skirmisher
- [Tower Archmage](tower-archmage.md) — Multi-phase commander
- [Tower Summoner](tower-summoner.md) — Reinforcement controller
- [Ward Mage](ward-mage.md) — Barrier support

## Bound undead

- [Bone Mage](bone-mage.md) — Ranged artillery
- [Death Knight](death-knight.md) — Formation commander
- [Grave Sentinel](grave-sentinel.md) — Attrition defender
- [Tower Wraith](tower-wraith.md) — Phasing pursuer

## Construct escalation

- [Clay Golem](clay-golem.md) — Slow attrition wall
- [Crystal Guardian](crystal-guardian.md) — Reflective magic boss
- [Iron Sentinel](iron-sentinel.md) — Disciplined counter-attacker
- [Stone Golem](stone-golem.md) — Armor and pattern check

## Draconic escalation

- [Armored Elder Drake](armored-elder-drake.md) — Breath-line tank
- [Cave Drake](cave-drake.md) — Ambush brawler
- [Giant Tower Dragon](giant-tower-dragon.md) — Arena-scale apex boss
- [Venom Wyvern](venom-wyvern.md) — Aerial poison striker

## Dungeon predators

- [Burrowing Worm](burrowing-worm.md) — Ground-eruption disruptor
- [Hungry Mimic](hungry-mimic.md) — Object ambusher
- [Slime Colony](slime-colony.md) — Splitting floor hazard
- [Tower Basilisk](tower-basilisk.md) — Gaze-lane controller

## Elemental manifestations

- [Ember Wisp](ember-wisp.md) — Ignition harrier
- [Frost Colossus](frost-colossus.md) — Zone-denial boss
- [Stone Breaker](stone-breaker.md) — Siege bruiser
- [Storm Stalker](storm-stalker.md) — Lane assassin

## Goblinoid warband

- [Goblin Archer](goblin-archer.md) — Ranged lane control
- [Goblin Chieftain](goblin-chieftain.md) — Formation leader
- [Goblin Hexweaver](goblin-hexweaver.md) — Telegraphed magical control
- [Goblin Skirmisher](goblin-skirmisher.md) — Mobile melee pressure

## Large threats

- [Cave Troll](cave-troll.md) — Regenerating reach threat
- [Frost Giant](frost-giant.md) — Environmental threshold boss
- [Hill Giant](hill-giant.md) — Arena-scale displacement
- [Ogoblin Brute](ogoblin-brute.md) — Boss-scale bruiser

## Tower arachnids

- [Armored Brood Guard](armored-brood-guard.md) — Chokepoint tank
- [Giant Broodmother](giant-broodmother.md) — Spawner boss
- [Tunnel Spider](tunnel-spider.md) — Low flanker
- [Web Caster](web-caster.md) — Ranged restraint

## Tower beasts

- [Cave Bear](cave-bear.md) — Close-range damage test
- [Dire Wolf](dire-wolf.md) — Relentless pursuit
- [Grey Wolf](grey-wolf.md) — Fast flanking predator
- [Tunnel Boar](tunnel-boar.md) — Armored line breaker

## Production synchronization

Visual workers own only their manifest-bound target, candidate, and result paths. The coordinator
refreshes this database with `pnpm export:wiki-monsters` after branches are consolidated. This
keeps individual image production collision-safe while making the wiki the shared review surface.
