# Five-head combat-chibi regeneration

This immutable contract scaffolds `five-head-chibi-regeneration-001`, a candidate-only run for the
200 owner-approved one-star heroes. It regenerates weaponless adult combat chibis at a target of
5.0 anatomical heads on `1024x1536` PNG canvases, using each selected summon portrait as the sole
generation reference.

`decision.json` freezes the source roster and upstream completion-report hashes, the exact prompt
template digest, thirteen wave sizes, and the 200-primary plus 10 provider-no-output-retry budget.
`scripts/contracts.py` supplies the fail-closed JSON, SHA-256, path-confinement, collision-safe
write, and prompt-rendering primitives used by later production work.

There is no pilot, review workflow, visual acceptance gate, or promotion in this run. Every valid
output remains an immutable candidate; later inspection or runtime promotion requires a separately
reviewed task.
