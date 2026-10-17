# Private playtest release

`FIN-008` is a human-gated private package, not a deployment shortcut. The checked
`playtest-release-report-v2` derives four claims from the hash-bound FIN-007 report:

1. the FIN-007 content still matches its report hash;
2. the single owner playthrough is recorded and reviewed;
3. all eight required owner-journey checkpoints were reached;
4. the release recommendation is `candidate` with no unverified P0/P1 finding.

Run `pnpm validate:playtest-release` at any time. A held report is valid evidence: it explains why
packaging is forbidden. It does not mean FIN-008 is complete.

## Current production build rehearsal

After `pnpm build`, run `pnpm exec tsx tools/rehearse-production-build.ts`. CI runs this check against
the generated Vercel Build Output API version 3 artifact. It discovers the catchall function and its
configured Fetch handler, copies the traced function outside the repository while preserving its
internal dependency symlinks, and imports that copy in a separate production process.

The rehearsal creates a temporary PostgreSQL database, applies the built database migrations, and
requires the isolated web function and built worker to report the tested commit and an available
database. It checks the current player title, verifies that its referenced immutable JavaScript and
artwork exist inside the static output, and requires the development release desk to return 404.
The worker and migrations run from temporary copies of the compiled workspace packages, with
temporary package exports pointing to those bundles and third-party dependencies linked from the
installed workspace. The web function uses only its own isolated traced dependency tree.
It removes the temporary function copy and database and stops the worker after success or failure.
Its `production-build-rehearsal-report-v1` reports these artifact checks only; it does not verify a
private archive, production dependency installation, archive determinism, or release authorization.

## Historical Node package rehearsal

The Node archive procedure below requires an adapter-node build at `apps/web/build`. The current
Vercel adapter does not produce that directory, so `pnpm rehearse:playtest-package` and the private
archive packaging procedure are unsupported for the current production adapter. Their tooling,
tests, and human release gates are retained; a passing production build rehearsal does not qualify
or restore that archive workflow.

With an adapter-node build, `pnpm rehearse:playtest-package` uses the held report only as an assembly
input and is structurally separate from release authorization:

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
`commitBound: false`. Current CI uses the Vercel production build rehearsal described above.

## Historical Node packaging procedure

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
