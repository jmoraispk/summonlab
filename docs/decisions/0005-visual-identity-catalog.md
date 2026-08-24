# ADR 0005: Generated art derives from versioned identity profiles

Status: accepted on 2026-08-23.

## Context

Character generation, painted anchors, compact rigs, expressions, equipment, injury, roster cards,
and settlement sprites can drift into different people. Putting generated-image details back into a
gameplay manifest would also let art generation redefine authoritative identity.

## Decision

- The deterministic character manifest remains physical identity truth.
- `human-v1` stays replayable; new Forge recipes use `human-v2`, which adds deterministic physiology
  without changing v1 bytes.
- A separate versioned visual profile binds one manifest hash to identity locks, expression states,
  equipment anchors, injury placement, and palette swaps.
- Every generated bitmap receives a catalog record with provenance, final prompt, references,
  dimensions, byte count, SHA-256, status, and explicit recognition checks.
- Generated images begin as approval candidates. A human gate changes status to approved; generation
  alone never approves itself.
- Settlement-scale art may rely on silhouette, hair, palette, and signature clothing. It must not
  claim facial recognition when the face is below useful resolution.

## Consequences

The same person can be audited across assets without changing game state. Art can be regenerated or
rejected independently from the manifest. Source PNGs remain deliberately unoptimized during the
approval gate; approved assets will receive layered runtime exports and compressed bundles before
shipping.
