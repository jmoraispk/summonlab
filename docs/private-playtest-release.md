# Private playtest release

`FIN-008` is a human-gated private package, not a deployment shortcut. The checked
`playtest-release-report-v1` derives four claims from the hash-bound FIN-007 report:

1. the FIN-007 content still matches its report hash;
2. all five de-identified moderated sessions are recorded;
3. every assigned task was actually attempted and all twelve task families have coverage;
4. the release recommendation is `candidate` with no unverified P0/P1 finding.

Run `pnpm validate:playtest-release` at any time. A held report is valid evidence: it explains why
packaging is forbidden. It does not mean FIN-008 is complete.

## Packaging procedure

After the moderator updates the sanitized cohort fixture, exports FIN-007, fixes and verifies every
P0/P1 finding, and commits those inputs:

```sh
pnpm check
pnpm export:playtest-release
git add packages/evaluation/fixtures/moderated-playtest-cohort-v1.json \
  docs/evidence/phase-7-fin007-moderated-playtest.json \
  docs/evidence/phase-7-fin008-playtest-release.json
git commit -m "test(playtest): verify moderated cohort"
pnpm package:playtest --acknowledge-private-release
```

The command fails before a production build when the report is held, has been edited without
rehashing, lacks explicit acknowledgement, or has uncommitted tracked inputs. Once qualified, it
builds the web server, worker, and workspace packages; stages only the runtime build, migrations,
locked manifests, environment example, and this runbook; and writes these ignored local outputs:

- `artifacts/private-playtest/summonlab-fin008-private-playtest.tar.gz`;
- `artifacts/private-playtest/fin008-private-playtest-v1.receipt.json`.

The receipt records the exact Git commit, archive bytes, SHA-256, and release-report hash. FIN-008
completes only after the archive exists, the receipt verifies, and the private operator performs a
clean extraction/install/migration/start smoke test.

## Privacy and operation boundary

The archive excludes participant identities, recordings, direct quotations, raw notes, local
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
