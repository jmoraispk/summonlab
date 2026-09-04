# One-star overnight 200 production envelope

This directory is an experiment-local, candidate-only image-production boundary. It does not use
or claim authorization from the enemy affinity schemas or dispatch gate.

Each image has an immutable target, hash-bound assignment, exclusive candidate path, and exclusive
result path. Summon and combat-chibi images are separate jobs. A chibi cannot be dispatched until
its target binds a valid summon candidate and result by raw SHA-256.

Visual corrections never overwrite a candidate. They receive a new target version and new output
paths, with the preceding candidate declared as a hash-bound `correction-source`. An assignment's
`retryCeiling` applies only to provider failures that returned no image.

The scripts require Python 3.11 or newer and use only the standard library. Run the local contract
tests with:

```bash
python3 -m unittest discover \
  assets/heroes/experiments/one-star-overnight-200-001/tests -v
```

Producers may write only their assignment's candidate and result paths. Roster plans, production
reports, journals, review pages, catalogs, wiki pages, and repository history remain coordinator
owned.

`production-report.json` is the immutable wave-03 checkpoint report. The completed 200-pair run is
summarized in `completion-report.json`, including the final review-manifest binding and the disclosed
production-budget overrun. The budget gate remains strict in `scripts/validate_experiment.py`; asset
completion does not erase or redefine that operational failure.
