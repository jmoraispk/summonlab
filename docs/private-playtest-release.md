# Private playtest release

`FIN-008` is a human-gated private package, not a deployment shortcut. The checked
`playtest-release-report-v2` derives four claims from the hash-bound FIN-007 report:

1. the FIN-007 content still matches its report hash;
2. the single owner playthrough is recorded and reviewed;
3. all eight required owner-journey checkpoints were reached;
4. the release recommendation is `candidate` with no unverified P0/P1 finding.

Run `pnpm validate:playtest-release` at any time. A held report is valid evidence: it explains why
packaging is forbidden. It does not mean FIN-008 is complete.

## Package rehearsal

Run `pnpm rehearse:playtest-package` before the owner playthrough is complete. Rehearsal uses the
current held report only as an assembly input and is structurally separate from release
authorization:

- its receipt mode is `rehearsal`, never `release`;
- its archive is named `summonlab-fin008-package-rehearsal.tar.gz`, while the receipt schema reserves
  the canonical private-playtest name for release mode;
- it reports `releaseEligible: false` and the real source status (`held` today);
- it writes everything beneath a temporary directory and deletes the archive, extraction, and
  temporary database after the checks finish.

The rehearsal production-builds the workspace, creates and verifies the deterministic archive,
extracts it, performs a frozen production-only install, migrates a newly created database, starts
the extracted web and worker processes, and requires both `/health` responses to report the tested
commit and an available database. It also renders the extracted player title and requires the
development release desk to return 404. A dirty local run says `sourceTreeStatus: dirty` and
`commitBound: false`; CI rehearses a clean checked-out commit after the production build.

## Packaging procedure

After an owner retest reaches every checkpoint, Codex updates the checked owner evidence, fixes and
verifies every P0/P1 finding, and commits those inputs:

```sh
pnpm check
pnpm export:playtest-release
git add packages/evaluation/fixtures/moderated-playtest-cohort-v1.json \
  docs/evidence/phase-7-fin007-moderated-playtest.json \
  docs/evidence/phase-7-fin008-playtest-release.json
git commit -m "test(playtest): verify owner journey"
pnpm package:playtest --acknowledge-private-release
```

The command fails before a production build when the report is held, has been edited without
rehashing, lacks explicit acknowledgment, or has uncommitted tracked inputs. Once qualified, it
builds the web server, worker, and workspace packages; stages only the runtime build, migrations,
locked manifests, environment example, and this runbook; removes source maps and development-lab
PNG/JPEG artwork from the staged web build; rejects forbidden archive entries; and writes these
ignored local outputs:

- `artifacts/private-playtest/summonlab-fin008-private-playtest.tar.gz`;
- `artifacts/private-playtest/fin008-private-playtest-v1.receipt.json`.

The receipt records the exact Git commit, archive bytes, SHA-256, and release-report hash. FIN-008
completes only after the archive exists, the receipt verifies, and the private operator performs a
clean extraction/install/migration/start smoke test.

## Privacy and operation boundary

The archive excludes participant identities, recordings, direct quotations, raw feedback, local
secrets, development evidence, and unoptimized source artwork. Copy `.env.example` to `.env`, set
private credentials and URLs outside the archive, install the frozen workspace dependencies, apply
the database migrations with `pnpm --filter @summonlab/database migrate`, and start the web server
with `node apps/web/build` plus the worker with `pnpm --filter @summonlab/worker start` under the
private operator's process supervisor. Do not publish the archive or its environment.

To verify delivery after copying the archive:

```sh
sha256sum summonlab-fin008-private-playtest.tar.gz
tar -tzf summonlab-fin008-private-playtest.tar.gz
```

The checksum must equal the receipt before extraction. Keep the receipt with the session's release
record; do not put raw participant material beside it.
