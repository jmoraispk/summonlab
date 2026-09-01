# Capable prototype plan

> **Historical planning document:** ADR 0065 supersedes every procedural or modular character-rig
> recommendation below. Current product work uses approved authored hero art; missing art is shown
> as a non-character pending or location marker. Engine, simulation, and product-scope guidance is
> preserved as historical context.

## The product bet

Build the smallest version of Summonlab that can produce a story the developers did not write.

The prototype is not a dashboard mockup and not a complete colony simulator. It is a playable run in which the player:

1. wakes inside a failing settlement;
2. summons three unfamiliar adults;
3. meets them as people before seeing them as units;
4. gives imperfect orders and watches habits form;
5. prepares a party and climbs floors 1–5;
6. discovers one character-dependent secret;
7. lives with injury, death, synthesis, trust, and resource consequences;
8. closes the game, returns later, and finds that time has passed coherently.

The success condition is not content volume. It is one session in which a tester says, “I did not expect that hero to do that, but it made sense.”

## Decisions for the first serious build

- **Client:** SvelteKit application shell with PixiJS for animated settlement and mission scenes.
- **Camera:** clickable 2.5D settlement, staged third-person mission views, and illustrated close-up conversations.
- **Simulation:** deterministic TypeScript engine on the server.
- **Agents:** one daily plan per hero plus event-driven decisions; habits handle routine time locally.
- **Art:** deterministic character construction, modular gameplay rigs, and selectively generated portrait or cinematic assets.
- **Campaign slice:** floors 1–5, one portal world, one settlement day, one boss, and one meaningful secret.
- **Human scope:** adult human summons only. Other peoples and creatures wait until the human pipeline is convincing.

A freely navigable first-person or third-person settlement is a later experiment, not a prerequisite. A small number of authored camera positions will look better, communicate more, and preserve the manhwa composition language.

## Inspiration and originality boundary

The official [Tapas page for *Pick Me Up*](https://tapas.io/series/pick-me-up/info) establishes its emotional hook: a player who considered low-rarity heroes expendable becomes one of those heroes and must resist a godlike player. Han Isratte and early party members such as Jenna are useful moodboard references for strong silhouettes, readable combat roles, severe stakes, and a party that looks assembled rather than uniformly heroic.

Summonlab should not copy those characters, costumes, tower scenes, logos, terminology, plot reveals, or artwork. Reference images remain research material and do not ship as game assets. Our visual bible will extract abstract qualities:

- sharp value separation and strong silhouettes;
- practical fantasy clothing with one memorable shape per hero;
- quiet character acting between explosive action beats;
- environments that dwarf the party;
- rarity that does not predict emotional importance;
- consequences that remain visible after combat.

Other useful design references are [Majesty](https://www.paradoxinteractive.com/games/majesty-gold-hd/about) for heroes with wills of their own and [Wildermyth](https://wildermyth.com/guide/) for character-driven procedural stories. Summonlab combines indirect control with a continuous social home and language-model-authored intent.

### Visual research set

Keep these external and spoiler-conscious; do not download them into the shipped asset library.

- [Official Tapas series art and first episode](https://tapas.io/episode/3077563): the primary visual reference.
- [Han Isratte](https://pick-me-up.fandom.com/wiki/Han_Isratte): male lead reference for a disciplined silhouette and restrained acting.
- [Jenna Shirai](https://pick-me-up.fandom.com/wiki/Jenna_Shirai): early female lead reference for a warmer palette, archer readability, and a distinct energy beside Han.
- [Aaron Delkirt](https://pick-me-up.fandom.com/wiki/Aaron_Delkirt): useful contrast for low-rarity clothing and visible growth.
- [Iolka Rivel Strachur](https://pick-me-up.fandom.com/wiki/Iolka_Rivel_Strachur): useful contrast for a strong mage silhouette and class-specific color language.

Community pages can contain major spoilers and inconsistent translations. Use them to locate visual questions, then verify against licensed art before codifying the art bible.

## Original story foundation

### Working title: The First Ember

The Master wakes in **Hearth 01**, a walled refuge suspended between dead worlds. Its central gate can summon living people, but it cannot restore their autobiographical memories. Beyond the wall, an impossible black tower rises through the sky.

A damaged caretaker message gives one promise:

> Rekindle the Hearth. Reach floor 100. Open the road home.

The settlement has eighteen hours of reserve power. The summoning gate works once. The Master has no army, no government, and no proof that the tower's promise is true.

Every fifth floor restores a settlement system. Every tenth floor opens an archive left by a previous Hearth. Portal worlds are fragments caught near collapse: rich in resources, dangerous, and temporary.

The campaign gradually reveals that the tower is not selecting the strongest individual. It is testing what kind of society forms when one person receives the power to summon, command, sacrifice, and remember people who arrive with nothing.

### Campaign arc

| Floors | Arc | External goal | Human question |
| --- | --- | --- | --- |
| 1–20 | Survival | Restore food, shelter, training, and the outer wall | Why should anyone follow the Master? |
| 21–40 | Authority | Stabilize portals and recover records from prior Hearths | Is competence enough to justify power? |
| 41–60 | Identity | Learn why summons lose autobiographical memory | Are clean slates liberated, stolen, or both? |
| 61–80 | Division | Meet another settlement that answered authority differently | Can heroes choose a society without being able to leave the roster? |
| 81–99 | Refusal | Survive the tower's attempt to turn relationships into optimizations | What will the settlement refuse to sacrifice? |
| 100 | The Warden | Open the promised road and confront the tower's purpose | Ascend, inherit, or break the system? |

The ending may branch, but the prototype only needs to prove the emotional machinery that could earn those endings.

## Prototype story: floors 1–5

### Prologue: strangers at the gate

- The Master wakes and learns the reserve-power deadline.
- The player summons three adults at once.
- The reveal shows bodies, posture, voice, and first reactions before stars or statistics.
- Each hero independently decides whether to answer the Master's first question.
- The player learns that the gate cannot summon again until an ember core is recovered from the tower.

### Floor 1: carry the ember

The objective is to recover a heavy ember core and return it to the lift. Goblins are simple duty-driven creatures guarding scrap. The problem admits combat, distraction, negotiation attempts, and a hidden maintenance route.

One goblin flees through a sealed wall if frightened from the correct direction. A curious, observant, or exit-counting hero may inspect the wall later. The engine owns the passage; an agent can reveal it but cannot invent it.

### Settlement beat: one core, three needs

The core can initially power only one facility:

- the kitchen, improving food and shared routines;
- the dormitory, improving recovery and privacy;
- the training ground, improving mission preparation.

The Master chooses. Heroes form beliefs about the decision from their values, needs, and what explanation they receive. The first strong habits can form during the following accelerated day.

### Portal beat: the Iron Moon

A mining route opens for a limited time. Entering it can secure material for armor before floor 5, but costs recovery time and risks missing a conversation or training window. Heroes sent there decide how cautiously to extract.

### Floors 2–4: pressure and attachment

- Floor 2 introduces formation and protection.
- Floor 3 makes injury likely and tests whether the party retreats.
- Floor 4 separates two heroes briefly and gives one a reason to trust or blame another.
- Settlement scenes surface the consequences rather than resetting everyone between missions.

### Floor 5: the Foundry Warden

The first boss is an armored goblin construct that becomes dangerous while the furnace is lit. The obvious path is a damage race. The hidden maintenance route can expose a cooling control, but only if someone previously discovered it and the party trusts that person's information.

Victory relights Hearth 01 and reveals an archive fragment:

> Hearth 01 was not the first.

That is enough story for the prototype. It gives the player a practical goal, a mystery, and a reason to care how authority is used.

## Everybody needs a goal

The campaign goal does not replace personal goals. Each hero maintains a small goal stack:

| Horizon | Example | Source | Resolution cadence |
| --- | --- | --- | --- |
| Immediate | Eat, sleep, escape danger, finish a repair | Need or emergency | Deterministic or habit policy |
| Daily | Practice sword forms before dinner | Daily agent plan | Once per game day |
| Social | Learn why Mara avoids Tarin | Relationship and belief | Event-driven agent choice |
| Growth | Become capable enough to survive floor 10 | Drive and experience | Reviewed after missions |
| Moral | Prevent another synthesis | Value and witnessed history | Reviewed after costly events |
| Campaign | Reach floor 100 or reject the tower | Learned world knowledge | Rare narrative beats |

The model may propose a goal from known facts and legal goal types. The engine persists, advances, blocks, completes, or fails it. Goals are never regenerated from scratch each turn.

## Character construction: use a hybrid pipeline

Fully generating a character independently for every image will cause identity drift. Fully assembling characters from a tiny part library will look generic. Use generation for high-value identity assets and deterministic construction for continuity.

### The Character Forge

Build a developer-facing `/forge` route before building a large roster. It should:

1. generate a reproducible character seed;
2. render the structured physical manifest;
3. show front, three-quarter, profile, and full-body views;
4. allow any field to be locked while the rest rerolls;
5. test expressions, injuries, outfits, and lighting;
6. export the manifest, approved portrait reference, palette, and presentation recipe;
7. render a grid of 50–100 seeds to expose sameness or bias.

The Forge is how the project discovers its character language. It is not a player-facing face editor.

### Physical manifest

The seed owns stable facts such as:

- adult age and apparent-age band;
- height, frame, body composition, reach, and handedness;
- face proportions and distinguishing landmarks;
- skin palette, hair texture, hair pattern, and eye properties;
- sex-linked physiology and separately represented gender identity;
- scars, marks, voice range, posture, and idle-motion profile;
- family resemblance anchors for future related characters;
- outfit fit points and equipment silhouette constraints.

Culture, language fragments, name, temperament, intelligence, values, rarity, and morality are generated separately.

### Age proposal

The first prototype summons adults only because its world includes combat, permadeath, coercion, and synthesis.

- Sample age from a truncated normal distribution with mean `25`, standard deviation `4.5`, and bounds `18–42`.
- Most summons will appear in their early-to-late twenties without making every roster look the same.
- Age influences appearance, recovery, accumulated bodily wear, and plausible prior skill exposure.
- Age does not directly determine intelligence, courage, obedience, or human value.
- Exact age may initially be unknown to the hero and shown as an apparent band until learned in play.

The distribution remains content configuration, so later summon channels or cultures can use different adult ranges.

### Ancestry and visible diversity

Do not generate “race” as a cosmetic label attached to a mental-stat package. Use curated, art-directed phenotype ranges that can blend coherently, then generate culture independently. Review large seed grids for stereotyping, accidental correlations, and whether every phenotype receives equal visual care.

### Asset hierarchy

| Asset | Construction | Why |
| --- | --- | --- |
| Simulation portrait | Layered 2D rig from manifest | Fast, consistent, expressive |
| Settlement figure | Simplified rig or sprite derived from same manifest | Readable at distance |
| Mission figure | Higher-detail 2D skeletal rig | Equipment, injury, and action continuity |
| Summon card | Generated or painted from canonical reference sheet | High-impact identity moment |
| Dialogue close-up | Rig plus painted expression overlays | Repeatable emotional acting |
| Promotion or death image | Selectively generated/painted with references | Rare cinematic payoff |

The official OpenAI documentation describes [GPT-Image-2](https://developers.openai.com/api/docs/models/gpt-image-2) as supporting image generation, editing, and high-fidelity image inputs. That makes reference-driven card and cinematic generation a viable experiment. It should not be the runtime renderer or the source of physical truth.

Every approved generated image records its prompt, model snapshot, input references, manifest version, and human approval state.

## Camera and interaction model

### Settlement: beautiful command view

Use a hand-composed 2.5D settlement scene with an isometric or high three-quarter camera. Buildings are large illustrated zones rather than icons on an empty map. Day, weather, construction, smoke, lights, damage, and small hero figures animate continuously.

The player can:

- pan and zoom within authored bounds;
- click buildings to enter interior compositions;
- click visible heroes when they are available;
- follow a hero's current route;
- see conversations, work, and idling happen spatially;
- enter an over-the-shoulder conversation shot as the Master.

### Conversations: manhwa panels in motion

Conversation scenes use portrait-depth compositions: a close subject, a readable background, subtle parallax, eye movement, breathing, expression changes, and restrained effects. Important choices can temporarily divide the screen into panel-like compositions.

The Master may type freely, choose a suggested line, issue an order, ask a hero to speak with someone else, or leave. The game stores the communicative act and its witnesses, not hidden reasoning.

### Missions: staged third person

Tower and portal missions use authored three-quarter arenas with limited camera tracks. The player sees the party move and act but does not directly puppeteer heroes. Soft orders, retreat, target priorities, and the Master's own embodied action are available when legal.

### First-person and free third-person

Use first-person briefly for the opening summon and rare confrontation shots. Do not build free walking for the first vertical slice. After the loop works, prototype one small “walk the courtyard” scene and compare whether embodiment adds more than the authored camera loses.

## Playable feature cut

### P0: must be real

- seeded run creation, saving, loading, and replay;
- Master death and hero permadeath;
- three generated adult heroes with stable appearances;
- summoning reveal and first conversation;
- one clickable settlement with kitchen, dormitory, training ground, gate, and workshop;
- needs, daily plans, habits, availability, goals, beliefs, and relationships;
- accelerated time plus server-side catch-up;
- free-text conversation and constrained orders;
- tower floors 1–5 with deterministic legal actions;
- simple autonomous combat and retreat;
- one hidden route with engine-owned discovery conditions;
- one timed Iron Moon resource mission;
- equipment repair or upgrade;
- one synthesis choice and visible social response;
- event/context inspector for debugging agent behavior;
- random and scripted policies for zero-cost simulation.

### P1: add if P0 is alive

- one building construction choice;
- a promotion from `1★` to `2★`;
- voice tests for short lines;
- a second boss solution;
- one intelligent monster conversation;
- one courtyard walk-mode experiment;
- generated promotion or memorial art.

### Not in the vertical slice

- all 100 playable floors;
- other settlements as explorable spaces;
- non-human summons;
- romance, children, aging across decades, or family simulation;
- full government and policy simulation;
- unrestricted 3D settlement traversal;
- runtime generation of every animation frame;
- PvP, trading, guilds, or monetization.

## Technical shape

```text
apps/
  web/            SvelteKit UI and PixiJS scenes
  worker/         simulation, catch-up, and model jobs
packages/
  engine/         pure state transitions and legal actions
  content/        floors, buildings, story beats, and encounter rules
  characters/     seeded manifests, needs, habits, goals, and relationships
  policies/       random, scripted, and model policies
  rendering/      rigs, animation state, cameras, and effects
  observability/  replay, context packets, costs, and evaluation traces
```

Postgres remains the source of truth. A Postgres-backed job queue is sufficient for the prototype and avoids adding Redis before load requires it. Object storage holds approved portraits, rig layers, and cinematic assets.

The current static prototype becomes an art and information-architecture reference, not production code.

## Build sequence and exit criteria

### Milestone 0: proof of life

Build one scene in which a seeded hero is summoned, looks around, speaks an agent-authored first line, walks to one of two available locations, and remains visually identical in both views.

**Exit:** five reruns with the same seed preserve identity; different seeds feel meaningfully distinct; a player can explain why the hero chose the location.

### Milestone 1: deterministic game kernel

Implement the run seed, clock, legal actions, event log, needs, habits, goals, floor state, injury, death, resources, and replay without any model dependency.

**Exit:** scripted and random policies can simulate 100 runs through floor 5; every result replays exactly; invalid actions never mutate state.

### Milestone 2: Character Forge and art bible

Build `/forge`, define the manifest schema, create the first modular rig, and approve twelve representative heroes. Produce the settlement color script and one full conversation composition.

**Exit:** 100-seed review shows acceptable variety and no obvious trait/phenotype coupling; one hero can wear two outfits, show six expressions, and sustain an injury without identity drift.

### Milestone 3: living settlement

Build Hearth 01, five building interiors, accelerated time, hero routes, needs, habits, daily plans, and save/resume catch-up.

**Exit:** a six-hour game day can run with the browser closed; returning produces a concise, causally correct recap; no routine action needs an LLM call.

### Milestone 4: conversation and authority

Add first meetings, free-text conversation, orders, availability, beliefs with provenance, witnesses, social propagation, and relationship changes.

**Exit:** the same order can be accepted, questioned, negotiated, or refused for inspectable reasons; stale decisions are safely discarded and replanned.

### Milestone 5: mission loop

Implement floors 1–5, the Iron Moon, party selection, autonomous turns, retreat, hidden-route discovery, equipment consequences, permadeath, and the Foundry Warden.

**Exit:** at least three viable floor-5 strategies emerge; a death changes later settlement behavior; hidden-route discovery is replayable from seed and action history.

### Milestone 6: vertical-slice finish

Add the story beats, synthesis scene, sound, summon animation, environmental motion, onboarding, performance work, telemetry, and a run-end/restart flow.

**Exit:** a new tester can complete or lose a run without developer help, remembers at least one hero by name, understands the goal, and reports one coherent emergent story.

## Playtest questions

- Do heroes feel like people with constraints, or chatbots attached to meters?
- Can the player infer why a surprising choice happened?
- Does talking change later behavior enough to matter?
- Is settlement time alive without becoming exhausting?
- Are the illustrated camera views more emotionally effective than free movement would be?
- Does one stable generated identity survive portrait, sprite, injury, equipment, and dialogue views?
- Does floor 5 test relationships and preparation rather than only statistics?
- Does death create memory and adaptation rather than a desire to reload?
- Is synthesis morally legible without making the mechanic unusable?
- After one run, does the player want to summon different people and try again?

## Highest risks

| Risk | Prototype answer |
| --- | --- |
| Generated characters drift visually | Manifest is canonical; use reference-driven assets and modular rigs |
| Agents are expensive or slow | Daily plans plus habits; event calls only for novelty |
| Dialogue has no gameplay consequence | Persist communicative acts, beliefs, promises, and authority changes |
| Too much simulation hides the fun | Limit the slice to five buildings, three heroes, and five floors |
| Art ambition overwhelms implementation | Fixed cameras, reusable rigs, and rare premium images |
| Emergent events feel random | Goals, provenance, legal actions, and replay inspector |
| Story and simulation fight each other | Authored pressure beats define problems; agents choose responses |

## Immediate next build

Start Milestone 0 before expanding the static mockup:

1. scaffold the TypeScript monorepo;
2. define `CharacterManifest`, `HeroMind`, `Goal`, and `LegalAction` schemas;
3. build the first Character Forge grid;
4. produce three original hero reference sheets and one settlement background;
5. implement the summon-to-first-choice proof of life;
6. play it repeatedly before committing to full movement or additional content.

That proof will answer the hardest question early: whether a generated person can look consistent, enter the world beautifully, and immediately seem to want something.
