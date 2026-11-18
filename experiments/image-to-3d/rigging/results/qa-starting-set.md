# QA: starting-set

80 of 91 subjects pass every gate. Gates: generated, riggable,
bones inside mesh, hit regions (bipeds: ≥17/19 filled, lowest purity ≥60%), worst-1% stretch ≤200%, ragdoll settles
floating pieces ≥4% of height away reviewed (removed as artifacts or kept as costume parts),
(<1 m/s at 2.5 s, no separation), budget (creatures ≤15k tris and 2 MB; props ≤3k tris and 300 KB).

| Subject | Kind | Body | Result | Worst clip | Notes |
| --- | --- | --- | --- | --- | --- |
| Goblin Runt | monster | biped | FLAG: hits | hit 112% | hit regions 19/19, lowest shoulder 43% |
| Orc Grunt | monster | biped | pass | hit 132% |  |
| Skeleton Rattler | monster | biped | pass | hit 157% | 9 bones read as outside: thin geometry, check visually |
| Rotwalker Shambler | monster | biped | pass | hit 127% |  |
| Mummy Husk | monster | biped | pass | hit 125% | islands reviewed: kept |
| Lizardfolk Scout | monster | biped | pass | hit 102% |  |
| Minotaur Bull-Kin | monster | biped | pass | hit 131% |  |
| Troll Scrag | monster | biped | pass | hit 127% |  |
| Fungalfolk Sporeling | monster | biped | FLAG: hits | hit 118% | hit regions 18/19, lowest upper_arm 6% |
| Deep One Fishman | monster | biped | pass | hit 144% |  |
| Demon Imp | monster | biped | FLAG: bones | attack 109% | bones outside mesh: mixamorigLeftLeg |
| Gargoyle Grotesque | monster | biped | pass | hit 128% |  |
| Werebeast Afflicted | monster | biped | pass | hit 88% | islands reviewed: kept |
| Giant Brute | monster | biped | pass | hit 150% |  |
| Harpy Screecher | monster | biped | pass | hit 157% |  |
| Bristle Hog | monster | quadruped | FLAG: bones | walk 68% | bones outside mesh: tripoHead_3, tripoTail_0 |
| Scrub Bear | monster | quadruped | FLAG: bones | walk 136% | bones outside mesh: tripoHead_0, tripoHead_1; islands reviewed: removed |
| Wildcat | monster | quadruped | pass | walk 93% |  |
| Mire Caiman | monster | quadruped | pass | walk 49% |  |
| Dragon Whelp | monster | quadruped | FLAG: bones | walk 147% | bones outside mesh: tripo1_Left_Limb_4, tripo1_Left_Limb_5 |
| Night Owl | monster | avian | pass |  | no clips (none available for this body plan) |
| Adder | monster | serpentine | pass | preset:serpentine:march 9% |  |
| Soil Grub | monster | serpentine | pass | march 16% | islands reviewed: kept |
| Insectoid Worker | monster | hexapod | FLAG: bones, ragdoll | walk 118% | bones outside mesh: tripo0_Left_Limb_4; ragdoll end speed 4.35 m/s; islands reviewed: kept |
| Arachnid Crawler | monster | octopod | FLAG: bones, deformation, ragdoll | walk 590% | bones outside mesh: tripo3_Left_Limb_1, tripo1_Left_Limb_1, tripo0_Right_Limb_1, tripoSpine_1; worst-1% stretch 590% (walk); ragdoll end speed 1.25 m/s; islands reviewed: kept |
| Slime Blob | monster | others | FLAG: bones |  | bones outside mesh: tripoHead_3; no clips (none available for this body plan) |
| Elemental Wisp | monster | others | pass |  | no clips (none available for this body plan) |
| Rao Falin | hero | biped | pass | hit 150% |  |
| Oran Keshi | hero | biped | FLAG: hits | hit 101% | hit regions 19/19, lowest throat 57% |
| Talar Morai | hero | biped | pass | hit 100% |  |
| Senia Lorel | hero | biped | pass | hit 167% |  |
| Iana Joro | hero | biped | pass | hit 119% |  |
| Lania Eshan | hero | biped | FLAG: ragdoll | hit 173% | ragdoll end speed 1.78 m/s |
| Aear Soro | hero | biped | pass | hit 142% |  |
| F ash bow | equipment | prop | pass |  |  |
| F ash staff | equipment | prop | pass |  |  |
| F bronze axe | equipment | prop | pass |  |  |
| F bronze dagger | equipment | prop | pass |  |  |
| F bronze heavy armor boots | equipment | prop | pass |  |  |
| F bronze heavy armor head | equipment | prop | pass |  |  |
| F bronze heavy armor legs | equipment | prop | pass |  |  |
| F bronze heavy armor torso | equipment | prop | pass |  |  |
| F bronze mace | equipment | prop | pass |  |  |
| F bronze shield | equipment | prop | pass |  |  |
| F bronze spear | equipment | prop | pass |  |  |
| F bronze sword | equipment | prop | pass |  |  |
| F coarse hide light armor boots | equipment | prop | pass |  |  |
| F coarse hide light armor head | equipment | prop | pass |  |  |
| F coarse hide light armor legs | equipment | prop | pass |  |  |
| F coarse hide light armor torso | equipment | prop | pass |  |  |
| F hemp weave robes boots | equipment | prop | pass |  |  |
| F hemp weave robes head | equipment | prop | pass |  |  |
| F hemp weave robes legs | equipment | prop | pass |  |  |
| F hemp weave robes torso | equipment | prop | pass |  |  |
| E hard leather light armor boots | equipment | prop | pass |  |  |
| E hard leather light armor head | equipment | prop | pass |  |  |
| E hard leather light armor legs | equipment | prop | pass |  |  |
| E hard leather light armor torso | equipment | prop | pass |  |  |
| E iron axe | equipment | prop | pass |  |  |
| E iron dagger | equipment | prop | pass |  |  |
| E iron heavy armor boots | equipment | prop | pass |  |  |
| E iron heavy armor legs | equipment | prop | pass |  |  |
| E iron heavy armor torso | equipment | prop | pass |  |  |
| E iron mace | equipment | prop | pass |  |  |
| E iron spear | equipment | prop | pass |  |  |
| E wool robes boots | equipment | prop | pass |  |  |
| E wool robes head | equipment | prop | pass |  |  |
| E wool robes legs | equipment | prop | pass |  |  |
| E wool robes torso | equipment | prop | pass |  |  |
| E yew bow | equipment | prop | pass |  |  |
| E yew staff | equipment | prop | pass |  |  |
| D beast scale light armor boots | equipment | prop | pass |  |  |
| D beast scale light armor head | equipment | prop | pass |  |  |
| D beast scale light armor legs | equipment | prop | pass |  |  |
| D beast scale light armor torso | equipment | prop | pass |  |  |
| D ironwood bow | equipment | prop | pass |  |  |
| D ironwood staff | equipment | prop | pass |  |  |
| D layered silk robes boots | equipment | prop | pass |  |  |
| D layered silk robes head | equipment | prop | pass |  |  |
| D layered silk robes legs | equipment | prop | pass |  |  |
| D layered silk robes torso | equipment | prop | pass |  |  |
| D steel axe | equipment | prop | pass |  |  |
| D steel dagger | equipment | prop | pass |  |  |
| D steel heavy armor boots | equipment | prop | pass |  |  |
| D steel heavy armor head | equipment | prop | pass |  |  |
| D steel heavy armor legs | equipment | prop | pass |  |  |
| D steel heavy armor torso | equipment | prop | pass |  |  |
| D steel mace | equipment | prop | pass |  |  |
| D steel shield | equipment | prop | pass |  |  |
| D steel spear | equipment | prop | pass |  |  |
| D steel sword | equipment | prop | pass |  |  |
