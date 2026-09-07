# Martial Skills — Body

Wiki ID: `skills.martial-body`

Domain: **Martial**
Family: **Body**

Design status: **draft source import**. These definitions preserve the supplied compendium; exact combat values and Living Village availability require validation.

Supersession note: requirements or effects below that mention retired attributes or poise are
preserved migration prose, not active mechanics. [ADR 0072](../../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md)
requires learned mastery/evidence in place of precision or comprehension stats and permits only
explicitly authored Break mechanics.

Body owns unarmed strikes, grappling, movement, endurance, awareness, mounted movement, and bodily
command in combat. `Unarmed` appears only when a technique truly requires empty hands.

| # | Skill | Equipment | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **Footing** | — | F | P | Any weapon foundation | Reduced knockback and stagger while standing ground |
| 2 | **Grip** | — | F | P | Any weapon foundation | Weapon cannot be disarmed by ordinary means |
| 3 | **Basic Block** | — | F | A | Any weapon foundation | Reduces incoming melee damage; costs poise |
| 4 | **Recovery** | — | F | P | Any weapon foundation | Rise faster after being knocked down |
| 5 | **Feint** | — | F | A | 500 attacks | Fake an attack; baits a block or dodge |
| 6 | **Sidestep** | — | E | A | Footing Intermediate | Short lateral evade with brief invulnerability |
| 7 | **Parry** | — | E | A | Basic Block Intermediate, 2,000 blocks | Negates an incoming melee hit within a window; opens the target |
| 8 | **Disarm** | — | E | A | Grip Expert, Dexterity threshold | Chance to strip the target's weapon |
| 9 | **Called Shot** | — | E | A | Dexterity threshold, 2,000 attacks | Target a specific body part; effect varies by limb |
| 10 | **Riposte** | — | D | A | Parry Intermediate | An unblockable counter following a successful parry |
| 11 | **Second Wind** | — | D | A | Vitality threshold, survived 100 near-deaths | Once per fight, recover health and clear one debuff |
| 12 | **Feint Chain** | — | D | P | Feint Master | Feints may be chained; each one raises the next attack's damage |
| 13 | **Combat Reading** | — | C | P | Parry Master, 500 fights | The next attack of any opponent is telegraphed |
| 14 | **Unbroken Guard** | — | C | St | Basic Block Master, Vitality threshold | Blocking costs no poise while held; movement heavily reduced |
| 15 | **Perfect Parry** | — | B | P | Parry Master, Combat Reading Expert | A parry within the tightest window reflects the attack entirely |
| 16 | **Battle Instinct** | — | A | P | Combat Reading Master, 2,000 fights, deed | Cannot be surprised, flanked, or hit by an unseen attack |
| 17 | **Martial Form** | Unarmed | F | P | None | Enables unarmed combat at real damage. **Foundation.** |
| 18 | **Straight Punch** | Unarmed | F | A | Martial Form Novice | Fast, cheap, infinitely repeatable |
| 19 | **Low Kick** | Unarmed | F | A | Martial Form Novice | Slows the target's movement |
| 20 | **Palm Block** | Unarmed | F | A | Martial Form Novice | Deflects an incoming melee attack barehanded |
| 21 | **Breathing Form** | Unarmed | F | P | Martial Form Intermediate | Passive mana regeneration while unarmed |
| 22 | **Elbow and Knee** | Unarmed | E | A | Straight Punch Intermediate | Close-range strike; cannot be blocked at range zero |
| 23 | **Combination** | Unarmed | E | A | Straight Punch Expert, 10,000 punches | A chain of strikes; each landed hit extends the chain |
| 24 | **Iron Body** | Unarmed | E | P | Vitality threshold, 5,000 hits taken | Standing mitigation while unarmed |
| 25 | **Rising Kick** | Unarmed | E | A | Low Kick Expert | Launches the target; opens an air chain |
| 26 | **Flowing Redirect** | Unarmed | D | A | Palm Block Master | Redirects an attack into another enemy |
| 27 | **Focused Strike** | Unarmed | D | A | Combination Master, Spirit threshold | Damage passes through armour and barriers entirely |
| 28 | **Hundred Hands** | Unarmed | D | A | Combination Master, Agility threshold | Rapid multi-hit; count scales with attack speed |
| 29 | **Diamond Body** | Unarmed | C | St | Iron Body Master | Heavy mitigation while held; no weapons may be used |
| 30 | **One Inch** | Unarmed | C | A | Focused Strike Master, 50,000 punches | Full damage delivered from no distance at all |
| 31 | **Storm of Fists** | Unarmed | B | A | Hundred Hands Master, deed | An unbroken barrage; the hero cannot be interrupted or moved |
| 32 | **Empty Force** | Unarmed | B | A | One Inch Master, Affinity Rank IV | The strike lands without contact, at range |
| 33 | **Formless Body** | Unarmed | A | St | Diamond Body Master, composite condition | Attacks pass through the hero without effect for the duration |
| 34 | **The Fist That Ends** | Unarmed | S | A | Empty Force Master, Formless Body Master, composite condition | One strike. Whatever it touches ceases. |
| 35 | **Wrestling** | — | F | P | Might threshold | Enables grabs and holds. **Foundation.** |
| 36 | **Grab** | — | F | A | Wrestling Novice | Holds a target in place; both are immobilised |
| 37 | **Shove** | — | F | A | Wrestling Novice | Pushes a target back; breaks their stance |
| 38 | **Trip** | — | E | A | Wrestling Intermediate | Knocks the target prone |
| 39 | **Joint Lock** | — | E | A | Grab Expert, Dexterity threshold | Prevents the target from using skills while held |
| 40 | **Throw** | — | E | A | Grab Expert, Might threshold | Hurls the target; damages whatever they land on |
| 41 | **Ground Control** | — | D | P | Trip Master | Prone targets cannot rise while the hero is adjacent |
| 42 | **Chokehold** | — | D | A | Joint Lock Master | Escalating damage and silence while maintained |
| 43 | **Suplex** | — | D | A | Throw Master, Might threshold | Heavy damage and area knockdown on impact |
| 44 | **Immovable Grip** | — | C | P | Chokehold Master, 10,000 grabs | Grabbed targets cannot be freed by allies |
| 45 | **Giant Toss** | — | C | A | Suplex Master, Might threshold | Throws targets of any size, including ones much larger |
| 46 | **Bind the Beast** | — | B | A | Immovable Grip Master, Animal Handling Expert | Grapples and holds monsters no human should be able to hold |
| 47 | **Footwork** | — | F | P | None | Improved movement speed and turning. **Foundation.** |
| 48 | **Dash** | — | F | A | Footwork Novice | Short burst of speed in any direction |
| 49 | **Roll** | — | F | A | Footwork Novice | Evade with brief invulnerability |
| 50 | **Climb** | — | F | P | Footwork Intermediate | Scale surfaces that would otherwise stop the hero |
| 51 | **Sure Step** | — | F | P | Footwork Intermediate | Immune to difficult terrain and slipping |
| 52 | **Vault** | — | E | A | Climb Expert | Cross gaps and obstacles without slowing |
| 53 | **Wall Run** | — | E | A | Sure Step Expert, Agility threshold | Traverse vertical surfaces briefly |
| 54 | **Weave** | — | E | P | Roll Expert, 10,000 evades | Evasion increases while moving continuously |
| 55 | **Dive** | — | E | A | Roll Master | Longer evade that ends prone; recovers instantly with Recovery |
| 56 | **Blink Step** | — | D | A | Spirit threshold, Dash Master | Short teleport; ignores intervening space |
| 57 | **Air Walk** | — | D | P | Wall Run Master, Agility threshold | A limited number of steps taken on nothing at all |
| 58 | **Afterimage** | — | D | P | Weave Master | Evaded attacks leave a decoy that briefly draws attention |
| 59 | **Shadowless** | — | C | St | Blink Step Master | Movement leaves no trail, sound, or mark of any kind |
| 60 | **Hundred Steps** | — | C | A | Air Walk Master, 50,000 evades | Cross an enormous distance in an instant, striking everything passed |
| 61 | **Untouchable** | — | B | St | Afterimage Master, Shadowless Expert | The first attack from every source in an engagement misses automatically |
| 62 | **Between Places** | — | B | A | Hundred Steps Master, Affinity Rank IV | Step out of the world briefly; return anywhere in sight |
| 63 | **Never Where Struck** | — | A | P | Untouchable Master, composite condition | Any attack that would land instead lands where the hero just was |
| 64 | **The Road Has No End** | — | S | St | Between Places Master, composite condition | Distance ceases to constrain the hero for the duration |
| 65 | **Set Jaw** | — | E | P | Endure Expert, 5,000 hits taken | Cannot be reduced below a health threshold by a single hit |
| 66 | **Undying** | — | C | P | Set Jaw Master, survived 500 near-deaths | Survives one otherwise fatal blow per engagement |
| 67 | **Riding** | — | E | P | Animal Handling Intermediate | Mount and control a trained beast |
| 68 | **Pack Bond** | — | D | P | Taming Master | Commands several tamed companions to coordinate attacks on the hero's behalf. |
| 69 | **Mounted Combat** | — | D | P | Riding Master, another Martial skill at Expert | Full combat capability while mounted |
| 70 | **Bonded Mount** | — | C | P | Mounted Combat Master, Breeding Expert | The mount levels, gains skills, and cannot be permanently killed |

---
