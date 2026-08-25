# ADR 0036: Portal cargo is attempt-local until extraction

Status: accepted

Date: 2026-08-24

## Context

The Iron Moon is a temporary resource world. Treating mining as an immediate settlement resource
change would let ore survive a collapsed portal, make retreats profitable, and allow the browser to
display resources the event stream never actually delivered. A wall-clock timer would also make
replay depend on machine timing instead of the submitted action history.

## Decision

- Bind the authored `iron-moon-v1` portal wrapper and its inner mission package by SHA-256. Normal
  Floor 01 histories remain on `engine-v13`; the explicit Iron Moon development run uses
  `engine-v15`.
- Give every attempt exactly eight engine-owned rounds. Resolving one complete party round consumes
  exactly one timer unit and derives stable, warning, critical, or collapsed pressure from the
  remaining count.
- Keep authored deposits finite. Mining moves a declared amount from one deposit into one actor's
  bounded attempt-local cargo and appends a provenance-complete ore entry.
- Count the quota from successfully mined ore, but open extraction only when the quota is met, the
  complete party is at the portal scar, and more than one round remains. Crossing the portal is a
  separate command, so returning on the final round is too late.
- Change settlement iron only in the extraction event. That event empties each actor's cargo,
  appends extracted entries, and applies one matching settlement resource delta atomically.
- Collapse and retreat empty cargo into explicit lost entries without changing settlement stock.
- Recompute the timer, positions, deposit amounts, cargo, ore ledger, outcome, and resource delta
  during strict replay.
- Include the remaining timer, pressure, quota progress, personal cargo, capacity, and finite
  deposit state in each participating hero's independent decision packet.

## Consequences

The portal produces real tension without relying on network or rendering latency. Ore cannot be
duplicated, credited early, or rescued from a failed history. Autonomous heroes can reason about
the same bounded pressure the player sees while still choosing only from legal engine actions.
Later portal worlds may reuse the cargo boundary, but injuries, equipment damage, death, and social
aftermath remain separate authoritative transitions owned by `MIS-008`.
