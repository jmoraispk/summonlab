# Integration contracts

## One owner, typed exchange

Subsystems communicate through six primitives:

1. **Command** — a request to an owning aggregate with expected version and idempotency key.
2. **Event** — an accepted canonical consequence emitted by that aggregate.
3. **Receipt** — hash-bound details of a multi-system transaction or rejection.
4. **Evidence reference** — provenance linking a fact or belief to canonical events and holders.
5. **Projection** — a read-only audience-specific view.
6. **Content binding** — immutable definition ID, version, and content hash.

No integration is allowed to reach into another aggregate and modify fields directly. Cross-system
work is coordinated by an application transaction or process manager that submits normal commands
and records linked receipts.

## Common envelope

Every new command and event should carry or derive:

```text
runId · aggregateType · aggregateId · aggregateVersion
commandId · correlationId · causationId · actorId
observedGameTime · expectedStateHash
rulesetVersion · schemaVersion · contentBindings[]
source/policy/job evidence · idempotency key
```

Randomness names a purpose and advances an engine-owned entropy cursor. Policy/model outputs bind
the source state hash and legal-action hash. Old schema versions replay under their original rules.

## Contract fixtures before consumers

For every integration, check in a fixture containing:

- minimum valid input;
- representative successful receipt;
- each typed rejection family;
- stale or duplicate submission;
- replay result hash;
- presentation projection for the intended audience.

Producer and consumer tests should use the same fixture. This lets workstreams build in parallel
without importing one another's implementation.

## Hero reference

Systems exchange a compact `HeroRef`, never a mutable character copy:

```text
heroId
characterManifestHash
lifeState
availabilityRevision
rulesetVersion
```

When needed, the owning context adds a projection:

- `CapabilitySnapshot` from Progression;
- `HeroPresentationState` from Presentation;
- `HolderEvidenceSummary` from Society;
- `AvailabilityReservation` from Party/Expedition.

## Hero presentation state

All visual surfaces consume one projection:

```text
heroId · manifestHash · visualProfileVersion
lifeState · equipmentRefs[] · injuryRefs[] · durableMarkRefs[]
evolutionStage · affectBand · actionPose · cameraTier
culturePackId · attirePackId · approvedAssetBinding
```

Summon, roster, dialogue, base, training, mission, synthesis, and memorial views choose assets from
this projection. Personality can affect gaze, posture tendency, gesture, expression, and voice
framing; it cannot change anatomy or identity locks. Render choices never mutate canonical affect.

## Party and expedition boundary

A `Party` is persistent organization:

```text
partyId · revision · name · memberIds[] · leaderId?
roleAssignments · doctrine · formationPreset · lifecycle
```

An `ExpeditionPartySnapshot` is attempt-local truth:

```text
partyId · partyRevision · reservedHeroIds[]
capabilitySnapshotHashes[] · equipmentReservationIds[]
willingness/authorization receipts · deployment roles
```

Rules:

- one hero belongs to at most one deployed expedition;
- editing an idle party creates a new revision and never rewrites an active attempt;
- expedition owns positions, guard, objectives, discoveries, harm, retreat, and extraction;
- party owns membership, leadership, doctrine, history, and cohesion;
- one frontier lease prevents two attempts from claiming the same first-clear transition;
- repeat floors, portal missions, and different destinations may run concurrently when reservations
  do not conflict.

## Readiness and hero petitions

Readiness is a deterministic, evidence-rich projection, not a magic scalar:

```text
partyId · partyRevision · targetRef · assessmentVersion
band: ready | marginal | unready | unknown
memberAvailability · injury/fatigue · provisions · equipment
skillCoverage · effectivePowerRange · cohesion · knownPressures
uncertainties[] · evidenceRefs[] · projectionHash
```

The omniscient UI projection and a hero's reported assessment are distinct. A hero may only cite
facts they or an authorized party process know.

A hero initiative uses a typed petition:

```text
petitionId · authorHeroId · representedPartyId?
kind: request | recommendation | warning | report
subjectRef · optionIds[] · evidenceRefs[]
urgency · expiry · sourceDecisionId · status
publicReason · spokenText?
```

Personality affects whether, when, and how a hero petitions. Level/experience affects evidence
quality and social weight, not permission to speak. Accepting a petition creates a normal command
for the owning domain linked by `petitionId`; it does not grant a privileged mutation path.

To support 1,000 heroes, leaders and councils aggregate duplicate concerns, petitions use cooldowns
and material-change thresholds, and the Master inbox clusters low-urgency items.

## Motivation boundary

Motivation is a derived explanation of why a hero currently favors or avoids an available behavior,
not a writable aggregate or universal productivity number:

```text
MotivationProjection
  heroId · opportunityRef · projectionVersion
  activeGoalFit · objectiveClarity · perceivedProgress
  challengeFit · autonomy · socialBelonging · leader/mentorTrust
  facility/toolAccess · fatigue/stress/recovery · expectedReward
  supportingEvidenceRefs[] · blockingReasonRefs[] · projectionHash
```

Settlement, Party, Progression, Society, Affect/Goals, and Economy each publish facts that contribute
to the projection while continuing to own their state. Simulation and policies consume the bounded
projection when scoring legal training, work, rest, social, or idle actions. A decision trace can
explain which conditions mattered, but no command may directly set motivation or obedience.

Changing a goal, schedule, facility, mentor, party norm, feedback loop, reward, or recovery plan
uses that domain's normal command. The resulting events may change later choices. Boredom, idleness,
avoidance, and overwork therefore remain reproducible consequences of the surrounding system rather
than arbitrary model characterization.

## Progression contract

Progression owns:

```text
ProgressionProfile
  rank · level · experience
  attributes · growth choices
  learned skills · mastery · equipped skills
  promotion state · effectivePowerVersion
```

Other systems submit typed `ProgressionGrantClaim`s containing source event, grant kind, amount or
skill evidence, and content binding. Progression validates caps, duplicates, prerequisites, and
recipient state before emitting deltas. Missions and synthesis do not write XP directly.

Raw level is not a universal difficulty comparison. Consumers request an `EffectivePowerProjection`
for a versioned context such as tower combat, crafting, medicine, or leadership. The projection is
inspectable and cannot hide missing skill coverage.

## Skill and fusion contract

A skill definition contains:

```text
skillId · version · contentHash · tier
domain · operation · delivery · aspects[]
prerequisiteIds[] · effectOperators[] · costs[]
tradeoffs[] · incompatibilityTags[] · powerBudget
```

Hero state distinguishes discovered, learned, mastered, and equipped skills. Fusion consumes a
canonical sorted input set and a versioned rule:

```text
FusionRequest
  heroId · inputSkillIds[2..3] · catalystRefs[] · ruleCatalogHash

FusionReceipt
  consumed/retained inputs · resultSkillId · inherited aspects
  costs · power-budget proof · recipeHash · state hashes
```

An authored recipe is preferred. A procedural template can compose only cataloged effect
operators within a budget. A development model may propose a missing definition for review, but a
runtime model cannot author effects. Cycles, free refunds, repeated-input duplication, and tier
growth without a paid power budget are rejected.

## Economy and grant boundary

Economy owns all balances. Separate ledgers distinguish earned resources, premium gems, reserved
construction inputs, attempt-local cargo, and owned items.

A multi-system spend follows:

```text
quote (read-only, versioned)
→ reserve/debit ledger
→ owning domain action
→ finalize receipt
```

Failure before finalization releases the reservation; retry returns the same receipt. Domain
systems never compensate by minting private currency.

### Summoning transaction

One atomic orchestration receipt binds:

```text
currency debit
+ channel/odds version
+ pity/anomaly before and after
+ entropy purpose/cursor
+ generation recipe and manifest hash
+ created hero ID
+ summon receipt hash
```

The animation reveals a committed outcome. It never performs the draw. Appearance, personality,
aptitude, culture, and rarity use independent entropy streams. Advanced summons may consume gems;
prices and final odds remain versioned tuning.

### Mission extraction

Mission resources and discoveries remain attempt-local until a valid extraction. Extraction emits
a claim; Economy commits cargo and Progression commits rewards through linked idempotent receipts.
Retreat, death, dropped cargo, and capacity rules remain expedition truth.

## Synthesis boundary

Synthesis preview is read-only and explicit:

```text
source lifecycle/value summary
recipient compatibility and saturation
allowed output choices
immediate grants
permanent exclusions: identity, memories, relationships, exclusive evidence
known witness/visibility rule
warning and formula versions
```

Commit atomically:

```text
validate source/recipient/chamber/confirmation
→ terminate source
→ emit synthesis receipt
→ submit bounded progression grant
→ create witness/absence evidence
→ publish social aftermath inputs
```

No synthesis output is a premium currency. No promotion requires synthesis. Exclusive knowledge is
lost unless previously shared or recorded. Repeated recipient/promotion-band saturation makes the
short-term return diminish.

## Settlement capability boundary

Settlement content defines building classes, modules, sectors, route templates, capacities, and
affordances. Runtime projects use:

```text
construction.project: proposed → funded → building → complete | paused | damaged
facility.instance: definition binding + modules + condition + staffing + power
sector.instance: topology binding + unlock proof + active route nodes
capability.grant: source instance + capability ID + revision
```

Suggested few building classes:

- habitat;
- production;
- training/research;
- recovery/social/civic;
- transit/ritual/defense.

Kitchen, dormitory, forge, training ground, infirmary, library, portal chamber, synthesis chamber,
shipyard, and similar facilities are definitions or modules within this small grammar. Completion
enables capabilities; the renderer does not.

Expansion adds a versioned sector instance or route overlay. It never changes the bytes or hash of
`hearth-01-v1`.

## Destination, airship, and neighbor boundary

Temporary portal worlds and persistent neighbors share expedition machinery but not persistence:

- portal: temporary opening, attempt-local cargo, expiring rules;
- neighbor: persistent destination ID, route knowledge, relation/treaty/trade receipts;
- tower: campaign floor/band state and frontier ownership.

An airship is both a settlement facility relationship and a vehicle asset:

```text
vehicleId · definitionHash · crew/cargo capacity · range
condition · modules · fuel/provision rules · dock location
```

Completing and provisioning it grants `neighbor-expedition`. A neighbor result cannot directly
mutate another settlement aggregate; it returns diplomacy, trade, recruit, knowledge, route, or
story receipts through typed commands.

## Mount boundary

Mounts are first-class non-hero entities with manifest, health, stamina, temperament, needs,
location, bond/training, tack/armor, and capability tags. Non-sapient mounts use deterministic
policies. Deployment reserves the mount and rider separately. `ride`, `carry`, and `evacuate` are
the first useful capability slice; breeding and intelligent/exotic mount agents are later scope.

## Story and evidence boundary

At campaign creation:

```text
campaign seed + ruleset + compatible approved envelope hashes
→ 20-band CampaignStoryPlan
→ global validation
→ campaign.story.instantiated + planHash
```

Validation proves 100 floors, causal reachability, progression/reward budgets, asset coverage,
recurrence payoff, secret dependencies, and Floor-100 compatibility. Runtime patches select only
eligible cataloged proposals. Facts stay separate from cast-bound voice.

World truth, Master awareness, and hero belief remain distinct. Narrative discoveries create
evidence only for explicit holders/witness sets. A hero cannot make a knowledge-backed party
recommendation from the Master-only projection.

## Scalable evidence and snapshot boundary

Prototype-sized inline collections must evolve before 1,000 heroes:

- evidence indexed by holder and source event;
- sparse relationship adjacency, never an all-pairs matrix;
- hash-bound `WitnessSetRef` records/chunks instead of fixed 32-ID arrays;
- partitioned aggregate/cohort snapshots with a composed run-root hash;
- deterministic batch catch-up events with inspectable per-hero receipts;
- materialized current projections backed by append-only provenance.

This preserves individual history while avoiding a whole social graph and whole-run JSON snapshot
rewrite after every ordinary action.
