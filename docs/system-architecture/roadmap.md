# Parallel roadmap

This roadmap separates **convergence contracts**, which unblock other work, from vertical features
that can proceed independently. It is a dependency plan, not a date estimate.

## Current delivery focus — Living Village

The owner has requested a reduced first playable milestone before the broader autonomous-society
roadmap below. [Living Village](../wiki/milestones/living-village.md) is the current scope authority:

```text
summon → inspect/equip → party/floor → deterministic combat
→ rewards/progression → direct training → improved retry
```

It uses one static settlement, Floors 1–10, one party, three navigational surfaces, bounded hero,
skill, equipment, and monster catalogs, and no agentic interaction, society, tower story, world
exploration, construction, or broad Town Master operations.

Delivery checkpoints:

1. **LV-1 Scope and content spine** — register all supplied drafts, visible conflicts, initial IDs,
   contracts, and runtime content selections.
2. **LV-2 Static Village and prepared roster** — summon, inspect, equip, form one party, and assign
   direct training through a fixed Hearth.
3. **LV-3 Deterministic tower loop** — Floors 1–10, combat adapter, claims, progression, unlocks,
   return, save, and replay.
4. **LV-4 Visual integration and playtest** — bind cross-surface art and ship the ten-minute,
   three-screen acceptance path on desktop and phone.

The remaining milestones describe the intended game after this reduced loop is proven. Their
contracts should influence extensibility, but their features are not Living Village requirements.

## Milestone 0 — architecture convergence

Goal: make the target product safe for parallel ownership without changing old replay histories.

Blocking decisions and contracts:

- ADR for the nonphysical Master, omniscient awareness, and legacy mortal-Master runs;
- progression-v2 cap table and effective-power contract;
- persistent Party, party revision, and general reservation contract;
- mission registry capable of multiple attempt records rather than one singleton;
- generic ledger reservation/grant receipt;
- capability/unlock registry;
- scalable evidence and `WitnessSetRef` contract;
- simulation-temperature and partitioned-snapshot ADR;
- `CampaignStoryPlan` compiler input/output contract;
- shared `HeroPresentationState` projection.

Repository convergence work:

- maintain the checked wiki catalog as the human-readable rulebook and artifact handoff surface;
- extract domain-owned contract/event/reducer modules from the current engine monoliths without
  changing historical behavior;
- replace scattered current-engine gates with one explicit ruleset/capability version manifest;
- compose the player campaign and isolated engine-v13–v23 subsystem proofs into one new integrated
  baseline before adding broad state;
- make domain event payloads typed/versioned instead of relying on an arbitrary payload record;
- route catch-up, decision context, journal, and campaign loading through that same manifest.

Exit evidence: schemas plus conformance fixtures, dependency tests, version-migration rules, and one
cross-system sequence diagram expressed as executable fixtures.

## Milestone 1 — summon to Hearth

Goal: make the game's central promise coherent before broadening content.

Parallel lanes:

- **Summoning/economy:** production-shaped Normal/Advanced/Special configs, gem ledger fixture,
  pity receipt, three committed deterministic test pulls.
- **Visual identity:** realistic manifest-bound hero presentation on summon, roster, dialogue, and
  settlement selection; tattoos/piercings/attire are separate visual slots.
- **Hero agency:** clean-slate onboarding, one mutable affect record, one personal goal, one request
  to the Master.
- **Settlement:** summoning gate to Hearth continuity, selectable residents, activity projection,
  one facility assignment.

Integration slice: summon three strangers, inspect the same identities everywhere, speak to each,
assign one hero, and receive one context-grounded request. No tower replay is required to review
this component.

## Milestone 2 — first growth day

Goal: connect base, skills, personality, and time.

Parallel lanes:

- **Progression:** progression-v2 levels 1–20, XP sources, mastery, slots, promotion preview.
- **Skills:** initial catalog across combat, crafting, construction, medicine, teaching, and
  exploration; deterministic two-input fusion preview.
- **Settlement:** generic construction project and one modular facility upgrade.
- **Simulation scale:** hot/warm/cold scheduling proof at 100 heroes, then 1,000 with provider calls
  disabled.
- **Agency:** petition inbox, response lifecycle, affect decay, durable goal lifecycle.
- **Motivation:** purpose/challenge/feedback projection plus one reversible schedule, mentorship, or
  facility intervention that changes voluntary training behavior.

Integration slice: heroes train, work, or idle for one offline game day; a leader or specialist
recommends a next action; one redesigned goal/facility/schedule changes voluntary behavior; and every
progression, motivation, and social delta replays.

## Milestone 3 — first autonomous party

Goal: prove leadership without an embodied Master.

Parallel lanes:

- **Party:** persistent party, leader, roles, formation, readiness evidence, willingness.
- **Mission:** mission-v2 deployment without Master, party-revision reservation, remote directives,
  retreat authorization, frontier lease.
- **Tower/story:** one alternate approved first-band envelope and seeded CampaignStoryPlan selection.
- **Presentation:** realistic party portraits plus small tactical figures from the same identity
  state.

Integration slice: a leader evaluates Floor 1 from held knowledge, recommends attempt or training,
the Master responds, the party deploys, returns, and reports. Story expression may use only a living
holder of the relevant fact.

## Milestone 4 — meaningful synthesis

Goal: make synthesis a legible, tempting, non-mandatory shortcut with a long-term cost.

Parallel lanes:

- typed output choices and recipient saturation;
- compatible skill fragments and promotion essence alternatives;
- anti-feeder economy simulations;
- witness/absence/rumor consequences at large rosters;
- synthesis presentation using the shared hero identity state.

Integration slice: preview two materially different source/recipient pairs, commit one irreversible
choice, inspect immediate grants and permanent exclusions, observe party/facility/relationship
consequences, and compare retained-roster value in a long-run deterministic simulation.

## Milestone 5 — growing company and base

Goal: support multiple parties and a town that changes spatially.

Parallel lanes:

- multiple idle parties and party reassignment;
- concurrent repeat-floor and portal expeditions;
- sealed district, vertical terrace, or underground sector expansion;
- facility modules, staffing, damage, and repair;
- councils/leader aggregation for high-population petitions;
- three-input and template-based skill fusion.

Integration slice: two parties operate while the settlement advances offline; construction changes
routes and affordances; no hero is double-reserved; journal/replay explains both expeditions and the
base transition.

## Milestone 6 — airship and first neighbor

Goal: unlock persistent exploration beyond tower and temporary portals.

Parallel lanes:

- shipyard/air dock construction and airship modules;
- destination signals and route discovery;
- vehicle crew/cargo/range/condition;
- one neighbor settlement content package;
- trade, diplomacy, recruit, knowledge, and story receipts;
- one ground mount with ride/carry/evacuate capabilities.

Integration slice: complete the ship, discover a signal, prepare a party and cargo, travel, resolve
one social or mission encounter, return with typed consequences, and retain a persistent neighbor
relationship.

## Milestone 7 — campaign breadth and long tail

Goal: expand proven generators and contracts, not bespoke exceptions.

- grow toward twenty reviewed five-floor envelopes and validate each generated 100-floor plan;
- extend enemy, skill, building, culture, mount, and destination catalogs;
- balance 6★ levels 51–99 for late campaign;
- calibrate level 40 around Floors 40–45, level 99 around Floors 85–90, and 100+ for the final
  Floor-100 push plus diminishing-return postgame mastery;
- benchmark 1,000 heroes, at least ten concurrent parties, seven game days of catch-up, and sparse
  salient model work;
- add operational tools for content/version rollout, replay compatibility, and live tuning.

## Per-system tracks

| Track | P1 | P2 | P3 | P4 |
| --- | --- | --- | --- | --- |
| Story/tower | Campaign plan contract | Alternate first band | Cross-band recurrence | 20-band breadth |
| Progression | Cap/effective power | Mastery/promotion | 2- and 3-input fusion | 6★/7★ long tail |
| Heroes/agency | Affect/goals | Motivation/petitions | Leaders/councils | Sparse deep life at 1,000 |
| Visuals | Shared presentation state | Realistic core surfaces | Culture packs/overlays | Mount/neighbor coverage |
| Settlement | Construction lifecycle | Modules | New sector topology | Shipyard/air dock |
| Parties/missions | Persistent party | Masterless deployment | Concurrent registry | Fleet/neighbor logistics |
| Summoning/economy | Gems/pity receipt | Production channels | Reserve roster | Versioned tuning simulations |
| Synthesis | Current safe commit | Output choice/saturation | Anti-feeder proof | World-story revelation |
| Neighbors/mounts | Capability contracts | First ship/neighbor | Trade/relations | Multiple routes/exotic mounts |
| Scale/platform | 1,000-agent zero-model bench | Partitioned evidence | Salient-job budgets | Production telemetry |

## Recommended parallel ownership

At most one workstream owns each contract. A useful team split after Milestone 0 is:

- kernel/scale and shared contracts;
- hero identity, visuals, and presentation;
- progression, skills, summoning economy, and synthesis math;
- society, affect, goals, and petitions;
- settlement construction and spatial expansion;
- parties, tower/portal mission runtime, and combat;
- campaign story compiler and content authoring;
- airship, neighbor, and mount content after the capability seam exists.

When team size is smaller, combine adjacent vertical lanes but keep the same ownership boundaries.

## Integration cadence

Every workstream should deliver small proofs against fixtures continuously. Integrate on a fixed
cadence around one player-visible causal chain, not a package-count target:

```text
contract fixture
→ producer implementation
→ consumer implementation
→ cross-system replay
→ player projection
→ owner feedback
→ accepted decision or revised experiment
```

Do not expand content breadth while an earlier causal chain is still ambiguous to the player.

## Risk gates

| Risk | Gate before expansion |
| --- | --- |
| Master pivot breaks current mission loop | Masterless Floor 1 strict replay under a new ruleset |
| 999 levels flatten content | Effective-power simulations and late-band playtest |
| Skill fusion becomes arbitrary | Recipe determinism, cycle rejection, budget properties |
| 1,000 heroes overload storage/attention | Seven-day benchmark and petition clustering review |
| Random story becomes incoherent | Full-plan causal/reward/asset validator |
| Realistic art loses identity | Same-hero cross-surface human recognition gate |
| Synthesis becomes feeder meta | Long-run retained-roster vs synthesis simulations |
| Parallel teams diverge | Shared fixtures and contract-owner review on every seam |
