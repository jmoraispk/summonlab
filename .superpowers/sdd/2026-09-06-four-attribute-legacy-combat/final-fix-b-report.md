# Foundation final-review fix B — truthful v25 follow and mission readiness

## Status

The real character-v2 summon path now continues through the existing **Follow to…** CTA into a
usable v25 settlement projection and from there to Floor 01. Mission preparation uses one
engine-owned readiness result, so an away or busy hero is disabled, deselected, never labeled
`READY`, given a public reason, and cannot be submitted by the UI into a predictable 409.

An eligible away hero can return through a bounded v25-only mission-assembly request. The request
commits the existing legal route to `gate-dais` and the existing scheduled arrival advance in one
atomic command batch. It does not teleport, mutate a database location directly, or choose any
combat action. Legacy automatic combat remains operator-owned and advances normally after return.

## Review round 1 — approved character art on the reachable v25 mission

The newly reachable v25 tactical board now requests the summoned hero's exact `combat-chibi` from
the same immutable runtime-manifest binding used by the approved roster. The route renders that
approved raster directly; it no longer turns the hero's initial into a tactical character token.

No canonical approved asset binding exists for the Master, Chain Watch, or Ember Hauler. Generic
combat studies and experimental enemy art were therefore not repurposed. V25 presents those slots
as a shared, plainly labeled **Art pending** archive record with no image role, glyph, silhouette,
emoji, SVG, or CSS anatomy. The Master roster card uses the same honest absence state. Existing
v1–v24 token branches remain unchanged, and the server projects `heroCombatChibi` only for v25.

The character-art regression was test-driven in two layers:

- RED: the component test failed because the honest missing-art component did not exist; after that
  component passed, the public browser route failed because no `hero-combat-art` was rendered.
- GREEN: the component render proves the missing state has a label and no depiction markup. The
  browser flow independently derives the expected hero/path from the approved source catalog and
  runtime manifest, then proves the live `<img>` has that exact path and approved binding. It also
  proves every unbound v25 slot is a missing-art record and that the legacy `.actor-token`,
  `.monster-token`, and `.master-portrait` substitutes are absent from the v25 DOM.

## Review round 2 — null-art boundary and active browser contracts

The roster's resolved and unresolved states now pass through `MissionHeroRosterArt`. When a v25
portrait cannot resolve, this boundary renders `CharacterArtMissing`; it has no image role, star
glyph, or decorative CSS character fallback. `HeroArtPlaceholder` remains reachable only through
the component's explicit historical presentation branch. The rendered test failed RED while the
boundary did not exist and passes GREEN for both the strict v25 absence and retained legacy branch.

The two stale active browser contracts now reflect their real product purpose. `mission.e2e.ts`
creates a current public v25 run, binds the actual public identity to the approved source/runtime
manifests, verifies roster and combat assets, verifies the entropy-bounded three-to-four monster
duty set, advances legacy automatic combat, and checks reload persistence. It no longer asserts the
retired fixed Mara identity or historical manual-turn controls. `master-game-over.e2e.ts` retains
its historical v17 fixture while checking current **Health** terminology and the actual public
sealed-replay evidence.

## Root causes and repaired seams

1. The summon CTA correctly linked to `/play/:runId`, and the proof arrival writer already used real
   engine travel plus scheduled advance. The play loader, however, projected settlement state only
   through v13. V25 therefore fell back to the static walking composition even after authoritative
   arrival. The shared settlement projector and play loader now admit v25, and the v25 play header
   exposes the canonical Floor 01 route.
2. The mission roster derived `READY` and selection from `lifeState` alone, while mission preparation
   rejected terminal, traveling, active, routine-bound, forging, assigned, or away heroes. The
   extracted engine readiness owner now drives both `assertMissionPartyReady()` and the strict public
   readiness DTO. V25 additionally requires the exact `gate-dais` node; v1–v24 acceptance remains
   unchanged.
3. A living idle v25 hero away from the threshold had no production-authorized route back. The new
   empty-body endpoint infers the manifest-bound hero server-side, confirms the readiness result and
   legal `hero.travel.gate-dais` action, preflights real engine travel, then atomically commits travel
   and its scheduled arrival. The travel event records internal `mission-readiness` context and a
   public summary beginning “At the Master's request…”.
4. V25 inherited Floor 03 presentation copy because it includes later aftermath and Master-risk
   mechanics. The route now gives character-v2 its own Floor 01/operator-bound labels, tower number,
   deploy copy, and footer without changing the existing Field Archive visual system.
5. Mission actor pools are now labeled **Health**. Vitality remains the character attribute, not the
   health-pool label.

ADR 0072 records the beta ownership assumption: the Master may request mission-assembly return as
settlement direction, but cannot interrupt conflicting work or control combat action/target/policy.
Future idle or agent-readiness work may introduce a compliance/scheduling decision without
rewriting this history.

## RED evidence

- `mission-readiness.spec.ts` initially failed because no readiness owner existed and the same file's
  v25 settlement fixture was rejected by `projectSettlementPresentation()`.
- The public readiness tests initially failed at module resolution because there was no strict public
  mission-readiness constructor.
- The endpoint tests initially failed at module resolution because no production return route
  existed.
- The first browser run reached the new return successfully but showed `STAY`: selection was restored
  before refreshed readiness arrived, so the legality effect correctly cleared it. Restoring
  selection after `invalidateAll()` repaired the reactive ordering.
- Browser inspection then exposed the inherited Floor 03 label on this Floor 01 v25 route. A route
  assertion now guards the operator-bound Floor 01 copy.

## GREEN implementation

- `missionHeroReadiness()` and `missionPreparationReadiness()` return stable engine reason codes and
  own the preconditions used by the mission assertion.
- `projectMissionReadinessForPublic()` maps only those codes into an exact DTO containing
  `canPrepare`, `partyReason`, and one hero's ID/status/reason/select/return booleans. It does not
  spread authoritative state.
- `POST /api/runs/:runId/mission-readiness` accepts only `{}`, only serves v25, infers the hero, and
  returns the same five-field minimal public engine receipt used by other mutations. Tests assert no
  state or event payload crosses the response.
- The return context is accepted only for v25, only when targeting `gate-dais`, and only with the
  server-owned system/null-timing source. Historical travel commands omit the optional field and
  keep their existing summaries and replay behavior.
- The roster presents `UNAVAILABLE` plus a concise reason for illegal heroes and disables selection
  and preparation. Only the away-and-legally-travelable case exposes **Request return**. Busy heroes
  cannot invoke it.
- The real primary CTA, v25 living settlement, Floor 01 link, recovery path, mission prepare/deploy,
  one legacy automatic round, and reload persistence are exercised without direct route setup. A
  second browser case covers a wait-mode hero who is already directly ready.

## Browser and design evidence

The focused Playwright flow built the production app and passed 2/2 cases. It created runs only
through the public API, clicked the visible summon CTA, waited for the real arrival, used the visible
Floor 01 and recovery controls, advanced automatic combat, and reloaded at the same version and
resolved round.

Temporary review screenshots from the passing run:

- `/tmp/final-fix-b-away.png` — Floor 01, `UNAVAILABLE`, public away reason, disabled roster lock,
  and the bounded return affordance.
- `/tmp/final-fix-b-ready.png` — return complete, `READY`, enabled roster lock, public success status,
  and the replay journal's travel/arrival evidence.
- `/tmp/final-fix-b-combat.png` — operator-bound v25 Floor 01 after a persisted legacy automatic
  round.
- `/tmp/final-fix-b-art-desktop.png` — desktop v25 tactical board with the approved hero chibi and
  labeled Master/enemy art gaps after one automatic round.
- `/tmp/final-fix-b-art-mobile.png` — 390×844 v25 mission capture after deployment; the approved
  hero art is visible and the document has no horizontal overflow.

Visual inspection confirmed the existing Field Archive hierarchy, Georgia display role, fine rules,
gold/teal status language, approved raster hero art, visible disabled state, and no new parallel
design system. The installed `frontend-design-premium` package still contains only `SKILL.md`; its
referenced audit resources/scripts are absent, so the maintained `apps/web/DESIGN.md` and visual
browser review were used as the documented fallback.

## Verification

- `pnpm --filter @summonlab/contracts test` — 14 files, 119/119 passed.
- `pnpm --filter @summonlab/engine test` — 30 files, 321/321 passed, including frozen historical
  compatibility and replay vectors.
- `pnpm --filter @summonlab/web test:unit` — 38 files passed, 1 skipped; 186/186 executed tests passed.
- Review-round rerun: 39 files passed, 1 skipped; 187/187 executed tests passed.
- Review-round-2 rerun: 40 files passed, 1 skipped; 189/189 executed tests passed.
- `pnpm --filter @summonlab/web test:e2e -- foundation-final-fix-b.e2e.ts` — 2/2 passed.
- `pnpm --filter @summonlab/web test:e2e -- mission.e2e.ts` — 1/1 passed in isolation.
- `pnpm --filter @summonlab/web test:e2e -- master-game-over.e2e.ts` — 1/1 passed in isolation.
- Contracts and engine TypeScript checks — passed.
- Web Svelte/TypeScript check — 0 errors and 0 warnings.
- Engine and web ESLint — passed.
- Production web build — passed as the Playwright web-server precondition; only existing optional
  Sharp-resolution and large-chunk warnings were emitted.
- `git diff --check` — passed.

No blocking seam remains in this slice. Agent-controlled readiness/compliance remains deliberately
deferred to the separately accepted agent-readiness plan.
