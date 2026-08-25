# ADR 0039: Foundry strategies are replay regressions

Status: accepted

Date: 2026-08-25

## Context

Floor 05 already exposed a direct route, retained Floor 04 knowledge, two cooling-wheel stages, and
furnace-linked Warden armor. Those mechanics had isolated tests, but no executable proof showed
that complete companies could prepare, choose materially different routes, survive, extract, and
replay the result. A hand-authored walkthrough would not prove that every step remained legal.

## Decision

- Add a credential-free `foundry-strategy-report-v1` generator that executes only authoritative
  engine commands and strictly replays every resulting event stream.
- Define three strategy doctrines: the four-hero Hammer Line keeps the furnace lit and rotates its
  exposed front; Split Cooling uses retained route memory and one wheel stage; Full Quench accepts
  a second control exposure to remove all Warden armor.
- Exercise each doctrine on eight fixed successful regression seeds. Require 24 successful
  extractions, zero deaths, zero replay mismatches, and the intended `lit`, `cooling`, or `quenched`
  state at Warden defeat.
- Label the matrix honestly: it proves reproducible viable paths, not population win rates or
  balance probabilities. Future balance work must sample an independently defined seed population
  and retain failures.
- Allow the development bootstrap to create up to four heroes and to carry an explicit Floor 04
  route-memory fixture. The full bootstrap state remains in the first hashed event, so the fixture
  is replayed rather than injected after initialization. Production summoning is unchanged.
- Publish the machine-readable report and the development-only `/foundry-trials` comparison page.
  The page reads the checked artifact and never mutates a run or calls a model.

## Consequences

Floor 05 now has three complete legal proofs whose preparation, route, combat cost, survival, and
return are inspectable. The matrix also exposed a separate lifecycle defect: v16/v17 aftermath is
described as attempt-level but can carry old round-numbered consequences into a later attempt. That
repair requires a versioned consequence boundary and is scheduled as `MIS-010A`; the focused Floor
05 matrix uses an explicit replayed memory fixture rather than masking the defect.
