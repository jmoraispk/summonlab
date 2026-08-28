# 0053 — Private packaging fails closed on human evidence

**Status:** accepted, amended by ADR 0054
**Date:** 2026-08-25

## Context

FIN-007 deliberately starts with a useful but empty human-feedback protocol. Build success,
automated browser journeys, zero recorded findings, or an editable dashboard must never be misread
as the owner's reviewed playthrough or as permission to package FIN-008. The eventual archive also
needs a reproducible identity and a privacy boundary.

## Decision

- Derive `playtest-release-report-v2` from the parsed FIN-007 report and independently recompute its
  canonical hash. A stale or hand-edited upstream report is a hold.
- Require the single owner playthrough, all eight owner-journey checkpoints observed, FIN-007
  recommendation `candidate`, and zero unverified P0/P1 findings. Friends remain an optional later
  validation round rather than a current packaging prerequisite.
- Treat `held` as a valid checked state. The development `/playtest-release` desk names every blocker
  and explicitly says that no package exists.
- Require the operator-only `--acknowledge-private-release` flag and clean tracked inputs. Only then
  may packaging run the production build and create the private archive.
- Produce an ignored local receipt containing the exact commit, archive SHA-256 and bytes, and
  release-report hash. Readiness evidence alone is not an artifact receipt and cannot complete
  FIN-008.
- Exclude participant identity, recordings, quotes, raw notes, secrets, development evidence, and
  source artwork from the archive.
- Prune source maps plus PNG/JPEG development-route artwork from the staged SvelteKit build, then
  reject forbidden entries after tar assembly and before issuing any receipt.
- Exercise the exact staging/archive core in a distinct rehearsal mode. Rehearsal must use a
  non-canonical archive name, a typed `rehearsal` receipt, temporary storage and database state,
  frozen production install, migrations, and web/worker health checks. It always remains
  `releaseEligible: false` regardless of mechanical success.

## Consequences

The current 0/1 state remains visibly held even though its evidence and tests pass. Once the owner's
real playthrough clears FIN-007, the same path can assemble a commit-bound runtime package. A
separate clean extraction/install/migration/start smoke test remains the final FIN-008 verification;
this ADR does not claim that artifact exists today.

Package mechanics are no longer deferred until the owner journey is qualified: unit tests prove
deterministic built-only archives and CI exercises a clean install plus both runtime processes. That
reduces release-day uncertainty without weakening or simulating the human gate.
