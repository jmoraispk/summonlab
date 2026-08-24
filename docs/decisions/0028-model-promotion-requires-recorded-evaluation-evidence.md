# ADR 0028: Model promotion requires recorded evaluation evidence

Status: accepted on 2026-08-24.

## Context

A cheap model is only cheap if it makes usable, legal decisions. A few hand-picked previews cannot
show whether personality remains distinguishable, a wound overrides ambition, a clean-slate hero
asks for context, witnessed orders influence without controlling, or hidden state stays hidden.
Wall-clock timings and token guesses are also easy to mistake for measurements when no provider
request occurred.

Summonlab needs one repeatable gate that runs without credentials in normal development and CI,
while leaving room for actual provider outputs to become auditable evidence later.

## Decision

- `agent-evaluation-corpus-v1` contains ten fixed, hash-bound `hero-decision-packet-v1` fixtures.
  The cases cover personality contrast, witnessed directive influence, injury-dependent mission
  behavior, clean-slate versus evidence-backed authority, cited witnessed memory, and legal secret
  discovery. Each case declares acceptable actions, public-output exclusions, citation rules, and
  contrast-pair invariants.
- Corpus generation uses real deterministic character minds, engine-v10 snapshots, witnessed
  communication where required, canonical legal actions, and existing packet integrity checks.
  The exported fixture contains no credentials or engine seed.
- Scripted and explicit-seed random policies run over the entire corpus in CI. The scripted policy
  is a positive zero-cost baseline; random is a structurally safe negative control. Grading checks
  packet/result bindings, result hashes, legal actions, target and memory boundaries, expected
  action fit, required memory citation, public knowledge exclusions, pair distinction, and exact
  output repetition.
- The planned OpenAI candidate records requested model `gpt-5-nano`, prompt and context versions,
  per-case request hashes, and a dated pricing snapshot. Until actual provider results cover every
  case, resolved model, latency percentiles, token usage, and quality are explicitly unmeasured and
  the model gate remains `insufficient-evidence`.
- The initial cost projection is an estimate, not provider usage: four input characters per token,
  the complete 800-token output cap, and prices observed on the official model page on 2026-08-24.
  The opt-in recorded-provider runner replaces estimates with returned model identity, usage,
  latency, output, and validation disposition without weakening the fixed corpus.
- `pnpm validate:agent-evaluation` regenerates both the corpus and report in memory and fails if the
  checked-in artifacts differ. `/debug/evaluations` is a development-only, zero-call evidence view.
- `pnpm record:agent-evaluation` is never part of CI. It requires both `OPENAI_API_KEY` and an
  explicit paid-run acknowledgement, evaluates all ten cases, and writes hash-bound local run and
  promotion reports under an ignored artifact directory. Partial or missing coverage cannot pass.

## Consequences

CI can detect accidental policy, prompt, packet, grader, or budget drift without an API key or paid
request. The current scripted baseline passes every intended case; the seeded-random control stays
legal but performs materially worse on expected behavior. This validates the evaluator's ability
to distinguish safe structure from useful agency.

The report does not claim that GPT-5 nano is good enough, fast enough, or exactly as cheap as the
estimate. Model promotion remains blocked until an explicit paid recording covers the full corpus.
The ten cases are a first policy-isolation suite rather than mission balance or narrative-quality
coverage; those dimensions expand with Phase 6 content.

## References

- [GPT-5 nano model and pricing](https://developers.openai.com/api/docs/models/gpt-5-nano)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
