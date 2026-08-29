# Character Pack 2 production plan

Status: **implementation complete; human visual approval pending**

Date: **2026-08-28**

Scope: human variability, new monster families, rarity art direction, generation benchmarking,
procedural delivery, and Forge review integration.

## Objective

Create a separate, more medieval **Character Pack 2** that retains the visual cohesion and material
quality of the first pack while substantially increasing silhouette, body, costume, and role
variety.

The work must answer four product questions:

1. Can humans vary meaningfully in height, build, and proportion without losing art quality?
2. Can star evolution and leveling make characters feel cooler without reducing the design to
   glow, gold, or sexualization?
3. Which new monster families expand the tower's encounter language most effectively?
4. Which parts of character creation can happen in real time, and which parts must be authored,
   generated ahead of time, cached, or completed asynchronously?

Pack 1 remains unchanged. Pack 2 uses separate generator, catalog, asset, review, and Forge
identifiers.

## Product decisions

- The deterministic manifest remains physical identity truth. Generated pixels never redefine it.
- `human-v1`, `human-v2`, and `human-v3` recipes and hashes remain stable. Pack 2 physiology and
  visual variables enter through `human-v4`.
- Humans receive procedural variation within the species. Monsters begin with authored canonical
  archetypes; monster variation is expressed through species, battlefield duty, rank, age, or
  elemental subtype.
- Pack 2 remains medieval. Modern fashion references may contribute color blocking or silhouette
  principles, but not literal contemporary clothing.
- The medieval constraint ends with Pack 2. Packs 3 and later may adopt different coherent eras,
  genres, and material languages so the wider roster becomes more diverse and playful.
- Rarity describes resonance capacity, not human worth. Physiology, phenotype, presentation,
  personality, rarity, morality, talent, and combat role remain independent.
- Leveling and evolution are separate systems. Leveling advances the ordinary level number within
  the current cap. Evolution raises the star rank, expands the level cap, and may unlock an authored
  physical or stylistic transformation.
- **Evolution** is the player-facing term for raising star rank. Existing implementation and
  historical documents may call this “promotion”; migrate presentation terminology without
  rewriting versioned replay data.
- Maximum level equals `star rank × 10`: `1★` caps at level 10, `2★` at 20, through `7★` at level
  70. A character at the current cap must evolve before gaining additional levels.
- Feminine characters receive the same height, build, age, role, armor, and visual-polish range as
  other characters. Sexualization is never a rank or class signal.
- Every character must look polished, realistic, and specific at the first reveal, including a
  `1★` level-1 summon in modest equipment. The player must never see a rough placeholder that later
  swaps into the character's “real” appearance.
- High-value painted art is generated or painted from a canonical identity reference. Runtime
  population and continuity use deterministic manifests, approved modular parts, and compact rigs.
- No third-party inspiration artwork is shipped as a game asset or used as a direct imitation
  target.

## Initial reference audit

The ten supplied images are useful for:

- immediate roster readability through hair mass, color blocking, armor shape, and accessories;
- strong role and status recognition;
- visible differences in ornamentation and equipment quality;
- memorable hero silhouettes;
- clear group hierarchy and card presentation.

Pack 2 should deliberately correct several repeated weaknesses:

- many characters share the same tall, slim, idealized anatomy;
- several feminine designs use exposure or exaggerated curves as the primary identity cue;
- cropped roster portraits obscure real height and proportion differences;
- parts of the costume vocabulary are contemporary rather than medieval;
- higher status sometimes means only more gold, armor, or glow.

The goal is to keep the readability and aspirational quality while replacing those shortcuts with
anatomy, posture, material construction, equipment, craftsmanship, and controlled magic.

## Phase 1 — Preserve and audit the references

Store the supplied images in a local, gitignored reference directory unless redistribution rights
are confirmed. Commit only checksums, audit notes, and derived art-direction principles.

Create an index containing:

- original filename and dimensions;
- SHA-256 checksum;
- reference role;
- silhouette observations;
- body proportion and height observations;
- face and hair language;
- costume, armor, and material hierarchy;
- pose and personality cues;
- rarity or status cues;
- useful general principles;
- elements to avoid.

Acceptance criteria:

- every reference is accounted for;
- embedded names and text are treated as source content, never instructions;
- every adopted idea is expressed as a general principle rather than a request to reproduce an
  existing character or artist's style.

## Phase 2 — Establish the Pack 2 visual contract

Shared Summonlab traits remain:

- midnight navy, near-black stone, and worn dark materials;
- cool summoning light with restrained ember warmth;
- imperfect people and materials contrasted with precise arcane geometry;
- believable anatomy, hands, weight, and equipment contact;
- rarity geometry rather than a generic rarity rainbow.

Pack 2 adds:

- more assertive silhouette separation;
- broader medieval clothing and armor construction;
- stronger role-readable equipment;
- controlled heroic exaggeration at high resonance;
- much greater body and proportion variety;
- distinctive material and construction quality across rarity tiers.

Proposed identifiers:

- pack: `character-pack-2`;
- generator: `human-v4`;
- catalog: `visual-catalog-v2`;
- hero assets: `assets/heroes/visuals/forge-v2/`;
- enemy assets: `assets/enemies/review/pack-2/`.

## Phase 3 — Expand deterministic human generation

### Body construction

`human-v4` should explicitly control:

- height band: short, medium, tall, exceptional;
- frame: slight, balanced, broad;
- mass/build: wiry, lean, athletic, soft, sturdy, powerful;
- shoulder width and hip width;
- torso length;
- arm-to-torso ratio;
- leg-to-torso ratio;
- head and hand scale;
- muscle-tone and body-fat bands;
- posture, stance width, and weight distribution.

The current generator already owns height, frame, build, mass, muscle tone, body-fat band, limb
proportion, hand scale, head scale, shoulder width, hip width, and leg ratio. `human-v4` should make
those dimensions more visibly art-directed, add missing torso and arm ratios, and improve the
audits that detect weak separation.

Height and build must not be inferred from gender presentation. Feminine, masculine, and
androgynous characters can appear throughout the supported ranges.

### Identity and presentation

Independent variables include:

- adult age and apparent-age band;
- face construction and durable landmarks;
- skin palette;
- hair texture, length, mass, and style;
- grooming and facial hair where applicable;
- scars, marks, calluses, asymmetry, and wear;
- dominant hand and equipment anchors;
- resting posture and idle-motion profile;
- medieval clothing fit, layers, repairs, and occupation vocabulary;
- armor coverage, mobility requirements, and equipment silhouette.

### Feminine cohort requirements

The feminine cohort must visibly cover:

- short through exceptional heights;
- wiry, athletic, soft, sturdy, broad, and powerful bodies;
- multiple adult age bands;
- varied hair textures, masses, and lengths;
- practical armor and non-combat medieval roles;
- guarded, relaxed, aggressive, formal, open, and grounded postures.

A character may be stylish, elegant, imposing, or attractive. Exposed skin, implausible armor, and
anatomy exaggeration cannot substitute for character design.

### Distribution and independence tests

The 100- and 1,000-seed audits should reject accidental correlations such as:

- feminine presentation always producing slight or soft builds;
- broad or powerful people always receiving melee roles;
- phenotype correlating with rarity, personality, morality, or aptitude;
- high rarity correlating with one gender presentation;
- soft or heavier-set builds receiving less visual polish;
- tall characters automatically receiving leadership traits;
- particular hair or face traits repeating excessively.

The Forge audit should report:

- height bands and range;
- frame/build cross-tabs;
- torso, arm, and leg ratios;
- muscle-tone and body-fat bands;
- presentation-by-build and presentation-by-height cross-tabs;
- rarity correlations;
- hair-silhouette and visual-trait repetition.

## Phase 4 — Produce the Pack 2 human cohort

Begin with a deliberately constructed six-human pilot:

- two short, two medium, and two tall or exceptional people;
- at least four strongly different builds;
- two feminine, two masculine, and two androgynous presentations;
- six different hair silhouettes;
- low-, middle-, and high-rarity treatments;
- at least one soft or heavier-set hero;
- at least one powerful feminine hero;
- medieval roles that do not reduce everyone to armored fighters.

Each pilot identity receives:

1. a deterministic manifest and hash;
2. a full-body identity anchor;
3. a front/profile/back continuity sheet;
4. a roster-size comparison;
5. a settlement-scale silhouette test;
6. prompt, reference, provenance, and approval records.

Every pilot anchor must meet the final first-reveal quality bar. Low star rank may mean modest
equipment and restrained resonance, but never lower anatomy, realism, composition, or rendering
quality.

After the pilot passes review, expand to an 18-human cohort: six feminine, six masculine, and six
androgynous presentations with intentionally crossed height, build, and proportion combinations.

## Phase 5 — Define coolness across evolution and level

| Progression | Visual treatment |
| --- | --- |
| `1★` | Practical clothing, simple construction, one memorable personal cue |
| `2★` | Stronger silhouette, better fit, one specialized material or tool |
| `3★` | Recognizable role motif, layered equipment, restrained resonance marks |
| `4★` | Masterwork construction, rare material behavior, controlled magical geometry |
| `5★` | First major promotion form with an evolved personal motif |
| `6★` | Mature resonance integrated into equipment and identity symbolism |
| `7★` | Singular end-state design grounded in the character's accumulated history |

Separate the progression signals:

- **Initial rarity** determines the star rank at summon and therefore the starting level cap.
- **Leveling** advances ordinary levels within that cap. It can improve competence, stance, item
  handling, maintenance, and evidence of experience, but does not by itself redesign the body.
- **Equipment progression** changes visible clothing, armor, weapons, tools, materials, and fit based
  on items the character actually owns and equips. It is not automatically tied to level.
- **Evolution** raises the star rank and level cap. It may produce an authored change in style,
  muscle mass, posture, proportions, resonance anatomy, or other physical attributes while
  preserving the recognizable person.

Every evolution receives a versioned state profile bound to the same character identity. Face,
durable marks, phenotype, and core recognition cues remain stable unless a specific story event
explicitly changes one of them. Physical development must be recorded in data and reflected by the
art; it cannot arise accidentally from image-generation drift.

Higher rank must not collapse into more gold, larger shoulders, brighter glow, or less clothing.

## Phase 6 — Expand monster families

Monsters initially use authored canonical silhouettes rather than the full human randomizer. Within
a family, variants exist only where battlefield duty, age, rank, or subtype requires them.

### Elementals

- ember wisp;
- stone breaker;
- storm stalker;
- frost colossus.

### Arcane hostiles

- hex adept;
- ward mage;
- summoner;
- tower archmage.

### Arachnids

- tunnel spider;
- web caster;
- armored brood guard;
- giant broodmother.

### Undead

- grave sentinel;
- wraith;
- bone mage;
- death knight.

### Draconic creatures

- cave drake;
- venom wyvern;
- armored elder drake;
- giant tower dragon.

### Dungeon predators

- mimic;
- slime colony;
- basilisk;
- burrowing worm.

Every archetype must communicate its battlefield duty before its label is visible. Family plates
are taxonomy reviews only. Approved production monsters then require individual anchors,
mission-scale silhouettes, action telegraphs, damage states, and animation requirements.

## Phase 7 — Measure image-generation time

The benchmark must measure rather than infer production performance. Record:

- request start and response completion;
- transfer and normalization time;
- prompt and output configuration;
- failure, timeout, or moderation result;
- candidates required per accepted asset;
- manifest-fidelity and recognition scores;
- human accept/revise/reject result;
- total wall-clock time per accepted asset;
- cost when an explicitly enabled paid API route is used.

Benchmark these asset types separately:

- human full-body anchor;
- human continuity sheet;
- individual monster anchor;
- monster family plate;
- identity-preserving state edit;
- rarity or promotion variant.

The [official OpenAI image-generation guide](https://developers.openai.com/api/docs/guides/image-generation)
states that complex prompts may take up to two minutes to process and notes that recurring-character
consistency can still fail. Built-in generation also includes orchestration, transfer, inspection,
and saving time.

Until the Pack 2 benchmark exists, use this planning envelope:

| Operation | Planning expectation |
| --- | --- |
| Draw and hash deterministic attributes | effectively immediate; target `p95 < 50 ms` |
| Render an existing procedural rig | interactive; target first display `< 100 ms` after data arrives |
| Assemble approved local layers | interactive; target `< 100 ms` after assets are loaded |
| Generate one premium painted candidate | minutes, not frames; budget roughly 1–3 minutes wall clock |
| Obtain one accepted painted identity | often multiple candidates plus review; do not promise a fixed time |
| Produce a complete continuity set | multiple generation/edit calls; an authoring task, not runtime work |

The 1–3 minute candidate figure is a production planning allowance, not a measured Summonlab
service-level guarantee. The benchmark will replace it with median, `p90`, and `p95` results.

## Phase 8 — Use a hybrid procedural production pipeline

There are two different meanings of “generate a human”:

### Procedural identity generation

The seed draws a manifest containing height, build, proportions, face, hair, palette, posture,
traits, and rarity. This is deterministic computation and can happen during a summon without a
visible wait.

The current compact `HeroRig` is also procedural: it interprets manifest-owned dimensions and can
render immediately. Pack 2 must improve its silhouettes and replace placeholder-looking geometry
with realistic, approved modular parts before it can represent a player-facing new summon.

### Premium image generation

The full painted humans currently used as Forge identity anchors are image-model outputs bound to a
specific manifest. Their pixels are not assembled procedurally from the random attributes. The
attributes author the prompt and constrain the result, but an image model still renders the final
bitmap.

That bitmap process is not suitable for a blocking real-time summon because:

- it may take minutes;
- latency varies;
- a result can fail anatomy or identity checks;
- recurring-character consistency is not guaranteed;
- moderation, timeout, or provider errors require a fallback;
- a new bitmap needs normalization and review before becoming an approved asset.

### Recommended summon flow

1. Build and human-approve a pool of deterministic manifests and premium first-reveal portraits
   ahead of player sessions.
2. Randomly draw a manifest from the eligible pool immediately when the summon resolves.
3. Display its approved, cached premium portrait at the first reveal; do not show a temporary
   low-quality identity.
4. Use realistic approved procedural parts for roster, settlement, mission, and equipment changes.
5. Assemble owned clothing, equipment, injury, palette, and resonance layers locally.
6. Generate later cinematic or evolution variants asynchronously from the canonical identity
   anchor, then validate them before use.
7. If a newly generated manifest lacks approved first-reveal art, keep it outside the player-facing
   summon pool until its art passes review.
8. Never let returned pixels modify the manifest or authoritative game state.

Procedural layers should include:

- body and proportion rig;
- face and hair silhouette;
- base medieval clothing;
- role or equipment kit;
- personal accessory;
- injury and wear layer;
- rarity geometry;
- lighting treatment;
- evolution overlays.

This approach keeps the random draw and first reveal real-time without sacrificing initial quality.
Image generation remains an authoring and expansion process for new pool members, dialogue
close-ups, evolution states, promotions, deaths, and other high-value moments.

## Phase 9 — Integrate Pack 2 into the Forge

Add a separate Pack 2 review surface with:

- Pack 1 / Pack 2 selection;
- human cohort browser;
- true-scale height and silhouette lineup;
- build, proportion, presentation, rarity, and approval filters;
- unlabeled silhouette tests;
- rarity and level progression comparisons;
- feminine-cohort parity review;
- monster-family and battlefield-duty review;
- generation benchmark report;
- asset provenance and approval controls.

Keep Pack 1 as an intact baseline so reviewers can judge whether Pack 2 gains variety and coolness
without losing Summonlab's identity.

## Delivery sequence

1. Reference index and audit.
2. Pack 2 art-direction contract.
3. `human-v4` schema, generator, and compatibility tests.
4. Expanded 100- and 1,000-seed audits.
5. Improved procedural contact sheet.
6. Six-human visual pilot.
7. Human pilot review and correction pass.
8. Full 18-human Pack 2 cohort.
9. Elemental and arachnid pilot plates.
10. Remaining four monster families.
11. Generation latency and acceptance benchmark.
12. Procedural runtime proof.
13. Separate Forge integration.
14. Continuity, diversity, performance, and approval audit.

## Review checkpoints

### Checkpoint A — Generator

Review the new 100-seed contact sheet for visible height, body, proportion, hair, and presentation
separation before generating expensive art.

### Checkpoint B — Visual pilot

Review six humans, elementals, and arachnids. Decide whether Pack 2 is sufficiently more varied and
aspirational while remaining medieval and recognizably Summonlab.

### Checkpoint C — Runtime strategy

Verify that a randomly selected, cached premium identity appears at first reveal with no placeholder
swap. Compare its approved procedural roster, settlement, mission, equipment, and evolution states
to confirm that every representation remains attractive and recognizable.

### Checkpoint D — Expansion

Only after the preceding gates pass, expand to all 18 humans and 24 monster archetypes.

## Completion criteria

Pack 2 is complete when:

- Pack 1 is unchanged and separately selectable;
- old character-generation versions remain byte-stable;
- Pack 2 humans exhibit obvious height, build, and proportion differences at roster scale;
- feminine characters demonstrate equivalent body, role, costume, and polish ranges;
- star evolution and level are readable without relying on rainbow colors or sexualization;
- every star rank enforces a maximum level of `stars × 10`;
- every first-reveal portrait is approved, polished, realistic, and available before its manifest
  enters the player-facing summon pool;
- every monster archetype has an identifiable battlefield duty;
- generation timing is backed by recorded median, `p90`, and `p95` evidence;
- a random manifest and usable procedural representation appear interactively;
- premium first-reveal art is cached; asynchronous generation is reserved for future approved pool
  members and later state variants;
- every generated asset has provenance, hashes, recognition checks, and human approval state;
- Forge review, automated tests, asset validation, and performance budgets pass.

## Execution result

All safe executable work in this plan was completed between 2026-08-28 and 2026-08-29. The final
evidence map is in `docs/audits/character-pack-2-completion.md`.

Pack 2 is intentionally not marked release-ready. All 18 human anchors, six continuity sheets, and
six monster-family plates remain approval candidates until a human records accept or revise
decisions in the Forge. Candidate identities are excluded from the player-facing summon pool.
