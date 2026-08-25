# 0047 — The campaign shell is replay-adjacent

**Status:** Accepted
**Date:** 2026-08-25

## Decision

The player-facing campaign journey wraps an authoritative engine run without becoming a second
source of game truth. Campaign registration stores the seed, three stable generated hero drafts,
control preference at creation, lifecycle, onboarding step, and restart lineage beside the engine
event stream. The four-beat prologue may advance presentation metadata, but every hero answer and
the first destination remain canonical engine commands and events.

Objectives are a versioned projection over campaign metadata plus the exact `engine-v13` snapshot.
Engine accomplishments come only from canonical state; the projection carries the snapshot state
hash and its own deterministic hash instead of persisting duplicate completion flags.

Pause stops player interaction only. It does not pause or rewrite the server-owned settlement
clock. Reading scale, motion preference, and Wait/five-second handoff preference are device-local
interface settings and never enter replay state.

Restart creates a new engine run and campaign registration. A same-seed restart regenerates the
same three identities, links the new run to its predecessor, and marks the predecessor superseded.
It never deletes, truncates, or rewrites the prior append-only chronicle, which remains available to
the replay verifier.

## Consequences

- A campaign page may resume onboarding or normal play from campaign metadata, but game legality and
  consequences still come exclusively from the engine boundary.
- Opening the pause menu may refresh its projection; onboarding also passes updated projections to
  the persistent objective chip so its current objective changes immediately.
- Closing the browser, opening settings, or pausing the interface cannot stop settlement catch-up.
- A restart can safely change device-local control preference while preserving deterministic hero
  identity for the selected seed.
- Campaign registration currently follows proof-run creation. Registration failure can therefore
  leave an unlisted proof run, but it cannot supersede or corrupt the prior chronicle; making that
  two-stage creation atomic is a separate reliability improvement.
