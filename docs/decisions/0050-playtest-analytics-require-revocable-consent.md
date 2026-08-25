# 0050 — Playtest analytics require revocable consent

**Status:** Accepted
**Date:** 2026-08-25

## Decision

FIN-006 adds first-party journey analytics only after explicit, informed, adult playtest consent.
The game remains fully playable when the player declines or leaves the choice undecided. Those two
states make no analytics request and create no server consent record. Consent is optional,
versioned as `playtest-consent-v1`, limited to the `playtest-analytics-v1` purpose, and expires after
30 days.

A grant returns a 256-bit withdrawal capability to local storage; the database retains only its
SHA-256 hash. The capability authorizes event submission, a retained-count summary, and withdrawal
for that one consent. Withdrawal deletes every associated session and event immediately, replaces
the grant with a non-identifying tombstone, and invalidates the capability. Expiry performs the
same deletion. This capability is a local-private-playtest control, not account authentication; a
hosted playtest still requires the private invite and owner scoping described in the implementation
plan.

Analytics is a closed discriminated union, not an extensible property bag. It accepts only:

- player-route views;
- campaign start;
- the three onboarding milestones;
- Hearth entry;
- pause opening;
- campaign restart; and
- bounded reconnect completion timing.

Each event may contain its random event/session IDs, the consenting campaign run ID, a coarse
phone/desktop category, a player-route category, and the fields declared for that event. Strict
schemas and matching database checks reject additional properties. The application does not store
names, campaign seeds, questions, hero replies, arbitrary feedback text, IP addresses, user agents,
advertising identifiers, or third-party analytics cookies. Qualitative moderated-test notes remain
outside this event store and require their own disclosed process.

These records are replay-adjacent presentation observations. They never submit engine commands,
change campaign metadata, become canonical events, or influence deterministic replay. The
development-only `/playtest-report` projection contains aggregate counts and a cohort funnel; it
does not return consent capabilities, individual sessions, run IDs, event timestamps, or event
payloads.

## Consequences

- Product instrumentation cannot silently grow by adding arbitrary JSON keys. A new event or field
  requires a contract, notice, migration/check, test, and documentation review.
- A declined or undecided browser is a tested zero-analytics path, not merely a UI state.
- Moderators can see where consenting sessions stop without reading what a participant typed or
  inspecting an individual history.
- A lost browser capability cannot be reconstructed from the database. This deliberately favors
  participant control and data minimization over administrative recovery.
- Aggregate counts may include sessions that consented after an earlier funnel stage; the report's
  funnel includes only sessions that contain the complete ordered prefix and remains monotonic.
- FIN-007 may collect five moderated sessions and triage observations, but it may not reinterpret
  this consent as permission for recordings, raw notes, provider prompts, or hosted public access.
