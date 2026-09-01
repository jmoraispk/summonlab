# 0062 — Wiki inventory is separate from release availability

**Status:** Accepted

**Date:** 2026-08-29

## Context

The wiki must preserve the complete intended game design even when the first playable release uses
only a small subset. Removing Alchemy, Beast Taming, crafting, society, or story from the Living
Village implementation could otherwise make those systems disappear from shared context, while
including their pages could be misread as a requirement to implement them immediately.

## Decision

- The wiki is the complete design inventory. Owner-supplied systems, mechanics, catalogs, examples,
  conflicts, and parked ideas remain in their owning pages with honest design status.
- A release roadmap separately declares whether each documented capability is `on`, `off`,
  `placeholder`, or `decision` for that named release.
- `off` means intentionally unreachable in that release. It does not mean rejected, deleted,
  superseded, or undocumented.
- Disabled skill families remain in the skill catalog, but summon generation, rewards, training,
  UI actions, and runtime policies cannot grant or invoke them in that release.
- Release scope changes update the matrix and its versioned executable allowlist. They do not rewrite
  the underlying design page unless the design itself changed.
- Implementation and visual status remain separate from release availability. A documented or
  illustrated feature may be off; an enabled feature may still be incomplete and therefore fail the
  release gate.

## Consequences

Workers can develop complete text and art ahead of runtime implementation without expanding the
first release accidentally. The Living Village can focus on summoning, direct hero training, and
missions while Alchemy, Forging, Cooking, Gathering, Knowledge, animal taming, skill merging, and other
systems remain discoverable and assignable as future work. A release validator can later reject any
disabled skill or feature that becomes reachable through generation, rewards, UI, or replay.
