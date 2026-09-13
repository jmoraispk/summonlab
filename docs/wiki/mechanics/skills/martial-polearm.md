# Martial Skills — Polearm

Wiki ID: `skills.martial-polearm`

Domain: **Martial**
Family: **Polearm**

Design status: **draft source import**. These definitions preserve the supplied compendium; exact combat values and Living Village availability require validation.

Supersession note: requirements or effects below that mention retired attributes or poise are
preserved migration prose, not active mechanics. [ADR 0072](../../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md)
requires learned mastery/evidence in place of precision or comprehension stats and permits only
explicitly authored Break mechanics.

Polearm owns long-shafted melee techniques. Equipment labels narrow compatibility; `—` means any compatible Polearm-family equipment.

| # | Skill | Equipment | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **Polearm Handling** | — | F | P | Hold compatible Polearm equipment | Damage and reach bonus with long-shafted melee weapons. **Foundation.** |
| 2 | **Straight Thrust** | Spear | F | A | Polearm Handling Novice | Long-reach single-target attack |
| 3 | **Butt Strike** | — | F | A | Polearm Handling Novice | Close-range blunt hit; creates space |
| 4 | **Bracing** | Spear | F | P | Polearm Handling Novice | Planted spear deals bonus damage to charging enemies |
| 5 | **Sweep Low** | Spear, Glaive, Halberd | E | A | Straight Thrust Intermediate | Trips light targets in an arc |
| 6 | **Keep Away** | — | E | P | Bracing Expert, 5,000 thrusts | Enemies entering reach are struck automatically |
| 7 | **Piercing Line** | Spear, Halberd | E | A | Strength threshold, Straight Thrust Expert | Skewers everything in a straight line |
| 8 | **Hook and Pull** | Glaive, Halberd | E | A | Polearm Handling Expert | Drags a target out of formation into melee range |
| 9 | **Wall of Points** | Spear | D | St | Keep Away Master, Vitality threshold | Allies behind the hero gain mitigation; the hero cannot advance |
| 10 | **Serpent's Tongue** | Spear | D | A | Piercing Line Master, Dexterity threshold | Three thrusts too fast to distinguish |
| 11 | **Dragon Tail** | Spear, Glaive, Halberd | D | A | Sweep Low Master | A full spinning sweep that knocks down everything nearby |
| 12 | **Unbreakable Line** | Spear | C | St | Wall of Points Master | The hero and adjacent allies cannot be moved or pushed |
| 13 | **Heaven Piercer** | Spear | C | A | Serpent's Tongue Master, Strength threshold | A thrown thrust that impales at extreme distance |
| 14 | **Coiling Dragon** | Spear | B | A | Dragon Tail Master, deed | The spear moves independently, striking every enemy in reach |
| 15 | **Thousand Li Thrust** | Spear | B | A | Heaven Piercer Master, rare catalyst | Reach becomes effectively unlimited for one strike |
| 16 | **The Line That Holds** | Spear | A | St | Unbreakable Line Master, composite condition | Nothing crosses the hero's reach while they stand |
| 17 | **Halberd Handling** | Halberd | F | P | Hold a halberd | Damage bonus with halberds; small armour-shred chance. **Foundation.** |
| 18 | **Chop** | Halberd | F | A | Halberd Handling Novice | Heavy downward strike |
| 19 | **Hook Shield** | Halberd | F | A | Halberd Handling Novice | Pulls a shield aside, exposing the target briefly |
| 20 | **Split Grip** | Halberd | E | P | Halberd Handling Intermediate | Choke the haft for faster, weaker swings on demand |
| 21 | **Rend Armour** | Halberd | E | A | Chop Expert | Stacking armour reduction on the target |
| 22 | **Berserk Swing** | Halberd | D | A | Rend Armour Master | Damage scales with the hero's missing health |
| 23 | **Reaping Arc** | Halberd | D | A | Chop Master, Strength threshold | Wide sweep; each kill refreshes the cooldown |
| 24 | **Bloodletting** | Halberd | D | P | 10,000 halberd hits | Halberd damage causes bleeding without any affinity |
| 25 | **Executioner's Grip** | Halberd | C | P | Berserk Swing Master | Critical hits against wounded targets are lethal far more often |
| 26 | **Storm of Iron** | Halberd | C | A | Reaping Arc Master | A sustained flurry of heavy swings; the hero cannot be interrupted |
| 27 | **Red Harvest** | Halberd | B | St | Bloodletting Master, Executioner's Grip Expert | Every kill restores health and extends the stance |
| 28 | **Ruin** | Halberd | B | A | Storm of Iron Master, deed | Destroys the target's equipment outright on a critical hit |
| 29 | **The Last Harvest** | Halberd | A | A | Red Harvest Master, composite condition | One swing per enemy in range, resolved simultaneously |
| 30 | **Polehammer Handling** | Polehammer | F | P | Strength threshold, hold a polehammer | Damage and poise-damage bonus with polehammers. **Foundation.** |
| 31 | **Crush** | Polehammer | F | A | Polehammer Handling Novice | Slow heavy strike; ignores a portion of armour |
| 32 | **Knee Breaker** | Polehammer | F | A | Polehammer Handling Novice | Slows the target heavily on hit |
| 33 | **Heavy Footing** | Polehammer | E | P | Polehammer Handling Intermediate | Cannot be knocked down while swinging |
| 34 | **Shatter** | Polehammer | E | A | Crush Expert | Removes the target's block or barrier entirely |
| 35 | **Concussive Blow** | Polehammer | E | A | Knee Breaker Expert | Interrupts casting and briefly dazes |
| 36 | **Seismic Step** | Polehammer | D | A | Heavy Footing Master, Strength threshold | Each step sends a shockwave forward |
| 37 | **Anvil Strike** | Polehammer | D | A | Shatter Master | Damage doubles against staggered targets |
| 38 | **Bell Ringer** | Polehammer | D | P | Concussive Blow Master, 10,000 polehammer hits | Every fourth polehammer hit dazes automatically |
| 39 | **Unmaking** | Polehammer | C | A | Anvil Strike Master | Permanently reduces the target's armour for the encounter |
| 40 | **Tremor Field** | Polehammer | C | St | Seismic Step Master | Continuous ground tremor; enemies within it cannot regain poise |
| 41 | **Mountain's Weight** | Polehammer | B | A | Unmaking Master, deed | A single blow carrying the mass of something far larger |
| 42 | **Silence the Bell** | Polehammer | B | P | Bell Ringer Master, rare catalyst | Dazed targets cannot act at all until the daze ends |
| 43 | **Nothing Stands** | Polehammer | A | A | Mountain's Weight Master, composite condition | Every structure, barrier and formation in range collapses |

---
