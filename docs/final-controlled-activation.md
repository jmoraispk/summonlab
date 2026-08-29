# Final-controlled activation

The final-controlled manifests remain inert until the human blind review and every recorded design-risk resolution authorize activation. Check the current evidence without writing anything:

```sh
pnpm report:affinity-final-controlled-activation
```

An authorized report is necessary but is not itself an activation token. The activation command reloads and validates the evidence twice, including once while holding its exclusive lock. Live activation requires a deliberate acknowledgement:

```sh
pnpm activate:affinity-final-controlled-rerun -- --acknowledge-live-manifest-activation
```

The writer overlays the human-approved staged targets on the derived 24-target plan, regenerates all 24 assignments from those exact targets, rejects any of the 96 planned target, assignment, candidate, or result paths that already exist, and refuses symlinked destination ancestors.

Activation is a receipt-last logical transaction. A durable intent and immutable payloads are written before live manifests. Interrupted work is recovered by removing only files linked from that transaction (or listed in its published journal) whose hashes still match. The final receipt is linked into place only after all 48 manifests pass schema and hash verification. Once that receipt exists, rerunning is idempotent only while every receipt-bound artifact remains intact; drift is a hard failure.

The receipt schema and verifier are exported from `tools/activate-final-controlled-rerun.ts` so completion checks and future exact-round Forge aggregators can bind to one activation cohort without mixing baseline and final-controlled evidence. Activation never authorizes breadth generation.
