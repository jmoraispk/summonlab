# 0049 — Phone budgets bind delivery artifacts and browser evidence

**Status:** Accepted
**Date:** 2026-08-25

> **Superseded in part:** ADR 0065 replaces the code-native hero fallback described below. The
> delivery and browser budgets remain accepted.

## Decision

FIN-005 treats phone performance as two linked evidence classes. Deterministic artifact gates own
encoded JavaScript and visual bytes; a real Chromium journey owns shell readiness, reconnect,
interface response, frame cadence, and a renderer working-set reference. Neither class may stand in
for the other.

The target browser profile is 390×844 at device scale factor 2, with 150 ms latency, 200,000 bytes/s
download, 93,750 bytes/s upload, and 4× CPU slowdown. It creates and completes a real seeded
campaign through public application endpoints, then measures the title and an arrived Hearth 01
route. The browser test must meet the documented four-second shell and reconnect bounds, 150 ms
local interface response, stable 30 FPS minimum, 700 KB compressed initial JavaScript, 8 MB first
settlement visuals, and 300 MB renderer-memory reference.

`phone-performance-report-v1` records a reviewable local run. `pnpm validate:phone-performance`
binds its deterministic measurements back to the current web-build report, phone-title manifest,
and Hearth scene definition. Hosted CI repeats the full throttled journey instead of accepting the
checked-in timing sample as proof.

The original title source remains the review authority, while `player-visual-exporter-v1` produces
content-addressed 832 px phone and 1681 px desktop WebP delivery variants with encoded and decoded
budgets. The title uses responsive selection and eager high-priority loading because it is the
largest visible element. Hearth reuses an approved purpose-sized dialogue portrait when one exists;
otherwise it keeps the code-native hero rig. Source PNGs are not player-route delivery assets.

The renderer working-set reference is deliberately limited to Chromium's JavaScript heap plus the
decoded RGBA size of loaded images. It is deterministic enough for regression detection, but it is
not a claim about native browser, GPU, or operating-system memory. The implementation plan's real
device review remains required before release packaging.

## Consequences

- A passing compressed build no longer implies that phone interaction, reconnect, frame cadence,
  or image selection passed; the browser journey must pass independently.
- A passing checked-in report cannot hide stale asset or JavaScript measurements. Exact artifact
  disagreement fails `pnpm check` before browser testing.
- Changing the target profile, any budget, or the working-set methodology requires a versioned
  contract change and refreshed evidence rather than silently moving a threshold.
- The browser-ready performance mark is presentation telemetry only. It submits no commands,
  persists no campaign data, and never enters replay state.
- Real phone testing may still reveal thermal, GPU, browser-chrome, or memory behavior that desktop
  emulation cannot represent; those findings belong in FIN-007 triage.
