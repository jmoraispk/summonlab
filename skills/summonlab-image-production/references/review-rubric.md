# Authoring review rubric

Inspect the full-resolution image before retaining it. Record each dimension as `pass`, `concern`,
or `fail` with a concise observation.

## Dimensions

1. `canvasCompletion`: the entire canvas is rendered; no blank band, unpainted region, or abrupt
   cutoff.
2. `framing`: the entire subject and all extremities remain within the declared safe margin.
3. `subjectCount`: exactly one featured subject and no accidental duplicate.
4. `speciesCueStrength`: the known target retains strong species cues. True recognition is measured
   later through a label-hidden human review.
5. `affinityCueStrength`: the known affinity has strong construction cues beyond hue. True
   recognition is measured later through a label-hidden human review.
6. `affinityIntegration`: at least two meaningful construction dimensions changed.
7. `anatomy`: limb plan, joints, contact, weight, and equipment grip are coherent.
8. `battlefieldDuty`: pose, equipment, and telegraph communicate the declared combat role.
9. `manifestFidelity`: every target invariant and compound-variation attribute is present.
10. `styleCohesion`: the target's declared pack style, material, lighting, floor, and finish remain
    coherent.
11. `constraintSafety`: no prohibited text, UI, watermark, extra subject, or sexualization is
    visible. Originality and resemblance remain human-review judgments.

## Decision

- Retain as `candidate` only when every required objective authoring criterion passes. Human-only
  criteria remain pending rather than being guessed by the producing agent.
- Use the one permitted correction when a specific defect can be changed without redesigning the
  target.
- Return `revise` when the retained image remains useful for review but still fails a visual gate.
- Return `failed` when generation, persistence, provenance, or verification fails.

Do not hide a failure because an image looks generally impressive. Coolness, glow, detail, or scale
cannot compensate for the wrong species, wrong affinity, cropped anatomy, or missing provenance.
