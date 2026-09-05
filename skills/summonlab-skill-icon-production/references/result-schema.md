# Result contract

The final file uses the strict result schema matching its packet tuple: `skill-icon-result-v1` for
exact-source jobs, including current `skill-art` and `calibration-plate` work, and
`skill-icon-result-v2` for profile-v1/producer-v2, profile-v2/producer-v3,
profile-v3/producer-v4, and geometry-first/producer-v5 normalized `rarity-frame` and `backing`
retries, plus strict geometry-first/producer-v6 normalized `rarity-frame` and `backing` retries and
black-matte/producer-v7 normalized `rarity-frame` retries.
Unknown fields and mixed protocol versions are invalid.

## Required evidence

- `resultId`, `jobId`, and `assignmentId` bind the packet.
- Producer-authored `status` is `candidate`, `revise`, or `failed`—never `approved` or
  `superseded`.
- `exactPrompt` equals the immutable target string byte-for-byte; `promptHash` is its lowercase
  SHA-256 over UTF-8 bytes.
- `referenceInputs` exactly repeats every target reference path and hash in manifest order.
- `output` records the retained candidate or is `null` only for `failed`.
- `resultPath` and `writtenOutputPaths` name only the grant. With an output, the written tuple is
  `[candidatePath, resultPath]`; without one it is `[resultPath]`.
- `findings`, timestamps, and elapsed time report the job honestly.
- `noSharedFilesEdited` is exactly `true`; `selfPromoted` is exactly `false`.

Result-v2 also records a required discriminated `normalization` outcome. `completed` binds the
literal profile, raw geometry-file hash, pathless provider-source PNG media/dimensions/alpha/byte
count/hash, `sourceContentHash`, and `outputContentHash`. Source hash equals the provider evidence
hash; output hash equals the retained candidate hash. `failed` records honest observed source
metadata and no output hash; `not-run` has no source or output evidence. A retained `candidate` or
`revise` requires `completed`. A terminal result may record `completed` only when normalization
finished before a later validation or persistence failure. No normalization evidence has a provider
path field.

Profile-v2, profile-v3, both geometry-first revisions, and black-matte `completed` evidence
additionally bind
`decoderInputContentHash` to the exact canonical PNG submitted to the pinned decoder, `containerBox`
to the removed pathless
`{chunkType: "caBX", bytes, contentHash}` payload descriptor, and
`colorSpaceDisposition: "assigned-srgb"`. `providerSource.contentHash` and `sourceContentHash`
always hash the complete original provider PNG, including the container. `containerBox` never
contains a path or payload. A `failed` outcome records derived provenance only after the complete
canonical envelope exists: decoder hash, container evidence, and color disposition are either all
present and valid or all null. A `not-run` outcome always leaves all three null. Profile-v3 result
provenance has exactly this profile-v2 shape; only its profile literal and geometry-v2 hash differ,
while the guide-v2 authority remains bound through the immutable ordered target references and
matching `referenceInputs`. Geometry-first provenance has the same complete shape and geometry-v2
binding as profile v3; only its profile literal differs. Strict geometry-first provenance has that
same complete shape; its distinct literal authorizes the zero-offset retained-green clamp.
Black-matte provenance also has that same complete shape; its distinct frame-only literal authorizes
the opaque-black source contract, 4–16 alpha/unmatte calculation, and inward-only 4×4 geometry-v2
coverage.

The only `superseded` result is coordinator-authored evidence for an unattempted obsolete packet.
It has zero provider attempts, no output or failure reason, a `not-run` normalization outcome, the
literal reason `unattempted-packet-superseded-by-higher-revision`, and a
`supersedingAuthority` binding the exact target/assignment paths and hashes for the same role and
logical identity at a strictly higher revision. That authority must be a live structural-v2 packet
whose profile and producer skill version form a valid pair. This production skill may verify such
evidence but must never create it; use
the coordinator's supersession command.

A coordinator reprocess result uses `skill-icon-reprocess-result-v1` and is never a producer result.
It is rarity-frame-only; backing results are invalid. It repeats its own target and assignment paths
plus raw hashes, the complete `originAuthority`, and the distinct `processingAuthority`. Both
`candidate` and `failed` record
`generationAttemptCount: 0` and `normalizationTransactionCount: 1`; neither contains a prompt or
generation references. `candidate` carries completed profile-v3 normalization evidence, output
metadata bound to the retained bytes, and the ordered passing `full-size` and `recognition-96`
inspections. `failed` carries null output, a result-only write set, a failure reason, and honest
normalization/inspection evidence. The historical prompt remains bound only through the ordinary
origin execution. This producer and this verifier reject the reprocess target, assignment, and
result schemas; only `pnpm reprocess:skill-icon-provider-source` owns their persistence and
verification.

Those two inspection records come from the coordinator's required informed inspection arguments for
the deterministic output. They may turn a technically valid output into a failed result, but cannot
turn one into a candidate when the automated full-size role inspector fails or the generated
recognition derivative is not a valid 96×96 RGBA PNG. The 96-pixel record is informed recognition
evidence, not an attempt to run the 1024-pixel role geometry inspector against a resized asset.

The one normalization transaction is reserved before it starts and is never rerun after a crash.
If normalization and both inspections pass but no-replace candidate publication fails, a truthful
terminal result may be `failed` with `failureReason.kind: "persistence"`, completed normalization,
and both inspections still `pass`; do not invent a failed visual inspection. If that result cannot
be published safely, the coordinator retains the reservation and blocks rather than opening another
transaction.

Candidate output metadata must equal the retained bytes: versioned path, target media type and
dimensions, alpha mode, byte count, and lowercase SHA-256. Verification invokes the repository's
`inspectSkillIconAsset`: individual artwork must satisfy visible-area, safe-zone, exclusion, and
alpha rules; frames must satisfy aperture and six-edge registration; backings must satisfy aperture
coverage; calibration plates use their declared canvas and may be RGB. A candidate has no concern
or failure and explicitly passes both required views; unrelated role-inapplicable findings may
remain `not-applicable`. Every retained `candidate` or `revise` records automated full-size geometry
evidence and producer 96-pixel recognition evidence; `revise` also records at least one concern or
failure. `failed` retains no image and supplies a failed finding or structured `failureReason`.

## Persistence and verification

Run `pnpm persist:skill-icon-output` with the explicit provider source, target, and assignment paths;
v2 also requires the expected provider hash. The helper validates and exclusively creates the exact
candidate and initial result as one crash-recoverable transaction. It durably stages both complete
files, records their hashes and inode ownership in an authenticated journal under the cooperative
lock, then publishes both without replacement. On the next invocation, a dead coordinator's
authenticated transaction is rolled back only when every remaining pathname still has the recorded
hash and inode; changed or foreign state fails closed. V1 retains source bytes exactly. V2 reads the
provider file once through a no-follow descriptor and applies only its target-authorized
deterministic profile inside that transaction. Never copy, rename, convert, key, resize, mask, or
overwrite candidate bytes yourself.

Only the published journal authorizes cleanup. A crash before that boundary can leave an ignored,
transaction-unique private stage; because it has no durable inode authority, later runs preserve it
and use a new transaction ID instead of adopting or deleting it. Such residue is for coordinator
inspection, never producer cleanup.

The result schema intentionally has no attempt array. Supply the actual number of imagegen calls to
the verifier separately with `--attempt-count`; producer results require
`1..retryCeiling+1`, while coordinator-authored `superseded` evidence requires exactly `0`. The verifier invokes
the live Zod execution contract, recomputes reference and candidate hashes, parses PNG structure,
rejects symlinks, compares the result argument with the owned result file, and requires the complete
Git change set to equal the result's one or two written paths.

When provider failure, throttle, timeout, malformed output, persistence, or validation leaves no
role-valid image, do not call the image persistence helper and do not fabricate a candidate. From a
clean preflight state, durably stage, no-replace publish, and immediately verify the result-only
failure with the verifier's `--write-failure` path. Its Linux worker transaction keeps partial bytes
in an unnamed `O_TMPFILE`, then atomically publishes and exclusively locks a process-epoch owner
record that binds the complete result inode before exposing its recovery hard link. A concurrent
writer or recovery attempt rejects the held owner lock; a later invocation may recover only a dead
owner's exact inode and hash. Foreign or
changed names are retained and fail closed, and authority revalidation or post-write verification
may remove only the transaction-bound inode. For a v2
failure after provider bytes were received but deterministic normalization rejected them, add
`--normalization-source PROVIDER_PATH`; the helper stable-reads and hashes that source, records
pathless observed metadata with `normalization.outcome: "failed"`, and does not create a candidate.
Omit the flag when no provider bytes were received, which records
`normalization.outcome: "not-run"`.

The result-only failure transaction also participates in the coordinator supersession handshake.
Before publishing its owner record and again immediately after owner publication while holding the
owner lock, it requires the job's
`.<result filename>.skill-icon-supersession-intent.json` pathname to be wholly absent. Any regular,
symbolic-link, or otherwise occupied intent name makes the producer stop. If an intent wins the
race between those checks, the producer removes only its exact owner/stage inode and preserves the
coordinator intent unchanged.

Run:

```bash
python3 <skill-directory>/scripts/verify_result.py \
  TARGET ASSIGNMENT RESULT WORKSPACE_ROOT --attempt-count ACTUAL_CALLS \
  --write-failure --failure-kind FAILURE_KIND --failure-message "HONEST DETAIL" \
  --started-at ACTUAL_ISO_START \
  --completed-at ACTUAL_ISO_COMPLETION --total-wall-time-ms ACTUAL_ELAPSED_MS
```

For the observed-source v2 route, insert
`--normalization-source PROVIDER_PATH` before the timing flags.

This mode refuses either pre-existing output or any other repository change, writes only the
assigned result path with `output: null`, and verifies the strict execution and ownership contract.
`--normalization-source` is valid only for v2 packets and never persists the source path itself.
Supply the real start plus either completion or elapsed milliseconds; when both are supplied they
must agree exactly. The helper derives only the omitted value and rejects naive, reversed, or
inconsistent timing instead of synthesizing a zero-duration attempt. Derived completion preserves
sub-millisecond start precision, and final verification independently cross-checks elapsed time
against both timestamps for every result status.

If verification fails, report the failure for coordinator handling. The helpers roll back only
their own transaction-bound artifacts; producers must not delete, replace, promote, move, or repair
evidence by hand and must not touch shared files.
