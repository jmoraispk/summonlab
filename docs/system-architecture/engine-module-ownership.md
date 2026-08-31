# Engine module ownership

This guide assigns the deterministic engine by source boundary. It preserves the public
`@summonlab/engine` and `@summonlab/contracts` entrypoints while keeping runtime dependencies
one-way:

```text
contracts/engine → engine/core → engine/domains → engine/orchestration → public facade → consumers
```

Exact command and event discriminators belong to the static command and event registries. Those
registries are the executable source of truth: this guide records ownership categories and seams,
not a second inventory that can drift.

## `contracts/engine`

**Owns.** Engine Zod schemas, state unions from v1 through v23, command and authoritative-event
contracts, scheduling/snapshot/replay contracts, and the compatibility re-export at
`packages/contracts/src/engine.ts`. It defines the shape of every engine command and event, but not
the runtime that accepts or reduces them.

**Allowed imports.** Contract-local schema leaves and schema dependencies such as Zod.

**Forbidden imports.** `@summonlab/engine`, engine runtime internals, application packages, and
content-policy decisions.

**Primary focused tests.** `packages/contracts/src/engine-compatibility.spec.ts` validates direct
leaf composition, historic state parsing, command union order, and the compatibility entrypoint.

**Integration consumers.** `@summonlab/engine`, database persistence, web and worker request
boundaries, policies, evaluation, and observability consume these contracts through public package
exports.

## `engine/core`

**Owns.** Deterministic state parsing and hashing, event metadata, verified content bindings,
version and capability predicates, and the shared command-handler/event-reducer ports. It owns no
feature command, feature event, or domain-state transition; it provides the stable types and
predicates those transitions use.

**Allowed imports.** `@summonlab/contracts`, reviewed content packages, sibling core modules, and
root deterministic helpers for hashes, entropy, time, and errors.

**Forbidden imports.** `domains/**`, `orchestration/**`, the public engine facade, and database,
web, worker, policy, or evaluation packages.

**Primary focused tests.** `packages/engine/src/core/core.spec.ts` covers every schema-version
predicate, state parsing/hash helpers, dispatch ports, and content-binding integrity.

**Integration consumers.** Domains use core ports and predicates; orchestration composes them;
the public facade exposes selected capability predicates and state hashing.

## `engine/domains/settlement`

**Owns.** Settlement navigation, facilities, travel, power, activities, daily routines, First
Ember, communication, conversation, directives, and simulation progression. Its command handler
and reducer own the settlement command/event families and the settlement, routine, travel, and
society portions of modern engine state.

**Allowed imports.** Contracts, core, root deterministic helpers, and sibling settlement leaves.

**Forbidden imports.** Other domains, orchestration, the public facade, and application packages.

**Primary focused tests.** `packages/engine/src/domains/settlement/settlement-domain.spec.ts` and
`packages/engine/src/domains/settlement/settlement-leaves.spec.ts` cover ownership, reducer
behavior, travel, routines, and society leaves.

**Integration consumers.** Orchestration registries and legal-action composition; public-facing
settlement, communication, conversation, directive, and First Ember flows consume the resulting
public engine API.

## `engine/domains/mission`

**Owns.** Mission preparation, party revisions, deployment, turns, extraction, retreat, Master
timing/fallback/safety/decision control, mission and attempt state, combat state, and portal state.
The mission command handler owns the Master-control and mission command families; its reducer owns
the non-composite mission event families. The exact discriminator allocation is enforced by the
orchestration registries.

**Allowed imports.** Contracts, core, root deterministic helpers, and sibling mission leaves.

**Forbidden imports.** Story, settlement, synthesis, orchestration, the public facade, and
application packages. The version-23 first-band consequence is intentionally composed outside both
mission and story.

**Primary focused tests.** `packages/engine/src/domains/mission/mission-control.spec.ts` and
`packages/engine/src/domains/mission/mission-runtime.spec.ts` cover Master control, command/event
ownership, lifecycle, first-band consequence ordering, and historical mission behavior.

**Integration consumers.** Orchestration command authorization, registries, reduction, and legal
actions; mission API routes and pages use public capability predicates and facade exports.

### Combat and portal

**Owns.** `combat.ts`, `monster-policy.ts`, and `portal.ts` own deterministic turn resolution,
monster intent, arena consequences, portal pressure, cargo losses, and portal extraction details.
They change mission/combat/portal event payloads only through the mission command handler and
mission reducer.

**Allowed imports.** Contracts, core content bindings, deterministic helpers, and mission action or
lifecycle types needed for resolution.

**Forbidden imports.** Lifecycle/Master-control mutation through orchestration, other domains, and
the public facade.

**Primary focused tests.** `mission-runtime.spec.ts` plus the combat, monster-policy, and portal
cases in `mission-control.spec.ts`.

**Integration consumers.** Mission command/event assembly and public mission presentation consume
their results through the mission domain, never by importing these leaves from an application.

### Lifecycle and Master control

**Owns.** `lifecycle.ts` owns party readiness, reservations, preparation, deployment, extraction,
and retreat state transitions. `master-control.ts` owns timing, fallback policy, safety stops,
decision windows, and fallback selection. Together they own the lifecycle and Master-control state
subtrees used by the mission handler.

**Allowed imports.** Contracts, core bindings, deterministic helpers, and sibling mission leaves.

**Forbidden imports.** Combat or portal code reaching into public authorization, other domains,
or orchestration.

**Primary focused tests.** `mission-control.spec.ts` and the lifecycle/Master-control cases in
`mission-runtime.spec.ts`.

**Integration consumers.** Legal-action composition and command authorization invoke this boundary;
the public facade exposes the Master fallback helpers needed by consumers.

## `engine/domains/story`

**Owns.** Story patch validation and application, runtime cast selection, first-band archive state,
archive recovery/reveal, and the story command/event families. It owns story and archive state,
but not mission lifecycle state.

**Allowed imports.** Contracts, core content bindings, deterministic helpers, root story validation,
and sibling story leaves.

**Forbidden imports.** Mission, settlement, synthesis, orchestration, the public facade, and
application packages. The mission/archive cross-domain transition is owned by an orchestration
composite rather than a domain-to-domain import.

**Primary focused tests.** `packages/engine/src/domains/story/story-domain.spec.ts` covers command
and reducer ownership, patch/archive behavior, and strict replay compatibility.

**Integration consumers.** Orchestration registries and the first-band composite; web story-patch
and archive surfaces use the public API and shared version predicates.

## `engine/domains/synthesis`

**Owns.** Irreversible hero synthesis, rumor propagation, synthesis receipts, readiness rules, and
the synthesis command/event families and state additions.

**Allowed imports.** Contracts, core metadata and ports, deterministic helpers, and sibling
synthesis leaves.

**Forbidden imports.** Settlement, mission, story, orchestration, the public facade, and
application packages.

**Primary focused tests.** `packages/engine/src/domains/synthesis/synthesis-domain.spec.ts` covers
command/event ownership, legal states, receipts, reducer checks, and replay behavior.

**Integration consumers.** Orchestration registries and authorization; synthesis pages, endpoints,
database proofs, and evaluation scenarios use only public engine exports.

## `engine/orchestration`

**Owns.** Static command and event registries, duplicate-discriminator rejection, the version-23
first-band mission/story composite, ordered legal-action composition, cross-domain authorization,
policy-command translation, bootstrap, command application, reduction, event outputs, and replay.
It owns the transaction order and registry allocation, while domains own the feature behavior
behind registered handlers.

**Allowed imports.** Contracts, core, all domain public leaves, root deterministic helpers, and
orchestration siblings.

**Forbidden imports.** The public facade and application packages. It must not duplicate domain
rules that a registered handler already owns.

**Primary focused tests.** `packages/engine/src/orchestration/registries.spec.ts`,
`packages/engine/src/orchestration/orchestration.spec.ts`, and
`packages/engine/src/orchestration/actions.spec.ts` cover registry totality, duplicate rejection,
transaction/replay behavior, and ordered actions. `packages/engine/src/module-boundaries.spec.ts`
enforces the import directions across the engine.

**Integration consumers.** The public facade exports apply, bootstrap, reduction, legal-action,
and replay operations; database command commits, worker jobs, web routes, policy translation, and
evaluation use that facade.

## Public facade and direct consumers

**Owns.** `packages/engine/src/engine.ts` is the 71-line export-only compatibility facade;
`packages/engine/src/index.ts` publishes it as `@summonlab/engine`. It owns no commands, events, or
state transitions. Consumers own their request, persistence, presentation, policy, or evaluation
logic—not engine internals.

**Allowed imports.** The facade may re-export intentional public symbols from core, domain, and
orchestration owners. Direct consumers import `@summonlab/engine` and `@summonlab/contracts`.

**Forbidden imports.** Internal production engine modules must not import the facade. Consumers
must not import `packages/engine/src/**` or a domain/orchestration implementation path.

**Primary focused tests.** `packages/engine/src/compatibility/public-api.spec.ts`,
`packages/engine/src/compatibility/replay-vectors.spec.ts`, and
`packages/engine/src/module-boundaries.spec.ts` protect the public export and black-box replay
surfaces.

**Integration consumers.** Database, worker, web, policies, evaluation, and observability are the
direct package consumers.

## Coordination and handoff rules

- Kernel changes coordinate schema, discriminator, registry, apply, or replay changes.
- A domain change stays inside its domain unless it changes a public contract.
- Combat changes use mission combat, monster-policy, and portal tests and coordinate lifecycle
  changes.
- Frontend code consumes `@summonlab/engine` and never imports package-internal engine paths.
- Every handoff states whether behavior changed, tests run, golden hashes changed, and migration
  needs.
